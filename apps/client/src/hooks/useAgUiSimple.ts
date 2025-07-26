import { useState, useCallback, useEffect, useRef } from 'react';
import { AgUiClient } from '../api/agui';
import { AgUiEvent, EventType, generateUUID } from '@shared/index.js';

/**
 * AG-UI hook for managing WebSocket connection and events
 */
export function useAgUi() {
    const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'running' | 'error'>('idle');
    const [isConnected, setIsConnected] = useState(false);
    const [events, setEvents] = useState<AgUiEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    const clientRef = useRef<AgUiClient | null>(null);

    // Initialize AG-UI client
    useEffect(() => {
        const client = new AgUiClient(
            {
                wsUrl: 'ws://localhost:3000',
                conversationId: generateUUID(),
                reconnectAttempts: 5,
                reconnectDelay: 2000
            },
            {
                onConnect: () => {
                    console.log('🎉 AG-UI Connected');
                    setIsConnected(true);
                    setState('connected');
                    setError(null);
                },
                onDisconnect: () => {
                    console.log('📪 AG-UI Disconnected');
                    setIsConnected(false);
                    setState('idle');
                },
                onError: (err) => {
                    console.error('🚨 AG-UI Error:', err);
                    setError(err.message);
                    setState('error');
                },
                onReconnecting: (attempt) => {
                    console.log(`🔄 AG-UI Reconnecting (${attempt})`);
                    setState('connecting');
                },
                onEvent: (event) => {
                    console.log('📥 AG-UI Event:', event.type);
                    setEvents(prev => [...prev, event]);

                    // Handle state changes based on events
                    switch (event.type) {
                        case EventType.RUN_STARTED:
                            setState('running');
                            break;
                        case EventType.RUN_FINISHED:
                            setState('connected');
                            break;
                        case EventType.ERROR:
                            setState('error');
                            if ('error' in event) {
                                setError(event.error);
                            }
                            break;
                    }
                }
            }
        );

        clientRef.current = client;
        setConversationId(client.getConversationId());

        // Auto-connect
        setState('connecting');
        client.connect().catch(err => {
            console.error('❌ Failed to connect AG-UI client:', err);
            setError('Failed to connect to server');
            setState('error');
        });

        // Cleanup on unmount
        return () => {
            client.disconnect();
        };
    }, []);

    const sendMessage = useCallback(async (message: { type: string; content: string }) => {
        if (!clientRef.current || !isConnected) {
            throw new Error('AG-UI client not connected');
        }

        try {
            setState('running');
            await clientRef.current.sendMessage(message.content);
        } catch (err) {
            console.error('❌ Failed to send message:', err);
            setError(err instanceof Error ? err.message : 'Failed to send message');
            setState('error');
            throw err;
        }
    }, [isConnected]);

    const startNewConversation = useCallback(() => {
        console.log('🆕 Starting new conversation');
        setEvents([]);
        setError(null);

        if (clientRef.current) {
            // Disconnect and create new client with new conversation ID
            clientRef.current.disconnect();

            const newConversationId = generateUUID();
            const client = new AgUiClient(
                {
                    wsUrl: 'ws://localhost:3000',
                    conversationId: newConversationId,
                    reconnectAttempts: 5,
                    reconnectDelay: 2000
                },
                {
                    onConnect: () => {
                        console.log('🎉 AG-UI Connected');
                        setIsConnected(true);
                        setState('connected');
                        setError(null);
                    },
                    onDisconnect: () => {
                        console.log('📪 AG-UI Disconnected');
                        setIsConnected(false);
                        setState('idle');
                    },
                    onError: (err) => {
                        console.error('🚨 AG-UI Error:', err);
                        setError(err.message);
                        setState('error');
                    },
                    onReconnecting: (attempt) => {
                        console.log(`🔄 AG-UI Reconnecting (${attempt})`);
                        setState('connecting');
                    },
                    onEvent: (event) => {
                        console.log('📥 AG-UI Event:', event.type);
                        setEvents(prev => [...prev, event]);

                        // Handle state changes based on events
                        switch (event.type) {
                            case EventType.RUN_STARTED:
                                setState('running');
                                break;
                            case EventType.RUN_FINISHED:
                                setState('connected');
                                break;
                            case EventType.ERROR:
                                setState('error');
                                if ('error' in event) {
                                    setError(event.error);
                                }
                                break;
                        }
                    }
                }
            );

            clientRef.current = client;
            setConversationId(newConversationId);

            // Connect the new client
            setState('connecting');
            client.connect().catch(err => {
                console.error('❌ Failed to connect new AG-UI client:', err);
                setError('Failed to connect to server');
                setState('error');
            });
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        if (state === 'error') {
            setState(isConnected ? 'connected' : 'idle');
        }
    }, [state, isConnected]);

    return {
        state,
        isConnected,
        sendMessage,
        startNewConversation,
        context: {
            events,
            error,
            conversationId
        },
        clearError
    };
}
