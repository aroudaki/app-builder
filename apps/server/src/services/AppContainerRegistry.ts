import { AppContainer } from '../tools/appContainer.js';

/**
 * Registry to manage AppContainer instances per conversation
 * Ensures containers persist across agent executions within the same conversation
 */
export class AppContainerRegistry {
    private static containers: Map<string, AppContainer> = new Map();

    /**
     * Get or create an AppContainer for a conversation
     */
    static async getContainer(conversationId: string): Promise<AppContainer> {
        let container = this.containers.get(conversationId);

        if (!container) {
            console.log(`🐳 Creating new AppContainer for conversation: ${conversationId}`);
            container = new AppContainer(conversationId);
            this.containers.set(conversationId, container);

            // Initialize the container
            await container.initialize();
        } else {
            console.log(`🐳 Reusing existing AppContainer for conversation: ${conversationId}`);
        }

        return container;
    }

    /**
     * Check if a container exists for a conversation
     */
    static hasContainer(conversationId: string): boolean {
        return this.containers.has(conversationId);
    }

    /**
     * Remove and cleanup a container for a conversation
     */
    static async removeContainer(conversationId: string): Promise<void> {
        const container = this.containers.get(conversationId);
        if (container) {
            console.log(`🧹 Removing AppContainer for conversation: ${conversationId}`);
            await container.cleanup();
            this.containers.delete(conversationId);
        }
    }

    /**
     * Cleanup all containers (for shutdown)
     */
    static async cleanup(): Promise<void> {
        console.log(`🧹 Cleaning up all AppContainers (${this.containers.size} containers)`);
        const cleanupPromises = Array.from(this.containers.values()).map(container =>
            container.cleanup().catch(error =>
                console.error('Failed to cleanup container:', error)
            )
        );

        await Promise.all(cleanupPromises);
        this.containers.clear();
    }

    /**
     * Get container info for all active containers
     */
    static getActiveContainers(): string[] {
        return Array.from(this.containers.keys());
    }
}
