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

- **App Container Tool** (`tools/appContainer.ts`): Provides a Linux-like terminal environment for generated applications:
  ```ts
  export class AppContainer {
    private workDir: string;
    private processes: Map<string, ChildProcess> = new Map();
    private currentDir: string = '/app';  // Virtual current directory
    private fileSystem: Map<string, FileNode> = new Map();
    
    constructor(conversationId: string) {
      // Create isolated workspace for this conversation
      this.workDir = path.join(os.tmpdir(), 'app-builder', conversationId);
      this.initializeFileSystem();
    }
    
    // Main terminal interface - executes bash commands like a real Linux terminal
    async executeCommand(command: string): Promise<CommandResult> {
      // Parse and execute bash commands
      const parsed = this.parseCommand(command);
      
      switch (parsed.command) {
        case 'ls':
          return this.ls(parsed.args, parsed.flags);
        case 'cd':
          return this.cd(parsed.args[0]);
        case 'pwd':
          return this.pwd();
        case 'cat':
          return this.cat(parsed.args);
        case 'echo':
          return this.echo(parsed.args, parsed.redirect);
        case 'mkdir':
          return this.mkdir(parsed.args, parsed.flags);
        case 'rm':
          return this.rm(parsed.args, parsed.flags);
        case 'cp':
          return this.cp(parsed.args[0], parsed.args[1], parsed.flags);
        case 'mv':
          return this.mv(parsed.args[0], parsed.args[1]);
        case 'touch':
          return this.touch(parsed.args);
        case 'sed':
          return this.sed(parsed.args, parsed.flags);
        case 'grep':
          return this.grep(parsed.pattern, parsed.files, parsed.flags);
        case 'npm':
          return this.npm(parsed.args);
        case 'node':
          return this.node(parsed.args);
        case 'npx':
          return this.npx(parsed.args);
        default:
          // Try to execute as a system command
          return this.execSystemCommand(command);
      }
    }
    
    // Bash-like command implementations
    private async ls(args: string[], flags: string[]): Promise<CommandResult> {
      const path = this.resolvePath(args[0] || '.');
      const files = await fs.readdir(this.toRealPath(path));
      
      if (flags.includes('l')) {
        // Long format with permissions, size, date
        const details = await Promise.all(files.map(async (file) => {
          const stats = await fs.stat(this.toRealPath(path + '/' + file));
          return this.formatLsLine(file, stats);
        }));
        return { stdout: details.join('\n'), stderr: '', exitCode: 0 };
      }
      
      return { stdout: files.join('  '), stderr: '', exitCode: 0 };
    }
    
    private async cat(files: string[]): Promise<CommandResult> {
      try {
        const contents = await Promise.all(
          files.map(file => fs.readFile(this.toRealPath(this.resolvePath(file)), 'utf-8'))
        );
        return { stdout: contents.join('\n'), stderr: '', exitCode: 0 };
      } catch (error) {
        return { stdout: '', stderr: `cat: ${error.message}`, exitCode: 1 };
      }
    }
    
    private async sed(args: string[], flags: string[]): Promise<CommandResult> {
      // Support common sed patterns like s/old/new/g
      const inPlace = flags.includes('i');
      const pattern = args[0];
      const files = args.slice(1);
      
      // Parse sed pattern (e.g., s/search/replace/g)
      const match = pattern.match(/^s\/(.+?)\/(.+?)\/(g?)$/);
      if (!match) {
        return { stdout: '', stderr: 'sed: invalid command', exitCode: 1 };
      }
      
      const [, search, replace, global] = match;
      const regex = new RegExp(search, global ? 'g' : '');
      
      for (const file of files) {
        const realPath = this.toRealPath(this.resolvePath(file));
        const content = await fs.readFile(realPath, 'utf-8');
        const modified = content.replace(regex, replace);
        
        if (inPlace) {
          await fs.writeFile(realPath, modified);
        } else {
          return { stdout: modified, stderr: '', exitCode: 0 };
        }
      }
      
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    
    private async npm(args: string[]): Promise<CommandResult> {
      const subcommand = args[0];
      const realPath = this.toRealPath(this.currentDir);
      
      // Execute npm command in the real directory
      return new Promise((resolve) => {
        const npm = spawn('npm', args, { 
          cwd: realPath,
          shell: true 
        });
        
        let stdout = '';
        let stderr = '';
        
        npm.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        npm.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        npm.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code || 0 });
        });
        
        // Store process for potential termination
        if (subcommand === 'run' && args[1] === 'dev') {
          this.processes.set('dev-server', npm);
        }
      });
    }
    
    // Path resolution (handle relative and absolute paths)
    private resolvePath(path: string): string {
      if (path.startsWith('/')) {
        return path;
      }
      if (path === '.') {
        return this.currentDir;
      }
      if (path === '..') {
        return this.currentDir.split('/').slice(0, -1).join('/') || '/';
      }
      return `${this.currentDir}/${path}`.replace(/\/+/g, '/');
    }
    
    // Convert virtual path to real filesystem path
    private toRealPath(virtualPath: string): string {
      return path.join(this.workDir, virtualPath.slice(1)); // Remove leading /
    }
    
    // Command result interface
    export interface CommandResult {
      stdout: string;
      stderr: string;
      exitCode: number;
    }
  }
  ```

