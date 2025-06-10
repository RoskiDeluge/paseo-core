# 🚘 Paseo

**Lightweight ephemeral environments for agentic workflows**

---

## 🌱 What is Paseo?

**Paseo** is an SDK and runtime that enables developers to spawn **ephemeral, intelligent “pods”**—self-contained, networked, and persistent micro-environments for agents.

Inspired by Marvin Minsky’s *Society of Mind*, Paseo envisions intelligence not as a monolith, but as a **dynamic constellation of lightweight, specialized minds**—each working in isolation or in collaboration to accomplish a goal.

These pods give agents on-demand access to:

* 🧠 **Compute** (via Cloudflare Workers)
* 📀 **Memory** (via Durable Objects with persistent SQLite)
* 🌐 **Networking** (auto-addressable APIs)
* 🕵️ **Observability** (logs, memory snapshots, identity)

Each pod becomes a **living thread** of cognition—stateful, inspectable, and composable.

---

## 🧹 Why Paseo?

Agentic applications today lack **first-class execution environments** designed for:

* short-lived, **task-specific computation**
* built-in memory that is scoped and persistent
* modular, inter-agent communication
* seamless deployment and scalability

Paseo provides these environments with:

* ✅ Web-native primitives (Cloudflare infrastructure)
* ✅ Minimal setup (no Docker, no VM orchestration)
* ✅ Portable SDK for declaring and interacting with pods
* ✅ Future-proofing: agents can scale across a planetary mesh


## 📦 Architecture Overview

* **Paseo SDK**: Developer interface to define, deploy, and interact with pods
* **Paseo Runtime (Cloudflare)**:

  * **Workers** serve as the execution surface for pods
  * **Durable Objects** provide stateful storage with embedded SQLite
* **Pod Interface**:

  * Every pod has a RESTful endpoint
  * Optionally memory-enabled and state-persistent
  * May communicate with other pods or be orchestrated centrally

---

## 🔮 Roadmap

### MVP Goals

* [x] Deploy a single pod with persistent memory
* [x] Stub out agent logic for proof-of-concept
* [ ] Add CLI support for spinning up and inspecting pods
* [ ] Document pod lifecycles and security model


## 🧠 Philosophy

Paseo reflects a shift in how we think about agents—not as single massive brains, but as **ecosystems of computation**. As LLMs grow more capable, what we’ll need isn’t smarter agents—but **better ground** for them to stand on. Paseo is that ground.

It’s not about making the smartest brain, but about letting many small minds do their part—safely, observably, and at scale.

---

## 📬 Get Involved

This project is early and exploratory. If you’re interested in:

* agent architectures
* serverless and edge infrastructure
* programmable memory
* or building the future substrate for AI
