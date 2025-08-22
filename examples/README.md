# Examples Directory

This directory contains working examples and documentation for the Paseo Core actor system, focusing on the store handlers.

## 📁 Files Overview

### 🚀 Working Demo Scripts
- **`demo.mjs`** - Interactive demo script for the generic store handler
- **`responses-demo.mjs`** - Interactive demo script for the responses store handler

### 📚 Documentation
- **`RESPONSES_STORE.md`** - Comprehensive documentation for the ResponsesStore handler
- **`README.md`** - This overview filetory

This directory contains working examples and documentation for the Paseo Core actor system, focusing on the store handlers.

## 📁 Files Overview

### � Working Demo Scripts
- **`demo.mjs`** - Interactive demo script for the generic store handler
- **`responses-demo.mjs`** - Interactive demo script for the responses store handler

### ⚙️ Configuration Examples
- **`openai-response-store-config.ts`** - Complete configuration example for the ResponsesStore handler

### 📚 Documentation
- **`RESPONSES_STORE.md`** - Comprehensive documentation for the ResponsesStore handler
- **`README.md`** - This overview file

## 🚀 Quick Start

### 1. Run the Generic Store Demo
```bash
# Set your Paseo endpoint
export PASEO_ENDPOINT="https://your-worker.workers.dev"

# Run the generic store demo
node examples/demo.mjs
```

### 2. Run the Responses Store Demo
```bash
# Set your Paseo endpoint (if not already set)
export PASEO_ENDPOINT="https://your-worker.workers.dev"

# Run the responses store demo
node examples/responses-demo.mjs
```

### 3. Use Configuration from Demo
The demo scripts contain complete configuration examples that you can reference:

```typescript
// From responses-demo.mjs - ResponsesStore configuration
const responsesActorConfig = {
  config: {
    actorType: 'responsesStore',
    version: 'v1',
    schema: { /* OpenAI Response API schema */ },
    indexes: ['id', 'status', 'model', 'output.type', 'output.role'],
    params: {
      retention_days: 30,
      max_output_content_length: 1000,
      enable_content_search: true
    }
  }
};
```

## 🎯 Handler Types

### Generic Store Handler (`store`)
- **Use for**: General document storage
- **Endpoints**: `/actors/{id}/items`
- **Demo**: `demo.mjs`
- **Best for**: Custom data structures, general documents

### Responses Store Handler (`responsesStore`) 
- **Use for**: OpenAI Response API data
- **Endpoints**: `/actors/{id}/responses`
- **Demo**: `responses-demo.mjs`
- **Best for**: AI response analysis, conversation storage, token tracking

## 📊 Key Features Comparison

| Feature | Generic Store | Responses Store |
|---------|---------------|-----------------|
| **Schema Validation** | Generic JSON | OpenAI Response API optimized |
| **Output Array Support** | Basic indexing | Advanced table with specialized queries |
| **Built-in Filters** | Custom indexes only | Status, model, tokens + custom |
| **Performance** | Good for general use | Optimized for response analysis |
| **Endpoints** | `/items` | `/responses` + `/responses/{id}/outputs` |
| **Content Search** | Limited | Full-text search in output content |

## 🔍 Example Queries

### Generic Store
```http
GET /actors/{id}/items?k_status=completed
GET /actors/{id}/items?output_type=message
```

### Responses Store
```http
GET /actors/{id}/responses?status=completed
GET /actors/{id}/responses?model=gpt-4o-2024-08-06
GET /actors/{id}/responses?output_type=message&output_role=assistant
GET /actors/{id}/responses?output_content=landscape
GET /actors/{id}/responses?min_tokens=100&max_tokens=500
```

## 📖 Learn More

- Read the **[Responses Store Documentation](./RESPONSES_STORE.md)** for detailed API reference
- Run both demo scripts to see the handlers in action
- Configuration examples are embedded in the demo scripts

## 🛠️ Getting Schemas

You don't need to manually maintain schemas - they're available from the handler endpoints:

```bash
# Get the OpenAPI schema for any actor
curl https://your-worker.workers.dev/pods/{podName}/actors/{actorId}/openapi.json
```