- **Browser Automation Tool** (`tools/browserAutomation.ts`): Advanced browser control with future Computer Use Agent support:
  ```ts
  export class BrowserAutomation {
    private browser: Browser;
    private page: Page;
    private recordingEnabled: boolean = false;
    
    async initialize(options?: BrowserOptions): Promise<void> {
      // Launch Playwright browser (headless or headful)
      // Set up viewport, user agent, etc.
    }
    
    // Navigation and screenshots
    async navigateToApp(url: string): Promise<void> {
      // Navigate to the generated app URL
    }
    
    async takeScreenshot(options?: ScreenshotOptions): Promise<Buffer> {
      // Capture full page or element screenshot
      // Support for annotations and highlighting
    }
    
    // Interactive actions (foundation for Computer Use Agent)
    async click(selector: string | Point): Promise<void> {
      // Click on element or coordinates
    }
    
    async type(selector: string, text: string): Promise<void> {
      // Type text into input field
    }
    
    async hover(selector: string | Point): Promise<void> {
      // Hover over element
    }
    
    async scrollTo(selector: string | Point): Promise<void> {
      // Scroll to element or position
    }
    
    // Advanced inspection
    async getElementInfo(selector: string): Promise<ElementInfo> {
      // Get element properties, computed styles, etc.
    }
    
    async evaluateScript(script: string): Promise<any> {
      // Execute JavaScript in page context
    }
    
    async waitForCondition(condition: string, timeout?: number): Promise<void> {
      // Wait for specific condition to be true
    }
    
    // Recording and playback (for future automation)
    async startRecording(): Promise<void> {
      // Begin recording user actions
    }
    
    async stopRecording(): Promise<Action[]> {
      // Stop recording and return action sequence
    }
    
    async playbackActions(actions: Action[]): Promise<void> {
      // Replay recorded actions
    }
    
    // Computer Use Agent preparation
    async captureViewport(): Promise<ViewportCapture> {
      // Capture viewport with element annotations
      // Include bounding boxes, element IDs, clickable areas
    }
    
    async executeAgentAction(action: AgentAction): Promise<ActionResult> {
      // Execute high-level action from Computer Use Agent
      // E.g., "Click the submit button", "Fill the form with test data"
    }
    
    // Testing utilities
    async runAccessibilityCheck(): Promise<A11yReport> {
      // Check for accessibility issues
    }
    
    async measurePerformance(): Promise<PerformanceMetrics> {
      // Capture performance metrics
    }
    
    async detectErrors(): Promise<ConsoleError[]> {
      // Check for console errors and warnings
    }
  }
  
  // Types for Computer Use Agent integration
  export interface AgentAction {
    type: 'click' | 'type' | 'scroll' | 'wait' | 'assert';
    target?: string; // Natural language description
    value?: string;
    coordinates?: Point;
  }
  
  export interface ViewportCapture {
    screenshot: Buffer;
    elements: AnnotatedElement[];
    dimensions: { width: number; height: number };
  }
  ```

