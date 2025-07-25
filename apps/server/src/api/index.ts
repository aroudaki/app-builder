import { WebSocket } from 'ws';
import {
    RunAgentInput,
    EventType,
    AgUiEvent,
    generateUUID,
    Context
} from '@shared/index.js';
import { emitEvent, loadContext, persistSnapshot, generateId } from '../utils/events.js';
import { selectPipeline } from '../orchestrator/pipeline.js';

/**
 * Handles incoming AG-UI WebSocket messages and orchestrates the pipeline flow
 */
export async function handleWebSocketMessage(ws: WebSocket, input: RunAgentInput): Promise<void> {
    const startTime = Date.now();

    try {
        console.log(`📨 Received AG-UI input:`, {
            conversationId: input.conversationId,
            messageCount: input.messages.length,
            toolCount: input.tools?.length || 0
        });

        // Emit RUN_STARTED event
        const runStartedEvent: AgUiEvent = {
            type: EventType.RUN_STARTED,
            conversationId: input.conversationId,
            timestamp: Date.now()
        };
        emitEvent(ws, runStartedEvent);

        // Load context from state or create new
        const context = await loadContext(input.state, input.messages);
        
        // Set up event listener to forward AG-UI events to WebSocket
        context.events.on('aguiEvent', (event: AgUiEvent) => {
            emitEvent(ws, event);
        });

        // Update context with input data
        const updatedContext: Context = {
            ...context,
            conversationId: input.conversationId,
            messages: input.messages,
            userInput: input.messages[input.messages.length - 1]?.content || '',
            state: input.state || {}
        };

        // Select and run pipeline
        const pipeline = selectPipeline(updatedContext);
        const finalContext = await pipeline.run(updatedContext);

        // Emit state snapshot
        const stateSnapshotEvent: AgUiEvent = {
            type: EventType.STATE_SNAPSHOT,
            conversationId: input.conversationId,
            state: finalContext.state || {},
            timestamp: Date.now()
        };
        emitEvent(ws, stateSnapshotEvent);

        // Emit messages snapshot
        const messagesSnapshotEvent: AgUiEvent = {
            type: EventType.MESSAGES_SNAPSHOT,
            conversationId: input.conversationId,
            messages: finalContext.messages,
            timestamp: Date.now()
        };
        emitEvent(ws, messagesSnapshotEvent);

        // Persist snapshot asynchronously
        persistSnapshot(finalContext).catch(error => {
            console.error('Failed to persist snapshot:', error);
        });

        // Emit RUN_FINISHED event
        const runFinishedEvent: AgUiEvent = {
            type: EventType.RUN_FINISHED,
            conversationId: input.conversationId,
            timestamp: Date.now()
        };
        emitEvent(ws, runFinishedEvent);

        console.log(`✅ Completed AG-UI flow in ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error('❌ Error in AG-UI flow:', error);

        // Emit error event
        const errorEvent: AgUiEvent = {
            type: EventType.ERROR,
            conversationId: input.conversationId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        };
        emitEvent(ws, errorEvent);
    }
}

/**
 * Creates a handler for WebSocket upgrade requests
 */
export function createAgentHandler() {
    return {
        handleUpgrade: (request: any, socket: any, head: any, callback: (ws: WebSocket) => void) => {
            // Handle WebSocket upgrade
            const conversationId = generateUUID();
            console.log(`🔗 WebSocket connection established for conversation: ${conversationId}`);
            
            const ws = new WebSocket(request.url);
            callback(ws);
        },
        
        handleConnection: (ws: WebSocket) => {
            ws.on('message', async (data: Buffer) => {
                try {
                    const input: RunAgentInput = JSON.parse(data.toString());
                    await handleWebSocketMessage(ws, input);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                    
                    const errorEvent: AgUiEvent = {
                        type: EventType.ERROR,
                        conversationId: 'unknown',
                        error: 'Invalid message format',
                        timestamp: Date.now()
                    };
                    emitEvent(ws, errorEvent);
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        }
    };
}

/**
 * Extract conversation ID from WebSocket request
 */
function extractConversationId(request: any): string {
    const url = new URL(request.url, 'http://localhost');
    return url.searchParams.get('conversationId') || generateUUID();
}
