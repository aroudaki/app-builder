import { useState, useCallback } from 'react';
import { AgUiEvent, EventType } from '@shared/index.js';

/**
 * AG-UI State Machine States
 */
export type AgUiState =
    | 'idle'          // Not connected or no active conversation
    | 'connecting'    // Establishing WebSocket connection
    | 'connected'     // Connected and ready to receive messages
    | 'running'       // Server is processing a request (RUN_STARTED)
    | 'streaming'     // Receiving streaming content
    | 'waiting'       // Waiting for user response
    | 'complete'      // Session completed successfully
    | 'error'         // Error state
    | 'disconnected'; // Connection lost

/**
 * State machine context
 */
export interface AgUiContext {
    conversationId: string | null;
    currentEvent: AgUiEvent | null;
    events: AgUiEvent[];
    messages: Array<{id: string, role: string, content: string, streaming?: boolean}>;
    error: string | null;
    isConnected: boolean;
    reconnectAttempt: number;
}

/**
 * State machine actions
 */
export interface AgUiActions {
    connect: () => void;
    disconnect: () => void;
    sendMessage: (content: string) => void;
    clearError: () => void;
    reset: () => void;
}

/**
 * Event handler for state transitions
 */
export type AgUiEventHandler = (event: AgUiEvent, context: AgUiContext) => Partial<AgUiContext>;

/**
 * Default event handlers for state transitions
 */
const defaultEventHandlers: Record<EventType, AgUiEventHandler> = {
    [EventType.TEXT_MESSAGE_START]: (event, context) => {
        if ('messageId' in event && 'role' in event) {
            const newMessage = {
                id: event.messageId,
                role: event.role,
                content: '',
                streaming: true
            };
            return {
                currentEvent: event,
                events: [...context.events, event],
                messages: [...context.messages, newMessage]
            };
        }
        return { currentEvent: event, events: [...context.events, event] };
    },

    [EventType.TEXT_MESSAGE_CONTENT]: (event, context) => {
        if ('messageId' in event && 'delta' in event) {
            const updatedMessages = context.messages.map(msg => 
                msg.id === event.messageId 
                    ? { ...msg, content: msg.content + event.delta }
                    : msg
            );
            return {
                currentEvent: event,
                events: [...context.events, event],
                messages: updatedMessages
            };
        }
        return { currentEvent: event, events: [...context.events, event] };
    },

    [EventType.TEXT_MESSAGE_END]: (event, context) => {
        if ('messageId' in event) {
            const updatedMessages = context.messages.map(msg => 
                msg.id === event.messageId 
                    ? { ...msg, streaming: false }
                    : msg
            );
            return {
                currentEvent: event,
                events: [...context.events, event],
                messages: updatedMessages
            };
        }
        return { currentEvent: event, events: [...context.events, event] };
    },

    [EventType.TOOL_CALL_START]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.TOOL_CALL_ARGS]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.TOOL_CALL_RESULT]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.TOOL_CALL_END]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.RUN_STARTED]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.RUN_FINISHED]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.ERROR]: (event, context) => {
        const errorMessage = 'error' in event ? event.error : 'Unknown error';
        return {
            currentEvent: event,
            events: [...context.events, event],
            error: errorMessage
        };
    },

    [EventType.RETRY]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.STEP_START]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.STEP_END]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.STATE_SNAPSHOT]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.STATE_DELTA]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [EventType.MESSAGES_SNAPSHOT]: (event, context) => {
        if ('messages' in event) {
            return {
                currentEvent: event,
                events: [...context.events, event],
                messages: event.messages.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content || '',
                    streaming: false
                }))
            };
        }
        return { currentEvent: event, events: [...context.events, event] };
    }
};

/**
 * AG-UI State Machine Hook
 */
