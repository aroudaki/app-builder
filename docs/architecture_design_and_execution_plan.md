# Architecture Design and Execution Plan

## Table of Contents

1. [Introduction](#introduction)
2. [High-Level Architecture](#high-level-architecture)
3. [Transport Protocol](#transport-protocol)
4. [Agent Pipeline](#agent-pipeline)
5. [Detailed Technical Design](#detailed-technical-design)
   - 5.1 [Shared Types & Utilities](#shared-types--utilities)
   - 5.2 [Server Components](#server-components)
   - 5.3 [Client Components](#client-components)
   - 5.4 [Orchestration with LangGraph](#orchestration-with-langgraph)
   - 5.5 [Container & Browser Tools](#container--browser-tools)
   - 5.6 [Azure Infrastructure](#azure-infrastructure)
   - 5.7 [Environment Configuration](#environment-configuration)
   - 5.8 [CI/CD & Deployment](#ci-cd--deployment)
   - 5.9 [Security & POC Constraints](#security--poc-constraints)
   - 5.10 [Local Development Setup](#local-development-setup)
   - 5.11 [Testing Strategy](#testing-strategy)
6. [Execution Plan](#execution-plan)
   - Task 1: Monorepo Setup
   - Task 2: Boilerplate Scaffolding
   - Task 3: Shared Types & Utilities
   - Task 4: AG-UI SDK Integration
   - Task 5: WebSocket Channel & Stateless Server
   - Task 6: LangGraph Pipeline Implementation
   - Task 7: Agent Wrappers & Prompts
   - Task 8: Container & Browser Tooling
   - Task 9: Client State Machine & Rendering
   - Task 10: Azure Resource Provisioning
   - Task 11: CI/CD Pipeline Configuration
   - Task 12: End-to-End Testing & Validation
   - Task 13: POC Review & Documentation
7. [Appendices](#appendices)

---

## 1. Introduction

This document unifies the **technical architecture** and the **step-by-step execution plan** for building an AI-powered web application generator. The system comprises a **React/TypeScript client**, a **Node.js/Express/TypeScript server**, and a **multi-agent backend** orchestrated via **LangChain/LangGraph** and **Azure OpenAI**. Communication occurs over a **WebSocket channel** using the **AG‑UI protocol**, with the server remaining entirely stateless and the client holding session state.

---

## 2. High-Level Architecture

1. **Client** opens a WebSocket to `/agent?conversationId=<id>`.
2. **Server** handles each message statelessly: loads context (from client or Blob), selects the agent pipeline (initial or modification), runs agents, streams AG‑UI events back, and asynchronously persists the updated snapshot to Azure Blob Storage.
3. **Agents** (Clarification, Requirements, Wireframe, Coder, Modification) run in sequence on initial requests; follow‑ups bypass the first two agents.
4. **Final app** is built in a temporary directory, tested with Playwright, then served locally; the client receives a `RENDER_URL` event for `<iframe>` embedding.

---

## 3. Transport Protocol

- **Protocol**: AG‑UI over **WebSocket** (AG-UI is transport agnostic - supports WebSocket, SSE, HTTP, etc.).
- **Session ID**: `conversationId`, generated on the first request and maintained throughout the conversation.
- **Input Structure**: AG-UI standard `RunAgentInput` with `messages`, `tools`, and `state` properties.
- **Events**: AG-UI standardized event types following official specification with 16 core event types.
- **Streaming Pattern**: Uses Start-Content-End pattern for streaming responses (TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT → TEXT_MESSAGE_END).

---

## 3. Transport Protocol

- **Protocol**: AG‑UI over **WebSocket** (no SSE).
- **Session ID**: `conversationId`, generated on the first request and returned in the first event.
- **ClientMessage** payload includes: `type` (`user_message` or `user_response`), `messageId`, `conversationId`, `clientState`, and `content`.
- **Events**: standardized AG‑UI event types (`TEXT_MESSAGE_CONTENT`, `RENDER_CONTENT`, `RENDER_URL`, `REQUIRE_USER_RESPONSE`, etc.).

---

## 4. Agent Pipeline

## 5. Agent Pipeline

- **Initial Pipeline** (`initial-app-generator`): Clarification → Requirements → Wireframe → Coding.
- **Modification Pipeline** (`modification-app-generator`): Modification → Coding.
- **Selector**: `context.isFirstRequest` determines which graph to run.
- **Agents** implement a common signature: receive `context`, emit AG‑UI events via `context.events`, and return updated `context`.

---

## 5. Agent Pipeline

- **Initial Pipeline** (`initial-app-generator`): Clarification → Requirements → Wireframe → Coding.
- **Modification Pipeline** (`modification-app-generator`): Modification → Coding.
- **Selector**: `context.isFirstRequest` determines which graph to run.
- **Agents** implement a common signature: receive `context`, emit AG‑UI events via `context.events`, and return updated `context`.

---

## 5. Detailed Technical Design

### 5.1 Shared Types & Utilities

- **Package**: `libs/shared`
- **Types** (`types.ts`):
  ```ts
  // AG-UI Protocol Compliant Event Types
  export enum EventType {
    // Lifecycle Events
    RUN_STARTED = 'RUN_STARTED',
    RUN_FINISHED = 'RUN_FINISHED', 
    RUN_ERROR = 'RUN_ERROR',
    STEP_STARTED = 'STEP_STARTED',
    STEP_FINISHED = 'STEP_FINISHED',
    
    // Text Message Events (Start-Content-End Pattern)
    TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
    TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
    TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',
    TEXT_MESSAGE_CHUNK = 'TEXT_MESSAGE_CHUNK',
    
    // Tool Call Events  
    TOOL_CALL_START = 'TOOL_CALL_START',
    TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
    TOOL_CALL_END = 'TOOL_CALL_END',
    TOOL_CALL_CHUNK = 'TOOL_CALL_CHUNK',
    TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',
    
    // State Management Events
    STATE_SNAPSHOT = 'STATE_SNAPSHOT',
    STATE_DELTA = 'STATE_DELTA', 
    MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',
    
    // Special Events
    RAW = 'RAW',
    CUSTOM = 'CUSTOM'
  }

  // AG-UI Base Event Structure
  export interface BaseEvent {
    type: EventType;
    timestamp?: number;
    rawEvent?: any;
  }

  // Specific Event Types
  export interface TextMessageStartEvent extends BaseEvent {
    type: EventType.TEXT_MESSAGE_START;
    messageId: string;
    role: 'assistant';
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

  export interface RunStartedEvent extends BaseEvent {
    type: EventType.RUN_STARTED;
  }

  export interface RunFinishedEvent extends BaseEvent {
    type: EventType.RUN_FINISHED;
  }

  export interface StateSnapshotEvent extends BaseEvent {
    type: EventType.STATE_SNAPSHOT;
    state: State;
  }

  export interface StateDeltaEvent extends BaseEvent {
    type: EventType.STATE_DELTA;
    delta: JsonPatch[];
  }

  export interface MessagesSnapshotEvent extends BaseEvent {
    type: EventType.MESSAGES_SNAPSHOT;
    messages: Message[];
  }

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
      arguments: string;
    };
  }

  // AG-UI Input Structure
  export interface RunAgentInput {
    messages: Message[];
    tools?: Tool[];
    state?: State;
  }

  export interface Context {
    conversationId: string;
    events: EventEmitter;
    isFirstRequest: boolean;
    userInput: string;
    messages: Message[];
    state?: State;
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

  export interface AgentConfig {
    name: string;
    prompt: string;
    tools?: Tool[];
    skipOn?: (context: Context) => boolean;
    validateOutput?: (output: any) => boolean;
  }

  export interface ConversationSnapshot {
    conversationId: string;
    version: number;
    timestamp: string;
    context: Context;
    events: BaseEvent[];
    artifacts?: {
      wireframe?: string;
      generatedFiles?: Record<string, string>;
      deploymentUrl?: string;
    };
  }

  export interface Question {
    id: string;
    text: string;
    type: 'text' | 'select' | 'multiselect' | 'boolean';
    options?: string[];
    required?: boolean;
  }

  export interface State {
    [key: string]: any;
  }

  export interface Tool {
    name: string;
    description: string;
    parameters: any;
  }

  export interface JsonPatch {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
  }
  ```
- **Helpers**: `generateUUID()`, `getTimestamp()`, Blob snapshot helpers.
- **Configuration**: `tsconfig.json` path mappings for shared package.

### 5.2 Server Components

- **Frameworks**: Express.js, WebSocket (`ws`), AG‑UI SDK, LangChain/LangGraph.
- **Structure** (`apps/server/src`):
  - `server.ts`: HTTP & WebSocket upgrade logic.
  - `api/index.ts`: `/agent` handler using `createAgentHandler`.
  - `orchestrator/pipeline.ts`: exports `initialPipeline`, `modificationPipeline`, and `selectPipeline`.
  - `agents/*`: Base agent class and agent configurations for extensibility.
  - `tools/*`: `codeRunner.ts` (temp directory approach), `browser.ts` (Playwright).
  - `utils/events.ts`: `emitEvent(sessionId,event)`, `loadContext()`, `persistSnapshot()`.
- **Stateless Handling**: no in‑memory session store; `loadContext` merges clientState or loads from Blob; `persistSnapshot` is fire‑and‑forget.
- **Agent Architecture**: Data-driven agent configuration with `BaseAgent` class for common execution logic.
- **WebSocket Handler**: Complete message handling implementation:
  ```ts
  export async function handleWebSocketMessage(ws: WebSocket, input: RunAgentInput) {
    try {
      // 1. Emit RUN_STARTED event
      emitEvent(ws, { type: EventType.RUN_STARTED, timestamp: Date.now() });
      
      // 2. Load context from state or create new
      const context = await loadContext(input.state, input.messages);
      
      // 3. Update context with new messages
      context.messages = input.messages;
      context.userInput = input.messages[input.messages.length - 1]?.content || '';
      context.retryCount = context.retryCount || 0;
      
      // 4. Select and run pipeline
      const pipeline = selectPipeline(context);
      const updatedContext = await pipeline.run(context);
      
      // 5. Emit state updates
      emitEvent(ws, {
        type: EventType.STATE_SNAPSHOT,
        state: updatedContext.state,
        timestamp: Date.now()
      });
      
      // 6. Emit messages snapshot
      emitEvent(ws, {
        type: EventType.MESSAGES_SNAPSHOT, 
        messages: updatedContext.messages,
        timestamp: Date.now()
      });
      
      // 7. Persist snapshot asynchronously
      persistSnapshot(updatedContext).catch(console.error);
      
      // 8. Emit RUN_FINISHED event
      emitEvent(ws, { type: EventType.RUN_FINISHED, timestamp: Date.now() });
    } catch (error) {
      // Handle errors with recovery context
      const updatedContext = {
        ...context,
        lastError: {
          agent: error.agent || 'unknown',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        retryCount: (context?.retryCount || 0) + 1
      };
      
      emitEvent(ws, {
        type: EventType.RUN_ERROR,
        timestamp: Date.now(),
        rawEvent: { message: error.message, recoverable: updatedContext.retryCount < 3 }
      });
    }
  }
  ```

### 5.3 Client Components

- **Frameworks**: React, TypeScript, Tailwind CSS, Shadcn UI, XState, AG‑UI SDK, `ws`.
- **Structure** (`apps/client/src`):
  - `api/agui.ts`: `createAgUiClient(conversationId)` connecting via WebSocket with AG-UI protocol.
  - `state/machine.ts`: XState definition with `idle`, `running`, `streaming`, `waiting`, `complete`, `error`.
  - `components/ChatPanel.tsx`, `components/ContentPanel.tsx`, `components/EventRenderer.tsx`.
  - `App.tsx`: initializes WebSocket, dispatches events to state machine, renders UI.
- **Client-Held State**: holds full conversation state with AG-UI Message format; on reload, fetches snapshot if local state is missing.
- **Reconnection Logic**: on `ws.close`, reconnect with same `conversationId` and send current state.
- **AG-UI Message Handling**: Convert user input to AG-UI `RunAgentInput` format:
  ```ts
  const runInput: RunAgentInput = {
    messages: [
      ...conversationHistory,
      { id: generateId(), role: 'user', content: userInput }
    ],
    tools: availableTools,
    state: currentState
  };
  ```
- **Event Processing**: Handle AG-UI event streams with proper Start-Content-End patterns:
  ```ts
  // Handle streaming text messages
  case EventType.TEXT_MESSAGE_START: {
    // Initialize new message
    setMessages(prev => [...prev, { 
      id: event.messageId, 
      role: event.role, 
      content: '', 
      streaming: true 
    }]);
    break;
  }
  
  case EventType.TEXT_MESSAGE_CONTENT: {
    // Append content delta
    setMessages(prev => prev.map(msg => 
      msg.id === event.messageId 
        ? { ...msg, content: msg.content + event.delta }
        : msg
    ));
    break;
  }
  
  case EventType.TEXT_MESSAGE_END: {
    // Mark message complete
    setMessages(prev => prev.map(msg => 
      msg.id === event.messageId 
        ? { ...msg, streaming: false }
        : msg
    ));
    break;
  }
  ```

### 5.4 Orchestration with LangGraph

```ts
import { Graph, Node } from 'langgraph';
import { BaseAgent, AgentConfig } from '../agents';

// Agent configurations
const agentConfigs: Record<string, AgentConfig> = {
  clarification: {
    name: 'clarification',
    prompt: 'Ask clarifying questions about the user requirements...',
    skipOn: (context) => context.retryCount > 0, // Skip on retries
  },
  requirements: {
    name: 'requirements', 
    prompt: 'Analyze requirements and create specifications...',
    validateOutput: (output) => output.includes('requirements'),
  },
  wireframe: {
    name: 'wireframe',
    prompt: 'Create wireframe based on requirements...',
  },
  coding: {
    name: 'coding',
    prompt: 'Generate code based on wireframe and requirements...',
    tools: ['codeRunner', 'browser'],
  },
  modification: {
    name: 'modification',
    prompt: 'Modify existing code based on user feedback...',
    tools: ['codeRunner'],
  }
};

export const initialPipeline = new Graph({ id: 'initial-app-generator' });
initialPipeline.addEdge(
  new Node('clarification', new BaseAgent(agentConfigs.clarification)), 
  new Node('requirements', new BaseAgent(agentConfigs.requirements))
);
initialPipeline.addEdge(
  new Node('requirements', new BaseAgent(agentConfigs.requirements)), 
  new Node('wireframe', new BaseAgent(agentConfigs.wireframe))
);
initialPipeline.addEdge(
  new Node('wireframe', new BaseAgent(agentConfigs.wireframe)), 
  new Node('coding', new BaseAgent(agentConfigs.coding))
);

export const modificationPipeline = new Graph({ id: 'modification-app-generator' });
modificationPipeline.addEdge(
  new Node('modification', new BaseAgent(agentConfigs.modification)), 
  new Node('coding', new BaseAgent(agentConfigs.coding))
);

export default function selectPipeline(context) {
  return context.isFirstRequest ? initialPipeline : modificationPipeline;
}
```

### 5.5 Container & Browser Tools

- **Simple Code Runner** (`tools/codeRunner.ts`): Uses temporary directories instead of Docker for POC simplicity:
  ```ts
  export class SimpleCodeRunner {
    async runCode(files: Record<string, string>): Promise<RunResult> {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-'));
      try {
        // Write files to temp directory
        // Run npm install, build, and tests
        // Return results with build output and test status
      } finally {
        // Clean up after delay for debugging
        setTimeout(() => fs.rm(tempDir, { recursive: true, force: true }), 5 * 60 * 1000);
      }
    }
    
    async serveApp(distPath: string, port: number): Promise<string> {
      // Use npx serve to host the built app
      return `http://localhost:${port}`;
    }
  }
  ```
- **Playwright** (`tools/browser.ts`): headless Chromium launch, DOM inspection, screenshots.
- **Migration Path**: Easy to swap `SimpleCodeRunner` with `DockerCodeRunner` for production isolation.

### 5.6 Azure Infrastructure

- **Azure OpenAI**: GPT‑4 endpoint, key in `ENV`.
- **Storage Account**: Blob containers `snapshots` (state) and `artifacts` (code bundles).
- **Static Web Apps**: deploy client artifacts; integrate with GitHub Actions.
- **(Optional)** Container Instances: for on‑demand isolation.

### 5.7 Environment Configuration

Required environment variables for development and production:

```bash
# Azure OpenAI
AZURE_OPENAI_API_KEY=your_openai_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_SNAPSHOTS=snapshots
AZURE_STORAGE_CONTAINER_ARTIFACTS=artifacts

# Server Configuration
PORT=3000
NODE_ENV=development
WS_TIMEOUT=30000
TEMP_DIR_CLEANUP_DELAY=300000

# Client Configuration (Vite)
VITE_WS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000

# Development Features
MOCK_AGENTS=false
VERBOSE_LOGGING=true
CUSTOM_AGENT_PATH=./custom-agents
```

### 5.8 AG-UI Pipeline Implementation Examples

**Wireframe Generation Pipeline**:
```ts
// apps/server/src/orchestrator/pipeline.ts
import { EventType, BaseEvent, RunAgentInput } from '@ag-ui/core';

export async function generateWireframe(
  input: RunAgentInput, 
  eventEmitter: (event: BaseEvent) => void
) {
  const messageId = generateId();
  
  // Start assistant response
  eventEmitter({
    type: EventType.TEXT_MESSAGE_START,
    conversationId: input.conversationId,
    messageId,
    role: 'assistant',
    timestamp: Date.now()
  });
  
  // Stream wireframe analysis
  const analysis = "I'll analyze your requirements and create a wireframe...";
  for (const chunk of analysis.split(' ')) {
    eventEmitter({
      type: EventType.TEXT_MESSAGE_CONTENT,
      conversationId: input.conversationId,
      messageId,
      delta: chunk + ' ',
      timestamp: Date.now()
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Tool call for wireframe generation
  const toolCallId = generateId();
  eventEmitter({
    type: EventType.TOOL_CALL_START,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    toolName: 'wireframeGenerator',
    timestamp: Date.now()
  });
  
  eventEmitter({
    type: EventType.TOOL_CALL_ARGS,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    args: { 
      requirements: extractRequirements(input.messages),
      style: 'modern',
      framework: 'react'
    },
    timestamp: Date.now()
  });
  
  // Execute wireframe generation
  const wireframeResult = await generateWireframeStructure(input.messages);
  
  eventEmitter({
    type: EventType.TOOL_CALL_RESULT,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    result: wireframeResult,
    timestamp: Date.now()
  });
  
  eventEmitter({
    type: EventType.TOOL_CALL_END,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    timestamp: Date.now()
  });
  
  // End message
  eventEmitter({
    type: EventType.TEXT_MESSAGE_END,
    conversationId: input.conversationId,
    messageId,
    timestamp: Date.now()
  });
}
```

**Code Generation Pipeline**:
```ts
export async function generateCode(
  input: RunAgentInput, 
  eventEmitter: (event: BaseEvent) => void
) {
  const messageId = generateId();
  
  // Start streaming response
  eventEmitter({
    type: EventType.TEXT_MESSAGE_START,
    conversationId: input.conversationId,
    messageId,
    role: 'assistant',
    timestamp: Date.now()
  });
  
  // Stream code generation progress
  const steps = [
    "Analyzing wireframe structure...",
    "Generating React components...", 
    "Adding TypeScript types...",
    "Implementing event handlers...",
    "Finalizing styles..."
  ];
  
  for (const step of steps) {
    eventEmitter({
      type: EventType.TEXT_MESSAGE_CONTENT,
      conversationId: input.conversationId,
      messageId,
      delta: step + '\n',
      timestamp: Date.now()
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Tool call for code execution
  const toolCallId = generateId();
  eventEmitter({
    type: EventType.TOOL_CALL_START,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    toolName: 'codeRunner',
    timestamp: Date.now()
  });
  
  const generatedCode = await generateComponentCode(input);
  
  eventEmitter({
    type: EventType.TOOL_CALL_ARGS,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    args: { 
      code: generatedCode,
      language: 'typescript',
      framework: 'react'
    },
    timestamp: Date.now()
  });
  
  // Execute and test code
  const executionResult = await executeCode(generatedCode);
  
  eventEmitter({
    type: EventType.TOOL_CALL_RESULT,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    result: executionResult,
    timestamp: Date.now()
  });
  
  eventEmitter({
    type: EventType.TOOL_CALL_END,
    conversationId: input.conversationId,
    messageId,
    toolCallId,
    timestamp: Date.now()
  });
  
  // End message
  eventEmitter({
    type: EventType.TEXT_MESSAGE_END,
    conversationId: input.conversationId,
    messageId,
    timestamp: Date.now()
  });
}
```

### 5.9 CI/CD & Deployment

- **Monorepo**: Turborepo or Nx pipelines.
- **Server Workflow**: `eslint`, `tsc --noEmit`, `npm test`, `npm run build`, `docker build && push`.
- **Client Workflow**: `eslint`, `tsc --noEmit`, `npm run build`, deploy to Static Web Apps.
- **Secrets**: stored in GitHub / Azure Key Vault.
- **Azure Static Web Apps Configuration** (`staticwebapp.config.json`):
  ```json
  {
    "routes": [
      {
        "route": "/api/*",
        "rewrite": "https://your-backend.azurewebsites.net/api/*"
      }
    ],
    "navigationFallback": {
      "rewrite": "/index.html",
      "exclude": ["/api/*", "/*.{css,scss,sass,js,ts,tsx,jsx}"]
    },
    "responseOverrides": {
      "404": {
        "rewrite": "/index.html"
      }
    }
  }
  ```

### 5.10 Security & POC Constraints

- **No Redis**: server stateless by design.
- **Simplified Sandboxing**: Uses temp directories instead of Docker for POC; easy to upgrade to container isolation later.
- **Error Recovery**: Context includes `lastError` and `retryCount` for graceful failure handling.
- **Input Validation**: sanitize attachments and clientState.
- **Async Persistence**: `persistSnapshot` does not block responses.
- **Extensible Agents**: Data-driven agent configuration makes it easy to add new agents or modify behavior.
- **Rate Limiting**: Simple in-memory rate limiting for POC (requests per conversation per minute).
- **File Size Limits**: Generated apps limited to 50MB, individual files to 10MB.
- **Timeouts**: Agent execution timeout of 30 seconds, WebSocket message timeout of 5 minutes.
- **Cleanup Strategy**: Temp directories cleaned after 5 minutes, blob snapshots retained for 30 days.

### 5.11 Local Development Setup

Root `package.json` scripts for development:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:server": "cd apps/server && npm run dev",
    "dev:client": "cd apps/client && npm run dev",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "build": "turbo run build",
    "build:server": "cd apps/server && npm run build",
    "build:client": "cd apps/client && npm run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean"
  }
}
```

Port configuration:
- **Server & WebSocket**: 3000 (unified on same port)
- **Client Dev Server**: 5173 (Vite default)
- **Generated Apps**: Dynamic ports starting from 8000

CORS configuration for development:
```ts
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:5173', 'http://localhost:3000']
    : [process.env.CLIENT_URL],
  credentials: true
}));
```

### 5.11 Testing Strategy

**Unit Tests**: Each agent, tool, and utility function should have unit tests.

```typescript
// Example: Agent Pipeline Tests
describe('Agent Pipeline', () => {
  it('should run initial pipeline for first request', async () => {
    const context = createTestContext({ isFirstRequest: true });
    const events = captureEvents(context);
    
    const pipeline = selectPipeline(context);
    await pipeline.run(context);
    
    expect(events).toContainEqual(
      expect.objectContaining({ type: AgUiEventType.TEXT_MESSAGE_CONTENT })
    );
  });

  it('should handle agent failures with retry logic', async () => {
    const context = createTestContext({ 
      lastError: { agent: 'coding', error: 'Build failed', timestamp: '2024-01-01' }
    });
    
    const pipeline = selectPipeline(context);
    const result = await pipeline.run(context);
    
    expect(result.retryCount).toBe(1);
  });
});

// Example: WebSocket Handler Tests
describe('WebSocket Handler', () => {
  it('should load context and run pipeline', async () => {
    const mockWs = createMockWebSocket();
    const message: ClientMessage = {
      type: 'user_message',
      messageId: 'test-123',
      conversationId: 'conv-123',
      clientState: {},
      content: { text: 'Build a todo app' }
    };

    await handleWebSocketMessage(mockWs, message);

    expect(mockWs.sentEvents).toContainEqual(
      expect.objectContaining({ type: AgUiEventType.SESSION_COMPLETE })
    );
  });
});
```

**Integration Tests**: End-to-end flow testing with mock Azure services.

```typescript
describe('E2E Agent Flow', () => {
  it('should complete full app generation flow', async () => {
    const client = createTestClient();
    
    // Send initial message
    await client.send('Build a feedback form');
    
    // Verify clarification questions
    const clarificationEvent = await client.waitForEvent(AgUiEventType.REQUIRE_USER_RESPONSE);
    expect(clarificationEvent.payload.questions).toHaveLength(3);
    
    // Answer questions
    await client.respond({ answers: ['Yes', 'MongoDB', 'React'] });
    
    // Verify wireframe generation
    const wireframeEvent = await client.waitForEvent(AgUiEventType.RENDER_CONTENT);
    expect(wireframeEvent.payload.type).toBe('wireframe');
    
    // Verify final app URL
    const urlEvent = await client.waitForEvent(AgUiEventType.RENDER_URL);
    expect(urlEvent.payload.url).toMatch(/^http:\/\/localhost:\d+/);
  });
});
```

**Helper Functions for Testing**:

```typescript
export function createTestContext(overrides?: Partial<Context>): Context {
  return {
    conversationId: 'test-123',
    events: new EventEmitter(),
    isFirstRequest: true,
    userInput: 'test input',
    retryCount: 0,
    ...overrides
  };
}

export function captureEvents(context: Context): AgUiEvent[] {
  const events: AgUiEvent[] = [];
  context.events.on('*', (event) => events.push(event));
  return events;
}

export function createMockWebSocket(): MockWebSocket {
  return {
    sentEvents: [],
    send: jest.fn((data) => {
      sentEvents.push(JSON.parse(data));
    }),
    close: jest.fn()
  };
}
```

---

## 6. Execution Plan

### ✅ Task 1: Repository & Monorepo Initialization **[COMPLETED]**
**Objective:** Set up the current directory as a Git repository and monorepo structure to host server, client, and shared libraries with base configurations.

**Status: COMPLETED** ✅
- ✅ Git repository initialized with main branch
- ✅ Turborepo configured with `turbo.json` and root scripts
- ✅ Workspace layout created: `apps/server`, `apps/client`, `libs/shared`
- ✅ Root `package.json` configured with workspaces and dev scripts
- ✅ TypeScript configuration with `tsconfig.base.json` and path mappings
- ✅ Git configuration with `.gitignore`, `README.md`
- ✅ ESLint & Prettier configured with TypeScript support
- ✅ All builds validate successfully

### ✅ Task 2: Boilerplate Scaffolding **[COMPLETED]**

**Status: COMPLETED** ✅

#### ✅ Server
- ✅ Dependencies installed: `express`, `dotenv`, `ws`, `@azure/openai`, `playwright`
- ✅ TypeScript configuration with `tsconfig.json`
- ✅ Server structure with `server.ts` and folder organization
- ✅ WebSocket integration configured

#### ✅ Client  
- ✅ Vite React+TypeScript scaffolded
- ✅ Styling configured with `tailwindcss` and `shadcn-ui`
- ✅ WebSocket client implementation
- ✅ Component structure and entry points configured

### ✅ Task 3: Shared Types & Utilities **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ `libs/shared` package created with full AG-UI protocol types
- ✅ Official AG-UI EventType enum with 15 core event types
- ✅ AG-UI Message interfaces (User, Assistant, System, Tool)
- ✅ RunAgentInput structure for AG-UI compliance
- ✅ Context, Pipeline, and AgentConfig interfaces
- ✅ TypeScript path mappings configured (`@shared/*`)
- ✅ Utility functions: `generateUUID()`, `getTimestamp()`

### ✅ Task 4: AG‑UI SDK Integration **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ **Server**: `/agent` WebSocket handler with AG-UI protocol compliance
  - ✅ `handleWebSocketMessage()` processes `RunAgentInput`
  - ✅ `createAgentHandler()` manages WebSocket lifecycle
  - ✅ Full AG-UI event emission (RUN_STARTED/FINISHED, streaming patterns)
  - ✅ Error handling with AG-UI ERROR events
- ✅ **Client**: Complete AG-UI client implementation
  - ✅ `AgUiClient` class with WebSocket management
  - ✅ `createAgUiClient()` factory function
  - ✅ AG-UI event subscription and state management
  - ✅ Reconnection logic with conversation persistence

### ✅ Task 5: WebSocket Channel & Stateless Server **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ WebSocket setup in `server.ts` for `/agent` upgrades
- ✅ Stateless message handling: parse `RunAgentInput`, load context, run pipeline
- ✅ AG-UI event streaming to client
- ✅ Asynchronous state persistence with `persistSnapshot()`
- ✅ Client reconnection logic with `conversationId` and local state recovery
- ✅ Error recovery and retry mechanisms

### ✅ Task 6: LangGraph Pipeline Implementation **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ Pipeline system in `orchestrator/pipeline.ts`
- ✅ `selectPipeline(context)` with intelligent routing
- ✅ Wireframe generation pipeline with AG-UI streaming
- ✅ Code generation pipeline with tool calls
- ✅ Default response pipeline for general queries
- ✅ AG-UI event emission throughout pipeline execution

### ⚠️ Task 7: Agent Wrappers & Prompts **[PARTIALLY COMPLETED]**

**Status: PARTIALLY COMPLETED** ⚠️
- ✅ Pipeline-based agent execution implemented
- ✅ Error recovery with `context.lastError` and `retryCount`
- ✅ Tool integration framework
- ❌ `BaseAgent` class not yet implemented (using pipeline functions instead)
- ❌ Agent configurations in separate files not yet created
- ❌ Advanced agent prompts need refinement

### ✅ Task 8: Container & Browser Tooling **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ `tools/codeRunner.ts` implemented with temp directory approach
- ✅ `tools/browser.ts` implemented with Playwright integration  
- ✅ Error handling and logging for tool failures
- ✅ Configuration for easy migration to Docker containers later
- ✅ Tool integration in pipeline execution

### ✅ Task 9: Client State Machine & Rendering **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ React state machine in `state/machine.ts` with AG-UI event handling
- ✅ State transitions: idle → connecting → connected → running → streaming → complete
- ✅ AG-UI event handlers for all 15 event types
- ✅ Message streaming support with Start-Content-End pattern
- ✅ Error states and reconnection handling
- ✅ Helper functions: `isBusyState()`, `canSendMessage()`, `getStateDescription()`

### ❌ Task 10: Azure Resource Provisioning **[NOT STARTED]**

**Status: NOT STARTED** ❌
- ❌ Azure OpenAI service provisioning
- ❌ Azure Storage Account for snapshots and artifacts
- ❌ Azure Static Web App for client hosting
- ❌ Service principal and secret configuration
- ❌ Environment variable setup for Azure services

### ❌ Task 11: CI/CD Pipeline Configuration **[NOT STARTED]**

**Status: NOT STARTED** ❌
- ❌ GitHub Actions workflow setup
- ❌ Server build and deployment pipeline
- ❌ Client build and Static Web App deployment
- ❌ Secret management and environment configuration
- ❌ Automated testing in CI pipeline

### ❌ Task 12: End-to-End Testing & Validation **[NOT STARTED]**

**Status: NOT STARTED** ❌

**Unit Testing Setup**:
- ❌ Testing frameworks installation (Jest, Supertest, React Testing Library)
- ❌ Test utilities: `createTestContext`, `captureEvents`, `createMockWebSocket`
- ❌ Agent pipeline tests: execution, error handling, retry logic
- ❌ Tool tests: code runner, browser automation

**Integration Testing**:
- ❌ Mock Azure services for testing
- ❌ Complete conversation flow testing
- ❌ WebSocket connection scenarios
- ❌ State persistence testing

**End-to-End Validation**:
- ❌ Staging environment deployment
- ❌ Multi-app type testing (todo, forms, dashboards)
- ❌ Network interruption testing
- ❌ Performance monitoring setup
- ❌ Security validation

### ❌ Task 13: POC Review & Documentation **[NOT STARTED]**

**Status: NOT STARTED** ❌
- ❌ README update with complete setup instructions
- ❌ `conversationId` scheme documentation
- ❌ Demo recording and usage examples
- ❌ Extension points and architecture documentation
- ❌ Deployment guide and production considerations

---

## 7. Appendices

### Appendix A: Example AG‑UI Event Sequence

1. Client → Server: `{ type: 'user_message', conversationId: null, content: { text: 'Build a feedback form' } }`
2. Server → Client: `TEXT_MESSAGE_CONTENT` ("Do you want a database?")
3. Server → Client: `REQUIRE_USER_RESPONSE`
4. Client → Server: `{ type: 'user_response', conversationId: 'abc123', clientState: {...}, content: { answers: [...] } }`
5. Server → Client: `TEXT_MESSAGE_CONTENT` ("Generating wireframe...")
6. Server → Client: `RENDER_CONTENT` (wireframe HTML)
7. Server → Client: `TEXT_MESSAGE_CONTENT` ("Coding now\...")
8. Server → Client: `RENDER_URL` ("[https://.../abc123](https://.../abc123)")
9. Server → Client: `SESSION_COMPLETE`

### Appendix B: Example Agent Prompts

**Clarification Agent**:
```
You are a helpful assistant that asks clarifying questions about web application requirements.

User Request: {userInput}

Ask 3-5 specific questions to understand:
1. What type of application (form, dashboard, game, etc.)
2. What data storage needs (none, local storage, database)
3. What framework preference (React, Vue, vanilla JS)
4. What styling approach (CSS, Tailwind, styled-components)
5. Any specific features or constraints

Format as JSON with question objects containing id, text, type, and options if applicable.
```

**Requirements Agent**:
```
You are a technical analyst that converts user requirements into detailed specifications.

User Input: {userInput}
Clarification Answers: {answers}

Create a detailed requirements specification including:
1. Application type and purpose
2. Core features and functionality
3. Data model and storage requirements
4. UI/UX requirements
5. Technical constraints
6. Success criteria

Output as structured markdown document.
```

**Wireframe Agent**:
```
You are a UI/UX designer that creates wireframes from requirements.

Requirements: {requirements}

Create an HTML wireframe that shows:
1. Application layout and structure
2. Key UI components and interactions
3. Data flow and user journey
4. Responsive design considerations

Use semantic HTML with inline CSS for styling. Make it visually clear but not final design.
```

**Coding Agent**:
```
You are a senior full-stack developer that builds web applications.

Requirements: {requirements}
Wireframe: {wireframe}

Generate a complete, working web application with:
1. Modern, clean code following best practices
2. Responsive design that works on mobile and desktop
3. Proper error handling and user feedback
4. Comments explaining key functionality
5. Package.json with appropriate dependencies

Use the specified framework and ensure the app is production-ready.
```

### Appendix C: Generated App File Structure

Expected structure for generated applications:
```
/
├── package.json          # Dependencies and scripts
├── index.html           # Entry point
├── src/
│   ├── main.js|tsx      # Application entry
│   ├── App.js|tsx       # Root component
│   ├── components/      # Reusable components
│   ├── styles/          # CSS/styling files
│   └── utils/          # Helper functions
├── public/             # Static assets
└── README.md          # Usage instructions
```

---

*End of Architecture Design and Execution Plan*

