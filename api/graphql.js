// api/graphql.js - Vercel serverless ESM function
import { ApolloServer } from "apollo-server-micro";
import { gql } from "apollo-server-core";
import LRU from "lru-cache";
import fs from "fs/promises";
import path from "path";

const REST_BASE = "https://swapi.py4e.com/api";
const FALLBACK_PATH = path.join(process.cwd(), "fallback.json");
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 });

let FALLBACK_DATA = [];
try {
  const raw = await fs.readFile(FALLBACK_PATH, "utf8").catch(() => null);
  if (raw) FALLBACK_DATA = JSON.parse(raw);
  console.log("Loaded fallback.json entries:", FALLBACK_DATA.length);
} catch (e) {
  console.warn("Could not load fallback.json:", e.message);
}

const typeDefs = gql`
  type Starship {
    id: ID
    name: String
    model: String
    starship_class: String
    manufacturers: [String]
    manufacturer_raw: String

    length: String
    crew: String
    passengers: String
    cost_in_credits: String
    consumables: String

    max_atmosphering_speed: String
    cargo_capacity: String
    hyperdrive_rating: String
    MGLT: String

    films: [String]
    url: String
    dataWarning: String
  }

  type StarshipEdge {
    node: Starship
  }

  type StarshipConnection {
    edges: [StarshipEdge]
    count: Int
  }

  type Query {
    allStarships(page: Int): StarshipConnection
    starshipById(id: ID!): Starship
    starshipByName(name: String!): Starship
  }
`;

async function cachedFetch(url) {
  const key = url;
  if (cache.has(key)) return { json: cache.get(key), warning: null };

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status} ${txt}`);
    }
    const json = await res.json();
    cache.set(key, json);
    return { json, warning: null };
  } catch (err) {
    console.warn("REST fetch failed for", url, err.message);

    let fallbackMatch = null;
    fallbackMatch = FALLBACK_DATA.find(
      s =>
        (s.url &&
          url.endsWith(
            s.url.replace("https://swapi.py4e.com/api", "").replace(/^\/+/, "")
          )) ||
        url === s.url
    );

    if (!fallbackMatch && url.includes("?search=")) {
      const qp = url.split("?")[1];
      try {
        const params = new URLSearchParams(qp);
        const name = params.get("search");
        if (name)
          fallbackMatch = FALLBACK_DATA.find(
            s =>
              s.name &&
              s.name.toLowerCase() === decodeURIComponent(name).toLowerCase()
          );
      } catch (e) {}
    }

    if (!fallbackMatch && FALLBACK_DATA.length > 0)
      fallbackMatch = FALLBACK_DATA[0];

    if (fallbackMatch) {
      const isCollection =
        url.includes("/starships/") &&
        (url.includes("?") ||
          url.endsWith("/starships/") ||
          url.includes("/starships/?"));
      const faux = isCollection
        ? { results: [fallbackMatch] }
        : fallbackMatch;
      return { json: faux, warning: "served-from-fallback-json" };
    }

    throw err;
  }
}

function mapRestStarship(rest, warning = null) {
  if (!rest) return null;
  const r = rest.results ? rest.results[0] : rest;
  return {
    id: r.url || null,
    name: r.name || null,
    model: r.model || null,
    starship_class: r.starship_class || null,
    manufacturer_raw: r.manufacturer || null,
    manufacturers: r.manufacturer
      ? r.manufacturer.split(",").map(s => s.trim())
      : null,
    length: r.length || null,
    crew: r.crew || null,
    passengers: r.passengers || null,
    cost_in_credits: r.cost_in_credits || null,
    consumables: r.consumables || null,
    max_atmosphering_speed: r.max_atmosphering_speed || null,
    cargo_capacity: r.cargo_capacity || null,
    hyperdrive_rating: r.hyperdrive_rating || null,
    MGLT: r.MGLT || null,
    films: r.films || null,
    url: r.url || null,
    dataWarning: warning || null
  };
}

const resolvers = {
  Query: {
    allStarships: async (_, { page = 1 }) => {
      const url = `${REST_BASE}/starships/?page=${page}`;
      const { json, warning } = await cachedFetch(url);
      const edges = (json.results || []).map(r => ({
        node: mapRestStarship(r, warning)
      }));
      return { edges, count: json.count || edges.length };
    },
    starshipById: async (_, { id }) => {
      const url = String(id).startsWith("http")
        ? id
        : `${REST_BASE}/starships/${id}/`;
      const { json, warning } = await cachedFetch(url);
      return mapRestStarship(json, warning);
    },
    starshipByName: async (_, { name }) => {
      const url = `${REST_BASE}/starships/?search=${encodeURIComponent(name)}`;
      const { json, warning } = await cachedFetch(url);
      if (!json || (json.results && json.results.length === 0)) return null;
      return mapRestStarship(json, warning);
    }
  }
};

// Create Apollo server - disable persistedQueries to avoid unbounded cache warning
// Create Apollo server - disable persistedQueries to avoid unbounded cache warning
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  persistedQueries: false,
});

let serverHandler;
export default async function handler(req, res) {
  if (!serverHandler) {
    await server.start();
    serverHandler = server.createHandler({
      cors: {
        origin: '*',  // allow all domains
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'OPTIONS'],
      },
    });
  }
  return serverHandler(req, res);
}

export const config = { api: { bodyParser: false } };
