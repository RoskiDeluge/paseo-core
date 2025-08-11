#!/usr/bin/env node
// scripts/demo.mjs

// Usage:
//   PASEO_ENDPOINT=https://<your-worker>.workers.dev node scripts/demo.mjs
// Optionally reuse:
//   export PASEO_POD_NAME=...; export PASEO_ACTOR_ID=...

const ENDPOINT = process.env.PASEO_ENDPOINT;
if (!ENDPOINT) {
	console.error('❌ Set PASEO_ENDPOINT, e.g. export PASEO_ENDPOINT="https://your-worker.workers.dev"');
	process.exit(1);
}

let POD = process.env.PASEO_POD_NAME || null;
let ACTOR = process.env.PASEO_ACTOR_ID || null;

async function httpJson(url, init = {}) {
	const res = await fetch(url, {
		headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
		...init,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`${res.status} ${res.statusText} – ${body}`);
	}
	return res.json();
}

async function ensurePod() {
	if (POD) {
		console.log(`📦 Using existing pod: ${POD}`);
		return POD;
	}
	console.log('📦 Creating a new pod...');
	const { podName } = await httpJson(`${ENDPOINT}/pods`, { method: 'POST' });
	POD = podName;
	console.log(`✅ Pod: ${POD}`);
	return POD;
}

async function ensureActor() {
	if (ACTOR) {
		console.log(`🎭 Using existing actor: ${ACTOR}`);
		return ACTOR;
	}
	console.log('🎭 Creating a store actor...');
	const storeActorConfig = {
		config: {
			actorType: 'store',
			version: 'v1',
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					data: {
						type: 'object',
						properties: {
							type: { type: 'string' },
							content: { type: 'string' },
							timestamp: { type: 'string' },
						},
					},
					tags: { type: 'array', items: { type: 'string' } },
				},
				required: ['id'],
				additionalProperties: true,
			},
			// We want to filter by these later:
			indexes: ['id', 'data.type'],
		},
	};
	const { actorId, openapi } = await httpJson(`${ENDPOINT}/pods/${POD}/actors`, { method: 'POST', body: JSON.stringify(storeActorConfig) });
	ACTOR = actorId;
	console.log(`✅ Actor: ${ACTOR}`);
	console.log(`📋 OpenAPI: ${openapi}`);
	return ACTOR;
}

function actorBase() {
	return `${ENDPOINT}/pods/${POD}/actors/${ACTOR}`;
}

async function putItem(doc) {
	return httpJson(`${actorBase()}/items`, { method: 'POST', body: JSON.stringify(doc) });
}

async function listItems(q = {}) {
	const qs = new URLSearchParams(q).toString();
	return httpJson(`${actorBase()}/items${qs ? `?${qs}` : ''}`);
}

async function getItem(id) {
	return httpJson(`${actorBase()}/items/${id}`);
}

async function main() {
	try {
		console.log(`🚀 Using Paseo Core at: ${ENDPOINT}\n`);

		await ensurePod();
		await ensureActor();
		console.log(`📍 Store URL: ${actorBase()}\n`);

		// 1) Store a couple items
		console.log('📝 Storing sample items...');
		const items = [
			{ id: 'item-3', data: { type: 'note', content: 'Third sample item', timestamp: new Date().toISOString() } },
			{ id: 'item-4', data: { type: 'task', content: 'Fourth sample item', priority: 'high' } },
		];
		for (const it of items) {
			const result = await putItem(it);
			console.log(`  ✅ Stored ${it.id} -> ${result.id}`);
		}

		// 2) List all
		console.log('\n📄 Listing all items...');
		let { items: all, next_after } = await listItems();
		console.log(`Found ${all.length} item(s)`);
		for (const it of all) console.log(`  - ${it.id}: ${JSON.stringify(it.body.data).slice(0, 60)}…`);

		// 3) Fetch one by generated id
		console.log('\n🔍 Fetching first item by id...');
		if (all.length) {
			const one = await getItem(all[0].id);
			console.log(JSON.stringify(one, null, 2));
		}

		// 4) Filter by indexed field (data.type -> k_data_type)
		console.log('\n🔎 Filtering by type=note ...');
		const filtered = await listItems({ k_data_type: 'note' });
		console.log(`Found ${filtered.items.length} note(s)`);
		for (const it of filtered.items) console.log(`  - ${it.id}: ${it.body.data.content}`);

		// 5) Simple pagination demo (if many items)
		if (next_after) {
			console.log('\n⏭️  More items available, fetching next page…');
			const page2 = await listItems({ after: next_after });
			console.log(`Fetched ${page2.items.length} more item(s)`);
		}

		console.log('\n🎉 Demo completed!\n');
		console.log('🔧 Reuse these envs:');
		console.log(`   export PASEO_ENDPOINT="${ENDPOINT}"`);
		console.log(`   export PASEO_POD_NAME="${POD}"`);
		console.log(`   export PASEO_ACTOR_ID="${ACTOR}"`);
		console.log('\n💡 Try:');
		console.log(`   curl ${actorBase()}/openapi.json`);
		console.log(`   curl ${actorBase()}/items`);
	} catch (err) {
		console.error('❌ Error:', err?.message || err);
		process.exit(1);
	}
}

main();
