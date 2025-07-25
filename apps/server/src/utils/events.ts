import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
    AgUiEvent,
    AgUiEventType,
    Context,
    ConversationSnapshot,
    generateUUID,
    getTimestamp,
    createSnapshot,
    serializeSnapshot,
    deserializeSnapshot,
    validateSnapshot,
    isValidConversationId
} from '@shared/index.js';

/**
 * Emits an AG-UI event to a WebSocket client
 */
export function emitEvent(ws: WebSocket, event: Omit<AgUiEvent, 'sessionId' | 'eventId' | 'timestamp'> & { sessionId?: string }): void {
    try {
        const completeEvent: AgUiEvent = {
            sessionId: event.sessionId || generateUUID(),
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: event.type,
            payload: event.payload
        };

        const eventData = JSON.stringify(completeEvent);
        ws.send(eventData);
        
        console.log(`📤 Sent ${event.type} event:`, completeEvent.payload);
    } catch (error) {
        console.error('❌ Failed to emit event:', error);
    }
}

/**
 * Loads conversation context from client state or storage
 */
export async function loadContext(conversationId: string | null, clientState: any): Promise<Context> {
    try {
        // If no conversation ID, this is a new conversation
        if (!conversationId) {
            const newConversationId = generateUUID();
            console.log(`🆕 Creating new conversation: ${newConversationId}`);
            
            return {
                conversationId: newConversationId,
                events: new EventEmitter(),
                isFirstRequest: true,
                userInput: '',
                retryCount: 0
            };
        }

        // Validate conversation ID format
        if (!isValidConversationId(conversationId)) {
            throw new Error(`Invalid conversation ID format: ${conversationId}`);
        }

        // Try to restore from client state first
        if (clientState && typeof clientState === 'object') {
            console.log(`🔄 Restoring context from client state for: ${conversationId}`);
            
            return {
                conversationId,
                events: new EventEmitter(),
                isFirstRequest: false,
                userInput: '',
                retryCount: clientState.retryCount || 0,
                requirements: clientState.requirements,
                wireframe: clientState.wireframe,
                generatedCode: clientState.generatedCode,
                lastError: clientState.lastError
            };
        }

        // TODO: In future tasks, try to load from Azure Blob Storage if client state is missing
        // For now, create a new context but mark as not first request
        console.log(`⚠️  No client state found for: ${conversationId}, creating fresh context`);
        
        return {
            conversationId,
            events: new EventEmitter(),
            isFirstRequest: false,
            userInput: '',
            retryCount: 0
        };

    } catch (error) {
        console.error('❌ Failed to load context:', error);
        
        // Fallback to new conversation
        const fallbackId = generateUUID();
        return {
            conversationId: fallbackId,
            events: new EventEmitter(),
            isFirstRequest: true,
            userInput: '',
            retryCount: 0,
            lastError: {
                agent: 'context-loader',
                error: error instanceof Error ? error.message : 'Context load failed',
                timestamp: getTimestamp()
            }
        };
    }
}

/**
 * Persists conversation snapshot asynchronously
 */
export async function persistSnapshot(context: Context, events: AgUiEvent[] = []): Promise<void> {
    try {
        // Create snapshot
        const snapshot = createSnapshot(
            context.conversationId,
            context,
            events
        );

        // For now, just log the snapshot (Azure Blob Storage will be implemented later)
        console.log(`💾 Persisting snapshot for conversation: ${context.conversationId}`);
        console.log(`📊 Snapshot contains ${events.length} events`);
        
        // TODO: Save to Azure Blob Storage in future tasks
        // const serialized = serializeSnapshot(snapshot);
        // await azureBlobStorage.uploadSnapshot(context.conversationId, serialized);
        
    } catch (error) {
        console.error('❌ Failed to persist snapshot:', error);
        // Don't throw - persistence failures shouldn't break the main flow
    }
}

/**
 * Creates a context with event emitter for agent communication
 */
export function createContextWithEvents(baseContext: Context): Context {
    return {
        ...baseContext,
        events: new EventEmitter()
    };
}

/**
 * Extracts client state from context for transmission
 */
export function extractClientState(context: Context): any {
    return {
        retryCount: context.retryCount || 0,
        requirements: context.requirements,
        wireframe: context.wireframe,
        generatedCode: context.generatedCode,
        lastError: context.lastError
    };
}

/**
 * Validates that a WebSocket is ready for communication
 */
export function isWebSocketReady(ws: WebSocket): boolean {
    return ws.readyState === WebSocket.OPEN;
}

/**
 * Safely sends data to WebSocket with error handling
 */
export function safeSend(ws: WebSocket, data: string): boolean {
    try {
        if (isWebSocketReady(ws)) {
            ws.send(data);
            return true;
        } else {
            console.warn('⚠️  WebSocket not ready for sending data');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to send WebSocket data:', error);
        return false;
    }
}
