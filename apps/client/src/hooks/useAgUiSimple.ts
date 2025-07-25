import { useState, useCallback } from 'react';

/**
 * Simple AG-UI hook for testing
 */
export function useAgUi() {
    const [state] = useState('idle');
    const [isConnected] = useState(false);

    const sendMessage = useCallback(async (content: any) => {
        console.log('Sending message:', content);
    }, []);

    const startNewConversation = useCallback(() => {
        console.log('Starting new conversation');
    }, []);

    return {
        state,
        isConnected,
        sendMessage,
        startNewConversation,
        context: {
            events: [],
            error: null,
            conversationId: null
        },
        clearError: () => { }
    };
}
