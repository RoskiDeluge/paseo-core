# Paseo Core

Paseo Core is a backend infrastructure for deploying stateful actors powered by Cloudflare Workers and Durable Objects. This repository provides the server-side implementation that powers the Paseo ecosystem, creating REST API endpoints for actor management, persistent storage, and state coordination.

**This is the backend component** - for client-side integration, use the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) repository which provides a simple interface to interact with these actor endpoints.

## What is Paseo Core?

Paseo Core serves as the foundational backend infrastructure for the Paseo ecosystem. It deploys Cloudflare Workers and Durable Objects that provide persistent, stateful execution environments called **pods**. Each pod acts as a micro-environment with its own set of isolated actors, each of which contains logic, state, and storage capabilities.

This repository handles the server-side logic, API endpoints, and data persistence, while the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) provides the client-side tools for developers to easily interact with these backend services.


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
```

- **Paseo Core** (this repo): Backend infrastructure providing REST APIs
- **[Paseo SDK](https://github.com/RoskiDeluge/paseo-sdk)**: Client library for easy integration

## 🔧 API Endpoints

Once deployed, Paseo Core provides the following REST API endpoints:

### Pod Management
- `POST /pods` - Create a new actor with a randomly assigned ID
- `GET /pods/{actorName}` - Retrieve actor state and conversation history
- `POST /pods/{actorName}/messages` - Send messages to an actor
- `GET /pods/{actorName}/memory` - Access actor's key-value storage
- `PUT /pods/{actorName}/memory/{key}` - Store data in actor memory

### Current Backend Capabilities
- Persistent conversation and prompt/response history storage
- Key-value data storage per actor
- Full memory state retrieval and management
- Stateful actor lifecycle management

### Usage with SDK

While you can interact with these endpoints directly, we recommend using the [paseo-sdk](https://github.com/RoskiDeluge/paseo-sdk) for a better developer experience:

Add the following to your .env file at the root of your project and replace the URL with the one deployed to Cloudflare:
```bash
PASEO_ENDPOINT=https://paseo-core.<your-account>.workers.dev
```

Then create the client within your project like so:
```javascript
import { createPaseoClient } from "paseo-sdk";

const paseo = await createPaseoClient();

const reply = await paseo.sendPrompt("What's the current state of this entity?");
console.log("🤖", reply);

const history = await paseo.getConversation();
console.log("🧠", history);
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

