/**
 * Conversation Storage Utility for client-side state persistence
 * Provides localStorage integration for conversation state management
 */

export interface ConversationState {
    conversationId: string;
    clientState: any;
    timestamp: string;
    lastActivity: string;
}

/**
 * Storage interface for conversation state
 */
export const ConversationStorage = {
    /**
     * Saves conversation state to localStorage
     */
    save(conversationId: string, state: any): void {
        try {
            const conversationState: ConversationState = {
                conversationId,
                clientState: state,
                timestamp: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };

            const key = `conversation-${conversationId}`;
            const serialized = JSON.stringify(conversationState);

            localStorage.setItem(key, serialized);

            console.log(`💾 Saved conversation state for: ${conversationId}`);
        } catch (error) {
            console.error('❌ Failed to save conversation state:', error);
        }
    },

    /**
     * Loads conversation state from localStorage
     */
    load(conversationId: string): any | null {
        try {
            const key = `conversation-${conversationId}`;
            const saved = localStorage.getItem(key);

            if (!saved) {
                console.log(`📂 No saved state found for: ${conversationId}`);
                return null;
            }

            const conversationState: ConversationState = JSON.parse(saved);

            // Update last activity
            conversationState.lastActivity = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(conversationState));

            console.log(`📁 Loaded conversation state for: ${conversationId}`);
            return conversationState.clientState;

        } catch (error) {
            console.error('❌ Failed to load conversation state:', error);
            return null;
        }
    },

    /**
     * Clears conversation state from localStorage
     */
    clear(conversationId: string): void {
        try {
            const key = `conversation-${conversationId}`;
            localStorage.removeItem(key);
            console.log(`🗑️  Cleared conversation state for: ${conversationId}`);
        } catch (error) {
            console.error('❌ Failed to clear conversation state:', error);
        }
    },

    /**
     * Lists all saved conversations
     */
    listConversations(): ConversationState[] {
        try {
            const conversations: ConversationState[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('conversation-')) {
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            const conversationState: ConversationState = JSON.parse(data);
                            conversations.push(conversationState);
                        } catch (parseError) {
                            console.warn(`⚠️  Invalid conversation data for key: ${key}`);
                        }
                    }
                }
            }

            // Sort by last activity (most recent first)
            conversations.sort((a, b) =>
                new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
            );

            return conversations;
        } catch (error) {
            console.error('❌ Failed to list conversations:', error);
            return [];
        }
    },

    /**
     * Cleans up old conversations (older than specified days)
     */
    cleanup(olderThanDays: number = 30): number {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const conversations = this.listConversations();
            let cleanedCount = 0;

            conversations.forEach(conversation => {
                const lastActivity = new Date(conversation.lastActivity);
                if (lastActivity < cutoffDate) {
                    this.clear(conversation.conversationId);
                    cleanedCount++;
                }
            });

            console.log(`🧹 Cleaned up ${cleanedCount} old conversations`);
            return cleanedCount;
        } catch (error) {
            console.error('❌ Failed to cleanup conversations:', error);
            return 0;
        }
    },

    /**
     * Gets storage usage information
     */
    getStorageInfo(): { totalConversations: number; storageUsed: string } {
        try {
            const conversations = this.listConversations();

            // Calculate approximate storage used by conversations
            let totalBytes = 0;
            conversations.forEach(conversation => {
                const key = `conversation-${conversation.conversationId}`;
                const data = localStorage.getItem(key);
                if (data) {
                    totalBytes += data.length;
                }
            });

            // Convert bytes to human readable format
            const storageUsed = totalBytes > 1024
                ? `${(totalBytes / 1024).toFixed(2)} KB`
                : `${totalBytes} bytes`;

            return {
                totalConversations: conversations.length,
                storageUsed
            };
        } catch (error) {
            console.error('❌ Failed to get storage info:', error);
            return { totalConversations: 0, storageUsed: '0 bytes' };
        }
    }
};

/**
 * Auto-cleanup utility that runs periodically
 */
export class ConversationCleanup {
    private timer: NodeJS.Timeout | null = null;
    private intervalMs: number;
    private maxAgeDays: number;

    constructor(intervalMs: number = 24 * 60 * 60 * 1000, maxAgeDays: number = 30) {
        this.intervalMs = intervalMs; // Default: 24 hours
        this.maxAgeDays = maxAgeDays; // Default: 30 days
    }

    start(): void {
        if (this.timer) {
            this.stop();
        }

        console.log(`🧹 Starting conversation cleanup with ${this.maxAgeDays} day retention`);

        // Run immediate cleanup
        ConversationStorage.cleanup(this.maxAgeDays);

        // Schedule periodic cleanup
        this.timer = setInterval(() => {
            ConversationStorage.cleanup(this.maxAgeDays);
        }, this.intervalMs);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('🛑 Stopped conversation cleanup');
        }
    }
}

/**
 * React hook for conversation storage (to be used with React components)
 */
export function useConversationStorage(conversationId: string | null) {
    const saveState = (state: any) => {
        if (conversationId) {
            ConversationStorage.save(conversationId, state);
        }
    };

    const loadState = (): any | null => {
        if (conversationId) {
            return ConversationStorage.load(conversationId);
        }
        return null;
    };

    const clearState = () => {
        if (conversationId) {
            ConversationStorage.clear(conversationId);
        }
    };

    return {
        saveState,
        loadState,
        clearState,
        listConversations: ConversationStorage.listConversations,
        getStorageInfo: ConversationStorage.getStorageInfo
    };
}
