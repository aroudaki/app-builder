import {
    RunAgentInput,
    AgUiEvent,
    Message,
    Tool,
    EventType,
    generateUUID
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
 * AG-UI Client for WebSocket communication following AG-UI protocol
 */
export class AgUiClient {
    private ws: WebSocket | null = null;
    private config: Required<AgUiClientConfig>;
    private handlers: AgUiEventHandlers;
    private conversationId: string;
    private messages: Message[] = [];
    private state: Record<string, any> = {};
    private tools: Tool[] = [];
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;
    private currentReconnectAttempt = 0;
    private isConnecting = false;
    private isIntentionallyClosed = false;

    constructor(config: AgUiClientConfig = {}, handlers: AgUiEventHandlers = {}) {
        this.config = {
            wsUrl: config.wsUrl || `ws://localhost:3000`,
            conversationId: config.conversationId || generateUUID(),
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 2000,
            pingInterval: config.pingInterval || 30000
        };
        this.handlers = handlers;
        this.conversationId = this.config.conversationId;
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

            this.ws = new WebSocket(`${this.config.wsUrl}?conversationId=${this.conversationId}`);

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
     * Sends a user message using AG-UI protocol
     */
    async sendMessage(content: string): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        // Add user message to conversation
        const userMessage: Message = {
            id: generateUUID(),
            role: 'user',
            content: content
        };

        this.messages.push(userMessage);

        // Create AG-UI input
        const runInput: RunAgentInput = {
            conversationId: this.conversationId,
            messages: [...this.messages],
            tools: this.tools,
            state: this.state
        };

        console.log(`📤 Sending AG-UI input:`, { 
            conversationId: runInput.conversationId,
            messageCount: runInput.messages.length,
            content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
        });

        this.ws!.send(JSON.stringify(runInput));
    }

    /**
     * Gets the current conversation ID
     */
    getConversationId(): string {
        return this.conversationId;
    }

    /**
     * Gets the current messages
     */
    getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Gets the current state
     */
    getState(): Record<string, any> {
        return { ...this.state };
    }

    /**
     * Updates the state
     */
    updateState(newState: Record<string, any>): void {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Sets available tools
     */
    setTools(tools: Tool[]): void {
        this.tools = [...tools];
    }

    /**
     * Handles incoming AG-UI events
     */
    private handleIncomingEvent(event: AgUiEvent): void {
        console.log(`📥 Received ${event.type} event`);

        // Handle different event types
        switch (event.type) {
            case EventType.STATE_SNAPSHOT:
                if ('state' in event) {
                    this.state = event.state;
                }
                break;
                
            case EventType.MESSAGES_SNAPSHOT:
                if ('messages' in event) {
                    this.messages = event.messages;
                }
                break;
                
            case EventType.TEXT_MESSAGE_START:
                // Start of a new assistant message
                if ('messageId' in event && 'role' in event && event.role === 'assistant') {
                    const assistantMessage: Message = {
                        id: event.messageId,
                        role: 'assistant',
                        content: ''
                    };
                    this.messages.push(assistantMessage);
                }
                break;
                
            case EventType.TEXT_MESSAGE_CONTENT:
                // Content delta for streaming message
                if ('messageId' in event && 'delta' in event) {
                    const messageIndex = this.messages.findIndex(m => m.id === event.messageId);
                    if (messageIndex !== -1) {
                        this.messages[messageIndex].content += event.delta;
                    }
                }
                break;
                
            case EventType.TEXT_MESSAGE_END:
                // Message complete
                console.log('📝 Message completed');
                break;
                
            case EventType.RUN_STARTED:
                console.log('🚀 Run started');
                break;
                
            case EventType.RUN_FINISHED:
                console.log('✅ Run finished');
                break;
                
            case EventType.ERROR:
                if ('error' in event) {
                    console.error('❌ Server error:', event.error);
                    this.handlers.onError?.(new Error(event.error));
                }
                break;
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
                // AG-UI doesn't specify ping format, so we'll skip this for now
                // Real implementation might use a heartbeat mechanism
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
