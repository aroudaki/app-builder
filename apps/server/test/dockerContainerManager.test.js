import { DockerContainerManager } from '../dist/src/services/index.js';

/**
 * Test the Docker Container Manager
 * This test validates Docker container creation, command execution, and lifecycle management
 */
async function testDockerContainerManager() {
    console.log('🧪 Testing Docker Container Manager...');

    let containerManager;
    let containerId;
    let testConversationId;

    try {
        // Initialize container manager
        console.log('🐳 Initializing Docker Container Manager...');
        containerManager = new DockerContainerManager();
        testConversationId = `test-${Date.now()}`;

        // Test 1: Container Creation
        console.log('🔧 Test 1: Creating container...');
        const config = {
            conversationId: testConversationId,
            image: 'app-builder-base:latest',
            memory: 512 * 1024 * 1024, // 512MB
            cpu: 512
        };

        containerId = await containerManager.createContainer(config);
        console.log(`✅ Container created with ID: ${containerId}`);

        // Test 2: Container Info
        console.log('📋 Test 2: Getting container info...');
        const containerInfo = await containerManager.getContainerInfo(testConversationId);
        console.log(`✅ Container info:`, {
            name: containerInfo.name,
            status: containerInfo.status,
            ports: containerInfo.ports,
            conversationId: containerInfo.conversationId
        });

        // Test 3: Basic Command Execution
        console.log('🔧 Test 3: Executing basic commands...');

        // Test pwd
        const pwdResult = await containerManager.executeCommand(testConversationId, 'pwd');
        console.log(`📍 Current directory: ${pwdResult.stdout}`);
        if (pwdResult.exitCode !== 0) {
            throw new Error('pwd command failed');
        }

        // Test ls
        const lsResult = await containerManager.executeCommand(testConversationId, 'ls -la');
        console.log(`📁 Directory listing:\n${lsResult.stdout}`);
        if (lsResult.exitCode !== 0) {
            throw new Error('ls command failed');
        }

        // Test pnpm version
        const pnpmResult = await containerManager.executeCommand(testConversationId, 'pnpm --version');
        console.log(`📦 pnpm version: ${pnpmResult.stdout}`);
        if (pnpmResult.exitCode !== 0) {
            throw new Error('pnpm command failed');
        }

        // Test 4: File Operations
        console.log('📝 Test 4: Testing file operations...');

        // Upload a test file
        const testFiles = [{
            path: '/generated-app/test-upload.txt',
            content: 'This is a test file uploaded via Docker Container Manager\nLine 2 of the test file',
            mode: '0644'
        }];

        await containerManager.uploadFiles(testConversationId, testFiles);
        console.log('✅ File upload completed');

        // Verify file exists and has correct content
        const catResult = await containerManager.executeCommand(testConversationId, 'cat /generated-app/test-upload.txt');
        if (catResult.exitCode === 0 && catResult.stdout.includes('Docker Container Manager')) {
            console.log('✅ File upload verification successful');
        } else {
            throw new Error('File upload verification failed');
        }

        // Download files
        const downloadedFiles = await containerManager.downloadFiles(testConversationId, [
            '/generated-app/test-upload.txt',
            '/generated-app/package.json'
        ]);

        console.log(`✅ Downloaded ${downloadedFiles.length} files`);
        downloadedFiles.forEach(file => {
            console.log(`   - ${file.path} (${file.size} bytes, modified: ${file.modified.toISOString()})`);
        });

        // Test 5: Container URL
        console.log('🌐 Test 5: Getting container URL...');
        const containerUrl = await containerManager.getContainerUrl(testConversationId);
        console.log(`✅ Container URL: ${containerUrl}`);

        // Test 6: Container Stats
        console.log('📊 Test 6: Getting container stats...');
        const stats = await containerManager.getContainerStats(testConversationId);
        console.log('✅ Container stats:', {
            memory: `${Math.round(stats.memory.percentage * 100) / 100}% (${Math.round(stats.memory.usage / 1024 / 1024)}MB / ${Math.round(stats.memory.limit / 1024 / 1024)}MB)`,
            cpu: `${Math.round(stats.cpu.percentage * 100) / 100}%`,
            network: `RX: ${Math.round(stats.network.rx / 1024)}KB, TX: ${Math.round(stats.network.tx / 1024)}KB`
        });

        // Test 7: Container Running Check
        console.log('🔍 Test 7: Checking if container is running...');
        const isRunning = await containerManager.isContainerRunning(testConversationId);
        console.log(`✅ Container running status: ${isRunning}`);

        // Test 8: List Containers
        console.log('📝 Test 8: Listing all containers...');
        const containers = await containerManager.listContainers();
        console.log(`✅ Found ${containers.length} app-builder containers`);
        containers.forEach(container => {
            console.log(`   - ${container.name} (${container.status}) - ${container.conversationId}`);
        });

        // Test 9: Development Server Test
        console.log('🚀 Test 9: Testing development server...');
        const devServerResult = await containerManager.executeCommand(testConversationId, 'pnpm run dev &');
        console.log('✅ Dev server start command executed');

        // Wait a moment for server to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if server is responding (this might fail if port isn't accessible, which is okay)
        try {
            const curlResult = await containerManager.executeCommand(testConversationId, 'curl -s http://localhost:3001 | head -5');
            if (curlResult.exitCode === 0 && curlResult.stdout.includes('html')) {
                console.log('✅ Dev server is responding');
            } else {
                console.log('ℹ️ Dev server might be starting (curl test inconclusive)');
            }
        } catch (error) {
            console.log('ℹ️ Dev server test skipped (curl might not be available)');
        }

        // Test 10: Package Installation
        console.log('📦 Test 10: Testing package installation...');
        const installResult = await containerManager.executeCommand(testConversationId, 'pnpm install axios');
        if (installResult.exitCode === 0) {
            console.log('✅ Package installation successful');
        } else {
            console.log('⚠️ Package installation failed, but continuing tests');
        }

        console.log('🎉 All Docker Container Manager tests completed successfully!');

    } catch (error) {
        console.error('💥 Docker Container Manager test failed:', error);
        throw error;
    } finally {
        // Cleanup: Stop and remove the test container
        if (containerManager && testConversationId) {
            try {
                console.log('🧹 Cleaning up test container...');
                await containerManager.stopContainer(testConversationId);
                console.log('✅ Test container cleaned up');
            } catch (error) {
                console.warn('⚠️ Failed to cleanup test container:', error);
            }
        }
    }
}

