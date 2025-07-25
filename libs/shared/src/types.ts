import { EventEmitter } from 'events';

// AG-UI Protocol Types - Official Event System
export enum EventType {
    TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
    TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
    TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',
    TOOL_CALL_START = 'TOOL_CALL_START',
    TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
    TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',
    TOOL_CALL_END = 'TOOL_CALL_END',
    ERROR = 'ERROR',
    RETRY = 'RETRY',
    STEP_START = 'STEP_START',
    STEP_END = 'STEP_END',
    RUN_STARTED = 'RUN_STARTED',
    RUN_FINISHED = 'RUN_FINISHED',
    STATE_SNAPSHOT = 'STATE_SNAPSHOT',
    STATE_DELTA = 'STATE_DELTA',
    MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT'
}

// AG-UI Base Event Interface
export interface BaseEvent {
    type: EventType;
    conversationId: string;
    timestamp: number;
}

// AG-UI Message Event Interfaces
export interface TextMessageStartEvent extends BaseEvent {
    type: EventType.TEXT_MESSAGE_START;
    messageId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
}

export interface TextMessageContentEvent extends BaseEvent {
    type: EventType.TEXT_MESSAGE_CONTENT;
    messageId: string;
    delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
    type: EventType.TEXT_MESSAGE_END;
    messageId: string;
}

// AG-UI Tool Call Event Interfaces
export interface ToolCallStartEvent extends BaseEvent {
    type: EventType.TOOL_CALL_START;
    messageId: string;
    toolCallId: string;
    toolName: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
    type: EventType.TOOL_CALL_ARGS;
    messageId: string;
    toolCallId: string;
    args: Record<string, any>;
}

export interface ToolCallResultEvent extends BaseEvent {
    type: EventType.TOOL_CALL_RESULT;
    messageId: string;
    toolCallId: string;
    result: any;
}

export interface ToolCallEndEvent extends BaseEvent {
    type: EventType.TOOL_CALL_END;
    messageId: string;
    toolCallId: string;
}

// AG-UI Control Event Interfaces
export interface RunStartedEvent extends BaseEvent {
    type: EventType.RUN_STARTED;
}

export interface RunFinishedEvent extends BaseEvent {
    type: EventType.RUN_FINISHED;
}

export interface ErrorEvent extends BaseEvent {
    type: EventType.ERROR;
    error: string;
}

export interface StateSnapshotEvent extends BaseEvent {
    type: EventType.STATE_SNAPSHOT;
    state: Record<string, any>;
}

export interface StateDeltaEvent extends BaseEvent {
    type: EventType.STATE_DELTA;
    delta: any[]; // JSON Patch operations
}

export interface MessagesSnapshotEvent extends BaseEvent {
    type: EventType.MESSAGES_SNAPSHOT;
    messages: Message[];
}

// Union type for all AG-UI events
export type AgUiEvent =
    | TextMessageStartEvent
    | TextMessageContentEvent
    | TextMessageEndEvent
    | ToolCallStartEvent
    | ToolCallArgsEvent
    | ToolCallResultEvent
    | ToolCallEndEvent
    | RunStartedEvent
    | RunFinishedEvent
    | ErrorEvent
    | StateSnapshotEvent
    | StateDeltaEvent
    | MessagesSnapshotEvent;

// AG-UI Message Types
export interface BaseMessage {
    id: string;
    role: string;
    content?: string;
    name?: string;
}

export interface UserMessage extends BaseMessage {
    role: 'user';
    content: string;
}

export interface AssistantMessage extends BaseMessage {
    role: 'assistant';
    content?: string;
    toolCalls?: ToolCall[];
}

export interface SystemMessage extends BaseMessage {
    role: 'system';
    content: string;
}

export interface ToolMessage extends BaseMessage {
    role: 'tool';
    content: string;
    toolCallId: string;
}

export type Message = UserMessage | AssistantMessage | SystemMessage | ToolMessage;

// AG-UI Tool Call Structure
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

// AG-UI Input Structure
export interface RunAgentInput {
    conversationId: string;
    messages: Message[];
    tools?: Tool[];
    state?: Record<string, any>;
}

// Tool Definition
export interface Tool {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

// Question Interface for User Interaction
export interface Question {
    id: string;
    text: string;
    type: 'text' | 'choice' | 'boolean';
    choices?: string[];
    required?: boolean;
}

// Context Interface for Pipeline Execution
export interface Context {
    conversationId: string;
    events: EventEmitter;
    isFirstRequest: boolean;
    userInput: string;
    messages: Message[];
    state?: Record<string, any>;
    requirements?: string;
    wireframe?: string;
    generatedCode?: Record<string, string>;
    lastError?: {
        agent: string;
        error: string;
        timestamp: string;
    };
    retryCount?: number;
}

// Pipeline Interface
export interface Pipeline {
    name: string;
    description: string;
    run: (context: Context) => Promise<Context>;
}

// Agent Configuration Interface
export interface AgentConfig {
    name: string;
    description: string;
    model: string;
    temperature?: number;
    tools?: Tool[];
    systemPrompt?: string;
}

// Utility Functions Type
export type UtilityFunction = (input: any) => any;

export interface AppUtilities {
    generateId: () => string;
    formatTimestamp: (date: Date) => string;
    validateInput: (input: any, schema: any) => boolean;
    sanitizeHtml: (html: string) => string;
    parseMarkdown: (markdown: string) => string;
}
