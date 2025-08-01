import { WebSocket } from 'ws';
import {
    RunAgentInput,
    EventType,
    AgUiEvent,
    generateUUID,
    Context
} from '@shared/index.js';
import { emitEvent, loadContext, persistSnapshot, generateId } from '../utils/events.js';
import { runAppBuilder, stateToAGUIContext, aguiContextToState } from '../langgraph/index.js';

/**
 * Handles incoming AG-UI WebSocket messages and orchestrates the pipeline flow
 */
export async function handleWebSocketMessage(ws: WebSocket, input: RunAgentInput): Promise<void> {
    const startTime = Date.now();

    try {
        const lastMessage = input.messages[input.messages.length - 1];
        console.log(`📨 Received AG-UI input:`, {
            conversationId: input.conversationId,
            messageCount: input.messages.length,
            toolCount: input.tools?.length || 0,
            lastMessageLength: lastMessage?.content?.length || 0,
            lastMessagePreview: lastMessage?.content ?
                lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '') :
                'No content',
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

        // Convert AG-UI context to LangGraph state
        const langGraphState = aguiContextToState(updatedContext, input.conversationId);

        // Execute LangGraph App Builder
        const finalLangGraphState = await runAppBuilder(
            updatedContext.userInput,
            langGraphState,
            input.conversationId
        );

        // Debug: Check what events were stored
        console.log(`🔍 Final state aguiEvents count: ${finalLangGraphState.aguiEvents?.length || 0}`);
        if (finalLangGraphState.aguiEvents?.length > 0) {
            console.log(`📋 Event types: ${finalLangGraphState.aguiEvents.map(e => e.type).join(', ')}`);
        }

        // Emit any stored AG-UI events from the graph execution
        if (finalLangGraphState.aguiEvents && finalLangGraphState.aguiEvents.length > 0) {
            console.log(`📤 Emitting ${finalLangGraphState.aguiEvents.length} stored AG-UI events`);
            for (const storedEvent of finalLangGraphState.aguiEvents) {
                emitEvent(ws, storedEvent);
            }
        }

        // Convert LangGraph state back to AG-UI context
        const finalContext = stateToAGUIContext(finalLangGraphState);

        // Emit state snapshot
        const stateSnapshotEvent: AgUiEvent = {
            type: EventType.STATE_SNAPSHOT,
            conversationId: input.conversationId,
            state: finalContext.state || {},
            allowContinue: finalContext.state?.conversationState === 'awaiting_clarification_response',
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
