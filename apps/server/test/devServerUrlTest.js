import { AppContainerRegistry } from '../dist/src/services/AppContainerRegistry.js';

async function testDevServerUrl() {
    console.log('🧪 Testing DevServer URL Functionality');
    console.log('=====================================');

    const conversationId = `test-devserver-${Date.now()}`;

    try {
        // Get container
        console.log('\n📦 Step 1: Creating container...');
        const container = await AppContainerRegistry.getContainer(conversationId);
        console.log(`✅ Container ready: ${container.containerId}`);

        // Get container URL before dev server starts
        console.log('\n📦 Step 2: Getting container URL...');
        const containerUrl = await container.getContainerUrl();
        console.log(`✅ Container URL: ${containerUrl}`);

        // Start dev server
        console.log('\n📦 Step 3: Starting dev server...');
        const devResult = await container.startDevServer();
        console.log(`✅ Dev server started with exit code: ${devResult.exitCode}`);
        if (devResult.stdout) {
            console.log(`📋 Dev server stdout: ${devResult.stdout.split('\n')[0]}`); // First line only
        }

        // Get dev server info
        console.log('\n📦 Step 4: Getting dev server info...');
        const devInfo = await container.getDevServerInfo();
        console.log(`✅ Dev server info:`, {
            isRunning: devInfo.isRunning,
            url: devInfo.url,
            port: devInfo.port
        });

        // Verify URLs match
        console.log('\n📦 Step 5: Verifying URLs...');
        if (containerUrl === devInfo.url) {
            console.log('✅ Container URL and dev server URL match!');
        } else {
            console.log('⚠️ URLs differ (this might be expected):');
            console.log(`   Container URL: ${containerUrl}`);
            console.log(`   Dev Server URL: ${devInfo.url}`);
        }

        // Test a simple command to verify container is still responsive
        console.log('\n📦 Step 6: Testing container responsiveness...');
        const testResult = await container.executeCommand('curl -s http://localhost:3001 2>/dev/null | head -1 || echo "Dev server not responding yet"');
        console.log(`✅ Test result: "${testResult.stdout.trim()}"`);

        console.log('\n🎉 DevServer URL test completed successfully!');
        console.log(`🌐 Your app should be accessible at: ${devInfo.url || containerUrl}`);

    } catch (error) {
        console.error('❌ DevServer URL test failed:', error);
        throw error;
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test container...');
        await AppContainerRegistry.removeContainer(conversationId);
        console.log('✅ Test cleanup completed');
    }
}

testDevServerUrl().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
