# Enrichment

CSV enrichment platform: upload a list, map its columns, and enrich the rows with cleaning operations, AI research and LeadOcean person/company lookups.

| Folder | What it is |
|---|---|
| `backend/` | TypeScript + Fastify API and job workers (Postgres, Redis/BullMQ). See `backend/CONTEXT.md`, `backend/ARCHITECTURE.md` and `backend/docs/adr/`. |
| `frontend/` | Next.js 15 dashboard. It proxies `/api/*` to the backend (`BACKEND_URL`, default `http://localhost:3000`). |
| `deploy/` | nginx config for the Docker stack. |
| `docker-compose.yml` | The whole stack: postgres, redis, migrate, backend, frontend, nginx. |
| `docs/deploy-vps.md` | Step-by-step VPS setup with Docker. |

## Run with Docker

```bash
cp .env.example .env          # fill in POSTGRES_PASSWORD, OPENAI_API_KEY, SITE_ORIGIN, …
docker run --rm httpd:2.4-alpine htpasswd -nbB tester 'a-strong-password' > deploy/nginx/htpasswd
docker compose up -d --build
```

Then open `http://localhost:${HTTP_PORT}/`. Sign in with the Basic Auth login first, then sign up in the app.

## Run for development (no Docker)

You need local Postgres and Redis.
- **Backend:** `cd backend && npm install && npm run build && npm run start:local`. It reads `backend/.env` and serves port 3000.
- **Frontend:** `cd frontend && npm install && npm run dev`. It serves port 3001.
- **Migrations:** apply `backend/infra/postgres/migrations/*.sql` in order.
- **Tests:** `cd backend && npx vitest run`.
