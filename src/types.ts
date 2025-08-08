// src/types.ts
export type ActorConfig = {
  actorType: "store";
  version: "v1";
  schema: Record<string, unknown>;   // JSON Schema / OpenAPI schema object
  indexes?: string[];                // e.g. ["run.id", "message.type"]
  params?: {
    retention_days?: number;
  };
};

export type Env = {
  ACTOR_DO: DurableObjectNamespace;
};
