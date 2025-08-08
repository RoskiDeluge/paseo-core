// src/registry.ts
import type { ActorConfig } from "./types";

export interface Handler {
  ensureSchema(db: SqlStorage, cfg: ActorConfig): Promise<void>;
  handle(req: Request, db: SqlStorage, cfg: ActorConfig): Promise<Response>;
  openapi(cfg: ActorConfig, basePath: string): any; // returns OpenAPI JSON
}

import { storeHandlerFactory } from "./handlers/store";
export const registry: Record<string, (cfg: ActorConfig) => Handler> = {
  "store.v1": storeHandlerFactory,
};