- **Integration with Coding Agent**: The coding agent uses bash commands naturally through tool calls:
  ```ts
  // Enhanced coding agent prompt
  export const codingAgentConfig: AgentConfig = {
    name: 'coding',
    prompt: `You are a senior full-stack developer that builds web applications.
    
    You have access to a Linux terminal through the appContainer.executeCommand tool.
    You can execute ANY bash command just like in a real terminal.
    
    Common commands you should use:
    - pwd: Check current directory
    - ls -la: List files with details
    - cat [file]: Read file contents
    - echo "[content]" > [file]: Write content to file
    - sed -i 's/old/new/g' [file]: Edit files in place
    - mkdir -p [directory]: Create directories
    - npm install: Install dependencies
    - npm run build: Build the application
    - npm run dev: Start development server
    - npm test: Run tests
    
    Your workflow should be:
    1. Check current directory with pwd
    2. Create necessary directories with mkdir
    3. Write all required files using echo or cat
    4. Run npm install to install dependencies
    5. Run npm run build to build the app
    6. Check for errors in the output
    7. If there are errors, read the problematic files with cat
    8. Fix errors using sed or by rewriting files
    9. Repeat build until successful
    10. Run npm run dev to start the app
    
    Continue iterating until you have a fully working application that meets all requirements.
    Never give up on errors - analyze them and fix them.
    `,
    tools: ['appContainer'],
    validateOutput: (output) => {
      // Ensure the agent actually built and tested the app
      return output.includes('build successful') || output.includes('dev server running');
    }
  };
  ```

- **Migration Path**: Easy to swap implementations while maintaining the same interface; ready for Docker containerization and Computer Use Agent integration.

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

### ✅ Task 7: Agent Wrappers & Prompts **[COMPLETED]**

**Status: COMPLETED** ✅
- ✅ **BaseAgent Class**: Complete implementation with AG-UI event handling
  - ✅ Error recovery with `context.lastError` and `retryCount` (up to 3 attempts)
  - ✅ Exponential backoff retry mechanism
  - ✅ AG-UI compliant event streaming (Start-Content-End pattern)
  - ✅ Tool integration framework (codeRunner, browser)
  - ✅ Agent validation and skip condition support
  - ✅ Context management and state updates
  - ⚠️ **Note**: Azure OpenAI integration is placeholder, but has sophisticated fallback code generation
- ✅ **Individual Agent Configurations**: 5 specialized agents created
  - ✅ `clarificationAgent.ts` - Asks clarifying questions (skips on retries/detailed input)
  - ✅ `requirementsAgent.ts` - Creates detailed technical specifications
  - ✅ `wireframeAgent.ts` - Designs UI layouts and structure
  - ✅ `codingAgent.ts` - Generates complete React applications with TypeScript
  - ✅ `modificationAgent.ts` - Modifies existing code (skips on first requests)
- ✅ **Agent Registry System**: Central agent management
  - ✅ Agent registration and factory creation
  - ✅ Pipeline configuration for initial vs modification flows
  - ✅ Agent discovery and validation
- ✅ **Enhanced Pipeline System**: Agent-based architecture
  - ✅ `initialPipeline`: clarification → requirements → wireframe → coding
  - ✅ `modificationPipeline`: modification → coding
  - ✅ `simplePipeline`: for basic help queries
  - ✅ Intelligent pipeline selection based on context
- ✅ **Code Generation Engine**: Real application generation
  - ✅ Todo apps, dashboards, forms, landing pages
  - ✅ Complete file structure (package.json, .tsx, .css, configs)
  - ✅ Modern React + TypeScript + Tailwind CSS
  - ✅ Production-ready code with proper architecture
- ✅ **Advanced Agent Prompts**: Specialized prompts for each agent type
  - ✅ Context-aware prompt building
  - ✅ Agent-specific response generation
  - ✅ Validation functions for output quality
- ✅ **Tool Integration**: Agents can execute tools
  - ⚠️ **Note**: Tool integration framework complete, but actual tools are placeholders (see Task 8)
  - ✅ Extensible tool system architecture

### ⚠️ Task 8: Container & Browser Tooling **[PARTIALLY COMPLETED]**

**Status: PARTIALLY COMPLETED** ⚠️

#### ✅ App Container Tool (COMPLETED)
- ✅ Linux-like terminal environment with bash command execution (`appContainer.ts`)
- ✅ Full filesystem simulation with virtual paths (pwd, cd, ls, cat, echo, touch, rm, cp, mv)
- ✅ Text processing commands: sed, grep, head, tail, wc with proper bash syntax
- ✅ Process management: npm, node, npx with real subprocess execution
- ✅ Environment variables and working directory management
- ✅ Error codes and stderr output matching Linux behavior
- ✅ Long-running process support (npm run dev) with background execution
- ✅ Command history and session persistence
- ✅ File operations with heredoc support for writing multi-line files
- ✅ Path resolution for relative and absolute paths
- ✅ Container cleanup and resource management

