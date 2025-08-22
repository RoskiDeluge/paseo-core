#!/usr/bin/env node
// examples/responses-demo.mjs

// Usage:
//   PASEO_ENDPOINT=https://<your-worker>.workers.dev node examples/responses-demo.mjs
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
		const text = await res.text();
		throw new Error(`HTTP ${res.status}: ${text}`);
	}
	return res.json();
}

async function ensurePod() {
	if (POD) {
		console.log(`🎪 Using existing pod: ${POD}`);
		return POD;
	}
	console.log('🎪 Creating a new pod...');
	const { podName } = await httpJson(`${ENDPOINT}/pods`, { method: 'POST' });
	POD = podName;
	console.log(`✅ Pod: ${POD}`);
	return POD;
}

async function ensureResponsesActor() {
	if (ACTOR) {
		console.log(`🤖 Using existing responses actor: ${ACTOR}`);
		return ACTOR;
	}
	console.log('🤖 Creating a responses store actor...');
	const responsesActorConfig = {
		config: {
			actorType: 'responsesStore',
			version: 'v1',
			schema: {
				type: 'object',
				required: ['id', 'object', 'created_at', 'status', 'model', 'output'],
				properties: {
					id: { type: 'string' },
					object: { type: 'string', enum: ['response'] },
					created_at: { type: 'integer' },
					status: { type: 'string', enum: ['completed', 'incomplete', 'failed'] },
					model: { type: 'string' },
					output: {
						type: 'array',
						items: { type: 'object' },
					},
					usage: {
						type: 'object',
						properties: {
							total_tokens: { type: 'integer' },
						},
					},
					metadata: { type: 'object' },
				},
				additionalProperties: true,
			},
			// Index important OpenAI response fields
			indexes: ['id', 'status', 'model', 'output.type', 'output.role', 'metadata.session_id'],
			params: {
				retention_days: 30,
				max_output_content_length: 1000,
				enable_content_search: true,
			},
		},
	};
	const { actorId, openapi } = await httpJson(`${ENDPOINT}/pods/${POD}/actors`, {
		method: 'POST',
		body: JSON.stringify(responsesActorConfig),
	});
	ACTOR = actorId;
	console.log(`✅ Responses Actor: ${ACTOR}`);
	console.log(`📋 OpenAPI: ${openapi}`);
	return ACTOR;
}

function actorBase() {
	return `${ENDPOINT}/pods/${POD}/actors/${ACTOR}`;
}

async function storeResponse(response) {
	return httpJson(`${actorBase()}/responses`, { method: 'POST', body: JSON.stringify(response) });
}

async function listResponses(q = {}) {
	const qs = new URLSearchParams(q).toString();
	return httpJson(`${actorBase()}/responses${qs ? `?${qs}` : ''}`);
}

async function getResponse(responseId) {
	return httpJson(`${actorBase()}/responses/${responseId}`);
}

async function getResponseOutputs(responseId) {
	return httpJson(`${actorBase()}/responses/${responseId}/outputs`);
}

// Sample OpenAI responses for testing
const sampleResponses = [
	{
		id: 'resp_demo_001',
		object: 'response',
		created_at: Math.floor(Date.now() / 1000),
		status: 'completed',
		model: 'gpt-4o-2024-08-06',
		output: [
			{
				type: 'message',
				id: 'msg_demo_001',
				role: 'assistant',
				status: 'completed',
				content: [
					{
						type: 'output_text',
						text: 'The image shows a beautiful mountain landscape with snow-capped peaks and a crystal clear lake.',
					},
				],
			},
		],
		usage: {
			input_tokens: 150,
			output_tokens: 45,
			total_tokens: 195,
		},
		metadata: {
			session_id: 'sess_demo_123',
			conversation_id: 'conv_demo_456',
		},
	},
	{
		id: 'resp_demo_002',
		object: 'response',
		created_at: Math.floor(Date.now() / 1000) + 1,
		status: 'completed',
		model: 'gpt-4o-2024-08-06',
		output: [
			{
				type: 'message',
				id: 'msg_demo_002a',
				role: 'assistant',
				content: [
					{
						type: 'output_text',
						text: "I'll analyze this data and create a visualization for you.",
					},
				],
			},
			{
				type: 'tool_call',
				id: 'call_demo_002b',
				function_call: {
					name: 'create_chart',
					arguments: '{"data": [1,2,3,4,5], "type": "line"}',
				},
			},
		],
		usage: {
			input_tokens: 200,
			output_tokens: 85,
			total_tokens: 285,
		},
		metadata: {
			session_id: 'sess_demo_123',
			conversation_id: 'conv_demo_789',
		},
	},
	{
		id: 'resp_demo_003',
		object: 'response',
		created_at: Math.floor(Date.now() / 1000) + 2,
		status: 'completed',
		model: 'gpt-3.5-turbo',
		output: [
			{
				type: 'message',
				id: 'msg_demo_003',
				role: 'assistant',
				content: [
					{
						type: 'output_text',
						text: "Based on your query about weather patterns, here's a comprehensive analysis of recent trends.",
					},
				],
			},
		],
		usage: {
			input_tokens: 75,
			output_tokens: 120,
			total_tokens: 195,
		},
		metadata: {
			session_id: 'sess_demo_456',
			conversation_id: 'conv_demo_101',
		},
	},
];

