import { DurableObject } from "cloudflare:workers";

interface ConversationTurn {
  prompt: string;
  response: string;
}

export class PASEO_POD extends DurableObject {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    switch (pathname) {
      case "/":
        return new Response("PaseoPod is alive.", { status: 200 });

      case "/get": {
        const key = searchParams.get("key");
        if (!key) return new Response("Missing key", { status: 400 });
        const value = await this.state.storage.get(key);
        return Response.json({ key, value });
      }

      case "/set": {
        const key = searchParams.get("key");
        const value = searchParams.get("value");
        if (!key || value === null) {
          return new Response("Missing key or value", { status: 400 });
        }
        await this.state.storage.put(key, value);
        return Response.json({ status: "ok", key, value });
      }

      case "/all": {
        const all = await this.state.storage.list();
        return Response.json(Object.fromEntries(all));
      }

      case "/llm": {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", { status: 405 });
        }

        let body: { prompt?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const prompt = body.prompt;
        if (!prompt) {
          return new Response("Missing 'prompt' in body", { status: 400 });
        }

        // Simulated LLM response
        const fakeResponse = `This is a simulated LLM response to: "${prompt}"`;

        const conversation =
          (await this.state.storage.get<ConversationTurn[]>("conversation")) || [];
        conversation.push({ prompt, response: fakeResponse });
        await this.state.storage.put("conversation", conversation);

        return Response.json({ response: fakeResponse });
      }

      case "/conversation": {
        const conversation =
          (await this.state.storage.get<ConversationTurn[]>("conversation")) || [];
        return Response.json({ conversation });
      }

      default:
        return new Response("Not Found", { status: 404 });
    }
  }
}
