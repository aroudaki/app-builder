import { EventEmitter } from 'events';
import { AgUiEvent, EventType, Context } from '@shared/index.js';

/**
 * Emit an AG-UI compliant event via WebSocket
 */
export function emitEvent(ws: any, event: AgUiEvent): void {
    try {
        ws.send(JSON.stringify(event));
    } catch (error) {
        console.error('Failed to emit event:', error);
    }
}

/**
 * Load context from state or create new context
 */
export async function loadContext(
    state?: Record<string, any>,
    messages?: any[]
): Promise<Context> {
    return {
        conversationId: state?.conversationId || generateId(),
        events: new EventEmitter(),
        isFirstRequest: !state || Object.keys(state).length === 0,
        userInput: messages?.[messages.length - 1]?.content || '',
        messages: messages || [],
        state: state || {},
        retryCount: state?.retryCount || 0
    };
}

/**
 * Persist snapshot asynchronously (fire-and-forget for POC)
 */
export async function persistSnapshot(context: Context): Promise<void> {
    try {
        // In production, this would persist to blob storage
        // For POC, we'll just log
        console.log('Persisting snapshot for conversation:', context.conversationId);
    } catch (error) {
        console.error('Failed to persist snapshot:', error);
    }
}

/**
 * Generate unique ID for events and messages
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
