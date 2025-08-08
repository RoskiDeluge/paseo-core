# Paseo Core

Paseo Core is a backend infrastructure for deploying stateful actors powered by Cloudflare Workers and Durable Objects. This repository provides the server-side implementation that powers the Paseo ecosystem, creating REST API endpoints for actor management, persistent storage, and state coordination.

**This is the backend component** - for client-side integration, use the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) repository which provides a simple interface to interact with these actor endpoints.

## What is Paseo Core?

Paseo Core serves as the foundational backend infrastructure for the Paseo ecosystem. It deploys Cloudflare Workers and Durable Objects that provide persistent, stateful execution environments organized into **pods** and **actors**.

**Pods** act as organizational containers that group related actors together. Each **actor** within a pod is an isolated Durable Object with its own state, storage, and configurable behavior patterns. The system comes with a built-in "store" actor type that provides schema-validated data storage, serving as both a practical tool and a reference pattern for developers building more complex actor behaviors.

This repository handles the server-side logic, nested API endpoints, and data persistence, while the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) provides the client-side tools for developers to easily interact with these backend services.


## ✨ Key Features

- **Cloudflare Workers Backend**: Global edge deployment for low-latency actor access
- **Durable Objects Integration**: Persistent state management and coordination for each actor
- **REST API Endpoints**: Clean HTTP interface for actor creation, interaction, and management
- **Stateful Pod Architecture**: Each actor maintains isolated memory and conversation history
- **SDK-Ready**: Designed to work seamlessly with [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) for client applications

## 📦 Setup & Deployment

This repository contains the backend infrastructure that needs to be deployed to Cloudflare Workers.

### Prerequisites
- Cloudflare account with Workers and Durable Objects enabled
- Node.js 18+ and npm

### Development Setup

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

### For Client Applications

To interact with your deployed Paseo Core backend, use the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk):

```bash
npm install paseo-sdk
```

## 🧠 Philosophy

Paseo is grounded in the belief that digital systems should not require premature commitment to AI-native workflows. Instead, the priority is to represent entities—human or non-human—in ways that preserve continuity, autonomy, and potential for growth. Inspired by Marvin Minsky's "Society of Mind," Paseo pods can form networks of co-operating intelligences, but begin simply as containers for structured memory and interaction.

Pods can live temporarily or persist indefinitely, accumulate experience, reflect decisions, or wait silently until needed. They can be used by agents—or serve as agents themselves. But most importantly, they can mirror the structure and complexity of the world, without being constrained by it.

## 🏗 Architecture Overview

```
┌─────────────────┐    HTTP/REST     ┌──────────────────┐
│   Client Apps   │ ◄──────────────► │   Paseo Core     │
│   (paseo-sdk)   │                  │   (Workers +     │
└─────────────────┘                  │   Durable        │
                                     │   Objects)       │
                                     └──────────────────┘
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
- **Composable Design**: Store actors serve as building blocks for more complex patterns

- **Paseo Core** (this repo): Backend infrastructure providing REST APIs
- **[Paseo SDK](https://github.com/RoskiDeluge/paseo-sdk)**: Client library for easy integration

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

### Usage with SDK

While you can interact with these endpoints directly, we recommend using the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) for a better developer experience:

Add the following to your .env file at the root of your project and replace the URL with the one deployed to Cloudflare:
```bash
PASEO_ENDPOINT=https://paseo-core.<your-account>.workers.dev
```

Then interact with pods and actors in your project:
```javascript
import { createPaseoClient } from "paseo-sdk";

const paseo = await createPaseoClient();

// Create a pod and actor
const pod = await paseo.createPod();
const actor = await paseo.createActor(pod.podName, {
  schema: {
    type: "object",
    properties: {
      message: { type: "string" },
      timestamp: { type: "number" }
    },
    required: ["message"]
  },
  indexes: ["timestamp"]
});

// Store and retrieve data
await actor.storeItem({ 
  message: "Hello from the actor!", 
  timestamp: Date.now() 
});

const items = await actor.listItems({ limit: 10 });
console.log("📦 Stored items:", items);

// Explore the actor's API
const apiSpec = await actor.getOpenAPI();
console.log("🔧 Actor capabilities:", apiSpec);
```

## 🗺 Roadmap

### Backend Infrastructure
- Enhanced Worker deployment automation
- Advanced actor lifecycle management
- Event hooks and background task processing
- Actor-to-actor communication protocols
- Enhanced security and authentication layers

### SDK & Client Tools
- CLI for local development and testing
- Advanced actor relationship management
- Federation and distributed actor networks
- Integration templates for common use cases

### Integration Features
- Webhook and event streaming support
- Enhanced monitoring and analytics
- Multi-tenant actor management

