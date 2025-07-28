import { ContainerRuntime } from './types.js';
import { DockerContainerManager } from './DockerContainerManager.js';

/**
 * Container Runtime Factory
 * Creates the appropriate container runtime based on configuration
 */
export class ContainerRuntimeFactory {
    private static instance: ContainerRuntime | null = null;

    /**
     * Create or get the singleton container runtime instance
     */
    static create(): ContainerRuntime {
        if (!ContainerRuntimeFactory.instance) {
            const runtime = process.env.CONTAINER_RUNTIME || 'docker';

            switch (runtime.toLowerCase()) {
                case 'docker':
                    ContainerRuntimeFactory.instance = new DockerContainerManager();
                    break;
                case 'azure':
                    // TODO: Implement Azure Container Manager
                    throw new Error('Azure container runtime not yet implemented. Use CONTAINER_RUNTIME=docker for now.');
                default:
                    throw new Error(`Unknown container runtime: ${runtime}. Supported runtimes: docker, azure`);
            }
        }

        return ContainerRuntimeFactory.instance;
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset(): void {
        ContainerRuntimeFactory.instance = null;
    }

    /**
     * Get the current runtime type
     */
    static getCurrentRuntimeType(): string {
        return process.env.CONTAINER_RUNTIME || 'docker';
    }

    /**
     * Check if a runtime is supported
     */
    static isRuntimeSupported(runtime: string): boolean {
        return ['docker', 'azure'].includes(runtime.toLowerCase());
    }

    /**
     * Get list of supported runtimes
     */
    static getSupportedRuntimes(): string[] {
        return ['docker', 'azure'];
    }
}
