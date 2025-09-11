# Paseo Core

Paseo Core is a complete backend infrastructure for deploying stateful actors powered by Cloudflare Workers and Durable Objects. This repository provides both the server-side implementation and direct HTTP API access for actor management, persistent storage, and state coordination.

**No SDK required** - Paseo Core provides a clean REST API that can be used directly with any HTTP client (curl, fetch, axios, etc.).

## What is Paseo Core?

Paseo Core serves as the foundational backend infrastructure for the Paseo ecosystem. It deploys Cloudflare Workers and Durable Objects that provide persistent, stateful execution environments organized into **pods** and **actors**.

**Pods** act as organizational containers that group related actors together. Each **actor** within a pod is an isolated Durable Object with its own state, storage, and configurable behavior patterns. The system comes with a built-in "store" actor type that provides schema-validated data storage, serving as both a practical tool and a reference pattern for developers building more complex actor behaviors.

Paseo Core provides a simple REST API that can be used directly with standard HTTP clients - no additional SDKs or libraries required.


## ✨ Key Features

- **Cloudflare Workers Backend**: Global edge deployment for low-latency actor access
- **Durable Objects Integration**: Persistent state management and coordination for each actor
- **REST API Endpoints**: Clean HTTP interface for actor creation, interaction, and management
- **Stateful Pod Architecture**: Each actor maintains isolated memory and conversation history
- **Direct HTTP Access**: No SDK required - use any HTTP client (curl, fetch, axios, etc.)

## 📦 Setup & Deployment

### Prerequisites
- Cloudflare account with Workers and Durable Objects enabled
- Node.js 18+ and npm

### Quick Start

```bash
# Clone and install dependencies
git clone https://github.com/RoskiDeluge/paseo-core
cd paseo-core
npm install

# Configure your Cloudflare credentials
npx wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

The deploy script will automatically:
- Deploy your worker to Cloudflare
- Create a default pod and store actor
- Show you ready-to-use API examples
- Provide environment variables for easy integration

### Testing Your Deployment

After deployment, you'll get output like this with ready-to-use examples:

```bash
📝 Store an item:
   curl -X POST https://your-worker.workers.dev/pods/{podName}/actors/{actorId}/items \
     -H "Content-Type: application/json" \
     -d '{"id":"demo-item","data":{"message":"Hello Paseo!"}}'

📄 List all items:
   curl https://your-worker.workers.dev/pods/{podName}/actors/{actorId}/items

🔍 Get a specific item:
   curl https://your-worker.workers.dev/pods/{podName}/actors/{actorId}/items/{itemId}
```

### Running the Example Script

We've included a complete example script that demonstrates all the core functionality:

```bash
# Set your environment variables (from deploy script output)
export PASEO_ENDPOINT="https://your-worker.workers.dev"
export PASEO_POD_NAME="your-pod-name"
export PASEO_ACTOR_ID="your-actor-id"

# Run the example
node examples/direct-api-usage.js
```

This script will:
- Connect to your deployed store actor
- Store sample items with different data structures
- List and filter items
- Demonstrate pagination and retrieval
- Show you environment variables for easy reuse

## 🧠 Philosophy

Pods and actors are designed as context engineering utilities. They can live temporarily or persist indefinitely, accumulate state, and provide a structured substrate for applications. Their primary purpose is to serve as the backbone for context-rich applications, mirroring the structure and complexity of the world without being constrained by it.

## 🏗 Architecture Overview

```
┌─────────────────┐    HTTP/REST     ┌──────────────────┐
│   Any HTTP      │ ◄──────────────► │   Paseo Core     │
│   Client        │                  │   (Workers +     │
│   (curl, fetch, │                  │   Durable        │
│    axios, etc.) │                  │   Objects)       │
└─────────────────┘                  └──────────────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │      Pods        │
                                     │  ┌─────────────┐ │
                                     │  │   Actor A   │ │
                                     │  │   (store)   │ │
                                     │  └─────────────┘ │
                                     │  ┌─────────────┐ │
                                     │  │   Actor B   │ │
                                     │  │   (store)   │ │
                                     │  └─────────────┘ │
                                     └──────────────────┘
