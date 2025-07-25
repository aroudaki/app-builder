import { WebSocket } from 'ws';
import {
    ClientMessage,
    AgUiEventType,
    AgUiEvent,
    generateUUID,
    getTimestamp
} from '@shared/index.js';

export async function handleWebSocketMessage(ws: WebSocket, message: ClientMessage): Promise<void> {
    try {
        console.log('Received message:', message);

        // Create AG-UI compliant event
        const response: AgUiEvent = {
            sessionId: message.conversationId || generateUUID(),
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: {
                text: `Echo: ${JSON.stringify(message.content)}`
            }
        };

        ws.send(JSON.stringify(response));

        // Send completion event
        const completionEvent: AgUiEvent = {
            sessionId: response.sessionId,
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: AgUiEventType.SESSION_COMPLETE,
            payload: {
                success: true
            }
        };

        ws.send(JSON.stringify(completionEvent));

    } catch (error) {
        console.error('Error in handleWebSocketMessage:', error);

        const errorEvent: AgUiEvent = {
            sessionId: message.conversationId || generateUUID(),
            eventId: generateUUID(),
            timestamp: getTimestamp(),
            type: AgUiEventType.ERROR,
            payload: {
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: true
            }
        };

        ws.send(JSON.stringify(errorEvent));
    }
}
