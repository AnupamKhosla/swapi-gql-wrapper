# SWAPI GraphQL Wrapper

Created by Anupam khosla with the help of chatgpt. Original Star Wars API https://swapi-graphql.netlify.app/.netlify/graphql doesn't return full data for many field, such as, `manufacturers`, `crew`, `passengers` and `consumables` etc.


This project wraps the SWAPI REST mirror (`https://swapi.py4e.com/api`) with a GraphQL endpoint, exposing starship data (including `manufacturers`, `crew`, `passengers`, `consumables`, etc.).

**Deployed endpoint (serverless function)**  
`POST https://swapi-gql-wrapper.vercel.app/api/graphql`

User friendly ndpoint `/graphql` redirects to the above mentioned raw function path
`POST https://swapi-gql-wrapper.vercel.app/graphql`

## Quick curl example

Request the GraphQL server type name:

```bash
curl -s -X POST "https://swapi-gql-wrapper.vercel.app/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query{ __typename }"}' | jq

```
## Quick fetch example -- Run in browser console to test
```
fetch("https://swapi-gql-wrapper.vercel.app/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `
      query($name: String!) {
        starshipByName(name: $name) {
          name
          model
          crew
          passengers
          manufacturers
          consumables
          cost_in_credits
        }
      }
    `,
    variables: { name: "Star Destroyer" }
  })
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
```

## Local Development

To run both the Apollo GraphQL server (`localhost:4000/graphql`) and the static demo (`localhost:8080/index.html`) together:

```bash
npm install
npm install --save-dev concurrently
npm start
```
Then open `http://localhost:3000/` to see main example in action. 