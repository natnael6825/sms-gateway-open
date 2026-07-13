# Deployment

## Backend variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Signs seven-day dashboard sessions |
| `ADMIN_EMAIL` | yes | Email for the single owner account |
| `ADMIN_PASSWORD` | yes | Initial owner password; minimum 12 characters |
| `PORT` | no | HTTP port, default `6700` |
| `CORS_ORIGIN` | recommended | Comma-separated dashboard origins |

Generate `JWT_SECRET` with a password manager or `openssl rand -hex 32`. The owner is created on first startup and must replace `ADMIN_PASSWORD` after first login. Changing the environment password later does not overwrite the database password. Run `npx prisma migrate deploy` on each release. The host must preserve PostgreSQL data; the API itself is stateless.

## Dashboard

Set `VITE_API_URL=https://your-api.example.com` in the build environment, run `npm ci && npm run build`, and host `dist` on a static service. Vite variables are build-time settings. Rebuild when the backend address changes.

Configure all unknown frontend routes to serve `index.html`. Add the exact dashboard origin to backend `CORS_ORIGIN`, with no path.

## Reverse proxy

Terminate HTTPS at Caddy, Nginx, Traefik, or your platform. Proxy the backend origin to port 6700 and keep `/health` publicly reachable for health checks. Do not expose PostgreSQL publicly.

## Upgrade

Back up PostgreSQL, pull the new source, install locked dependencies with `npm ci`, run `npx prisma migrate deploy`, rebuild the frontend, and restart the API.