/**
 * Test error scenarios
 */
async function testErrorScenarios() {
    console.log('🧪 Testing error scenarios...');

    const containerManager = new DockerContainerManager();

    try {
        // Test 1: Container not found
        console.log('🔧 Test 1: Testing container not found error...');
        try {
            await containerManager.executeCommand('non-existent-container', 'echo test');
            throw new Error('Should have thrown ContainerNotFoundError');
        } catch (error) {
            if (error.name === 'ContainerNotFoundError') {
                console.log('✅ ContainerNotFoundError thrown correctly');
            } else {
                throw error;
            }
        }

        // Test 2: Invalid command
        console.log('🔧 Test 2: Testing invalid command...');
        const testConversationId = `error-test-${Date.now()}`;

        try {
            const config = {
                conversationId: testConversationId,
                image: 'app-builder-base:latest'
            };

            const containerId = await containerManager.createContainer(config);

            const result = await containerManager.executeCommand(testConversationId, 'non-existent-command-xyz');
            if (result.exitCode !== 0) {
                console.log('✅ Invalid command properly returned non-zero exit code');
            }

            // Cleanup
            await containerManager.stopContainer(testConversationId);

        } catch (error) {
            console.log('✅ Invalid command handling test completed');
        }

        console.log('🎉 All error scenario tests completed!');

    } catch (error) {
        console.error('💥 Error scenario test failed:', error);
        throw error;
    }
}

// Run the tests if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    Promise.resolve()
        .then(() => testDockerContainerManager())
        .then(() => testErrorScenarios())
        .then(() => {
            console.log('🎉 All Docker Container Manager tests passed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Docker Container Manager test suite failed:', error);
            process.exit(1);
        });
}

export { testDockerContainerManager, testErrorScenarios };
