import { EventEmitter } from 'events';

// AG-UI Protocol Event Types
export enum AgUiEventType {
    TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
    RENDER_CONTENT = 'RENDER_CONTENT',
    RENDER_URL = 'RENDER_URL',
    REQUIRE_USER_RESPONSE = 'REQUIRE_USER_RESPONSE',
    SESSION_COMPLETE = 'SESSION_COMPLETE',
    ERROR = 'ERROR',
    PROGRESS = 'PROGRESS'
}

// Event Payload Types
export interface EventPayloads {
    [AgUiEventType.TEXT_MESSAGE_CONTENT]: { text: string };
    [AgUiEventType.RENDER_CONTENT]: { html: string; type: 'wireframe' | 'preview' };
    [AgUiEventType.RENDER_URL]: { url: string; title?: string };
    [AgUiEventType.REQUIRE_USER_RESPONSE]: { questions: Question[] };
    [AgUiEventType.SESSION_COMPLETE]: { success: boolean };
    [AgUiEventType.ERROR]: { message: string; recoverable: boolean };
    [AgUiEventType.PROGRESS]: { stage: string; percentage: number };
}

// Generic AG-UI Event Interface
export interface AgUiEvent<T = any> {
    sessionId: string;
    eventId: string;
    timestamp: string;
    type: AgUiEventType;
    payload: T;
}

// Client Message Interface
export interface ClientMessage {
    type: 'user_message' | 'user_response';
    messageId: string;
    conversationId: string | null;
    clientState: any;
    content: any;
}

// Agent Execution Context
export interface Context {
    conversationId: string;
    events: EventEmitter;
    isFirstRequest: boolean;
    userInput: string;
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

// Agent Configuration
export interface AgentConfig {
    name: string;
    prompt: string;
    tools?: Tool[];
    skipOn?: (context: Context) => boolean;
    validateOutput?: (output: any) => boolean;
}

// Conversation Snapshot for Persistence
export interface ConversationSnapshot {
    conversationId: string;
    version: number;
    timestamp: string;
    context: Context;
    events: AgUiEvent[];
    artifacts?: {
        wireframe?: string;
        generatedFiles?: Record<string, string>;
        deploymentUrl?: string;
    };
}

// Question Interface for User Responses
export interface Question {
    id: string;
    text: string;
    type: 'text' | 'select' | 'multiselect' | 'boolean';
    options?: string[];
    required?: boolean;
}

// Tool Types
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

// Application Generation Types (Legacy - keeping for compatibility)
export interface AppGenerationRequest {
    description: string;
    features?: string[];
    targetFramework?: 'react' | 'vue' | 'angular';
    styling?: 'tailwind' | 'css' | 'styled-components';
}

export interface GeneratedApp {
    name: string;
    framework: string;
    files: GeneratedFile[];
    packageJson: object;
    readme: string;
}

export interface GeneratedFile {
    path: string;
    content: string;
    type: 'component' | 'page' | 'style' | 'config' | 'other';
}

// Pipeline Types (will be enhanced in Task 6)
export interface Pipeline {
    id: string;
    name: string;
    steps: PipelineStep[];
    status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface PipelineStep {
    id: string;
    name: string;
    agentId: string;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: any;
}
