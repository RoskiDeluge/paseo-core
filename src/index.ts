import PaseoPod from './paseo-pod';

export interface Env {
  PASEO_POD: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const podId = env.PASEO_POD.idFromName("singleton");
    const podStub = env.PASEO_POD.get(podId);

    // Forward the request to the Durable Object
    return podStub.fetch(request);
  },
};

// Register the Durable Object class here
export const durableObjects = {
  PASEO_POD: PaseoPod,
};
