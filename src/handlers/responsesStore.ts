// src/handlers/responsesStore.ts
import { z } from "zod";
import type { ResponsesStoreActorConfig } from "../types";
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

// OpenAI Response API optimized schema validation
function createResponsesZodSchema(): z.ZodType {
  const OutputItemSchema = z.object({
    type: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional(),
    role: z.enum(["assistant", "user", "system", "function"]).optional(),
    content: z.union([
      z.string(),
      z.array(z.object({
        type: z.string().optional(),
        text: z.string().optional(),
        annotations: z.array(z.any()).optional()
      }).catchall(z.any()))
    ]).optional(),
    text: z.string().optional(),
    function_call: z.any().optional(),
    tool_calls: z.array(z.any()).optional()
  }).catchall(z.any());

  return z.object({
    id: z.string(),
    object: z.literal("response"),
    created_at: z.number(),
    status: z.enum(["completed", "incomplete", "failed"]),
    error: z.any().nullable().optional(),
    incomplete_details: z.any().nullable().optional(),
    instructions: z.string().nullable().optional(),
    max_output_tokens: z.number().nullable().optional(),
    model: z.string(),
    output: z.array(OutputItemSchema),
    parallel_tool_calls: z.boolean().optional(),
    previous_response_id: z.string().nullable().optional(),
    reasoning: z.object({
      effort: z.string().nullable().optional(),
      summary: z.string().nullable().optional()
    }).optional(),
    store: z.boolean().optional(),
    temperature: z.number().optional(),
    text: z.object({
      format: z.object({
        type: z.enum(["text", "json"]).optional()
      }).optional()
    }).optional(),
    tool_choice: z.union([
      z.enum(["auto", "none"]),
      z.object({}).catchall(z.any())
    ]).optional(),
    tools: z.array(z.any()).optional(),
    top_p: z.number().optional(),
    truncation: z.enum(["enabled", "disabled"]).optional(),
    usage: z.object({
      input_tokens: z.number().optional(),
      input_tokens_details: z.object({
        cached_tokens: z.number().optional()
      }).optional(),
      output_tokens: z.number().optional(),
      output_tokens_details: z.object({
        reasoning_tokens: z.number().optional()
      }).optional(),
      total_tokens: z.number().optional()
    }).optional(),
    user: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }).catchall(z.any());
}

