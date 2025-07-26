import { useState, useCallback, useMemo } from 'react'
import { useAgUi } from './hooks/useAgUiSimple'
import { EventType, type AgUiEvent } from '@shared/index.js'
import './App.css'

interface ParsedMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    isComplete: boolean;
}

function App() {
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showDetailedEvents, setShowDetailedEvents] = useState(false);

    // Initialize AG-UI
    const {
        state,
        context,
        isConnected,
        sendMessage,
        startNewConversation,
        clearError
    } = useAgUi();

    // Parse events into readable messages
    const parsedMessages = useMemo(() => {
        const messages: ParsedMessage[] = [];
        const messageMap = new Map<string, ParsedMessage>();

        // Parse events into messages
        context.events.forEach(event => {
            switch (event.type) {
                case EventType.TEXT_MESSAGE_START:
                    if ('messageId' in event && 'role' in event) {
                        const message: ParsedMessage = {
                            id: event.messageId,
                            role: event.role as 'user' | 'assistant',
                            content: '',
                            timestamp: event.timestamp || Date.now(),
                            isComplete: false
                        };
                        messageMap.set(event.messageId, message);
                    }
                    break;

                case EventType.TEXT_MESSAGE_CONTENT:
                    if ('messageId' in event && 'delta' in event) {
                        const message = messageMap.get(event.messageId);
                        if (message) {
                            message.content += event.delta;
                            messageMap.set(event.messageId, message);
                        }
                    }
                    break;

                case EventType.TEXT_MESSAGE_END:
                    if ('messageId' in event) {
                        const message = messageMap.get(event.messageId);
                        if (message) {
                            message.isComplete = true;
                            messageMap.set(event.messageId, message);
                        }
                    }
                    break;
            }
        });

        // Convert map to sorted array
        return Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [context.events]);

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

    // Render conversation messages (user-friendly format)
    const renderMessages = () => (
        <div className="space-y-4">
            {parsedMessages.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                    No messages yet. Start a conversation!
                </div>
            ) : (
                parsedMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 border'
                            }`}>
                            <div className="text-xs opacity-70 mb-2">
                                {message.role === 'user' ? 'You' : 'Assistant'} • {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="whitespace-pre-wrap">
                                {message.content}
                                {!message.isComplete && <span className="animate-pulse">|</span>}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    // Render detailed events (technical debug view)
    const renderDetailedEvents = () => (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {context.events.map((event, index) => {
                const timestamp = new Date().toLocaleTimeString();

                switch (event.type) {
                    case EventType.TEXT_MESSAGE_START:
                        return (
                            <div key={index} className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                <div className="text-xs text-blue-600 mb-1">{timestamp} - Message Start</div>
                                <div className="text-sm">{'role' in event ? `${event.role} message starting...` : 'Message starting...'}</div>
                            </div>
                        );

                    case EventType.TEXT_MESSAGE_CONTENT:
                        return (
                            <div key={index} className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded">
                                <div className="text-xs text-gray-600 mb-1">{timestamp} - Content</div>
                                <div className="text-sm font-mono">{'delta' in event ? event.delta : 'Content update'}</div>
                            </div>
                        );

                    case EventType.TEXT_MESSAGE_END:
                        return (
                            <div key={index} className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                                <div className="text-xs text-green-600 mb-1">{timestamp} - Message Complete</div>
                                <div className="text-sm">Message finished</div>
                            </div>
                        );

                    case EventType.RUN_STARTED:
                        return (
                            <div key={index} className="p-3 bg-purple-50 border-l-4 border-purple-400 rounded">
                                <div className="text-xs text-purple-600 mb-1">{timestamp} - Run Started</div>
                                <div className="text-sm">Processing your request...</div>
                            </div>
                        );

                    case EventType.RUN_FINISHED:
                        return (
                            <div key={index} className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                                <div className="text-xs text-green-600 mb-1">{timestamp} - Run Finished</div>
                                <div className="text-sm">Request completed successfully</div>
                            </div>
                        );

                    case EventType.ERROR:
                        return (
                            <div key={index} className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                                <div className="text-xs text-red-600 mb-1">{timestamp} - Error</div>
                                <div className="text-sm text-red-800">{'error' in event ? event.error : 'An error occurred'}</div>
                            </div>
                        );

                    default:
                        return (
                            <div key={index} className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded">
                                <div className="text-xs text-gray-600 mb-1">{timestamp} - {event.type}</div>
                                <div className="text-sm font-mono">{JSON.stringify(event, null, 2)}</div>
                            </div>
                        );
                }
            })}
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
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-semibold">Conversation</h2>
                            <button
                                onClick={() => setShowDetailedEvents(!showDetailedEvents)}
                                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                            >
                                {showDetailedEvents ? 'Show Messages' : 'Show Debug Events'}
                            </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {showDetailedEvents ? renderDetailedEvents() : renderMessages()}
                        </div>
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
                                <span>WebSocket Integration</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Mock Pipeline System</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Browser Automation Tool</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span>Container Tool</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-600">⏳</span>
                                <span>Azure OpenAI Integration (ready to test)</span>
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
