import { useState, useCallback } from 'react';
import { AgUiEvent, AgUiEventType } from '@shared/index.js';

/**
 * AG-UI State Machine States
 */
export type AgUiState = 
    | 'idle'          // Not connected or no active conversation
    | 'connecting'    // Establishing WebSocket connection
    | 'connected'     // Connected and ready to receive messages
    | 'processing'    // Server is processing a request
    | 'waiting'       // Waiting for user response
    | 'rendering'     // Displaying content (wireframe, preview, etc.)
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
    progress: { stage: string; percentage: number } | null;
    error: { message: string; recoverable: boolean } | null;
    isConnected: boolean;
    reconnectAttempt: number;
}

/**
 * State machine actions
 */
export interface AgUiActions {
    connect: () => void;
    disconnect: () => void;
    sendMessage: (content: any) => void;
    sendResponse: (content: any) => void;
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
const defaultEventHandlers: Record<AgUiEventType, AgUiEventHandler> = {
    [AgUiEventType.TEXT_MESSAGE_CONTENT]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [AgUiEventType.PROGRESS]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event],
        progress: event.payload
    }),

    [AgUiEventType.RENDER_CONTENT]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [AgUiEventType.RENDER_URL]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [AgUiEventType.REQUIRE_USER_RESPONSE]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event]
    }),

    [AgUiEventType.SESSION_COMPLETE]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event],
        progress: null
    }),

    [AgUiEventType.ERROR]: (event, context) => ({
        currentEvent: event,
        events: [...context.events, event],
        error: event.payload,
        progress: null
    })
};

/**
 * AG-UI State Machine Hook
 */
export function useAgUiStateMachine(
    initialState: AgUiState = 'idle',
    eventHandlers: Partial<Record<AgUiEventType, AgUiEventHandler>> = {}
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
        progress: null,
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
        if (!context.conversationId && event.sessionId) {
            setContext(prev => ({ ...prev, conversationId: event.sessionId }));
        }

        // Handle the event with appropriate handler
        const handler = handlers[event.type];
        if (handler) {
            const contextUpdate = handler(event, context);
            setContext(prev => ({ ...prev, ...contextUpdate }));
        }

        // State transitions based on event type
        switch (event.type) {
            case AgUiEventType.TEXT_MESSAGE_CONTENT:
                if (state === 'connected' || state === 'idle') {
                    setState('processing');
                }
                break;

            case AgUiEventType.PROGRESS:
                setState('processing');
                break;

            case AgUiEventType.RENDER_CONTENT:
            case AgUiEventType.RENDER_URL:
                setState('rendering');
                break;

            case AgUiEventType.REQUIRE_USER_RESPONSE:
                setState('waiting');
                break;

            case AgUiEventType.SESSION_COMPLETE:
                setState('complete');
                break;

            case AgUiEventType.ERROR:
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
            progress: null,
            error: null,
            isConnected: false,
            reconnectAttempt: 0
        });
    }, []);

    /**
     * Sends a message (triggers processing state)
     */
    const sendMessage = useCallback(() => {
        if (state === 'connected' || state === 'complete') {
            setState('processing');
        }
    }, [state]);

    /**
     * Sends a response (triggers processing state)
     */
    const sendResponse = useCallback(() => {
        if (state === 'waiting') {
            setState('processing');
        }
    }, [state]);

    /**
     * Actions object
     */
    const actions: Omit<AgUiActions, 'connect' | 'disconnect'> = {
        sendMessage,
        sendResponse,
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
    return ['connecting', 'processing'].includes(state);
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
        processing: 'Processing your request...',
        waiting: 'Waiting for your response',
        rendering: 'Displaying results',
        complete: 'Task completed',
        error: 'An error occurred',
        disconnected: 'Connection lost'
    };

    return descriptions[state] || state;
}
