// generate_fallback.mjs
import fs from "fs/promises";

const BASE = "https://swapi.py4e.com/api";

async function fetchUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url} ${res.status}`);
  return res.json();
}

async function fetchAllStarships() {
  let url = `${BASE}/starships/`;
  const all = [];
  while (url) {
    console.log("fetching starships", url);
    const j = await fetchUrl(url);
    all.push(...(j.results || []));
    url = j.next || null;
  }

  return all.map((s) => ({
    name: s.name,
    model: s.model,
    manufacturer: s.manufacturer,
    manufacturers: s.manufacturer
      ? s.manufacturer.split(",").map((x) => x.trim())
      : [],
    crew: s.crew,
    passengers: s.passengers,
    consumables: s.consumables,
    cargo_capacity: s.cargo_capacity,
    max_atmosphering_speed: s.max_atmosphering_speed,
    hyperdrive_rating: s.hyperdrive_rating,
    MGLT: s.MGLT,
    cost_in_credits: s.cost_in_credits,
    starship_class: s.starship_class,
    films: s.films, // still URLs; film_names resolver will deref
    url: s.url,
  }));
}

async function fetchAllFilms() {
  const url = `${BASE}/films/`;
  console.log("fetching films", url);
  const j = await fetchUrl(url);
  return (j.results || []).map((f) => ({
    title: f.title,
    episode_id: f.episode_id,
    director: f.director,
    producer: f.producer,
    release_date: f.release_date,
    opening_crawl: f.opening_crawl,
    url: f.url,
  }));
}

async function main() {
  const starships = await fetchAllStarships();
  const films = await fetchAllFilms();

  const out = { starships, films };

  await fs.writeFile("fallback.json", JSON.stringify(out, null, 2), "utf8");
  console.log(
    "wrote fallback.json with",
    starships.length,
    "starships and",
    films.length,
    "films"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
