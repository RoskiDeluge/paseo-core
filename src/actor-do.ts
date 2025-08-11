// src/actor-do.ts
import type { ActorConfig, StoreActorConfig } from "./types";
import { registry } from "./registry";

export class ActorDO {
  private db!: SqlStorage;
  private cfg!: ActorConfig;
  private handler!: ReturnType<(typeof registry)["store.v1"]>;

  constructor(private state: DurableObjectState, private env: any) {}

  private async init() {
    if (!this.db) this.db = this.state.storage.sql;
    if (!this.cfg) {
      // default until seeded
      this.cfg = { 
        actorType: "store", 
        version: "v1", 
        schema: { type: "object" } 
      } as StoreActorConfig;
      const persisted = await this.state.storage.get<ActorConfig>("cfg");
      if (persisted) this.cfg = persisted;
      await this.state.storage.put("cfg", this.cfg);
    }
    if (!this.handler) {
      const key = `${this.cfg.actorType}.${this.cfg.version}`;
      const factory = registry[key];
      if (!factory) throw new Error(`unknown actor type: ${key}`);
      this.handler = factory(this.cfg);
      await this.handler.ensureSchema(this.db, this.cfg);
    }
  }

  async fetch(req: Request) {
    await this.init();
    const url = new URL(req.url);
    const path = url.pathname;

    // POST .../__seed
    if (path.endsWith("/__seed") && req.method === "POST") {
      const incoming = (await req.json().catch(() => ({}))) as Partial<ActorConfig>;
      this.cfg = { ...this.cfg, ...incoming } as ActorConfig;
      await this.state.storage.put("cfg", this.cfg);

      const factory = registry[`${this.cfg.actorType}.${this.cfg.version}`];
      this.handler = factory(this.cfg);
      await this.handler.ensureSchema(this.db, this.cfg);
      return new Response("ok");
    }

    // GET .../openapi.json
    if (path.endsWith("/openapi.json")) {
      // basePath = everything before /openapi.json
      const basePath = path.slice(0, -"/openapi.json".length);
      return Response.json(this.handler.openapi(this.cfg, basePath));
    }

    // Delegate to handler (items, etc.)
    return this.handler.handle(req, this.db, this.cfg);
  }
}