#### ✅ Coding Agent Integration (COMPLETED)
- ✅ Natural bash command usage in agent prompts and tool calls
- ✅ Iterative development workflow with automatic command generation
- ✅ File creation through echo/cat with heredoc syntax
- ✅ Build error detection and handling through container execution
- ✅ Container initialization per conversation ID
- ✅ Tool integration framework in BaseAgent class

#### ❌ Browser Automation Tool (NOT STARTED)
- ❌ Playwright integration for headless/headful browser control
- ❌ Screenshot capture with annotations
- ❌ Interactive actions (click, type, scroll, hover)
- ❌ Element inspection and JavaScript evaluation
- ❌ Error detection and console monitoring
- ❌ Performance metrics collection
- ❌ Accessibility checking
- ❌ Action recording and playback
- ❌ Foundation for Computer Use Agent integration

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

### Appendix D: Coding Agent Container Interaction

**Example: Agent Building a Todo App**

```typescript
// Coding agent tool calls sequence
const toolCalls: ToolCall[] = [
  // 1. Check current directory
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ command: 'pwd' })
    }
  },
  
  // 2. List current files
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ command: 'ls -la' })
    }
  },
  
  // 3. Create package.json
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ 
        command: `cat > package.json << 'EOF'
{
  "name": "todo-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}
EOF`
      })
    }
  },
  
  // 4. Create src directory
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ command: 'mkdir -p src' })
    }
  },
  
  // 5. Create main App component
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ 
        command: `cat > src/App.tsx << 'EOF'
import React, { useState } from 'react'

interface Todo {
  id: number
  text: string
  completed: boolean
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputText, setInputText] = useState('')

  const addTodo = () => {
    if (inputText.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputText.trim(),
        completed: false
      }])
      setInputText('')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">Todo App</h1>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
          className="flex-1 px-3 py-2 border rounded-l"
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded-r"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center space-x-2 p-2 border rounded">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => setTodos(todos.map(t => 
                t.id === todo.id ? { ...t, completed: !t.completed } : t
              ))}
            />
            <span className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p className="text-center text-gray-500 mt-4">No todos yet!</p>
      )}
    </div>
  )
}

export default App
EOF`
      })
    }
  },
  
  // 6. Install dependencies
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ command: 'npm install' })
    }
  },
  
  // 7. Build the app
  {
    id: generateId(),
    type: 'function',
    function: {
      name: 'appContainer.executeCommand',
      arguments: JSON.stringify({ command: 'npm run build' })
    }
  }
];

// If build fails, agent analyzes error and fixes
if (buildResult.exitCode !== 0) {
  // Example: Missing index.html
  const fixToolCalls = [
    {
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ 
          command: `cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF`
        })
      }
    },
    
    {
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ 
          command: `cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF`
        })
      }
    },
    
    // Retry build
    {
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ command: 'npm run build' })
      }
    }
  ];
}

// Start dev server
{
  id: generateId(),
  type: 'function',
  function: {
    name: 'appContainer.executeCommand',
    arguments: JSON.stringify({ command: 'npm run dev' })
  }
}
```

**Error Analysis and Fixing Example**:
```typescript
// Agent analyzes build error and automatically fixes
private analyzeErrorAndGenerateFix(error: string): ToolCall[] {
  // TypeScript error: Property 'className' does not exist
  if (error.includes("Property 'className' does not exist")) {
    return [{
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ 
          command: `sed -i 's/className=/className=/g' src/App.tsx` 
        })
      }
    }];
  }
  
  // Missing dependency error
  if (error.includes('Cannot find module')) {
    const module = error.match(/Cannot find module '(.+?)'/)?.[1];
    return [{
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ command: `npm install ${module}` })
      }
    }];
  }
  
  // Port already in use
  if (error.includes('EADDRINUSE')) {
    return [{
      id: generateId(),
      type: 'function',
      function: {
        name: 'appContainer.executeCommand',
        arguments: JSON.stringify({ command: 'npm run dev -- --port 3001' })
      }
    }];
  }
  
  return [];
}
```

---

*End of Architecture Design and Execution Plan*

