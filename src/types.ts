// src/types.ts

/**
 * Actor Configuration System
 * 
 * To add a new actor type:
 * 1. Create a new specific config type extending BaseActorConfig
 * 2. Add it to the ActorConfig union type
 * 3. Create a handler factory function that accepts the specific config
 * 4. Register it in the registry
 * 
 * Example:
 * ```typescript
 * export type ChatActorConfig = BaseActorConfig & {
 *   actorType: "chat";
 *   version: "v1";
 *   maxMessages?: number;
 *   allowedRoles?: string[];
 * };
 * 
 * // Then update ActorConfig union:
 * export type ActorConfig = StoreActorConfig | ChatActorConfig;
 * ```
 */

// Base actor configuration that all actors must have
export type BaseActorConfig = {
  actorType: string;
  version: string;
  schema: Record<string, unknown>;   // JSON Schema / OpenAPI schema object
};

// Store-specific configuration
export type StoreActorConfig = BaseActorConfig & {
  actorType: "store";
  version: "v1";
  indexes?: string[];                // e.g. ["run.id", "message.type"]
  params?: {
    retention_days?: number;
  };
};

// Union type for all possible actor configurations
// Add new actor config types here as they are created
export type ActorConfig = StoreActorConfig;

// Type helper to extract config type based on actor type and version
export type ConfigForActor<T extends string, V extends string> = 
  T extends "store" ? (V extends "v1" ? StoreActorConfig : never) : never;

export type Env = {
  ACTOR_DO: DurableObjectNamespace;
};
