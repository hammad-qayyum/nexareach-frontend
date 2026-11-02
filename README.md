# NexaReach Frontend

Next.js app for NexaReach, FastNexa's internal outreach tool. It is UI only: data, logic and permissions live in [nexareach-backend](https://github.com/hammad-qayyum/nexareach-backend). Read [CONTEXT.md](CONTEXT.md) first.

## Local development

Requires Node 22. Start the backend first (see its CONTEXT.md, "Local development"), so the API is on http://localhost:8000.

```bash
npm install
npm run dev          # http://localhost:3000, proxies /api/* to the backend
```

Set `API_PROXY_TARGET` to proxy to a different backend, for example `API_PROXY_TARGET=http://localhost:8001 npm run dev`.

Sign in with the admin created by `python -m app.cli create-admin`. Admins set up 2-step sign-in (an authenticator app) the first time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run gen:api` | Regenerate `src/lib/api/schema.d.ts` from the running backend's OpenAPI schema. Run it after any backend API change and commit the result. Set `API_SCHEMA_URL` to use another URL. |
