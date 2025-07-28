import { ContainerRuntime, CommandResult, ContainerConfig, FileUpload } from '../services/types.js';
import { ContainerRuntimeFactory } from '../services/ContainerRuntimeFactory.js';

/**
 * File information for directory listings (for compatibility)
 */
export interface FileInfo {
    name: string;
    size: number;
    isDirectory: boolean;
    permissions: string;
    modified: Date;
}

/**
 * Process information for running processes (for compatibility)
 */
export interface ProcessInfo {
    pid: number;
    name: string;
    command: string;
    startTime: Date;
    status: 'running' | 'stopped' | 'error';
}

/**
 * App Container Tool - Provides a Docker-based container environment for generated applications
 * 
 * This tool uses real Docker containers to provide isolated environments where the coding agent
 * can execute bash commands in a real Linux environment. It supports file operations,
 * process management, and all common shell commands needed for development.
 * 
 * This replaces the previous mock container implementation with real Docker integration.
 */
export class AppContainer {
    private runtime: ContainerRuntime;
    private containerId?: string;
    private isInitialized: boolean = false;

    constructor(private conversationId: string) {
        this.runtime = ContainerRuntimeFactory.create();
        console.log(`🐳 AppContainer created for conversation: ${this.conversationId}`);
    }

    /**
     * Initialize the container environment with boilerplate React app
     * This replaces the mock file system with a real Docker container
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log(`🐳 Container already initialized for conversation: ${this.conversationId}`);
            return;
        }

        try {
            console.log(`🚀 Initializing Docker container for conversation: ${this.conversationId}`);

            // Create container with our base image that already contains the boilerplate React app
            this.containerId = await this.runtime.createContainer({
                conversationId: this.conversationId,
                image: 'app-builder-base:latest', // Our pre-built base image
                memory: 512 * 1024 * 1024, // 512MB
                cpu: 512, // CPU shares (integer value, not percentage)
                workingDir: '/generated-app'
            });

            this.isInitialized = true;

            console.log(`✅ Container initialized for conversation: ${this.conversationId}`);
            console.log(`📦 Container ID: ${this.containerId}`);
            console.log(`🚀 Boilerplate React app is ready for modifications`);

            // Verify the container is ready
            const verifyResult = await this.executeCommand('pwd && ls -la');
            if (verifyResult.exitCode === 0) {
                console.log(`✅ Container verified and ready`);
            } else {
                console.warn(`⚠️ Container verification failed:`, verifyResult.stderr);
            }

        } catch (error) {
            console.error(`❌ Failed to initialize container:`, error);
            throw new Error(`Container initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Main command execution interface - executes bash commands in the Docker container
     * This replaces the mock terminal implementation with real Docker exec
     */
    async executeCommand(command: string): Promise<CommandResult> {
        // Ensure container is initialized
        if (!this.isInitialized || !this.containerId) {
            await this.initialize();
        }

        if (!this.containerId) {
            throw new Error('Container not available after initialization');
        }

        try {
            console.log(`🔧 Executing in container: ${command}`);

            const result = await this.runtime.executeCommand(this.containerId, command);

            console.log(`✅ Command completed with exit code: ${result.exitCode}`);
            if (result.stderr && result.exitCode !== 0) {
                console.warn(`⚠️ Command stderr:`, result.stderr);
            }

            return result;

        } catch (error) {
            console.error(`❌ Command execution failed:`, error);
            return {
                stdout: '',
                stderr: `Container execution failed: ${error instanceof Error ? error.message : String(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Start the development server and return the URL
     * This replaces the mock dev server with real pnpm dev execution
     */
    async startDevServer(): Promise<CommandResult> {
        try {
            if (!this.containerId) {
                await this.initialize();
            }

            console.log('🚀 Starting development server in container...');

            // Start pnpm dev in background and get the URL
            const startResult = await this.executeCommand('pnpm run dev &');

            if (startResult.exitCode !== 0) {
                console.error('❌ Failed to start development server');
                return startResult;
            }

            // Get the container URL (which includes the mapped port)
            if (!this.containerId) {
                throw new Error('Container ID not available');
            }
            const url = await this.runtime.getContainerUrl(this.containerId);

            console.log(`✅ Development server started at: ${url}`);

            return {
                stdout: `Development server started successfully!\nLocal: ${url}\nContainer: ${this.containerId}\n\n${startResult.stdout}`,
                stderr: startResult.stderr,
                exitCode: 0
            };

        } catch (error) {
            console.error('❌ Failed to start development server:', error);
            return {
                stdout: '',
                stderr: `Failed to start development server: ${error instanceof Error ? error.message : String(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Get running development server info
     * This uses the container runtime to check if the dev server is running
     */
    getDevServerInfo(): { isRunning: boolean; url?: string; port?: number } {
        if (!this.containerId) {
            return { isRunning: false };
        }

        try {
            // Check if container is running (dev server runs inside container)
            // This is a synchronous interface so we'll return basic info
            return {
                isRunning: this.isInitialized,
                url: `http://localhost:${this.getContainerPort()}`,
                port: this.getContainerPort()
            };
        } catch (error) {
            return { isRunning: false };
        }
    }

    /**
     * Get the container's mapped port (simplified for demo)
     */
    private getContainerPort(): number {
        // The Docker Container Manager maps to random ports
        // For now, we'll return a default since the actual port is managed by the runtime
        return 3001;
    }

    /**
     * Stop the development server
     * This stops processes within the container
     */
    async stopDevServer(): Promise<boolean> {
        if (!this.containerId) {
            return false;
        }

        try {
            console.log('🛑 Stopping development server in container...');

            // Kill any running dev server processes
            const killResult = await this.executeCommand('pkill -f "vite\\|dev" || true');

            console.log('🛑 Development server stopped');
            return true;

        } catch (error) {
            console.error('❌ Failed to stop development server:', error);
            return false;
        }
    }

    /**
     * Upload files to the container
     * This replaces direct file system writes with container file operations
     */
    async uploadFiles(files: { path: string; content: string; mode?: string }[]): Promise<void> {
        if (!this.containerId) {
            await this.initialize();
        }

        if (!this.containerId) {
            throw new Error('Container not available');
        }

        const uploads: FileUpload[] = files.map(file => ({
            path: file.path,
            content: file.content,
            mode: file.mode || '0644'
        }));

        await this.runtime.uploadFiles(this.containerId, uploads);
        console.log(`📁 Uploaded ${files.length} files to container`);
    }

    /**
     * Download files from the container
     * This provides access to generated files
     */
    async downloadFiles(paths: string[]): Promise<{ path: string; content: string; size: number; modified: Date }[]> {
        if (!this.containerId) {
            throw new Error('Container not initialized');
        }

        const downloads = await this.runtime.downloadFiles(this.containerId, paths);
        console.log(`📁 Downloaded ${downloads.length} files from container`);

        return downloads;
    }

    /**
     * Get container statistics and info
     */
    async getContainerInfo(): Promise<any> {
        if (!this.containerId) {
            return { isRunning: false, error: 'Container not initialized' };
        }

        try {
            const info = await this.runtime.getContainerInfo(this.containerId);
            const stats = await this.runtime.getContainerStats(this.containerId);

            return {
                isRunning: true,
                info,
                stats,
                containerId: this.containerId
            };
        } catch (error) {
            return {
                isRunning: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Cleanup the container
     * This replaces cleanup of temporary directories with container cleanup
     */
    async cleanup(): Promise<void> {
        if (this.containerId) {
            try {
                console.log(`🧹 Cleaning up container for conversation: ${this.conversationId}`);
                await this.runtime.stopContainer(this.containerId);
                console.log(`✅ Container cleaned up: ${this.containerId}`);
            } catch (error) {
                console.error(`❌ Container cleanup failed:`, error);
            }

            this.containerId = undefined;
            this.isInitialized = false;
        }
    }

    /**
     * Legacy compatibility method for getting workspace directory
     * Returns container working directory path
     */
    get workDir(): string {
        return `/tmp/app-builder-containers/${this.conversationId}`;
    }
}

/**
 * Helper function to safely extract error message from unknown error (for compatibility)
 */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
