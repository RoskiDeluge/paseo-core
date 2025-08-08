# Gemini Guidelines for `paseo-core`

This document provides a summary of the `paseo-core` project to help Gemini assist with development.

## Project Overview

Paseo is an experimental runtime for deploying intelligent, stateful pods that serve as digital counterparts to real-world entities. It uses Cloudflare Workers and Durable Objects to provide isolated and persistent execution environments.

## Key Technologies

- **Runtime**: Cloudflare Workers
- **State Management**: Cloudflare Durable Objects
- **Language**: TypeScript
- **Validation**: Zod
- **Testing**: Vitest
- **Deployment**: Wrangler

## Development

- **Run locally**: `npm run dev`
- **Run tests**: `npm test`
- **Deploy**: `npm run deploy`
- **Generate Cloudflare types**: `npm run cf-typegen`

## Code Style

- **Formatting**: Prettier (`printWidth`: 140, `singleQuote`: true, `semi`: true, `useTabs`: true)
- **Line Endings**: LF
- **Exports**: Durable Object classes must be exported from `src/` for Wrangler to detect them.

## Project Structure

- `src/`: Main source code.
  - `index.ts`: Entry point for the Cloudflare Worker.
  - `actor-do.ts`: Implementation of the Durable Object.
- `test/`: Vitest tests.
- `wrangler.jsonc`: Configuration for the Cloudflare Worker and Durable Objects.
- `package.json`: Project dependencies and scripts.