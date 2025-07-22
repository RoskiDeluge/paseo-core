# Paseo

Paseo is an experimental runtime concept for deploying intelligent, stateful pods that serve as digital counterparts to real-world entities. These pods are lightweight, composable environments designed to provide access to compute, networking, and storage fundamentals. While Paseo is compatible with agentic workflows, its design generalizes to support a wider vision: enabling better alignment between real-world entities (humans, organizations, devices) and their operational representations in the digital world.

## Why Paseo?

Amid the rapid growth of agent-based systems and AI applications, many foundational needs remain unchanged: the need to represent, isolate, coordinate, and persist the actions and states of entities—be they people, teams, systems, or services. Paseo addresses this need by providing ephemeral yet durable execution environments called **pods**, powered by Cloudflare Workers and Durable Objects.

Paseo's goal is not to build agents, but to serve as an infrastructural substrate that allows any digital entity to act meaningfully and persistently across time and space.

## ✨ Key Features

- **Pods = Isolated micro-environments** for compute + state
- **Built on Cloudflare Workers + Durable Objects** for global reach and persistence
- **Composable via simple SDK**: use with or without LLMs
- **Supports ephemeral and long-lived interactions**
- **General-purpose**: works with agents, orgs, services, or humans-in-the-loop

## 📦 Installation

> **Note**: Paseo SDK will be published to npm soon.

Until then:

```bash
# Local install (assuming paseo-core directory is adjacent)
npm install ../paseo-core
```

## 🧠 Philosophy

Paseo is grounded in the belief that digital systems should not require premature commitment to AI-native workflows. Instead, the priority is to represent entities—human or non-human—in ways that preserve continuity, autonomy, and potential for growth. Inspired by Marvin Minsky's "Society of Mind," Paseo pods can form networks of co-operating intelligences, but begin simply as containers for structured memory and interaction.

Pods can live temporarily or persist indefinitely, accumulate experience, reflect decisions, or wait silently until needed. They can be used by agents—or serve as agents themselves. But most importantly, they can mirror the structure and complexity of the world, without being constrained by it.

## 🔧 Current Capabilities

- Persistent conversation and prompt/response history
- Read/write key-value data storage
- Retrieve full memory state

### Creating a Pod

Send a `POST` request to `/pods` to generate a new pod. The response contains the
randomly assigned `podName` which can then be used with the other endpoints.

## 🗺 Roadmap (Planned)

- CLI for local pod/dev environment management
- Automation for Worker + DO deployment
- Event hooks and background task scaffolding
- Pod relationships and federation (graph view)
- Identity/trust layer for inter-pod communication
- Optional LLM backends for enriched responses

