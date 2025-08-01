import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useAgUi } from './hooks/useAgUiSimple'
import { EventType } from '@shared/index.js'
import './App.css'

interface ParsedMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    isComplete: boolean;
}

interface SuggestedPrompt {
    label: string;
    fullPrompt: string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
    {
        label: "Todo App",
        fullPrompt: "Create a modern todo application with the following features:\n\n• Add new tasks with a clean input interface\n• Mark tasks as complete/incomplete with checkboxes\n• Delete tasks with confirmation\n• Filter tasks by status (all, active, completed)\n• Task counter showing remaining items\n• Local storage to persist tasks between sessions\n• Responsive design that works on mobile and desktop\n• Smooth animations for task interactions\n• Dark/light mode toggle\n\nUse React with TypeScript, Tailwind CSS for styling, and include proper accessibility features."
    },
    {
        label: "E-commerce Dashboard",
        fullPrompt: "Build a comprehensive e-commerce admin dashboard with:\n\n• Sales analytics with interactive charts and graphs\n• Product management (add, edit, delete products)\n• Order management with status tracking\n• Customer overview with search and filtering\n• Inventory tracking with low stock alerts\n• Revenue metrics and key performance indicators\n• Responsive data tables with sorting and pagination\n• Real-time notifications for new orders\n• Export functionality for reports\n\nImplement using React, TypeScript, Chart.js for visualizations, and Tailwind CSS. Include mock data for demonstration."
    },
    {
        label: "Social Media Feed",
        fullPrompt: "Create a social media feed application featuring:\n\n• Infinite scroll timeline with posts\n• Post creation with text, images, and emoji support\n• Like, comment, and share functionality\n• User profiles with bio and post history\n• Real-time notifications for interactions\n• Search functionality for users and posts\n• Trending topics sidebar\n• Stories feature with auto-advance\n• Dark mode support\n• Responsive design for all devices\n\nUse React with TypeScript, implement virtual scrolling for performance, and include smooth animations for all interactions."
    },
    {
        label: "Project Management Tool",
        fullPrompt: "Develop a project management application with:\n\n• Kanban board with drag-and-drop task management\n• Project creation and team member assignment\n• Task creation with due dates, priorities, and labels\n• Progress tracking with completion percentages\n• Time tracking functionality\n• Team collaboration with comments and mentions\n• Calendar view for deadline management\n• File attachment support\n• Activity feed for project updates\n• Export projects to PDF or CSV\n\nImplement using React, TypeScript, React DnD for drag-and-drop, and include a clean, professional interface."
    }
];

