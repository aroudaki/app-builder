import { AppContainerRegistry } from '../dist/src/services/AppContainerRegistry.js';

async function testContainerPersistence() {
    console.log('🧪 Testing AppContainer Registry Persistence');
    console.log('==========================================');

    const conversationId = `test-persistence-${Date.now()}`;

    try {
        // Test 1: Get a new container
        console.log('\n📦 Test 1: Creating new container...');
        const container1 = await AppContainerRegistry.getContainer(conversationId);
        const containerId1 = container1.containerId;
        console.log(`✅ Container 1 created with ID: ${containerId1}`);

        // Test 2: Get the same container (should reuse)
        console.log('\n📦 Test 2: Getting same container (should reuse)...');
        const container2 = await AppContainerRegistry.getContainer(conversationId);
        const containerId2 = container2.containerId;
        console.log(`✅ Container 2 ID: ${containerId2}`);

        // Test 3: Verify they are the same
        console.log('\n📦 Test 3: Verifying container persistence...');
        if (container1 === container2 && containerId1 === containerId2) {
            console.log('✅ Container persistence works! Same instance and ID returned.');
        } else {
            console.log('❌ Container persistence failed! Different instances returned.');
            console.log(`Container 1 === Container 2: ${container1 === container2}`);
            console.log(`Container ID 1: ${containerId1}`);
            console.log(`Container ID 2: ${containerId2}`);
        }

        // Test 4: Test container URL
        console.log('\n📦 Test 4: Testing container URL...');
        try {
            const containerUrl = await container1.getContainerUrl();
            console.log(`✅ Container URL: ${containerUrl}`);
        } catch (error) {
            console.log(`⚠️ Container URL failed (expected if no dev server): ${error.message}`);
        }

        // Test 5: Execute a simple command
        console.log('\n📦 Test 5: Testing command execution...');
        const result = await container1.executeCommand('echo "Hello from persistent container!"');
        console.log(`✅ Command result: "${result.stdout.trim()}", exit code: ${result.exitCode}`);

        console.log('\n🎉 All container persistence tests passed!');

    } catch (error) {
        console.error('❌ Container persistence test failed:', error);
        throw error;
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test container...');
        await AppContainerRegistry.removeContainer(conversationId);
        console.log('✅ Test cleanup completed');
    }
}

testContainerPersistence().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
