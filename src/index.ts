// src/index.ts
import type { Env, ActorConfig } from "./types";
export { ActorDO } from "./actor-do";

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);

    // POST /pods -> create a pod
    if (req.method === "POST" && parts[0] === "pods" && parts.length === 1) {
      const podName = crypto.randomUUID();
      // Optional: warm-up or record pod metadata somewhere if you like
      return Response.json({ podName });
    }

    // GET /pods/{podName} -> pod status
    if (req.method === "GET" && parts[0] === "pods" && parts[1] && parts.length === 2) {
      const podName = parts[1];
      // Minimal status for now
      return Response.json({ podName, status: "ok" });
    }

    // POST /pods/{podName}/actors -> create actor inside pod
    if (req.method === "POST" && parts[0] === "pods" && parts[1] && parts[2] === "actors" && parts.length === 3) {
      const podName = parts[1];
	  const body = await req.json().catch(() => ({})) as { config?: ActorConfig };
      const actorId = crypto.randomUUID();
      const actorKey = `${podName}:${actorId}`;

      const id = env.ACTOR_DO.idFromName(actorKey);
      const stub = env.ACTOR_DO.get(id);

      // seed config into the actor DO
      await stub.fetch(new Request(`${url.origin}/pods/${podName}/actors/${actorId}/__seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body?.config ?? {})
      }));

      return Response.json({
        podName,
        actorId,
        openapi: `${url.origin}/pods/${podName}/actors/${actorId}/openapi.json`
      });
    }

    // Actor routes under /pods/{podName}/actors/{actorId}/...
    if (parts[0] === "pods" && parts[1] && parts[2] === "actors" && parts[3]) {
      const podName = parts[1];
      const actorId = parts[3];
      const actorKey = `${podName}:${actorId}`;
      const id = env.ACTOR_DO.idFromName(actorKey);
      const stub = env.ACTOR_DO.get(id);

      // Proxy the exact subpath to the DO
      const remainder = "/" + parts.slice(4).join("/");
      const target = new URL(`/pods/${podName}/actors/${actorId}${remainder}`, url.origin);
      return stub.fetch(new Request(target, req));
    }

    return new Response("Not Found", { status: 404 });
  }
};
