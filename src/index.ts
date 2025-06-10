// import type { DurableObjectNamespace } from "@cloudflare/workers-types";

// export interface Env {
//   PASEO_POD: DurableObjectNamespace;
// }

export interface Env {
  PASEO_POD: any; // temporarily use 'any' until type declarations are available
}


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts[0] === "pods" && pathParts[1]) {
      const podName = pathParts[1];
      const subpath = pathParts.slice(2).join("/");

      const podId = env.PASEO_POD.idFromName(podName);
      const stub = env.PASEO_POD.get(podId);

      url.pathname = "/" + subpath;
      const newRequest = new Request(url.toString(), request);
      return await stub.fetch(newRequest);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// ✅ Re-export your DO class so wrangler can detect it
export { PASEO_POD } from "./paseo-pod";