```

**Architecture Principles:**
- **Pods**: Organizational containers that group related actors
- **Actors**: Individual Durable Objects with isolated state and configurable behavior  
- **Store Pattern**: Default actor implementation providing schema-validated data storage
- **HTTP-First Design**: Clean REST API accessible from any programming language
- **No Dependencies**: Use with any HTTP client - no special libraries required

## 🔧 API Architecture

Paseo Core implements a nested, hierarchical API structure that allows for organized, scalable actor management:

### Pod Management
- `POST /pods` - Create a new pod with a randomly assigned ID
- `GET /pods/{podName}` - Get pod status and basic information

### Actor Management (within pods)
- `POST /pods/{podName}/actors` - Create a new actor within a pod
- `GET /pods/{podName}/actors/{actorId}/openapi.json` - Get the OpenAPI specification for the actor

### Actor Data Operations
All actors are created with a default "store" handler that provides a simple, yet powerful data storage pattern:

- `GET /pods/{podName}/actors/{actorId}/items` - List stored items with optional filtering and pagination
- `POST /pods/{podName}/actors/{actorId}/items` - Store a validated document according to the actor's schema
- `GET /pods/{podName}/actors/{actorId}/items/{itemId}` - Retrieve a specific item by ID

### Store Actor Pattern

Each actor comes with a built-in "store" handler that serves as both a reference implementation and a practical starting point for developers and agents. The store provides:

**Schema Validation**: Define a JSON Schema when creating an actor to enforce data structure
```json
{
  "config": {
    "actorType": "store",
    "version": "v1", 
    "schema": {
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "timestamp": { "type": "number" },
        "metadata": { "type": "object" }
      },
      "required": ["message"]
    },
    "indexes": ["metadata.type", "timestamp"]
  }
}
```

**Indexed Querying**: Configure indexes on nested JSON properties for efficient filtering
```
GET /pods/{podName}/actors/{actorId}/items?k_metadata_type=chat&limit=10
```

**Pagination**: Built-in cursor-based pagination for large datasets
```
GET /pods/{podName}/actors/{actorId}/items?after=some-item-id&limit=50
```

### Current Backend Capabilities
- **Hierarchical Organization**: Pods contain multiple actors, each with isolated state
- **Schema-driven Storage**: JSON Schema validation with configurable indexes
- **Automatic OpenAPI Generation**: Each actor exposes its own API specification
- **Flexible Data Patterns**: The store actor serves as a foundation for more complex behaviors
- **Edge-optimized Performance**: Cloudflare Workers + Durable Objects for global low-latency access

### Usage with HTTP Clients

Paseo Core provides a clean REST API that works with any HTTP client. Here are some examples:

**Using curl:**
```bash
# Set your base URL (from deploy script output)
export PASEO_ENDPOINT="https://your-worker.workers.dev"
export POD_NAME="your-pod-name"
export ACTOR_ID="your-actor-id"

# Store an item
curl -X POST $PASEO_ENDPOINT/pods/$POD_NAME/actors/$ACTOR_ID/items \
  -H "Content-Type: application/json" \
  -d '{"id":"hello","data":{"message":"Hello World!","timestamp":'$(date +%s)'}}'

# List items
curl $PASEO_ENDPOINT/pods/$POD_NAME/actors/$ACTOR_ID/items

# Get a specific item
curl $PASEO_ENDPOINT/pods/$POD_NAME/actors/$ACTOR_ID/items/{itemId}
```

**Using JavaScript/Node.js:**
```javascript
const PASEO_ENDPOINT = "https://your-worker.workers.dev";
const POD_NAME = "your-pod-name";
const ACTOR_ID = "your-actor-id";

// Store an item
const response = await fetch(`${PASEO_ENDPOINT}/pods/${POD_NAME}/actors/${ACTOR_ID}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: "hello",
    data: { message: "Hello World!", timestamp: Date.now() }
  })
});
const result = await response.json();
console.log('Stored:', result);

// List items
const items = await fetch(`${PASEO_ENDPOINT}/pods/${POD_NAME}/actors/${ACTOR_ID}/items`);
const itemsList = await items.json();
console.log('Items:', itemsList);
```

**Using Python:**
```python
import requests

PASEO_ENDPOINT = "https://your-worker.workers.dev"
POD_NAME = "your-pod-name"
ACTOR_ID = "your-actor-id"

# Store an item
response = requests.post(
    f"{PASEO_ENDPOINT}/pods/{POD_NAME}/actors/{ACTOR_ID}/items",
    json={"id": "hello", "data": {"message": "Hello World!", "timestamp": 1234567890}}
)
print("Stored:", response.json())

# List items
items = requests.get(f"{PASEO_ENDPOINT}/pods/{POD_NAME}/actors/{ACTOR_ID}/items")
print("Items:", items.json())
```

## 🗺 Roadmap

### Core Infrastructure
- Create MCP Server 
- Advanced actor lifecycle management
- Event hooks and background task processing
- Actor-to-actor communication protocols
- Enhanced security and authentication layers

### Developer Experience
- More built-in actor types beyond "store"
- CLI tools for local development and testing
- Enhanced monitoring and analytics dashboard
- Integration templates and examples for common use cases

