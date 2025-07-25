import { WebSocket } from 'ws';
export interface ClientMessage {
    type: 'user_message' | 'user_response';
    messageId: string;
    conversationId: string | null;
    clientState: any;
    content: any;
}
export declare function handleWebSocketMessage(ws: WebSocket, message: ClientMessage): Promise<void>;
//# sourceMappingURL=index.d.ts.map