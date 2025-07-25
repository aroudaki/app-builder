import {
    ClientMessage,
    AgUiEvent,
    generateUUID,
    isValidConversationId
} from '@shared/index.js';

/**
 * AG-UI Client configuration
 */
export interface AgUiClientConfig {
    wsUrl?: string;
    conversationId?: string;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    pingInterval?: number;
}

/**
 * Event handler types for AG-UI client
 */
export interface AgUiEventHandlers {
    onEvent?: (event: AgUiEvent) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
    onReconnecting?: (attempt: number) => void;
}

/**
 * AG-UI Client for WebSocket communication
 */
export class AgUiClient {
    private ws: WebSocket | null = null;
    private config: Required<AgUiClientConfig>;
    private handlers: AgUiEventHandlers;
    private conversationId: string | null = null;
    private clientState: any = {};
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;
    private currentReconnectAttempt = 0;
    private isConnecting = false;
    private isIntentionallyClosed = false;

    constructor(config: AgUiClientConfig = {}, handlers: AgUiEventHandlers = {}) {
        this.config = {
            wsUrl: config.wsUrl || `ws://localhost:3000`,
            conversationId: config.conversationId || '',
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 2000,
            pingInterval: config.pingInterval || 30000
        };
        this.handlers = handlers;
        
        if (this.config.conversationId && isValidConversationId(this.config.conversationId)) {
            this.conversationId = this.config.conversationId;
        }
    }

    /**
     * Connects to the WebSocket server
     */
    async connect(): Promise<void> {
        if (this.isConnecting || this.isConnected()) {
            return;
        }

        this.isConnecting = true;
        this.isIntentionallyClosed = false;

        try {
            console.log(`🔗 Connecting to AG-UI server: ${this.config.wsUrl}`);
            
            this.ws = new WebSocket(this.config.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnecting = false;
                this.currentReconnectAttempt = 0;
                this.startPing();
                this.handlers.onConnect?.();
            };

            this.ws.onmessage = (event) => {
                try {
                    const agUiEvent: AgUiEvent = JSON.parse(event.data);
                    this.handleIncomingEvent(agUiEvent);
                } catch (error) {
                    console.error('❌ Failed to parse incoming event:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
                this.isConnecting = false;
                this.stopPing();
                this.handlers.onDisconnect?.();
                
                if (!this.isIntentionallyClosed) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('🚨 WebSocket error:', error);
                this.isConnecting = false;
                this.handlers.onError?.(new Error('WebSocket connection failed'));
            };

        } catch (error) {
            this.isConnecting = false;
            console.error('❌ Failed to create WebSocket connection:', error);
            throw error;
        }
    }

    /**
     * Disconnects from the WebSocket server
     */
    disconnect(): void {
        this.isIntentionallyClosed = true;
        this.stopPing();
        this.clearReconnectTimer();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Checks if the client is connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Sends a user message to the server
     */
    async sendMessage(content: any): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        const message: ClientMessage = {
            type: 'user_message',
            messageId: generateUUID(),
            conversationId: this.conversationId,
            clientState: this.clientState,
            content
        };

        console.log(`📤 Sending message:`, { type: message.type, messageId: message.messageId });
        
        this.ws!.send(JSON.stringify(message));
    }

    /**
     * Sends a user response to the server
     */
    async sendResponse(content: any): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        const message: ClientMessage = {
            type: 'user_response',
            messageId: generateUUID(),
            conversationId: this.conversationId,
            clientState: this.clientState,
            content
        };

        console.log(`📤 Sending response:`, { type: message.type, messageId: message.messageId });
        
        this.ws!.send(JSON.stringify(message));
    }

    /**
     * Gets the current conversation ID
     */
    getConversationId(): string | null {
        return this.conversationId;
    }

    /**
     * Gets the current client state
     */
    getClientState(): any {
        return { ...this.clientState };
    }

    /**
     * Updates the client state
     */
    updateClientState(newState: any): void {
        this.clientState = { ...this.clientState, ...newState };
    }

    /**
     * Handles incoming AG-UI events
     */
    private handleIncomingEvent(event: AgUiEvent): void {
        console.log(`📥 Received ${event.type} event:`, event.payload);

        // Update conversation ID if this is the first event
        if (!this.conversationId && event.sessionId) {
            this.conversationId = event.sessionId;
            console.log(`🆔 Set conversation ID: ${this.conversationId}`);
        }

        // Update client state if provided in the event payload
        if (event.payload?.clientState) {
            this.updateClientState(event.payload.clientState);
        }

        // Call the event handler
        this.handlers.onEvent?.(event);
    }

    /**
     * Schedules a reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.currentReconnectAttempt >= this.config.reconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${this.config.reconnectAttempts}) reached`);
            this.handlers.onError?.(new Error('Max reconnection attempts reached'));
            return;
        }

        this.currentReconnectAttempt++;
        
        console.log(`🔄 Scheduling reconnection attempt ${this.currentReconnectAttempt}/${this.config.reconnectAttempts} in ${this.config.reconnectDelay}ms`);
        
        this.handlers.onReconnecting?.(this.currentReconnectAttempt);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect().catch(error => {
                console.error('❌ Reconnection failed:', error);
            });
        }, this.config.reconnectDelay);
    }

    /**
     * Clears the reconnection timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Starts the ping mechanism to keep connection alive
     */
    private startPing(): void {
        this.pingTimer = setInterval(() => {
            if (this.isConnected()) {
                // Send a ping by sending a small message
                this.ws!.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.config.pingInterval);
    }

    /**
     * Stops the ping mechanism
     */
    private stopPing(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
}

/**
 * Factory function to create an AG-UI client (matches architecture document interface)
 */
export function createAgUiClient(conversationId?: string, config?: AgUiClientConfig): AgUiClient {
    const clientConfig = {
        ...config,
        conversationId: conversationId || config?.conversationId
    };
    
    return new AgUiClient(clientConfig);
}
