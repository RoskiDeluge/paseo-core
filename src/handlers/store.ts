// src/handlers/store.ts
import { z } from "zod";
import type { ActorConfig } from "../types";
import type { Handler } from "../registry";

/** safe column label from "a.b.c" -> "k_a_b_c" */
const colName = (p: string) => "k_" + p.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 48);
const getPath = (obj: any, path: string) =>
  path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

// Convert JSON Schema to Zod schema (basic implementation)
function jsonSchemaToZod(schema: any): z.ZodType {
  if (schema.type === "object") {
    const shape: Record<string, z.ZodType> = {};
    const properties = schema.properties || {};
    const required = schema.required || [];
    
    for (const [key, propSchema] of Object.entries(properties)) {
      let zodType = jsonSchemaToZod(propSchema);
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }
      shape[key] = zodType;
    }
    
    return z.object(shape);
  } else if (schema.type === "string") {
    return z.string();
  } else if (schema.type === "number") {
    return z.number();
  } else if (schema.type === "boolean") {
    return z.boolean();
  } else if (schema.type === "array") {
    return z.array(jsonSchemaToZod(schema.items || {}));
  }
  
  // Fallback for unknown types
  return z.any();
}

export function storeHandlerFactory(cfg: ActorConfig): Handler {
  const idxCols = (cfg.indexes ?? []).map(colName);
  const zodSchema = jsonSchemaToZod(cfg.schema);

  return {
    async ensureSchema(db, cfg) {
      // meta
      await db.exec(`
        CREATE TABLE IF NOT EXISTS actor_meta(
          k TEXT PRIMARY KEY,
          v TEXT
        );
      `);

      // Check if we need to recreate the items table due to schema changes
      const currentIndexes = JSON.stringify((cfg.indexes ?? []).sort());
      const result = await db.exec("SELECT v FROM actor_meta WHERE k = 'indexes'");
      const rows = result.toArray();
      const storedIndexes = rows.length > 0 ? rows[0].v as string : null;
      
      if (storedIndexes !== currentIndexes) {
        // Schema changed, recreate the table
        await db.exec("DROP TABLE IF EXISTS items");
        
        // Store the new index configuration
        await db.exec("INSERT OR REPLACE INTO actor_meta(k, v) VALUES ('indexes', ?)", currentIndexes);
      }

      // base table: items
      // (generic indexed columns k_... are TEXT; we store raw JSON too)
      const idxCols = (cfg.indexes ?? []).map(colName);
      const extraCols = idxCols.map(c => `${c} TEXT`).join(", ");
      await db.exec(`
        CREATE TABLE IF NOT EXISTS items(
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          schema_version TEXT,
          body TEXT NOT NULL
          ${extraCols ? "," + extraCols : ""}
        );
      `);

      // simple indexes on configured columns
      for (const c of idxCols) {
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_${c} ON items(${c});`);
      }
    },

    async handle(req, db, cfg) {
      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];

      // GET /actors/{id}/items
      if (req.method === "GET" && last === "items") {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
        const after = url.searchParams.get("after"); // pagination by item id
        const filters = Object.fromEntries([...url.searchParams.entries()]
          .filter(([k]) => k.startsWith("k_"))); // filter by indexed fields: ?k_run_id=...

        let where = [];
        let params: any[] = [];
        if (after) { where.push("id > ?"); params.push(after); }
        for (const [k, v] of Object.entries(filters)) { where.push(`${k} = ?`); params.push(v as string); }
        const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const q = `SELECT id, ts, schema_version, body FROM items ${clause} ORDER BY id ASC LIMIT ?`;
        const cursor = db.exec(q, ...params, limit);
        const results = cursor.toArray();
        return Response.json({
          items: results.map((row: any) => ({ ...row, body: JSON.parse(row.body) })),
          next_after: results.length ? results[results.length - 1].id : null
        });
      }

      // POST /actors/{id}/items
      if (req.method === "POST" && last === "items") {
        const doc = await req.json().catch(() => null);
        const result = zodSchema.safeParse(doc);
        if (!result.success) {
          return Response.json({ 
            error: "invalid_document", 
            details: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
          }, { status: 400 });
        }
        const validatedDoc = result.data;
        const id = crypto.randomUUID();
        const ts = Math.floor(Date.now() / 1000);

        // extract configured indexes
        const values: Record<string, string | null> = {};
        for (const p of cfg.indexes ?? []) {
          const c = colName(p);
          const v = getPath(validatedDoc, p);
          values[c] = v == null ? null : String(v);
        }

        const cols = ["id", "ts", "schema_version", "body", ...Object.keys(values)];
        const marks = cols.map(() => "?").join(", ");
        const args = [id, ts, "v1", JSON.stringify(validatedDoc), ...Object.values(values)];
        await db.exec(`INSERT INTO items(${cols.join(",")}) VALUES (${marks})`, args);

        return Response.json({ id, ts });
      }

      // GET /actors/{id}/items/{itemId}
      if (req.method === "GET" && parts[parts.length - 2] === "items") {
        const itemId = last;
        const cursor = db.exec("SELECT id, ts, schema_version, body FROM items WHERE id = ?", itemId);
        const r = cursor.one();
        if (!r) return new Response("Not Found", { status: 404 });
        return Response.json({ ...r, body: JSON.parse(r.body as string) });
      }

      return new Response("Not Found", { status: 404 });
    },

    openapi(cfg, basePath) {
      // minimal, actor-specific spec embedding your provided schema
      return {
        openapi: "3.1.0",
        info: { title: "Paseo Store Actor", version: "0.1.0" },
        paths: {
          [`${basePath}/items`]: {
            get: {
              summary: "List stored items",
              parameters: [
                { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
                { name: "after", in: "query", schema: { type: "string" } },
                ...((cfg.indexes ?? []).map(p => ({
                  name: colName(p), in: "query", schema: { type: "string" }, description: `filter on ${p}`
                })))
              ],
              responses: { "200": { description: "OK" } }
            },
            post: {
              summary: "Store a validated document",
              requestBody: {
                required: true,
                content: { "application/json": { schema: cfg.schema } }
              },
              responses: { "200": { description: "Stored" } }
            }
          },
          [`${basePath}/items/{itemId}`]: {
            get: {
              summary: "Fetch one item",
              parameters: [{ name: "itemId", in: "path", required: true, schema: { type: "string" } }],
              responses: { "200": { description: "OK" }, "404": { description: "Not Found" } }
            }
          }
        }
      };
    }
  };
}
