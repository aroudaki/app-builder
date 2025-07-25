import { WebSocket } from 'ws';

export interface ClientMessage {
    type: 'user_message' | 'user_response';
    messageId: string;
    conversationId: string | null;
    clientState: any;
    content: any;
}

export async function handleWebSocketMessage(ws: WebSocket, message: ClientMessage): Promise<void> {
    try {
        console.log('Received message:', message);

        // For now, just echo back a simple response
        // This will be expanded in later tasks
        const response = {
            type: 'TEXT_MESSAGE_CONTENT',
            sessionId: message.conversationId || 'temp-session',
            eventId: generateUUID(),
            timestamp: new Date().toISOString(),
            payload: {
                text: `Echo: ${JSON.stringify(message.content)}`
            }
        };

        ws.send(JSON.stringify(response));

        // Send completion event
        const completionEvent = {
            type: 'SESSION_COMPLETE',
            sessionId: message.conversationId || 'temp-session',
            eventId: generateUUID(),
            timestamp: new Date().toISOString(),
            payload: {
                success: true
            }
        };

        ws.send(JSON.stringify(completionEvent));

    } catch (error) {
        console.error('Error in handleWebSocketMessage:', error);

        const errorEvent = {
            type: 'ERROR',
            sessionId: message.conversationId || 'temp-session',
            eventId: generateUUID(),
            timestamp: new Date().toISOString(),
            payload: {
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: true
            }
        };

        ws.send(JSON.stringify(errorEvent));
    }
}

function generateUUID(): string {
    return 'xxxx-xxxx-xxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