export function responsesStoreHandlerFactory(cfg: ResponsesStoreActorConfig): Handler<ResponsesStoreActorConfig> {
  const idxCols = (cfg.indexes ?? []).map(colName);
  const zodSchema = createResponsesZodSchema();
  const maxContentLength = cfg.params?.max_output_content_length ?? 1000;
  const enableContentSearch = cfg.params?.enable_content_search ?? true;

  return {
    async ensureSchema(db, cfg) {
      // meta
      await db.exec(`
        CREATE TABLE IF NOT EXISTS actor_meta(
          k TEXT PRIMARY KEY,
          v TEXT
        );
      `);

      // Check if we need to recreate the tables due to schema changes
      const currentIndexes = JSON.stringify((cfg.indexes ?? []).sort());
      const result = await db.exec("SELECT v FROM actor_meta WHERE k = 'indexes'");
      const rows = result.toArray();
      const storedIndexes = rows.length > 0 ? rows[0].v as string : null;
      
      if (storedIndexes !== currentIndexes) {
        // Schema changed, recreate the tables
        await db.exec("DROP TABLE IF EXISTS responses");
        await db.exec("DROP TABLE IF EXISTS response_outputs");
        
        // Store the new index configuration
        await db.exec("INSERT OR REPLACE INTO actor_meta(k, v) VALUES ('indexes', ?)", currentIndexes);
      }

      // main table: responses (optimized for OpenAI Response API)
      const idxCols = (cfg.indexes ?? []).map(colName);
      const extraCols = idxCols.map(c => `${c} TEXT`).join(", ");
      await db.exec(`
        CREATE TABLE IF NOT EXISTS responses(
          id TEXT PRIMARY KEY,
          response_id TEXT NOT NULL,
          ts INTEGER NOT NULL,
          schema_version TEXT,
          status TEXT NOT NULL,
          model TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          total_tokens INTEGER,
          body TEXT NOT NULL
          ${extraCols ? "," + extraCols : ""}
        );
      `);

      // Create dedicated table for indexing output array items
      await db.exec(`
        CREATE TABLE IF NOT EXISTS response_outputs(
          response_id TEXT NOT NULL,
          output_index INTEGER NOT NULL,
          output_type TEXT,
          output_role TEXT,
          output_content TEXT,
          output_status TEXT,
          content_tokens INTEGER,
          PRIMARY KEY(response_id, output_index)
        );
      `);

      // Indexes on main responses table
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_response_id ON responses(response_id);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_model ON responses(model);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_total_tokens ON responses(total_tokens);`);

      // Indexes for configured columns
      for (const c of idxCols) {
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_responses_${c} ON responses(${c});`);
      }

      // Indexes for output array searching
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_outputs_response_id ON response_outputs(response_id);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_outputs_type ON response_outputs(output_type);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_outputs_role ON response_outputs(output_role);`);
      if (enableContentSearch) {
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_outputs_content ON response_outputs(output_content);`);
      }
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_outputs_status ON response_outputs(output_status);`);
    },

    async handle(req, db, cfg) {
      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];

      // GET /actors/{id}/responses
      if (req.method === "GET" && last === "responses") {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
        const after = url.searchParams.get("after"); // pagination by response_id
        const filters = Object.fromEntries([...url.searchParams.entries()]
          .filter(([k]) => k.startsWith("k_"))); // filter by indexed fields

        // Support output array filtering
        const outputType = url.searchParams.get("output_type");
        const outputRole = url.searchParams.get("output_role");
        const outputContent = url.searchParams.get("output_content");
        const outputStatus = url.searchParams.get("output_status");

        // Support built-in response filtering
        const status = url.searchParams.get("status");
        const model = url.searchParams.get("model");
        const minTokens = url.searchParams.get("min_tokens");
        const maxTokens = url.searchParams.get("max_tokens");

        let where = [];
        let params: any[] = [];
        let joins = "";

        // Handle output array filters by joining with response_outputs table
        if (outputType || outputRole || outputContent || outputStatus) {
          joins = "JOIN response_outputs ro ON responses.response_id = ro.response_id";
          if (outputType) { where.push("ro.output_type = ?"); params.push(outputType); }
          if (outputRole) { where.push("ro.output_role = ?"); params.push(outputRole); }
          if (outputContent) { where.push("ro.output_content LIKE ?"); params.push(`%${outputContent}%`); }
          if (outputStatus) { where.push("ro.output_status = ?"); params.push(outputStatus); }
        }

        // Built-in response filters
        if (after) { where.push("responses.response_id > ?"); params.push(after); }
        if (status) { where.push("responses.status = ?"); params.push(status); }
        if (model) { where.push("responses.model = ?"); params.push(model); }
        if (minTokens) { where.push("responses.total_tokens >= ?"); params.push(parseInt(minTokens)); }
        if (maxTokens) { where.push("responses.total_tokens <= ?"); params.push(parseInt(maxTokens)); }

        // Custom index filters
        for (const [k, v] of Object.entries(filters)) { 
          where.push(`responses.${k} = ?`); 
          params.push(v as string); 
        }

        const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const q = `SELECT DISTINCT responses.id, responses.response_id, responses.ts, responses.schema_version, 
                          responses.status, responses.model, responses.created_at, responses.total_tokens, responses.body 
                   FROM responses ${joins} ${clause} 
                   ORDER BY responses.response_id ASC LIMIT ?`;
        
        const cursor = db.exec(q, ...params, limit);
        const results = cursor.toArray();
        return Response.json({
          responses: results.map((row: any) => ({ 
            id: row.id,
            response_id: row.response_id,
            ts: row.ts,
            status: row.status,
            model: row.model,
            created_at: row.created_at,
            total_tokens: row.total_tokens,
            body: JSON.parse(row.body) 
          })),
          next_after: results.length ? results[results.length - 1].response_id : null
        });
      }

      // POST /actors/{id}/responses
      if (req.method === "POST" && last === "responses") {
        try {
          const doc = await req.json().catch(() => null);
          if (!doc) {
            return Response.json({ error: "invalid_json" }, { status: 400 });
          }

          const result = zodSchema.safeParse(doc);
          if (!result.success) {
            return Response.json({ 
              error: "invalid_response_document", 
              details: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
            }, { status: 400 });
          }
          
          const validatedDoc = result.data;
          const docAsAny = validatedDoc as any;
          const id = crypto.randomUUID();
          const ts = Math.floor(Date.now() / 1000);

          // Extract main response fields
          const responseId = docAsAny.id;
          const status = docAsAny.status;
          const model = docAsAny.model;
          const createdAt = docAsAny.created_at;
          const totalTokens = docAsAny.usage?.total_tokens || null;

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

          const cols = ["id", "response_id", "ts", "schema_version", "status", "model", "created_at", "total_tokens", "body", ...Object.keys(values)];
          const marks = cols.map(() => "?").join(", ");
          const args = [id, responseId, ts, "v1", status, model, createdAt, totalTokens, JSON.stringify(validatedDoc), ...Object.values(values)];
          
          // Insert main response
          await db.exec(`INSERT INTO responses(${cols.join(",")}) VALUES (${marks})`, ...args);

          // Index output array
          if (docAsAny.output && Array.isArray(docAsAny.output)) {
            for (let i = 0; i < docAsAny.output.length; i++) {
              const outputItem = docAsAny.output[i];
              const outputType = outputItem.type || null;
              const outputRole = outputItem.role || null;
              const outputStatus = outputItem.status || null;
              
              // Extract text content from various possible structures
              let outputContent = null;
              let contentTokens = null;
              
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

              if (outputContent) {
                // Estimate token count (rough approximation: 1 token ~= 4 characters)
                contentTokens = Math.ceil(outputContent.length / 4);
                
                // Truncate for indexing if needed
                if (outputContent.length > maxContentLength) {
                  outputContent = outputContent.substring(0, maxContentLength);
                }
              }

              await db.exec(
                `INSERT INTO response_outputs(response_id, output_index, output_type, output_role, output_content, output_status, content_tokens) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                responseId, i, outputType, outputRole, outputContent, outputStatus, contentTokens
              );
            }
          }

          return Response.json({ 
            id, 
            response_id: responseId, 
            ts,
            outputs_indexed: docAsAny.output?.length || 0
          });
        } catch (error) {
          console.error("Error in responsesStore POST:", error);
          return Response.json({ 
            error: "internal_error", 
            message: error instanceof Error ? error.message : "Unknown error"
          }, { status: 500 });
        }
      }

      // GET /actors/{id}/responses/{responseId}
      if (req.method === "GET" && parts[parts.length - 2] === "responses") {
        const responseId = last;
        const cursor = db.exec("SELECT id, response_id, ts, schema_version, status, model, created_at, total_tokens, body FROM responses WHERE response_id = ?", responseId);
        const r = cursor.one();
        if (!r) return new Response("Response Not Found", { status: 404 });
        
        return Response.json({ 
          id: r.id,
          response_id: r.response_id,
          ts: r.ts,
          status: r.status,
          model: r.model,
          created_at: r.created_at,
          total_tokens: r.total_tokens,
          body: JSON.parse(r.body as string) 
        });
      }

      // GET /actors/{id}/responses/{responseId}/outputs - Get output array details
      if (req.method === "GET" && parts[parts.length - 1] === "outputs") {
        const responseId = parts[parts.length - 2];
        const cursor = db.exec(`
          SELECT output_index, output_type, output_role, output_status, content_tokens, 
                 CASE WHEN LENGTH(output_content) > 200 THEN SUBSTR(output_content, 1, 200) || '...' 
                      ELSE output_content END as output_content_preview
          FROM response_outputs 
          WHERE response_id = ? 
          ORDER BY output_index ASC
        `, responseId);
        
        const outputs = cursor.toArray();
        if (outputs.length === 0) {
          return new Response("Response Not Found", { status: 404 });
        }
        
        return Response.json({ response_id: responseId, outputs });
      }

      return new Response("Not Found", { status: 404 });
    },

    openapi(cfg, basePath) {
      // Enhanced spec optimized for OpenAI Response API structure
      const indexParams = (cfg.indexes ?? []).map(p => ({
        name: colName(p), 
        in: "query", 
        schema: { type: "string" }, 
        description: `filter on ${p}`
      }));

      // Built-in response filtering parameters
      const responseParams = [
        { name: "status", in: "query", schema: { type: "string", enum: ["completed", "incomplete", "failed"] }, description: "filter by response status" },
        { name: "model", in: "query", schema: { type: "string" }, description: "filter by model name" },
        { name: "min_tokens", in: "query", schema: { type: "integer" }, description: "minimum total tokens" },
        { name: "max_tokens", in: "query", schema: { type: "integer" }, description: "maximum total tokens" }
      ];

      // Output array filtering parameters
      const outputParams = [
        { name: "output_type", in: "query", schema: { type: "string" }, description: "filter by output item type" },
        { name: "output_role", in: "query", schema: { type: "string", enum: ["assistant", "user", "system", "function"] }, description: "filter by output item role" },
        { name: "output_content", in: "query", schema: { type: "string" }, description: "search in output content (partial match)" },
        { name: "output_status", in: "query", schema: { type: "string" }, description: "filter by output item status" }
      ];

      return {
        openapi: "3.1.0",
        info: { 
          title: "Paseo Responses Store Actor", 
          version: "0.1.0",
          description: "Specialized store actor for OpenAI Response API structures with advanced output array indexing and querying"
        },
        paths: {
          [`${basePath}/responses`]: {
            get: {
              summary: "List stored OpenAI responses with advanced filtering",
              description: "Supports filtering by response fields, indexed properties, and output array characteristics",
              parameters: [
                { name: "limit", in: "query", schema: { type: "integer", maximum: 200, default: 50 }, description: "maximum number of responses to return" },
                { name: "after", in: "query", schema: { type: "string" }, description: "pagination cursor (response_id)" },
                ...responseParams,
                ...indexParams,
                ...outputParams
              ],
              responses: { 
                "200": { 
                  description: "Successfully retrieved responses",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          responses: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string", description: "internal storage ID" },
                                response_id: { type: "string", description: "OpenAI response ID" },
                                ts: { type: "integer", description: "storage timestamp" },
                                status: { type: "string", enum: ["completed", "incomplete", "failed"] },
                                model: { type: "string", description: "model used" },
                                created_at: { type: "integer", description: "OpenAI creation timestamp" },
                                total_tokens: { type: "integer", nullable: true },
                                body: { type: "object", description: "full OpenAI response object" }
                              }
                            }
                          },
                          next_after: { type: "string", nullable: true, description: "pagination cursor for next page" }
                        }
                      }
                    }
                  }
                } 
              }
            },
            post: {
              summary: "Store an OpenAI Response API document",
              description: "Stores OpenAI Response API documents with automatic output array indexing for fast querying",
              requestBody: {
                required: true,
                content: { 
                  "application/json": { 
                    schema: {
                      type: "object",
                      required: ["id", "object", "created_at", "status", "model", "output"],
                      properties: {
                        id: { type: "string" },
                        object: { type: "string", enum: ["response"] },
                        created_at: { type: "integer" },
                        status: { type: "string", enum: ["completed", "incomplete", "failed"] },
                        model: { type: "string" },
                        output: {
                          type: "array",
                          items: { type: "object" }
                        }
                      },
                      additionalProperties: true
                    }
                  } 
                }
              },
              responses: { 
                "200": { 
                  description: "Successfully stored OpenAI response",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "internal storage ID" },
                          response_id: { type: "string", description: "OpenAI response ID" },
                          ts: { type: "integer", description: "storage timestamp" },
                          outputs_indexed: { type: "integer", description: "number of output items indexed" }
                        }
                      }
                    }
                  }
                },
                "400": {
                  description: "Invalid OpenAI response format",
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
          [`${basePath}/responses/{responseId}`]: {
            get: {
              summary: "Fetch a specific OpenAI response",
              parameters: [{ name: "responseId", in: "path", required: true, schema: { type: "string" }, description: "OpenAI response ID" }],
              responses: { 
                "200": { 
                  description: "Successfully retrieved response",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          response_id: { type: "string" },
                          ts: { type: "integer" },
                          status: { type: "string" },
                          model: { type: "string" },
                          created_at: { type: "integer" },
                          total_tokens: { type: "integer", nullable: true },
                          body: { type: "object", description: "full OpenAI response" }
                        }
                      }
                    }
                  }
                }, 
                "404": { description: "Response not found" } 
              }
            }
          },
          [`${basePath}/responses/{responseId}/outputs`]: {
            get: {
              summary: "Get indexed output array details for a response",
              parameters: [{ name: "responseId", in: "path", required: true, schema: { type: "string" }, description: "OpenAI response ID" }],
              responses: {
                "200": {
                  description: "Successfully retrieved output details",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          response_id: { type: "string" },
                          outputs: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                output_index: { type: "integer" },
                                output_type: { type: "string", nullable: true },
                                output_role: { type: "string", nullable: true },
                                output_status: { type: "string", nullable: true },
                                content_tokens: { type: "integer", nullable: true },
                                output_content_preview: { type: "string", nullable: true }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                "404": { description: "Response not found" }
              }
            }
          }
        }
      };
    }
  };
}
