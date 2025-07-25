#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function deployAndShowEndpoint() {
	try {
		console.log('🚀 Deploying to Cloudflare Workers...\n');

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
		console.log(`✅ Worker name: ${workerName}`);

		if (fullEndpoint) {
			console.log(`🌐 Worker endpoint: ${fullEndpoint}`);
			console.log(`🎯 Ready to use!`);
		} else {
			console.log(`🌐 Worker endpoint: https://${workerName}.<your-account>.workers.dev`);
			console.log(`⚠️  Could not extract full URL from deploy output`);
		}

		console.log('');
		console.log('📚 Available API endpoints:');
		console.log('   POST   /pods                        - Create a new pod');
		console.log('   GET    /pods/{podName}              - Get pod state');
		console.log('   POST   /pods/{podName}/messages     - Send message to pod');
		console.log('   GET    /pods/{podName}/memory       - Get pod memory');
		console.log('   PUT    /pods/{podName}/memory/{key} - Store in pod memory');
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

deployAndShowEndpoint();
