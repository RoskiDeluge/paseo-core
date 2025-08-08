#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use fetch polyfill for Node.js versions that don't have it built-in
let fetch;
try {
	fetch = globalThis.fetch;
	if (!fetch) {
		fetch = require('node-fetch');
	}
} catch (e) {
	console.log('⚠️  Note: fetch not available, skipping default store creation');
}

async function deployAndShowEndpoint() {
	try {
		console.log('🚀 Deploying to Cloudflare ...\n');

		// Run wrangler deploy and capture output
		const deployOutput = execSync('wrangler deploy', {
			encoding: 'utf8',
			stdio: 'pipe',
		});

		// Display the deploy output
		console.log(deployOutput);

		// Extract the worker URL from the output
		const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.workers\.dev/);
		const fullEndpoint = urlMatch ? urlMatch[0] : null;

		// Read wrangler config to get worker name
		const wranglerConfigPath = path.join(__dirname, '..', 'wrangler.jsonc');
		const wranglerConfigContent = fs.readFileSync(wranglerConfigPath, 'utf8');
		const jsonContent = wranglerConfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
		const config = JSON.parse(jsonContent);
		const workerName = config.name;

		// Show the nice summary
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎉 Deployment Summary');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`✅ Pod name: ${workerName}`);

		if (fullEndpoint) {
			console.log(`🌐 Pod endpoint: ${fullEndpoint}`);
			console.log(`🎯 Ready to use!`);
		} else {
			console.log(`🌐 Pod endpoint: https://${workerName}.<your-account>.workers.dev`);
			console.log(`⚠️  Could not extract full URL from deploy output`);
		}

		console.log('');
		console.log('🎯 Creating default store actor...');

		// Create a default pod and store actor
		if (fullEndpoint && fetch) {
			try {
				console.log(`Attempting to create pod at: ${fullEndpoint}/pods`);

				// Create a pod
				const podResponse = await fetch(`${fullEndpoint}/pods`, {
					method: 'POST',
					headers: {
						'User-Agent': 'paseo-deploy-script/1.0',
						Accept: 'application/json',
					},
				});

				if (!podResponse.ok) {
					throw new Error(`Pod creation failed: ${podResponse.status} ${podResponse.statusText}`);
				}

				const podData = await podResponse.json();
				const podName = podData.podName;
				console.log(`Pod created: ${podName}`);

				// Create a default store actor in the pod
				const storeConfig = {
					config: {
						actorType: 'store',
						version: 'v1',
						schema: {
							type: 'object',
							properties: {
								id: { type: 'string' },
								data: { type: 'object' },
							},
							required: ['id'],
						},
						indexes: ['id'],
					},
				};

				console.log(`Creating actor in pod: ${podName}`);
				const actorResponse = await fetch(`${fullEndpoint}/pods/${podName}/actors`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': 'paseo-deploy-script/1.0',
						Accept: 'application/json',
					},
					body: JSON.stringify(storeConfig),
				});

				if (!actorResponse.ok) {
					throw new Error(`Actor creation failed: ${actorResponse.status} ${actorResponse.statusText}`);
				}

				const actorData = await actorResponse.json();

				console.log(`✅ Default store created: ${actorData.actorId}`);
				console.log(`📋 OpenAPI spec: ${actorData.openapi}`);
				console.log('');
				console.log('📚 Available API endpoints:');
				console.log(`   POST   /pods                                    - Create a new pod`);
				console.log(`   GET    /pods/{podName}                         - Get pod status`);
				console.log(`   POST   /pods/{podName}/actors                  - Create actor in pod`);
				console.log(`   GET    /pods/${podName}/actors/${actorData.actorId}/items          - List items in store`);
				console.log(`   POST   /pods/${podName}/actors/${actorData.actorId}/items          - Add item to store`);
				console.log(`   GET    /pods/${podName}/actors/${actorData.actorId}/items/{itemId} - Get specific item`);
				console.log(`   GET    /pods/${podName}/actors/${actorData.actorId}/openapi.json  - OpenAPI specification`);
			} catch (error) {
				console.log('⚠️  Could not create default store:', error.message);
				console.log('');
				console.log('📚 Available API endpoints:');
				console.log('   POST   /pods                                    - Create a new pod');
				console.log('   GET    /pods/{podName}                         - Get pod status');
				console.log('   POST   /pods/{podName}/actors                  - Create actor in pod');
				console.log('   GET    /pods/{podName}/actors/{actorId}/items          - List items in store');
				console.log('   POST   /pods/{podName}/actors/{actorId}/items          - Add item to store');
				console.log('   GET    /pods/{podName}/actors/{actorId}/items/{itemId} - Get specific item');
				console.log('   GET    /pods/{podName}/actors/{actorId}/openapi.json  - OpenAPI specification');
			}
		} else {
			console.log('');
			console.log('📚 Available API endpoints:');
			console.log('   POST   /pods                                    - Create a new pod');
			console.log('   GET    /pods/{podName}                         - Get pod status');
			console.log('   POST   /pods/{podName}/actors                  - Create actor in pod');
			console.log('   GET    /pods/{podName}/actors/{actorId}/items          - List items in store');
			console.log('   POST   /pods/{podName}/actors/{actorId}/items          - Add item to store');
			console.log('   GET    /pods/{podName}/actors/{actorId}/items/{itemId} - Get specific item');
			console.log('   GET    /pods/{podName}/actors/{actorId}/openapi.json  - OpenAPI specification');
		}

		console.log('');
		console.log('🔗 Use with paseo-sdk:');
		console.log('   Add to your .env file:');

		if (fullEndpoint) {
			console.log(`   PASEO_ENDPOINT=${fullEndpoint}`);
		} else {
			console.log(`   PASEO_ENDPOINT=https://${workerName}.<your-account>.workers.dev`);
		}

		console.log('');
		console.log('   Then create your client:');
		console.log('   const client = new PaseoClient();');

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('');
	} catch (error) {
		console.error('❌ Deployment failed:', error.message);
		console.log('\nIf you see authentication errors, run: wrangler login');
		console.log('If you see other errors, check your wrangler.jsonc configuration.');
		process.exit(1);
	}
}

deployAndShowEndpoint().catch(console.error);
