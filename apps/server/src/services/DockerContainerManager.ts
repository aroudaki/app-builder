import Docker from 'dockerode';
import { Readable } from 'stream';
import {
    ContainerRuntime,
    ContainerConfig,
    CommandResult,
    FileUpload,
    FileDownload,
    ContainerInfo,
    ContainerStats,
    ContainerCreateOptions,
    ExecOptions,
    StreamResult,
    ContainerError,
    ContainerNotFoundError,
    ContainerExecutionError,
    ContainerTimeoutError,
    SecurityOptions,
    ResourceLimits
} from './types.js';

/**
 * Docker Container Manager
 * Implements the ContainerRuntime interface using Docker Desktop/Engine
 */
export class DockerContainerManager implements ContainerRuntime {
    private docker: Docker;
    private containers: Map<string, Docker.Container> = new Map();
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly COMMAND_TIMEOUT = 60000; // 60 seconds for command execution

    constructor() {
        this.docker = new Docker({
            socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
        });
    }

    /**
     * Create and start a new container
     */
    async createContainer(config: ContainerConfig): Promise<string> {
        try {
            const containerName = `app-builder-${config.conversationId}`;

            // Check if container already exists and remove it
            await this.removeExistingContainer(containerName);

            const containerOptions = this.buildContainerOptions(config, containerName);

            console.log(`🐳 Creating Docker container: ${containerName}`);
            const container = await this.docker.createContainer(containerOptions);

            console.log(`🚀 Starting container: ${containerName}`);
            await container.start();

            // Store container reference
            this.containers.set(config.conversationId, container);

            // Wait for container to be fully ready
            await this.waitForContainer(container);

            console.log(`✅ Container ${containerName} is ready`);
            return container.id;
        } catch (error) {
            throw new ContainerError(
                `Failed to create container for conversation ${config.conversationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CREATE_FAILED',
                config.conversationId
            );
        }
    }

    /**
     * Execute a command in the container
     */
    async executeCommand(containerId: string, command: string): Promise<CommandResult> {
        try {
            const container = await this.getContainer(containerId);

            console.log(`🔧 Executing command in container ${containerId}: ${command}`);

            const execOptions: ExecOptions = {
                Cmd: ['bash', '-c', command],
                AttachStdout: true,
                AttachStderr: true,
                WorkingDir: '/generated-app',
                Env: [
                    'TERM=xterm',
                    'PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
                    'NODE_ENV=development'
                ]
            };

            const exec = await container.exec(execOptions);
            const stream = await exec.start({ Detach: false });

            const result = await this.parseExecStream(stream);

            // Get the exit code
            const inspectResult = await exec.inspect();
            result.exitCode = inspectResult.ExitCode || 0;

            console.log(`📋 Command completed with exit code: ${result.exitCode}`);
            return result;
        } catch (error) {
            if (error instanceof ContainerError) {
                throw error;
            }
            throw new ContainerExecutionError(
                `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`,
                1,
                containerId
            );
        }
    }

    /**
     * Get the URL to access the container's dev server
     */
    async getContainerUrl(containerId: string): Promise<string> {
        try {
            const container = await this.getContainer(containerId);
            const containerInfo = await container.inspect();

            // Find the port mapping for 3001 (dev server port)
            const portBindings = containerInfo.NetworkSettings?.Ports?.['3001/tcp'];
            if (portBindings && portBindings.length > 0) {
                const hostPort = portBindings[0].HostPort;
                return `http://localhost:${hostPort}`;
            }

            throw new ContainerError('No port mapping found for dev server', 'NO_PORT_MAPPING', containerId);
        } catch (error) {
            if (error instanceof ContainerError) {
                throw error;
            }
            throw new ContainerError(
                `Failed to get container URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'URL_ERROR',
                containerId
            );
        }
    }

    /**
     * Upload files to the container using base64 encoding
     */
    async uploadFiles(containerId: string, files: FileUpload[]): Promise<void> {
        try {
            for (const file of files) {
                const encodedContent = Buffer.from(file.content).toString('base64');
                const command = `echo '${encodedContent}' | base64 -d > '${file.path}'`;

                await this.executeCommand(containerId, command);

                // Set file permissions if specified
                if (file.mode) {
                    await this.executeCommand(containerId, `chmod ${file.mode} '${file.path}'`);
                }
            }
        } catch (error) {
            throw new ContainerError(
                `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'UPLOAD_ERROR',
                containerId
            );
        }
    }

