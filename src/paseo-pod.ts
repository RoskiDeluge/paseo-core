export default class PaseoPod {
  state: DurableObjectState;
  env: any;
  memory: Record<string, any>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.memory = {};
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    switch (pathname) {
      case "/":
        return new Response("PaseoPod is alive.", { status: 200 });

      case "/get":
        const key = searchParams.get("key");
        const value = this.memory[key || ""] || null;
        return Response.json({ key, value });

      case "/set":
        const k = searchParams.get("key");
        const v = searchParams.get("value");
        if (k && v) {
          this.memory[k] = v;
          return Response.json({ status: "ok", key: k, value: v });
        }
        return new Response("Missing key or value.", { status: 400 });

      default:
        return new Response("Not Found", { status: 404 });
    }
  }
}