export function useAgUiStateMachine(
    initialState: AgUiState = 'idle',
    eventHandlers: Partial<Record<EventType, AgUiEventHandler>> = {}
) {
    // Merge default and custom event handlers
    const handlers = { ...defaultEventHandlers, ...eventHandlers };

    // State
    const [state, setState] = useState<AgUiState>(initialState);

    // Context
    const [context, setContext] = useState<AgUiContext>({
        conversationId: null,
        currentEvent: null,
        events: [],
        messages: [],
        error: null,
        isConnected: false,
        reconnectAttempt: 0
    });

    /**
     * Handles incoming AG-UI events and transitions state
     */
    const handleEvent = useCallback((event: AgUiEvent) => {
        console.log(`🎯 Handling ${event.type} event in state: ${state}`);

        // Update conversation ID if not set
        if (!context.conversationId && event.conversationId) {
            setContext(prev => ({ ...prev, conversationId: event.conversationId }));
        }

        // Handle the event with appropriate handler
        const handler = handlers[event.type];
        if (handler) {
            const contextUpdate = handler(event, context);
            setContext(prev => ({ ...prev, ...contextUpdate }));
        }

        // State transitions based on event type
        switch (event.type) {
            case EventType.RUN_STARTED:
                setState('running');
                break;

            case EventType.TEXT_MESSAGE_START:
            case EventType.TEXT_MESSAGE_CONTENT:
            case EventType.TOOL_CALL_START:
            case EventType.TOOL_CALL_ARGS:
            case EventType.TOOL_CALL_RESULT:
                setState('streaming');
                break;

            case EventType.TEXT_MESSAGE_END:
            case EventType.TOOL_CALL_END:
                // Stay in streaming state until run finishes
                break;

            case EventType.RUN_FINISHED:
                setState('complete');
                break;

            case EventType.ERROR:
                setState('error');
                break;
        }
    }, [state, context, handlers]);

    /**
     * Handles connection state changes
     */
    const handleConnectionChange = useCallback((isConnected: boolean, reconnectAttempt: number = 0) => {
        setContext(prev => ({ ...prev, isConnected, reconnectAttempt }));

        if (isConnected) {
            setState('connected');
        } else {
            setState('disconnected');
        }
    }, []);

    /**
     * Clears error state
     */
    const clearError = useCallback(() => {
        setContext(prev => ({ ...prev, error: null }));
        if (state === 'error') {
            setState(context.isConnected ? 'connected' : 'idle');
        }
    }, [state, context.isConnected]);

    /**
     * Resets the state machine
     */
    const reset = useCallback(() => {
        setState('idle');
        setContext({
            conversationId: null,
            currentEvent: null,
            events: [],
            messages: [],
            error: null,
            isConnected: false,
            reconnectAttempt: 0
        });
    }, []);

    /**
     * Sends a message (triggers running state)
     */
    const sendMessage = useCallback(() => {
        if (state === 'connected' || state === 'complete') {
            setState('running');
        }
    }, [state]);

    /**
     * Actions object
     */
    const actions: Omit<AgUiActions, 'connect' | 'disconnect'> = {
        sendMessage,
        clearError,
        reset
    };

    return {
        state,
        context,
        actions,
        handleEvent,
        handleConnectionChange
    };
}

/**
 * Helper function to determine if the state machine is in a busy state
 */
export function isBusyState(state: AgUiState): boolean {
    return ['connecting', 'running', 'streaming'].includes(state);
}

/**
 * Helper function to determine if the state machine can send messages
 */
export function canSendMessage(state: AgUiState): boolean {
    return ['connected', 'complete'].includes(state);
}

/**
 * Helper function to determine if the state machine is waiting for user input
 */
export function isWaitingForUser(state: AgUiState): boolean {
    return state === 'waiting';
}

/**
 * Helper function to get a human-readable state description
 */
export function getStateDescription(state: AgUiState): string {
    const descriptions: Record<AgUiState, string> = {
        idle: 'Ready to start',
        connecting: 'Connecting to server...',
        connected: 'Connected and ready',
        running: 'Processing your request...',
        streaming: 'Receiving response...',
        waiting: 'Waiting for your response',
        complete: 'Task completed',
        error: 'An error occurred',
        disconnected: 'Connection lost'
    };

    return descriptions[state] || state;
}
