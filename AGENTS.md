# Agent Guidelines for `paseo-mvp`

This document contains conventions and tips for contributing to this project.

## Development

- **Run locally**: `npm run dev` (alias of `wrangler dev`).
- **Deploy**: `npm run deploy`.
- **Generate Cloudflare types**: `npm run cf-typegen` updates `worker-configuration.d.ts`. Do not manually edit this file.
- **Run tests**: `npm test` (uses `vitest`). Tests live under `test/`.

## Code Style

- TypeScript project targeting `es2021` with strict mode enabled.
- Format all files with [Prettier](https://prettier.io/) using the repo configuration:
  - `printWidth`: 140
  - `singleQuote`: true
  - `semi`: true
  - `useTabs`: true
- `.editorconfig` enforces tabs and LF line endings.
- Export Durable Object classes from `src/` so Wrangler can detect them.

## Commit Messages

Write concise messages in the imperative mood (e.g. "Add unit test" not "Added unit test").

## Misc

- Node dependencies are not committed (`node_modules/` is gitignored).
- `wrangler.jsonc` configures the `PASEO_POD` Durable Object. Adjust migrations when changing storage schema.

