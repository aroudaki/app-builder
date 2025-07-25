import { WebSocket } from 'ws';
import {
    ClientMessage,
    AgUiEventType,
    AgUiEvent,
    generateUUID,
    getTimestamp,
    sanitizeInput
} from '@shared/index.js';
import { emitEvent, loadContext, persistSnapshot, extractClientState } from '../utils/events.js';
import { runPipeline } from '../orchestrator/pipeline.js';

/**
 * Handles incoming WebSocket messages and orchestrates the AG-UI flow
 */
export async function handleWebSocketMessage(ws: WebSocket, message: ClientMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
        console.log(`📨 Received ${message.type} message:`, {
            messageId: message.messageId,
            conversationId: message.conversationId,
            contentPreview: typeof message.content === 'string' 
                ? message.content.substring(0, 100) + '...'
                : JSON.stringify(message.content).substring(0, 100) + '...'
        });

        // 1. Load context from client state or storage
        const context = await loadContext(message.conversationId, message.clientState);
        
        // 2. Update context with new user input
        const userInput = typeof message.content === 'string' 
            ? message.content 
            : message.content?.text || JSON.stringify(message.content);
            
        const sanitizedInput = sanitizeInput(userInput);
        
        const updatedContext = {
            ...context,
            userInput: sanitizedInput,
            retryCount: context.retryCount || 0
        };

        console.log(`🔍 Processing request for conversation: ${updatedContext.conversationId}`);
        console.log(`📝 User input: "${sanitizedInput}"`);
        console.log(`🔄 Is first request: ${updatedContext.isFirstRequest}`);

        // Send acknowledgment event
        emitEvent(ws, {
            sessionId: updatedContext.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: `Processing your request: "${sanitizedInput}"` }
        });

        // 3. Select and run the appropriate pipeline
        const finalContext = await runPipeline(updatedContext, ws);
        
        // 4. Persist snapshot asynchronously (fire-and-forget)
        const clientState = extractClientState(finalContext);
        persistSnapshot(finalContext, []).catch(error => {
            console.error('⚠️  Snapshot persistence failed (non-blocking):', error);
        });

        // 5. Send completion event with updated client state
        const completionEvent: AgUiEvent = {
            sessionId: finalContext.conversationId,
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: AgUiEventType.SESSION_COMPLETE,
            payload: {
                success: true,
                clientState,
                processingTime: Date.now() - startTime
            }
        };

        ws.send(JSON.stringify(completionEvent));
        
        console.log(`✅ Request completed successfully in ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error('❌ Error in handleWebSocketMessage:', error);

        // Create error context for recovery
        const errorContext = {
            conversationId: message.conversationId || generateUUID(),
            lastError: {
                agent: 'websocket-handler',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: getTimestamp()
            },
            retryCount: ((message.clientState?.retryCount || 0) + 1)
        };

        // Send error event with recovery information
        const errorEvent: AgUiEvent = {
            sessionId: errorContext.conversationId,
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: AgUiEventType.ERROR,
            payload: {
                message: error instanceof Error ? error.message : 'Unknown error occurred',
                recoverable: errorContext.retryCount < 3,
                retryCount: errorContext.retryCount,
                clientState: extractClientState(errorContext as any)
            }
        };

        try {
            ws.send(JSON.stringify(errorEvent));
        } catch (sendError) {
            console.error('❌ Failed to send error event:', sendError);
        }
    }
}

/**
 * Creates an AG-UI compatible WebSocket handler
 * This function provides the interface that matches the architecture document's `createAgentHandler`
 */
export function createAgentHandler() {
    return {
        handleMessage: handleWebSocketMessage,
        
        // Additional handler methods for future expansion
        handleConnection: (ws: WebSocket, request: any) => {
            console.log(`🔗 New WebSocket connection established`);
            
            // Send welcome event
            emitEvent(ws, {
                type: AgUiEventType.TEXT_MESSAGE_CONTENT,
                payload: { text: 'Connected to AI App Generator. Send a message to start building your application!' }
            });
        },
        
        handleDisconnection: (ws: WebSocket, code: number, reason: string) => {
            console.log(`🔌 WebSocket disconnected - Code: ${code}, Reason: ${reason}`);
        },
        
        handleError: (ws: WebSocket, error: Error) => {
            console.error('🚨 WebSocket error:', error);
        }
    };
}
