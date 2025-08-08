# Agent Guidelines for `paseo-core`

Conventions and tips for contributing to this repository.

## Development

- Run locally: `npm run dev` (alias of `wrangler dev`).
- Deploy: `npm run deploy` (uses `scripts/deploy-and-show.js`).
- Generate Cloudflare types: `npm run cf-typegen` updates `worker-configuration.d.ts` (do not edit manually).
- Run tests: `npm test` (Vitest + Cloudflare Workers pool). Tests live under `test/`.
- Prereqs: Node 18+, Wrangler v4 (`npx wrangler login`).

## Code Style

- TypeScript targeting `es2021` with `strict` enabled.
- Format with Prettier (repo config):
  - `printWidth`: 140, `singleQuote`: true, `semi`: true, `useTabs`: true
- `.editorconfig` enforces tabs and LF line endings.
- Keep changes focused and minimal; avoid one-letter identifiers and unnecessary abstractions.

## Project Layout

- `src/index.ts`: Worker entry. Routes pod/actor HTTP requests and proxies actor subpaths to the Durable Object.
- `src/actor-do.ts`: Durable Object implementation (class `ActorDO`). Handles seeding (`/__seed`), OpenAPI generation, and delegates to a handler.
- `src/handlers/store.ts`: Default handler implementing a schema-validated document store with optional indexed queries.
- `src/registry.ts`: Maps actor type/version (e.g. `store.v1`) to handler factories. Add new handlers here.
- `src/types.ts`: Shared types including `Env` (with `ACTOR_DO`) and `ActorConfig`.
- `src/paseo-pod.ts`: Legacy Durable Object kept for history; migrations remove it from active use.
- `examples/direct-api-usage.js`: End-to-end example using only HTTP requests (no SDK).
- `wrangler.jsonc`: Worker config, Durable Object binding (`ACTOR_DO` -> `ActorDO`), and migrations.
- `worker-configuration.d.ts`: Generated Cloudflare types (via `npm run cf-typegen`).

## Durable Objects & Migrations

- Active binding: `ACTOR_DO` (class `ActorDO`). Access via `env.ACTOR_DO`.
- Storage: uses the new SQLite-backed DO storage (`new_sqlite_classes`).
- Migrations (`wrangler.jsonc`):
  - `v1`: introduced legacy `PASEO_POD` (kept for history).
  - `v2`: removed `PASEO_POD`.
  - `v3`: introduced `ActorDO`.
- Handler schema management: handlers implement `ensureSchema(db, cfg)` to create/migrate their own tables and indexes. Prefer bumping the handler `version` (e.g. `store.v2`) for breaking changes.

## HTTP API Conventions

- Pods:
  - `POST /pods` → `{ podName }` (creates a pod ID).
  - `GET /pods/{podName}` → minimal status payload.
- Actors:
  - `POST /pods/{podName}/actors` with `{ config: ActorConfig }` → `{ actorId, openapi }` and seeds the DO via `.../__seed`.
  - `GET /pods/{podName}/actors/{actorId}/openapi.json` → actor-specific OpenAPI spec.
- Actor subroutes are proxied to the DO under `/pods/{podName}/actors/{actorId}/...`.

### Store Handler (`store.v1`)

- Endpoints:
  - `GET /.../items` → list items with pagination (`limit`, `after`).
  - `POST /.../items` → validate against `config.schema` and insert.
  - `GET /.../items/{itemId}` → fetch one item.
- Validation: basic JSON Schema → Zod conversion at runtime; invalid documents return `400` with issue details.
- Indexes: declare dotted paths in `config.indexes` (e.g. `data.type`). These are materialized as columns named `k_<path>` and become query params (e.g. `?k_data_type=note`).

## Testing

- Run: `npm test` (Vitest). Cloudflare worker pool is configured via `@cloudflare/vitest-pool-workers`.
- Location: `test/` with its own `tsconfig.json`.
- Keep tests aligned with the HTTP API; update or add tests when changing endpoints or behaviors.

## Commit Messages

- Use concise, imperative messages (e.g., "Add unit test" not "Added unit test").

## Misc

- `node_modules/` is gitignored; do not commit dependencies.
- Do not edit generated files (`worker-configuration.d.ts`). Re-generate with `npm run cf-typegen`.
- Always export Durable Object classes from `src/` so Wrangler can detect them.
