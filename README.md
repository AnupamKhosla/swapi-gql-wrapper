# SWAPI GraphQL Wrapper

Created by Anupam khosla with the help of chatgpt.

This project wraps the SWAPI REST mirror (`https://swapi.py4e.com/api`) with a GraphQL endpoint,
exposing starship data (including `manufacturers`, `crew`, `passengers`, `consumables`, etc.).

## Endpoints

- GraphQL (serverless): `POST https://<your-domain>/api/graphql`
- Friendly path (with rewrite): `POST https://<your-domain>/graphql` (if `vercel.json` added)

## Example Query

```bash
curl -s -X POST "https://<your-domain>/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query{ starshipByName(name:\"Star Destroyer\"){ name crew manufacturers passengers consumables dataWarning } }"}' | jq
