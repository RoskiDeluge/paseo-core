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
		const pathParts = url.pathname.split('/').filter(Boolean);

               if (pathParts[0] === 'pods' && !pathParts[1]) {
                       if (request.method !== 'POST') {
                               return new Response('Method Not Allowed', { status: 405 });
                       }
                       const actorName = crypto.randomUUID();
                       const actorId = env.PASEO_POD.idFromName(actorName);
                       const stub = env.PASEO_POD.get(actorId);
                       await stub.status();
                       return Response.json({ actorName });
               }

               if (pathParts[0] === 'pods' && pathParts[1]) {
			const actorName = pathParts[1];
			const subpath = pathParts.slice(2).join('/');

			const actorId = env.PASEO_POD.idFromName(actorName);
			const stub = env.PASEO_POD.get(actorId);

			switch (subpath) {
				case '':
					return new Response(await stub.status());

				case 'get': {
					const key = url.searchParams.get('key');
					if (!key) return new Response('Missing key', { status: 400 });
					const value = await stub.get(key);
					return Response.json({ key, value });
				}

				case 'set': {
					const key = url.searchParams.get('key');
					const value = url.searchParams.get('value');
					if (!key || value === null) {
						return new Response('Missing key or value', { status: 400 });
					}
					await stub.set(key, value);
					return Response.json({ status: 'ok', key, value });
				}

				case 'all': {
					const all = await stub.all();
					return Response.json(all);
				}

				case 'llm': {
					if (request.method !== 'POST') {
						return new Response('Method Not Allowed', { status: 405 });
					}
					let body: { prompt?: string };
					try {
						body = await request.json();
					} catch {
						return new Response('Invalid JSON', { status: 400 });
					}
					if (!body.prompt) {
						return new Response("Missing 'prompt' in body", { status: 400 });
					}
					const resp = await stub.llm(body.prompt);
					return Response.json({ response: resp });
				}

				case 'conversation': {
					const conversation = await stub.conversation();
					return Response.json({ conversation });
				}

				default:
					return new Response('Not Found', { status: 404 });
			}
		}

		return new Response('Not Found', { status: 404 });
	},
};

// ✅ Re-export your DO class so wrangler can detect it
export { PASEO_POD } from './paseo-pod';
