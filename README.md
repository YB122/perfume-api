# perfume-api

Backend for the multi-vendor perfume marketplace.

- **Stack:** Bun + Hono + TypeScript, MongoDB (Mongoose), Redis (ioredis + BullMQ), Stripe (collection only), Cloudinary (signed uploads).
- **Docs:** live OpenAPI 3.1 spec at `GET /openapi.json` (run `bun src/openapi.ts` to dump `openapi.json`).
- **Polyrepo note:** all secrets live here (see `.env.example`). Frontends never receive Stripe secret keys or DB credentials.

## Setup

```bash
bun install
cp .env.example .env   # fill in real values
bun run dev            # http://localhost:4000
```

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Hot-reload dev server |
| `bun run start` | Production server |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | e2e/integration tests (`tests/e2e.test.ts`, spins up an in-memory MongoDB) |
| `bun run openapi` | Regenerate `openapi.json` |

## Security (defense-in-depth)

Applied globally in `src/middleware/security.ts` and `src/middleware/sanitize.ts`:

- **Helmet-equivalent headers** via `hono/secure-headers`.
- **CORS** restricted to the dashboard (`:5173`) and storefront (`:3000`) origins.
- **Compression** via `hono/compress`.
- **Rate limiting** — 120 req/min/IP (in-memory; switch to Redis for multi-instance).
- **NoSQL injection guard** — strips `$`/`.` operator keys and blocks IPs that probe with
  `$ne`, `$gt`, `DROP`, `UNION`, etc. (ported from the shared `detectInjection` module in
  `src/common/security/`). Suspicious IPs are blacklisted in Redis and logged via the
  Winston `securityLogger` (Africa/Cairo timezone) in `src/common/security/logger.ts`.
- **File uploads** — `POST /v1/uploads/image` validates real bytes with `file-type`
  (jpg/png/webp only) and enforces a 5MB cap before proxying to Cloudinary.
- **dotenv** loads `.env` at boot (`src/config/env.ts`).

## Key design points (from plan v2)

- **Payments:** Stripe collects; an internal Payout Engine settles vendors (plan 5.3).
- **Race conditions:** inventory reservations use an **atomic conditional `findOneAndUpdate`**
  with `$expr` (`src/services/inventory.service.ts`) — two customers buying the last unit can
  never both succeed (plan 3.1, req #7).
- **Orders:** multi-document MongoDB transaction (plan 3.2).
- **i18n:** `?lang=en|fr|ar` or `Accept-Language`; storefront endpoints return flattened strings.
- **RBAC:** `authMiddleware` -> `requireRole` -> `requireVendorOwnership` (prevents IDOR).

## Directory layout

```
src/
  config/      env, db, redis, cloudinary, logger
  models/      User, Vendor, Product, Category, Inventory, Order, PayoutBatch, Cart, Review
  lib/         jwt, auth (RBAC), i18n
  services/    commission, inventory, order, payment, auth
  jobs/        payout batch worker
  routes/      auth, products, cart, orders, uploads, webhooks, admin, reviews
  app.ts       router assembly + /openapi.json
  index.ts     entrypoint
```