    /**
     * Download files from the container
     */
    async downloadFiles(containerId: string, paths: string[]): Promise<FileDownload[]> {
        try {
            const downloads: FileDownload[] = [];

            for (const filePath of paths) {
                // Check if file exists and get stats
                const statResult = await this.executeCommand(containerId, `stat -c '%s %Y' '${filePath}' 2>/dev/null || echo 'NOT_FOUND'`);

                if (statResult.stdout.trim() === 'NOT_FOUND') {
                    continue; // Skip non-existent files
                }

                const [sizeStr, modifiedStr] = statResult.stdout.trim().split(' ');
                const size = parseInt(sizeStr, 10);
                const modified = new Date(parseInt(modifiedStr, 10) * 1000);

                // Read file content using base64 encoding
                const contentResult = await this.executeCommand(containerId, `base64 '${filePath}'`);

                if (contentResult.exitCode === 0) {
                    const content = Buffer.from(contentResult.stdout.trim(), 'base64').toString('utf-8');
                    downloads.push({
                        path: filePath,
                        content,
                        size,
                        modified
                    });
                }
            }

            return downloads;
        } catch (error) {
            throw new ContainerError(
                `Failed to download files: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DOWNLOAD_ERROR',
                containerId
            );
        }
    }

    /**
     * Get container information
     */
    async getContainerInfo(containerId: string): Promise<ContainerInfo> {
        try {
            const container = await this.getContainer(containerId);
            const containerData = await container.inspect();

            return {
                id: containerData.Id,
                name: containerData.Name.replace(/^\//, ''), // Remove leading slash
                status: containerData.State.Status,
                ports: this.extractPortMappings(containerData),
                created: new Date(containerData.Created),
                conversationId: this.extractConversationId(containerData.Name)
            };
        } catch (error) {
            throw new ContainerError(
                `Failed to get container info: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'INFO_ERROR',
                containerId
            );
        }
    }

