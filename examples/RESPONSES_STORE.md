# Responses Store Handler

A specialized store handler optimized specifically for OpenAI Response API structures, providing advanced indexing and querying capabilities for response data with dynamic output arrays.

## Overview

The `responsesStore` handler is purpose-built for storing and querying OpenAI Response API documents. Unlike the generic `store` handler, it provides:

- **Specialized schema validation** for OpenAI Response API structure
- **Advanced output array indexing** with dedicated database tables
- **Built-in response filtering** by status, model, and token usage
- **Optimized query endpoints** with `/responses` paths instead of generic `/items`
- **Enhanced metadata extraction** from response structures

## Key Features

### 🎯 **OpenAI Response API Optimized**
- Native support for the complete OpenAI Response API structure
- Specialized Zod schema validation for response documents
- Automatic extraction of response metadata (status, model, tokens, etc.)

### 📊 **Dual Table Architecture**
1. **`responses` table**: Main response storage with extracted metadata
2. **`response_outputs` table**: Dedicated indexing for output array items

### 🔍 **Advanced Querying**
- **Built-in filters**: `status`, `model`, `min_tokens`, `max_tokens`
- **Output array filters**: `output_type`, `output_role`, `output_content`, `output_status`
- **Custom indexes**: Configure additional field indexing via `indexes` array
- **Content search**: Full-text search within output content

### 🚀 **Performance Optimized**
- Separate indexing table for fast output array queries
- Efficient joins between main and output tables
- Token count estimation and indexing
- Configurable content truncation for indexing

## Configuration

```typescript
import { ResponsesStoreActorConfig } from "../src/types";

const config: ResponsesStoreActorConfig = {
  actorType: "responsesStore",
  version: "v1",
  schema: openaiResponseSchema, // OpenAI Response API schema
  
  indexes: [
    "id",                    // Response ID
    "status",               // Response status
    "model",                // Model name
    "output.type",          // Output item types
    "output.role",          // Output item roles
    "metadata.session_id"   // Custom metadata fields
  ],
  
  params: {
    retention_days: 30,                    // Data retention policy
    max_output_content_length: 2000,       // Content indexing limit
    enable_content_search: true            // Enable content search indexing
  }
};
```

## API Endpoints

### Store Response
```http
POST /actors/{actorId}/responses
Content-Type: application/json

{
  "id": "resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41",
  "object": "response",
  "created_at": 1741476777,
  "status": "completed",
  "model": "gpt-4o-2024-08-06",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Response content here..."
        }
      ]
    }
  ],
  "usage": {
    "total_tokens": 150
  }
}
```

### Query Responses

#### Basic Filtering
```http
# Filter by status
GET /actors/{actorId}/responses?status=completed

# Filter by model
GET /actors/{actorId}/responses?model=gpt-4o-2024-08-06

# Filter by token usage
GET /actors/{actorId}/responses?min_tokens=100&max_tokens=500
```

#### Output Array Filtering
```http
# Filter by output type
GET /actors/{actorId}/responses?output_type=message

# Filter by output role
GET /actors/{actorId}/responses?output_role=assistant

# Search in output content
GET /actors/{actorId}/responses?output_content=landscape

# Filter by output status
GET /actors/{actorId}/responses?output_status=completed
```

#### Combined Queries
```http
# Complex filtering
GET /actors/{actorId}/responses?status=completed&model=gpt-4o&output_type=message&limit=20
```

#### Pagination
```http
# Paginated results
GET /actors/{actorId}/responses?limit=10&after=resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41
```

### Retrieve Specific Response
```http
GET /actors/{actorId}/responses/resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41
```

### Get Output Array Details
```http
GET /actors/{actorId}/responses/resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41/outputs
```

## Database Schema

### Main Table: `responses`
```sql
CREATE TABLE responses (
  id TEXT PRIMARY KEY,                    -- Internal storage ID
  response_id TEXT NOT NULL,              -- OpenAI response ID
  ts INTEGER NOT NULL,                    -- Storage timestamp
  schema_version TEXT,                    -- Schema version
  status TEXT NOT NULL,                   -- Response status
  model TEXT NOT NULL,                    -- Model used
  created_at INTEGER NOT NULL,            -- OpenAI creation timestamp
  total_tokens INTEGER,                   -- Token usage
  body TEXT NOT NULL,                     -- Full JSON response
  -- Dynamic index columns based on config
  k_* TEXT                               -- Configurable index columns
);
```

### Output Index Table: `response_outputs`
```sql
CREATE TABLE response_outputs (
  response_id TEXT NOT NULL,              -- Links to responses table
  output_index INTEGER NOT NULL,         -- Position in output array
  output_type TEXT,                       -- Type of output item
  output_role TEXT,                       -- Role (assistant, user, etc.)
  output_content TEXT,                    -- Extracted text content
  output_status TEXT,                     -- Status of output item
  content_tokens INTEGER,                 -- Estimated token count
  PRIMARY KEY(response_id, output_index)
);
```

## Response Format

### Store Response
```json
{
  "id": "uuid-v4",
  "response_id": "resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41",
  "ts": 1741476777,
  "outputs_indexed": 3
}
```

### Query Response
```json
{
  "responses": [
    {
      "id": "uuid-v4",
      "response_id": "resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41",
      "ts": 1741476777,
      "status": "completed",
      "model": "gpt-4o-2024-08-06",
      "created_at": 1741476777,
      "total_tokens": 150,
      "body": { /* full OpenAI response */ }
    }
  ],
  "next_after": "resp_next_cursor"
}
```

### Output Details Response
```json
{
  "response_id": "resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41",
  "outputs": [
    {
      "output_index": 0,
      "output_type": "message",
      "output_role": "assistant",
      "output_status": "completed",
      "content_tokens": 45,
      "output_content_preview": "The image depicts a scenic landscape..."
    }
  ]
}
```

## Registration

The handler is automatically registered in the system:

```typescript
// src/registry.ts
export const registry: Record<string, (cfg: ActorConfig) => Handler> = {
  "responsesStore.v1": (cfg: ActorConfig) => {
    if (cfg.actorType === "responsesStore") {
      return responsesStoreHandlerFactory(cfg);
    }
    throw new Error(`Invalid config for responsesStore.v1`);
  }
};
```

## Benefits vs Generic Store

| Feature | Generic Store | Responses Store |
|---------|---------------|-----------------|
| **Schema** | Generic JSON Schema | OpenAI Response API optimized |
| **Validation** | Basic Zod validation | Specialized response validation |
| **Endpoints** | `/items` | `/responses` |
| **Output Array** | Basic indexing | Dedicated table + advanced queries |
| **Built-in Filters** | Custom only | Status, model, tokens + custom |
| **Performance** | Good | Optimized for response queries |
| **Content Search** | Limited | Full-text search in outputs |
| **Token Tracking** | Manual | Automatic extraction + indexing |

## Use Cases

✅ **AI Application Logging**: Store and analyze OpenAI API responses  
✅ **Conversation Analytics**: Query by model, status, content  
✅ **Token Usage Tracking**: Monitor and analyze token consumption  
✅ **Content Discovery**: Search across response content  
✅ **Performance Monitoring**: Track response times and success rates  
✅ **A/B Testing**: Compare responses across different models  
✅ **Debugging**: Investigate specific response patterns or issues

The `responsesStore` handler provides a robust, high-performance solution for managing OpenAI Response API data in agentic applications.