function App() {
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showDetailedEvents, setShowDetailedEvents] = useState(false);
    const [userMessages, setUserMessages] = useState<ParsedMessage[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const debugContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize AG-UI
    const {
        context,
        isConnected,
        allowContinue,
        sendMessage,
        startNewConversation,
        clearError
    } = useAgUi();

    // Function to adjust textarea height
    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
        }
    }, []);

    // Parse events into readable messages
    const parsedMessages = useMemo(() => {
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

        // Combine user messages with assistant messages
        const allMessages = [...userMessages, ...Array.from(messageMap.values())];
        return allMessages.sort((a, b) => a.timestamp - b.timestamp);
    }, [context.events, userMessages]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
            if (showDetailedEvents && debugContainerRef.current) {
                const container = debugContainerRef.current;
                container.scrollTop = container.scrollHeight;
            } else if (!showDetailedEvents && chatContainerRef.current) {
                const container = chatContainerRef.current;
                container.scrollTop = container.scrollHeight;
            }
        });
    }, [parsedMessages, context.events, showDetailedEvents]);

    // Separate effect for debug auto-scroll
    useEffect(() => {
        if (showDetailedEvents && debugContainerRef.current) {
            // Double requestAnimationFrame to ensure everything is rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (debugContainerRef.current) {
                        const container = debugContainerRef.current;
                        container.scrollTop = container.scrollHeight;
                    }
                });
            });
        }
    }, [context.events.length, showDetailedEvents]);

    // Handle continuing without clarification response OR sending message
    const handleContinueOrSend = useCallback(async () => {
        if (!isConnected) return;

        const messageContent = messageInput.trim();

        try {
            setIsLoading(true);

            if (allowContinue && !messageContent) {
                // Continue without clarification response (empty message)
                console.log('⏭️ Continuing without clarification response');
                await sendMessage({
                    type: 'user_message',
                    content: '' // Empty content for continue
                });
                console.log('✅ Continue request sent successfully');
            } else {
                // Send user message (either regular message or clarification response)
                if (!messageContent) return; // Don't send empty messages when not in continue mode

                const userMessage: ParsedMessage = {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    content: messageContent,
                    timestamp: Date.now(),
                    isComplete: true
                };

                setUserMessages(prev => [...prev, userMessage]);

                console.log('📤 Sending message:', {
                    length: messageContent.length,
                    preview: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
                    isConnected,
                    timestamp: Date.now()
                });

                await sendMessage({
                    type: 'user_message',
                    content: messageContent
                });

                console.log('✅ Message sent successfully');
                setMessageInput('');
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            // Remove the user message if sending failed (only if we added one)
            if (messageInput.trim()) {
                setUserMessages(prev => prev.filter(msg => msg.id !== `user-${Date.now()}`));
            }
        } finally {
            setIsLoading(false);
        }
    }, [messageInput, isConnected, allowContinue, sendMessage]);

    // Handle suggested prompt selection
    const handleSuggestedPrompt = useCallback((prompt: SuggestedPrompt) => {
        setMessageInput(prompt.fullPrompt);
        // Adjust textarea height after setting the content
        setTimeout(() => {
            adjustTextareaHeight();
        }, 0);
    }, [adjustTextareaHeight]);

    // Handle reset - clear all messages and start new conversation
    const handleReset = useCallback(() => {
        setUserMessages([]);
        setMessageInput('');
        startNewConversation();
    }, [startNewConversation]);

    // Handle key press for sending messages
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleContinueOrSend();
        }
    }, [handleContinueOrSend]);

    // Render conversation messages (user-friendly format)
    const renderMessages = () => (
        <div className="space-y-4">
            {parsedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-5xl mb-3">🤖</div>
                    <p className="text-muted-foreground text-sm">
                        Describe the web application you want to build
                    </p>
                </div>
            ) : (
                <>
                    {parsedMessages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="flex items-start gap-2 max-w-[85%]">
                                {message.role === 'assistant' && (
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                                        <span className="text-xs">🤖</span>
                                    </div>
                                )}
                                <div className={`p-3 rounded-lg ${message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                    }`}>
                                    <div className="whitespace-pre-wrap text-sm">
                                        {message.content}
                                        {!message.isComplete && (
                                            <span className="inline-block w-1 h-4 bg-current opacity-75 animate-pulse ml-1">|</span>
                                        )}
                                    </div>
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                                        <span className="text-xs">👤</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Generated App URL Display */}
                    {context.state?.appUrl && (
                        <div className="flex justify-center">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md w-full text-center">
                                <div className="text-green-800 font-medium mb-2">🎉 Your App is Ready!</div>
                                <div className="text-sm text-green-700 mb-3">
                                    Your application has been generated and is running.
                                </div>
                                <a
                                    href={context.state.appUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <span>View Your App</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                                <div className="text-xs text-green-600 mt-2">
                                    {context.state.appUrl}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );    // Render detailed events (technical debug view)
    const renderDetailedEvents = () => (
        <div className="space-y-2">
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
        return (
            <div className="space-y-3">
                {/* Suggested Prompts */}
                {parsedMessages.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTED_PROMPTS.map((prompt, index) => (
                            <button
                                key={index}
                                onClick={() => handleSuggestedPrompt(prompt)}
                                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full border transition-colors"
                            >
                                {prompt.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={allowContinue ? "Provide additional details or click Continue to proceed..." : "Describe your app idea..."}
                        className="flex-1 p-3 border rounded-lg resize-none min-h-[44px] max-h-32"
                        rows={1}
                        disabled={!isConnected || isLoading}
                        style={{
                            height: 'auto',
                            minHeight: '44px',
                            maxHeight: '128px'
                        }}
                        onInput={adjustTextareaHeight}
                    />

                    {/* Unified Send/Continue Button */}
                    <button
                        onClick={handleContinueOrSend}
                        disabled={!isConnected || isLoading || (!allowContinue && !messageInput.trim())}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 h-11 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="text-sm">{allowContinue ? 'Continue' : 'Send'}</span>
                        )}
                    </button>
                </div>
            </div>
        );
    }; return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6 max-w-4xl">
                <main className="space-y-4">
                    {/* Error Panel */}
                    {context.error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center justify-between">
                            <div className="text-sm text-destructive">
                                {context.error}
                            </div>
                            <button
                                onClick={clearError}
                                className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Chat Interface */}
                    <div className="bg-card rounded-lg border flex flex-col h-[80vh]">
                        {/* Minimal Header */}
                        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm text-muted-foreground">
                                    {isConnected ? 'AI App Generator' : 'Disconnected'}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setShowDetailedEvents(!showDetailedEvents)}
                                    className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                                >
                                    {showDetailedEvents ? 'Chat' : 'Debug'}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-hidden">
                            {/* Chat View */}
                            <div
                                ref={chatContainerRef}
                                className={`h-full overflow-y-auto p-4 ${showDetailedEvents ? 'hidden' : 'block'}`}
                            >
                                {renderMessages()}
                            </div>

                            {/* Debug View */}
                            <div
                                ref={debugContainerRef}
                                className={`h-full overflow-y-auto p-4 ${showDetailedEvents ? 'block' : 'hidden'}`}
                            >
                                {renderDetailedEvents()}
                            </div>
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t bg-muted/20">
                            {renderInput()}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default App