async function main() {
	try {
		console.log(`🚀 OpenAI Responses Store Demo\n`);
		console.log(`📡 Using Paseo Core at: ${ENDPOINT}\n`);

		await ensurePod();
		await ensureResponsesActor();
		console.log(`🎯 Responses Store URL: ${actorBase()}\n`);

		// 1) Store sample OpenAI responses
		console.log('📝 Storing sample OpenAI responses...');
		for (const response of sampleResponses) {
			const result = await storeResponse(response);
			console.log(`  ✅ Stored ${response.id} -> storage_id: ${result.id}, outputs_indexed: ${result.outputs_indexed}`);
		}

		// 2) List all responses
		console.log('\n📄 Listing all responses...');
		let { responses: all, next_after } = await listResponses();
		console.log(`Found ${all.length} response(s)`);
		for (const resp of all) {
			console.log(`  - ${resp.response_id}: ${resp.model} [${resp.status}] ${resp.total_tokens} tokens`);
		}

		// 3) Query by status
		console.log('\n🔍 Filtering by status=completed...');
		const completedResponses = await listResponses({ status: 'completed' });
		console.log(`Found ${completedResponses.responses.length} completed response(s)`);

		// 4) Query by model
		console.log('\n🔍 Filtering by model=gpt-4o-2024-08-06...');
		const gpt4Responses = await listResponses({ model: 'gpt-4o-2024-08-06' });
		console.log(`Found ${gpt4Responses.responses.length} GPT-4o response(s)`);

		// 5) Query by output characteristics
		console.log('\n🔍 Filtering by output_type=message...');
		const messageResponses = await listResponses({ output_type: 'message' });
		console.log(`Found ${messageResponses.responses.length} responses with message outputs`);

		// 6) Query by output role
		console.log('\n🔍 Filtering by output_role=assistant...');
		const assistantResponses = await listResponses({ output_role: 'assistant' });
		console.log(`Found ${assistantResponses.responses.length} responses from assistant`);

		// 7) Search in content
		console.log('\n🔍 Searching for content containing "analysis"...');
		const contentSearch = await listResponses({ output_content: 'analysis' });
		console.log(`Found ${contentSearch.responses.length} responses containing "analysis"`);

		// 8) Token usage filtering
		console.log('\n🔍 Filtering by token usage (200-300 tokens)...');
		const tokenFiltered = await listResponses({ min_tokens: 200, max_tokens: 300 });
		console.log(`Found ${tokenFiltered.responses.length} responses in token range`);

		// 9) Fetch specific response
		if (all.length > 0) {
			const firstResponse = all[0];
			console.log(`\n📋 Fetching response details for: ${firstResponse.response_id}`);
			const details = await getResponse(firstResponse.response_id);
			console.log(`  Status: ${details.status}, Model: ${details.model}, Tokens: ${details.total_tokens}`);
			console.log(`  Created: ${new Date(details.created_at * 1000).toISOString()}`);

			// 10) Get output array details
			console.log(`\n🎯 Getting output array details for: ${firstResponse.response_id}`);
			const outputs = await getResponseOutputs(firstResponse.response_id);
			console.log(`  Found ${outputs.outputs.length} output item(s):`);
			for (const output of outputs.outputs) {
				console.log(
					`    [${output.output_index}] ${output.output_type || 'unknown'} (${output.output_role || 'no-role'}) - ${
						output.content_tokens || 0
					} tokens`
				);
				if (output.output_content_preview) {
					console.log(`        Preview: ${output.output_content_preview.substring(0, 80)}...`);
				}
			}
		}

		// 11) Complex query
		console.log('\n🎯 Complex query: completed + gpt-4o + message output...');
		const complexQuery = await listResponses({
			status: 'completed',
			model: 'gpt-4o-2024-08-06',
			output_type: 'message',
			limit: 5,
		});
		console.log(`Found ${complexQuery.responses.length} responses matching complex criteria`);

		console.log('\n🎉 Responses Store Demo completed!\n');
		console.log('🔧 Reuse these envs:');
		console.log(`   export PASEO_ENDPOINT="${ENDPOINT}"`);
		console.log(`   export PASEO_POD_NAME="${POD}"`);
		console.log(`   export PASEO_ACTOR_ID="${ACTOR}"`);
		console.log('\n💡 Try these API calls:');
		console.log(`   curl "${actorBase()}/responses"`);
		console.log(`   curl "${actorBase()}/responses?status=completed"`);
		console.log(`   curl "${actorBase()}/responses?output_type=message"`);
		console.log(`   curl "${actorBase()}/responses?model=gpt-4o-2024-08-06"`);
		console.log(`   curl "${actorBase()}/openapi.json"`);
	} catch (err) {
		console.error('❌ Error:', err?.message || err);
		process.exit(1);
	}
}

main();
