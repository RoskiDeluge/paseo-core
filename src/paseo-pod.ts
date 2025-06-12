import { DurableObject } from 'cloudflare:workers';

interface ConversationTurn {
	prompt: string;
	response: string;
}

export class PASEO_POD extends DurableObject {
	constructor(state: DurableObjectState, env: any) {
		super(state, env);
	}

	// RPC methods
	async status(): Promise<string> {
		return 'PaseoPod is alive.';
	}

	async get(key: string): Promise<unknown> {
		return await this.ctx.storage.get(key);
	}

	async set(key: string, value: unknown): Promise<void> {
		await this.ctx.storage.put(key, value);
	}

	async all(): Promise<Record<string, unknown>> {
		const all = await this.ctx.storage.list();
		return Object.fromEntries(all);
	}

	async llm(prompt: string): Promise<string> {
		const fakeResponse = `This is a simulated LLM response to: "${prompt}"`;

		const conversation = (await this.ctx.storage.get<ConversationTurn[]>('conversation')) || [];
		conversation.push({ prompt, response: fakeResponse });
		await this.ctx.storage.put('conversation', conversation);

		return fakeResponse;
	}

	async conversation(): Promise<ConversationTurn[]> {
		return (await this.ctx.storage.get<ConversationTurn[]>('conversation')) || [];
	}

	// Optional HTTP interface mapping to the RPC methods
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname, searchParams } = url;

		switch (pathname) {
			case '/':
				return new Response(await this.status(), { status: 200 });

			case '/get': {
				const key = searchParams.get('key');
				if (!key) return new Response('Missing key', { status: 400 });
				const value = await this.get(key);
				return Response.json({ key, value });
			}

			case '/set': {
				const key = searchParams.get('key');
				const value = searchParams.get('value');
				if (!key || value === null) {
					return new Response('Missing key or value', { status: 400 });
				}
				await this.set(key, value);
				return Response.json({ status: 'ok', key, value });
			}

			case '/all': {
				const all = await this.all();
				return Response.json(all);
			}

			case '/llm': {
				if (request.method !== 'POST') {
					return new Response('Method Not Allowed', { status: 405 });
				}

				let body: { prompt?: string };
				try {
					body = await request.json();
				} catch {
					return new Response('Invalid JSON', { status: 400 });
				}

				const prompt = body.prompt;
				if (!prompt) {
					return new Response("Missing 'prompt' in body", { status: 400 });
				}

				const fakeResponse = await this.llm(prompt);
				return Response.json({ response: fakeResponse });
			}

			case '/conversation': {
				const conversation = await this.conversation();
				return Response.json({ conversation });
			}

			default:
				return new Response('Not Found', { status: 404 });
		}
	}
}
