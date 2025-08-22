// src/handlers/store.ts
import { z } from "zod";
import type { StoreActorConfig } from "../types";
import type { Handler } from "../registry";

/** safe column label from "a.b.c" -> "k_a_b_c" */
const colName = (p: string) => "k_" + p.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 48);
const getPath = (obj: any, path: string) =>
  path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

/** Extract values from dynamic output array for indexing */
const extractOutputValues = (doc: any, path: string): string[] => {
  const values: string[] = [];
  
  if (path.startsWith("output.")) {
    const outputArray = doc.output;
    if (Array.isArray(outputArray)) {
      const subPath = path.substring(7); // Remove "output." prefix
      
      for (let i = 0; i < outputArray.length; i++) {
        const value = getPath(outputArray[i], subPath);
        if (value != null) {
          values.push(String(value));
        }
      }
    }
  } else {
    // Handle non-output paths normally
    const value = getPath(doc, path);
    if (value != null) {
      values.push(String(value));
    }
  }
  
  return values;
};

// Convert JSON Schema to Zod schema with enhanced support for OpenAI Response structure
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
    if (schema.enum) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    return z.string();
  } else if (schema.type === "number" || schema.type === "integer") {
    return z.number();
  } else if (schema.type === "boolean") {
    return z.boolean();
  } else if (schema.type === "array") {
    return z.array(jsonSchemaToZod(schema.items || {}));
  } else if (schema.type === "null") {
    return z.null();
  } else if (schema.oneOf || schema.anyOf) {
    const variants = (schema.oneOf || schema.anyOf).map(jsonSchemaToZod);
    return z.union(variants as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  
  // Fallback for unknown types - use z.any() for maximum flexibility
  return z.any();
}

export function storeHandlerFactory(cfg: StoreActorConfig): Handler<StoreActorConfig> {
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
        await db.exec("DROP TABLE IF EXISTS output_index");
        
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

      // Create separate table for indexing output array items
      await db.exec(`
        CREATE TABLE IF NOT EXISTS output_index(
          item_id TEXT NOT NULL,
          output_index INTEGER NOT NULL,
          output_type TEXT,
          output_role TEXT,
          output_content TEXT,
          FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
        );
      `);

      // simple indexes on configured columns
      for (const c of idxCols) {
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_${c} ON items(${c});`);
      }

      // Indexes for output array searching
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_output_item_id ON output_index(item_id);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_output_type ON output_index(output_type);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_output_role ON output_index(output_role);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_output_content ON output_index(output_content);`);
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

        // Support output array filtering
        const outputType = url.searchParams.get("output_type");
        const outputRole = url.searchParams.get("output_role");
        const outputContent = url.searchParams.get("output_content");

        let where = [];
        let params: any[] = [];
        let joins = "";

        // Handle output array filters by joining with output_index table
        if (outputType || outputRole || outputContent) {
          joins = "JOIN output_index oi ON items.id = oi.item_id";
          if (outputType) { where.push("oi.output_type = ?"); params.push(outputType); }
          if (outputRole) { where.push("oi.output_role = ?"); params.push(outputRole); }
          if (outputContent) { where.push("oi.output_content LIKE ?"); params.push(`%${outputContent}%`); }
        }

        if (after) { where.push("items.id > ?"); params.push(after); }
        for (const [k, v] of Object.entries(filters)) { 
          where.push(`items.${k} = ?`); 
          params.push(v as string); 
        }

        const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const q = `SELECT DISTINCT items.id, items.ts, items.schema_version, items.body 
                   FROM items ${joins} ${clause} 
                   ORDER BY items.id ASC LIMIT ?`;
        
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
        const docAsAny = validatedDoc as any;
        const id = crypto.randomUUID();
        const ts = Math.floor(Date.now() / 1000);

        // extract configured indexes
        const values: Record<string, string | null> = {};
        for (const p of cfg.indexes ?? []) {
          const c = colName(p);
          if (p.startsWith("output.")) {
            // For output array paths, concatenate all values found
            const extractedValues = extractOutputValues(docAsAny, p);
            values[c] = extractedValues.length > 0 ? extractedValues.join("|") : null;
          } else {
            const v = getPath(validatedDoc, p);
            values[c] = v == null ? null : String(v);
          }
        }

        const cols = ["id", "ts", "schema_version", "body", ...Object.keys(values)];
        const marks = cols.map(() => "?").join(", ");
        const args = [id, ts, "v1", JSON.stringify(validatedDoc), ...Object.values(values)];
        
        // Insert main item
        await db.exec(`INSERT INTO items(${cols.join(",")}) VALUES (${marks})`, ...args);

        // Index output array if present
        if (docAsAny.output && Array.isArray(docAsAny.output)) {
          for (let i = 0; i < docAsAny.output.length; i++) {
            const outputItem = docAsAny.output[i];
            const outputType = outputItem.type || null;
            const outputRole = outputItem.role || null;
            
            // Extract text content from various possible structures
            let outputContent = null;
            if (outputItem.content) {
              if (typeof outputItem.content === "string") {
                outputContent = outputItem.content;
              } else if (Array.isArray(outputItem.content)) {
                // Handle content arrays (like OpenAI's structure)
                const textItems = outputItem.content
                  .filter((item: any) => item.type === "text" || item.type === "output_text")
                  .map((item: any) => item.text)
                  .filter(Boolean);
                outputContent = textItems.join(" ");
              }
            } else if (outputItem.text) {
              outputContent = outputItem.text;
            }

            if (outputContent && outputContent.length > 1000) {
              outputContent = outputContent.substring(0, 1000); // Truncate for indexing
            }

            await db.exec(
              `INSERT INTO output_index(item_id, output_index, output_type, output_role, output_content) 
               VALUES (?, ?, ?, ?, ?)`,
              id, i, outputType, outputRole, outputContent
            );
          }
        }

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
      // Enhanced spec with support for OpenAI Response API structure
      const indexParams = (cfg.indexes ?? []).map(p => ({
        name: colName(p), 
        in: "query", 
        schema: { type: "string" }, 
        description: `filter on ${p}`
      }));

      // Add output array filtering parameters
      const outputParams = [
        { name: "output_type", in: "query", schema: { type: "string" }, description: "filter by output item type" },
        { name: "output_role", in: "query", schema: { type: "string" }, description: "filter by output item role" },
        { name: "output_content", in: "query", schema: { type: "string" }, description: "search in output content (partial match)" }
      ];

      return {
        openapi: "3.1.0",
        info: { 
          title: "Paseo Store Actor", 
          version: "0.1.0",
          description: "Store actor optimized for OpenAI Response API structure with dynamic output array support"
        },
        paths: {
          [`${basePath}/items`]: {
            get: {
              summary: "List stored items with advanced filtering",
              description: "Supports filtering by indexed fields and output array properties",
              parameters: [
                { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
                { name: "after", in: "query", schema: { type: "string" } },
                ...indexParams,
                ...outputParams
              ],
              responses: { 
                "200": { 
                  description: "Successfully retrieved items",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                ts: { type: "integer" },
                                schema_version: { type: "string" },
                                body: { type: "object" }
                              }
                            }
                          },
                          next_after: { type: "string", nullable: true }
                        }
                      }
                    }
                  }
                } 
              }
            },
            post: {
              summary: "Store a validated document",
              description: "Stores documents conforming to OpenAI Response API structure with automatic output array indexing",
              requestBody: {
                required: true,
                content: { "application/json": { schema: cfg.schema } }
              },
              responses: { 
                "200": { 
                  description: "Successfully stored document",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          ts: { type: "integer" }
                        }
                      }
                    }
                  }
                },
                "400": {
                  description: "Invalid document format",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          error: { type: "string" },
                          details: { type: "array", items: { type: "string" } }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          [`${basePath}/items/{itemId}`]: {
            get: {
              summary: "Fetch one item",
              parameters: [{ name: "itemId", in: "path", required: true, schema: { type: "string" } }],
              responses: { 
                "200": { 
                  description: "Successfully retrieved item",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          ts: { type: "integer" },
                          schema_version: { type: "string" },
                          body: { type: "object" }
                        }
                      }
                    }
                  }
                }, 
                "404": { description: "Item not found" } 
              }
            }
          }
        }
      };
    }
  };
}
