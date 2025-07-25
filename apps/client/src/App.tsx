import { useState, useCallback } from 'react'
import { useAgUi } from './hooks/useAgUiSimple'
import './App.css'

function App() {
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Initialize AG-UI
    const {
        state,
        context,
        isConnected,
        sendMessage,
        startNewConversation,
        clearError
    } = useAgUi();

    // Handle sending messages
    const handleSendMessage = useCallback(async () => {
        if (!messageInput.trim() || !isConnected) return;
        
        try {
            setIsLoading(true);
            await sendMessage({
                type: 'user_message',
                content: messageInput.trim()
            });
            setMessageInput('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsLoading(false);
        }
    }, [messageInput, isConnected, sendMessage]);

    // Handle key press for sending messages
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // Render connection status
    const renderConnectionStatus = () => (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>
                {isConnected ? 'Connected' : 'Disconnected'}
            </span>
        </div>
    );

    // Render current state information
    const renderStateInfo = () => (
        <div className="space-y-2">
            <div>State: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{state}</span></div>
            {context.conversationId && (
                <div>Conversation: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{context.conversationId}</span></div>
            )}
        </div>
    );

    // Render events/messages
    const renderEvents = () => (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {context.events.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                    No messages yet. Start a conversation!
                </div>
            ) : (
                <div className="text-muted-foreground">
                    Messages will appear here when the full AG-UI integration is active.
                </div>
            )}
        </div>
    );

    // Render input area
    const renderInput = () => {
        const canSend = isConnected && !isLoading && messageInput.trim();
        
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <textarea
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
                            className="flex-1 p-3 border rounded resize-none"
                            rows={3}
                            disabled={!isConnected || isLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!canSend}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                            {isLoading ? '...' : 'Send'}
                        </button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Try: "Create a simple todo app with React" or "Build a calculator component"
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-primary mb-2">
                        AI App Generator
                    </h1>
                    <p className="text-muted-foreground">
                        Generate web applications through natural language interactions using AG-UI
                    </p>
                </header>

                <main className="space-y-6">
                    {/* Status Panel */}
                    <div className="bg-card p-6 rounded-lg border">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-semibold">Status</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={startNewConversation}
                                    className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                                >
                                    New Conversation
                                </button>
                                {context.error && (
                                    <button
                                        onClick={clearError}
                                        className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
                                    >
                                        Clear Error
                                    </button>
                                )}
                            </div>
                        </div>
                        {renderConnectionStatus()}
                        <div className="mt-4">
                            {renderStateInfo()}
                        </div>
                        {context.error && (
                            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
                                <div className="font-semibold">Error:</div>
                                <div className="text-sm">{context.error}</div>
                            </div>
                        )}
                    </div>

                    {/* Messages Panel */}
                    <div className="bg-card p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold mb-4">Conversation</h2>
                        {renderEvents()}
                    </div>

                    {/* Input Panel */}
                    <div className="bg-card p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold mb-4">Send Message</h2>
                        {renderInput()}
                    </div>

                    {/* Implementation Status */}
                    <div className="bg-card p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold mb-4">Implementation Status</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Server AG-UI Protocol Implementation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Client AG-UI Components</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Mock Pipeline System</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-600">⏳</span>
                                <span>WebSocket Integration (in progress)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">⭕</span>
                                <span>LangGraph Pipeline (Task 6)</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default App