    /**
     * Get container statistics
     */
    async getContainerStats(containerId: string): Promise<ContainerStats> {
        try {
            const container = await this.getContainer(containerId);
            const stats = await container.stats({ stream: false });

            // Calculate memory usage
            const memoryUsage = stats.memory_stats?.usage || 0;
            const memoryLimit = stats.memory_stats?.limit || 0;
            const memoryPercentage = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

            // Calculate CPU usage
            const cpuDelta = stats.cpu_stats?.cpu_usage?.total_usage - stats.precpu_stats?.cpu_usage?.total_usage;
            const systemDelta = stats.cpu_stats?.system_cpu_usage - stats.precpu_stats?.system_cpu_usage;
            const cpuPercentage = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

            // Network stats
            const networks = stats.networks || {};
            const networkRx = Object.values(networks).reduce((sum: number, net: any) => sum + (net.rx_bytes || 0), 0);
            const networkTx = Object.values(networks).reduce((sum: number, net: any) => sum + (net.tx_bytes || 0), 0);

            return {
                memory: {
                    usage: memoryUsage,
                    limit: memoryLimit,
                    percentage: memoryPercentage
                },
                cpu: {
                    usage: cpuDelta || 0,
                    percentage: cpuPercentage
                },
                network: {
                    rx: networkRx,
                    tx: networkTx
                }
            };
        } catch (error) {
            throw new ContainerError(
                `Failed to get container stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'STATS_ERROR',
                containerId
            );
        }
    }

    /**
     * Check if container is running
     */
    async isContainerRunning(containerId: string): Promise<boolean> {
        try {
            const container = await this.getContainer(containerId);
            const containerData = await container.inspect();
            return containerData.State.Status === 'running';
        } catch (error) {
            return false; // Container not found or error - consider it not running
        }
    }

    /**
     * Stop and remove the container
     */
    async stopContainer(containerId: string): Promise<void> {
        try {
            const conversationId = this.findConversationId(containerId);
            const container = await this.getContainer(containerId);

            console.log(`🛑 Stopping container: ${containerId}`);

            try {
                await container.stop({ t: 10 }); // Give 10 seconds to gracefully stop
            } catch (error) {
                console.warn(`Container may already be stopped: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            console.log(`🗑️ Removing container: ${containerId}`);
            await container.remove({ force: true });

            // Remove from our tracking
            if (conversationId) {
                this.containers.delete(conversationId);
            }

            console.log(`✅ Container removed: ${containerId}`);
        } catch (error) {
            throw new ContainerError(
                `Failed to stop container: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'STOP_ERROR',
                containerId
            );
        }
    }

    /**
     * List all containers managed by this runtime
     */
    async listContainers(): Promise<ContainerInfo[]> {
        try {
            const containers = await this.docker.listContainers({
                all: true,
                filters: { name: ['app-builder-'] }
            });

            return containers.map(container => ({
                id: container.Id,
                name: container.Names[0]?.replace(/^\//, '') || 'unknown',
                status: container.Status,
                ports: container.Ports?.map(p => `${p.PublicPort || '?'}:${p.PrivatePort}/${p.Type}`) || [],
                created: new Date((container.Created || 0) * 1000),
                conversationId: this.extractConversationId(container.Names[0] || '')
            }));
        } catch (error) {
            throw new ContainerError(
                `Failed to list containers: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'LIST_ERROR'
            );
        }
    }

    /**
     * Clean up all containers (for maintenance)
     */
    async cleanup(): Promise<void> {
        try {
            console.log('🧹 Starting container cleanup...');

            const containers = await this.listContainers();
            const cleanupPromises = containers.map(container =>
                this.stopContainer(container.id).catch(error =>
                    console.warn(`Failed to cleanup container ${container.id}:`, error)
                )
            );

            await Promise.all(cleanupPromises);
            this.containers.clear();

            console.log(`✅ Cleanup completed. Removed ${containers.length} containers.`);
        } catch (error) {
            throw new ContainerError(
                `Failed to cleanup containers: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CLEANUP_ERROR'
            );
        }
    }

    // Private helper methods

    private async getContainer(containerId: string): Promise<Docker.Container> {
        // First try to get from our tracked containers by conversation ID
        const trackedContainer = this.containers.get(containerId);
        if (trackedContainer) {
            return trackedContainer;
        }

        // If not found, try to get by actual container ID
        try {
            const container = this.docker.getContainer(containerId);
            await container.inspect(); // Verify it exists
            return container;
        } catch (error) {
            throw new ContainerNotFoundError(containerId);
        }
    }

    private async removeExistingContainer(containerName: string): Promise<void> {
        try {
            const existingContainer = this.docker.getContainer(containerName);
            await existingContainer.inspect(); // Check if it exists

            console.log(`🗑️ Removing existing container: ${containerName}`);
            try {
                await existingContainer.stop({ t: 5 });
            } catch (error) {
                // Container might already be stopped
            }
            await existingContainer.remove({ force: true });
        } catch (error) {
            // Container doesn't exist, which is fine
        }
    }

    private buildContainerOptions(config: ContainerConfig, containerName: string): ContainerCreateOptions {
        const securityOptions = this.getSecurityOptions();
        const resourceLimits = this.getResourceLimits(config);

        return {
            Image: config.image || 'app-builder-base:latest',
            name: containerName,
            Env: [
                `CONVERSATION_ID=${config.conversationId}`,
                'NODE_ENV=development',
                'TERM=xterm',
                ...Object.entries(config.environment || {}).map(([key, value]) => `${key}=${value}`)
            ],
            WorkingDir: config.workingDir || '/generated-app',
            ExposedPorts: {
                '3001/tcp': {}
            },
            HostConfig: {
                Memory: resourceLimits.memory,
                MemorySwap: resourceLimits.memorySwap,
                CpuShares: resourceLimits.cpuShares,
                CpuQuota: resourceLimits.cpuQuota,
                CpuPeriod: resourceLimits.cpuPeriod,
                PidsLimit: resourceLimits.pidsLimit,
                AutoRemove: false, // We manage removal manually
                NetworkMode: 'bridge',
                PortBindings: {
                    '3001/tcp': [{ HostPort: config.port?.toString() || '0' }] // 0 = random port
                },
                ReadonlyRootfs: securityOptions.readonlyRootfs,
                CapDrop: securityOptions.capDrop,
                CapAdd: securityOptions.capAdd,
                SecurityOpt: securityOptions.securityOpt
            }
        };
    }

    private getSecurityOptions(): SecurityOptions {
        return {
            readonlyRootfs: false, // Need write access for development
            capDrop: ['ALL'],
            capAdd: ['CHOWN', 'SETUID', 'SETGID', 'DAC_OVERRIDE'],
            securityOpt: ['no-new-privileges']
        };
    }

    private getResourceLimits(config: ContainerConfig): ResourceLimits {
        const memory = config.memory || 512 * 1024 * 1024; // 512MB default

        return {
            memory,
            memorySwap: memory, // No additional swap
            cpuShares: config.cpu || 512, // Default weight
            cpuQuota: 50000, // 50% of one CPU core
            cpuPeriod: 100000, // 100ms period
            pidsLimit: 100 // Limit number of processes
        };
    }

    private async waitForContainer(container: Docker.Container, timeout: number = DockerContainerManager.DEFAULT_TIMEOUT): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const containerData = await container.inspect();
                if (containerData.State.Status === 'running' && containerData.State.Health?.Status !== 'starting') {
                    return; // Container is ready
                }
            } catch (error) {
                // Container might not be fully created yet
            }

            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        }

        throw new ContainerTimeoutError(container.id, timeout);
    }

    private async parseExecStream(stream: NodeJS.ReadableStream): Promise<StreamResult> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            // Docker multiplexes stdout and stderr in a single stream
            // The format is: [STREAM_TYPE][SIZE][PAYLOAD]
            stream.on('data', (chunk: Buffer) => {
                if (chunk.length < 8) return; // Invalid chunk

                const streamType = chunk[0];
                const size = chunk.readUInt32BE(4);
                const payload = chunk.slice(8, 8 + size).toString();

                if (streamType === 1) {
                    stdout += payload;
                } else if (streamType === 2) {
                    stderr += payload;
                }
            });

            stream.on('end', () => {
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: 0 // Will be updated by caller
                });
            });

            stream.on('error', (error) => {
                reject(new ContainerExecutionError(`Stream error: ${error.message}`, 1));
            });

            // Add timeout protection
            const timeout = setTimeout(() => {
                reject(new ContainerTimeoutError('stream', DockerContainerManager.COMMAND_TIMEOUT));
            }, DockerContainerManager.COMMAND_TIMEOUT);

            stream.on('end', () => clearTimeout(timeout));
            stream.on('error', () => clearTimeout(timeout));
        });
    }

    private extractPortMappings(containerData: any): string[] {
        const ports: string[] = [];
        const portBindings = containerData.NetworkSettings?.Ports || {};

        for (const [containerPort, hostBindings] of Object.entries(portBindings)) {
            if (Array.isArray(hostBindings)) {
                hostBindings.forEach((binding: any) => {
                    ports.push(`${binding.HostPort}:${containerPort}`);
                });
            }
        }

        return ports;
    }

    private extractConversationId(containerName: string): string {
        const match = containerName.match(/app-builder-(.+)/);
        return match ? match[1] : 'unknown';
    }

    private findConversationId(containerId: string): string | undefined {
        for (const [conversationId, container] of this.containers.entries()) {
            if (container.id === containerId) {
                return conversationId;
            }
        }
        return undefined;
    }
}
