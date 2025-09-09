# SWAPI GraphQL Wrapper

Created by Anupam khosla with the help of chatgpt.


This project wraps the SWAPI REST mirror (`https://swapi.py4e.com/api`) with a GraphQL endpoint,
exposing starship data (including `manufacturers`, `crew`, `passengers`, `consumables`, etc.).

**Deployed endpoint (serverless function)**  
`POST https://swapi-gql-wrapper.vercel.app/graphql`

> If you'd rather call the raw function path, this also works:  
> `POST https://swapi-gql-wrapper.vercel.app/api/graphql`

---

## Quick curl example

Request the GraphQL server type name:

```bash
curl -s -X POST "https://swapi-gql-wrapper.vercel.app/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query{ __typename }"}' | jq