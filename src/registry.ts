// src/registry.ts
import type { ActorConfig, BaseActorConfig } from "./types";

export interface Handler<TConfig extends BaseActorConfig = ActorConfig> {
  ensureSchema(db: SqlStorage, cfg: TConfig): Promise<void>;
  handle(req: Request, db: SqlStorage, cfg: TConfig): Promise<Response>;
  openapi(cfg: TConfig, basePath: string): any; // returns OpenAPI JSON
}

import { storeHandlerFactory } from "./handlers/store";
export const registry: Record<string, (cfg: ActorConfig) => Handler> = {
  "store.v1": storeHandlerFactory,
};
