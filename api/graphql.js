// api/graphql.js — Apollo Server v5 + @as-integrations/next + explicit CORS wrapper
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { LRUCache } from "lru-cache";
import fs from "fs";
import path from "path";

// --- Config ---
const REST_BASE = "https://swapi.py4e.com/api2";
const FALLBACK_PATH = path.join(process.cwd(), "fallback.json");
const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 5 });

// --- Load fallback synchronously to avoid top-level await issues in some runtimes ---
let FALLBACK_DATA = [];
try {
  if (fs.existsSync(FALLBACK_PATH)) {
    const raw = fs.readFileSync(FALLBACK_PATH, "utf8");
    FALLBACK_DATA = JSON.parse(raw || "[]");
  }
} catch (e) {
  console.warn("Could not load fallback.json:", e?.message || e);
}

// --- Schema ---
const typeDefs = `#graphql
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
  film_names: [Film]
  url: String
  dataWarning: String
}
type Film {
  title: String
  episode_id: Int
  director: String
  release_date: String
}

type StarshipEdge { node: Starship }
type StarshipConnection { edges: [StarshipEdge], count: Int }

type Query {
  allStarships(page: Int): StarshipConnection
  starshipById(id: ID!): Starship
  starshipByName(name: String!): Starship
  filmById(id: ID!): Film
  allFilms: [Film]
}
`;

// --- Helpers ---
async function cachedFetch(url) {
  const key = url;
  if (cache.has(key)) return { json: cache.get(key), warning: null };

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${txt}`);
    }
    const json = await res.json();
    cache.set(key, json);
    return { json, warning: null };
  } catch (err) {
    console.warn("REST fetch failed for", url, err?.message || err);

    let fallbackMatch = null;

    // Old style: fallback.json was a flat array of starships
    if (Array.isArray(FALLBACK_DATA)) {
      fallbackMatch =
        FALLBACK_DATA.find(
          (s) =>
            (s.url &&
              url.endsWith(
                s.url.replace("https://swapi.py4e.com/api", "").replace(/^\/+/, "")
              )) ||
            url === s.url
        ) || null;
    }

    // New style: structured { starships: [], films: [] }
    if (!fallbackMatch && FALLBACK_DATA.starships) {
      fallbackMatch =
        FALLBACK_DATA.starships.find((s) => s.url === url) || null;
    }
    if (!fallbackMatch && FALLBACK_DATA.films) {
      fallbackMatch =
        FALLBACK_DATA.films.find((f) => f.url === url) || null;
    }

    // Handle search queries (?search=)
    if (!fallbackMatch && url.includes("?search=")) {
      const qp = url.split("?")[1];
      try {
        const params = new URLSearchParams(qp);
        const name = params.get("search");
        if (name) {
          const pool = FALLBACK_DATA.starships || FALLBACK_DATA;
          fallbackMatch = pool.find(
            (s) =>
              s.name &&
              s.name.toLowerCase() === decodeURIComponent(name).toLowerCase()
          );
        }
      } catch (e) {}
    }

    // As a last resort, take the first entry
    const pool = FALLBACK_DATA.starships || FALLBACK_DATA;
    if (!fallbackMatch && pool.length > 0) {
      fallbackMatch = pool[0];
    }


    if (fallbackMatch) {
      const isCollection =
        url.includes("/starships/") &&
        (url.includes("?") || url.endsWith("/starships/") || url.includes("/starships/?"));

      if (isCollection) {
        // Return ALL starships from fallback, not just one
        const pool = FALLBACK_DATA.starships || FALLBACK_DATA;
        return { json: { results: pool }, warning: "served-from-fallback-json" };
      }

      const faux = fallbackMatch;
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
      ? r.manufacturer.split(",").map((s) => s.trim())
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
    dataWarning: warning || null,
  };
}

// --- Resolvers ---
const resolvers = {
  Query: {
    allStarships: async (_, { page = 1 }) => {
      const url = `${REST_BASE}/starships/?page=${page}`;
      const { json, warning } = await cachedFetch(url);
      const edges = (json.results || []).map((r) => ({
        node: mapRestStarship(r, warning),
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
    },
    filmById: async (_, { id }) => {
      const url = `https://swapi.dev/api/films/${id}/`;
      const { json, warning } = await cachedFetch(url);
      return {
        ...json,
        dataWarning: warning || null,
      };
    },
    allFilms: async () => {
      const url = `https://swapi.dev/api/films/`;
      const { json, warning } = await cachedFetch(url);
      return (json.results || []).map((f) => ({
        ...f,
        dataWarning: warning || null,
      }));
    },
  },
  Starship: {
    film_names: async (parent) => {
      if (!parent.films || parent.films.length === 0) return [];
      return Promise.all(
        parent.films.map(async (url) => {
          try {
            const { json } = await cachedFetch(url);
            return {
              title: json.title,
              episode_id: json.episode_id,
              director: json.director,
              release_date: json.release_date,
            };
          } catch (err) {
            console.warn("Film fetch failed:", url, err?.message || err);
            return null;
          }
        })
      ).then((results) => results.filter(Boolean));
    },
  },
};

// --- Apollo server instance ---
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

// --- Next-compatible handler ---
const nextHandler = startServerAndCreateNextHandler(server, {
  context: async ({ req }) => ({ req }),
});

// --- Export handler with CORS ---
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  return nextHandler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
