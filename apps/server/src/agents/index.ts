import { Context, AgentConfig, EventType, AgUiEvent, Tool } from '@shared/index.js';
import { generateId } from '../utils/events.js';
import { SimpleCodeRunner } from '../tools/codeRunner.js';
import { BrowserTool } from '../tools/browser.js';

/**
 * Base Agent class implementing common execution logic and error handling
 */
export class BaseAgent {
    private codeRunner: SimpleCodeRunner;
    private browserTool: BrowserTool;

    constructor(public config: AgentConfig) {
        this.codeRunner = new SimpleCodeRunner();
        this.browserTool = new BrowserTool();
    }

    /**
     * Execute the agent with error handling and retry logic
     */
    async execute(context: Context): Promise<Context> {
        const startTime = Date.now();

        try {
            console.log(`🤖 Executing agent: ${this.config.name}`);

            // Check if agent should be skipped
            if (this.config.skipOn && this.config.skipOn(context)) {
                console.log(`⏭️ Skipping agent ${this.config.name} based on skipOn condition`);
                return context;
            }

            // Emit step start event
            this.emitStepEvent(context, EventType.STEP_START, {
                agent: this.config.name,
                timestamp: Date.now()
            });

            // Execute the agent logic
            const updatedContext = await this.executeCore(context);

            // Validate output if validation function provided
            if (this.config.validateOutput) {
                const isValid = this.config.validateOutput(updatedContext);
                if (!isValid) {
                    throw new Error(`Agent ${this.config.name} output validation failed`);
                }
            }

            // Emit step end event
            this.emitStepEvent(context, EventType.STEP_END, {
                agent: this.config.name,
                duration: Date.now() - startTime,
                timestamp: Date.now()
            });

            console.log(`✅ Agent ${this.config.name} completed in ${Date.now() - startTime}ms`);
            return updatedContext;

        } catch (error) {
            console.error(`❌ Agent ${this.config.name} failed:`, error);

            // Update context with error information
            const errorContext: Context = {
                ...context,
                lastError: {
                    agent: this.config.name,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                },
                retryCount: (context.retryCount || 0) + 1
            };

            // Emit error event
            this.emitAgUiEvent(context, {
                type: EventType.ERROR,
                conversationId: context.conversationId,
                error: `Agent ${this.config.name} failed: ${error instanceof Error ? error.message : error}`,
                timestamp: Date.now()
            });

            // Check if retry is possible
            const retryCount = errorContext.retryCount || 0;
            if (retryCount < 3) {
                console.log(`🔄 Retrying agent ${this.config.name} (attempt ${retryCount})`);

                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));

                return this.execute(errorContext);
            }

            // Max retries reached, return error context
            console.error(`💥 Agent ${this.config.name} failed after ${retryCount} attempts`);
            return errorContext;
        }
    }

    /**
     * Core agent execution logic - to be implemented by specific agents
     */
    protected async executeCore(context: Context): Promise<Context> {
        const messageId = generateId();

        // Start assistant response
        this.emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_START,
            conversationId: context.conversationId,
            messageId,
            role: 'assistant',
            timestamp: Date.now()
        });

        // Execute agent-specific logic
        const result = await this.processWithLLM(context);

        // Stream the response
        await this.streamResponse(context, messageId, result);

        // Execute tools if needed
        if (this.config.tools && this.config.tools.length > 0) {
            const toolResults = await this.executeTools(context, messageId, result);
            result.toolResults = toolResults;
        }

        // End message
        this.emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_END,
            conversationId: context.conversationId,
            messageId,
            timestamp: Date.now()
        });

        // Update context with results
        return this.updateContext(context, result);
    }

    /**
     * Process user input with LLM (placeholder - would integrate with Azure OpenAI)
     */
    protected async processWithLLM(context: Context): Promise<any> {
        // This would integrate with Azure OpenAI in a real implementation
        // For now, we'll use the existing logic patterns

        const prompt = this.buildPrompt(context);

        // Simulate LLM processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            response: this.generateResponse(context),
            confidence: 0.8,
            reasoning: `Processed with ${this.config.name} agent`,
            requiresTools: this.config.tools && this.config.tools.length > 0
        };
    }

    /**
     * Build prompt for LLM based on agent configuration and context
     */
    protected buildPrompt(context: Context): string {
        let prompt = this.config.systemPrompt || `You are a ${this.config.name} agent.`;

        prompt += `\n\nUser Input: ${context.userInput}`;

        if (context.requirements) {
            prompt += `\n\nRequirements: ${context.requirements}`;
        }

        if (context.wireframe) {
            prompt += `\n\nWireframe: ${context.wireframe}`;
        }

        if (context.lastError) {
            prompt += `\n\nPrevious Error: ${context.lastError.error} (from ${context.lastError.agent})`;
            prompt += `\nRetry Count: ${context.retryCount}`;
        }

        return prompt;
    }

    /**
     * Generate response based on agent type and context
     */
    protected generateResponse(context: Context): string {
        // This would be replaced by actual LLM integration
        switch (this.config.name) {
            case 'clarification':
                return this.generateClarificationResponse(context);
            case 'requirements':
                return this.generateRequirementsResponse(context);
            case 'wireframe':
                return this.generateWireframeResponse(context);
            case 'coding':
                return this.generateCodingResponse(context);
            case 'modification':
                return this.generateModificationResponse(context);
            default:
                return `I understand you'd like help with: "${context.userInput}". Let me assist you with that.`;
        }
    }

    /**
     * Stream response content to client
     */
    protected async streamResponse(context: Context, messageId: string, result: any): Promise<void> {
        const response = result.response || '';
        const words = response.split(' ');

        for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? ' ' : '');

            this.emitAgUiEvent(context, {
                type: EventType.TEXT_MESSAGE_CONTENT,
                conversationId: context.conversationId,
                messageId,
                delta: chunk,
                timestamp: Date.now()
            });

            // Simulate natural typing speed
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /**
     * Execute agent tools
     */
    protected async executeTools(context: Context, messageId: string, result: any): Promise<any[]> {
        const toolResults: any[] = [];

        for (const tool of this.config.tools || []) {
            const toolCallId = generateId();

            // Emit tool call start
            this.emitAgUiEvent(context, {
                type: EventType.TOOL_CALL_START,
                conversationId: context.conversationId,
                messageId,
                toolCallId,
                toolName: tool.name,
                timestamp: Date.now()
            });

            try {
                const toolResult = await this.executeTool(tool, context, result);

                // Emit tool call result
                this.emitAgUiEvent(context, {
                    type: EventType.TOOL_CALL_RESULT,
                    conversationId: context.conversationId,
                    messageId,
                    toolCallId,
                    result: toolResult,
                    timestamp: Date.now()
                });

                toolResults.push(toolResult);

            } catch (error) {
                console.error(`Tool ${tool.name} failed:`, error);

                // Emit tool error
                this.emitAgUiEvent(context, {
                    type: EventType.ERROR,
                    conversationId: context.conversationId,
                    error: `Tool ${tool.name} failed: ${error instanceof Error ? error.message : error}`,
                    timestamp: Date.now()
                });
            }

            // Emit tool call end
            this.emitAgUiEvent(context, {
                type: EventType.TOOL_CALL_END,
                conversationId: context.conversationId,
                messageId,
                toolCallId,
                timestamp: Date.now()
            });
        }

        return toolResults;
    }

    /**
     * Execute a specific tool
     */
    protected async executeTool(tool: Tool, context: Context, result: any): Promise<any> {
        switch (tool.name) {
            case 'codeRunner':
                return this.executeCodeRunner(context, result);
            case 'browser':
                return this.executeBrowser(context, result);
            default:
                throw new Error(`Unknown tool: ${tool.name}`);
        }
    }

    /**
     * Execute code runner tool
     */
    protected async executeCodeRunner(context: Context, result: any): Promise<any> {
        if (!context.generatedCode) {
            throw new Error('No code to run');
        }

        return this.codeRunner.runCode(context.generatedCode);
    }

    /**
     * Execute browser tool
     */
    protected async executeBrowser(context: Context, result: any): Promise<any> {
        // Placeholder for browser tool execution
        return this.browserTool.takeScreenshot('https://example.com');
    }

    /**
     * Update context with agent results
     */
    protected updateContext(context: Context, result: any): Context {
        const updates: Partial<Context> = {
            state: {
                ...context.state,
                [`${this.config.name}_complete`]: true,
                [`${this.config.name}_result`]: result
            }
        };

        // Agent-specific context updates
        switch (this.config.name) {
            case 'requirements':
                updates.requirements = result.response;
                break;
            case 'wireframe':
                updates.wireframe = result.response;
                break;
            case 'coding':
                // For coding agent, use the generated code files
                const generatedCode = (context as any).generatedCodeFiles || result.generatedCode || {};
                updates.generatedCode = generatedCode;
                updates.state = {
                    ...updates.state,
                    generatedFiles: Object.keys(generatedCode),
                    codeGenerated: true
                };
                break;
            case 'modification':
                // For modification agent, update the existing code
                const modifiedCode = (context as any).generatedCodeFiles || result.generatedCode || context.generatedCode;
                updates.generatedCode = modifiedCode;
                updates.state = {
                    ...updates.state,
                    lastModified: new Date().toISOString(),
                    modificationApplied: true
                };
                break;
        }

        return { ...context, ...updates };
    }

    /**
     * Generate clarification response
     */
    protected generateClarificationResponse(context: Context): string {
        return `I'd like to understand your requirements better. Here are a few questions:

1. What type of application are you building? (e.g., form, dashboard, game, e-commerce)
2. What data storage do you need? (none, local storage, database)
3. Do you have any framework preferences? (React, Vue, vanilla JS)
4. What styling approach would you like? (CSS, Tailwind, styled-components)
5. Are there any specific features or constraints I should know about?

Please let me know your preferences so I can create the best solution for you.`;
    }

    /**
     * Generate requirements response
     */
    protected generateRequirementsResponse(context: Context): string {
        return `Based on your input, I've analyzed the requirements:

## Application Requirements

**Type**: Web Application
**Framework**: React with TypeScript
**Styling**: Tailwind CSS

## Core Features
- Modern, responsive design
- User-friendly interface
- Clean, maintainable code
- Cross-browser compatibility

## Technical Requirements
- React 18+ with TypeScript
- Component-based architecture
- Responsive design for mobile and desktop
- Modern ES6+ JavaScript features

These requirements will guide the wireframe and coding phases.`;
    }

    /**
     * Generate wireframe response
     */
    protected generateWireframeResponse(context: Context): string {
        return `## Wireframe Design

Based on your requirements, here's the proposed structure:

### Layout Components
- **Header**: Navigation and branding
- **Main Content**: Primary application functionality
- **Sidebar**: Additional features and controls
- **Footer**: Links and information

### Interactive Elements
- Form inputs with validation
- Action buttons with clear labels
- Dynamic content areas
- Responsive breakpoints for mobile

### User Flow
1. User lands on main interface
2. Interacts with primary features
3. Receives feedback and confirmations
4. Can navigate to additional functionality

This wireframe provides a solid foundation for the implementation phase.`;
    }

    /**
     * Generate coding response and actual code files
     */
    protected generateCodingResponse(context: Context): string {
        // Generate actual code files for the coding agent
        const generatedCode = this.generateCodeFiles(context);

        // Store the generated code in the result
        if (generatedCode) {
            (context as any).generatedCodeFiles = generatedCode;
        }

        return `## Code Generation Complete

I've generated a complete React application based on your requirements and wireframe:

### Generated Components
- **App.tsx** - Main application component with routing
- **components/** - Reusable UI components  
- **styles/** - Tailwind CSS configuration and custom styles
- **utils/** - Helper functions and utilities
- **types/** - TypeScript type definitions

### Features Implemented
- Modern React with TypeScript
- Responsive design with Tailwind CSS
- Clean component architecture
- Proper error handling and validation
- Accessibility features
- Production-ready code structure

### Code Quality
- Clean, readable, and maintainable code
- Proper TypeScript typing throughout
- Component composition patterns
- Responsive design patterns
- Performance optimizations

The application is being built and tested. You'll be able to preview it shortly!`;
    }

    /**
     * Generate actual code files based on context
     */
    protected generateCodeFiles(context: Context): Record<string, string> {
        const userInput = context.userInput;
        const wireframe = context.wireframe || '';
        const requirements = context.requirements || '';

        // Determine app type based on input
        const appType = this.determineAppType(userInput);

        return {
            'package.json': this.generatePackageJson(appType),
            'index.html': this.generateIndexHtml(appType),
            'src/main.tsx': this.generateMainTsx(),
            'src/App.tsx': this.generateAppTsx(appType, userInput),
            'src/App.css': this.generateAppCss(),
            'tailwind.config.js': this.generateTailwindConfig(),
            'vite.config.ts': this.generateViteConfig(),
            'tsconfig.json': this.generateTsConfig(),
            'README.md': this.generateReadme(appType, userInput)
        };
    }

    /**
     * Determine application type from user input
     */
    protected determineAppType(userInput: string): string {
        const input = userInput.toLowerCase();

        if (input.includes('todo') || input.includes('task')) return 'todo';
        if (input.includes('dashboard') || input.includes('admin')) return 'dashboard';
        if (input.includes('form') || input.includes('contact')) return 'form';
        if (input.includes('blog') || input.includes('article')) return 'blog';
        if (input.includes('portfolio') || input.includes('profile')) return 'portfolio';
        if (input.includes('landing') || input.includes('homepage')) return 'landing';
        if (input.includes('shop') || input.includes('store') || input.includes('ecommerce')) return 'shop';

        return 'general';
    }

    /**
     * Generate package.json
     */
    protected generatePackageJson(appType: string): string {
        return JSON.stringify({
            name: `generated-${appType}-app`,
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
                dev: "vite",
                build: "tsc && vite build",
                preview: "vite preview"
            },
            dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0"
            },
            devDependencies: {
                "@types/react": "^18.2.66",
                "@types/react-dom": "^18.2.22",
                "@typescript-eslint/eslint-plugin": "^7.2.0",
                "@typescript-eslint/parser": "^7.2.0",
                "@vitejs/plugin-react": "^4.2.1",
                autoprefixer: "^10.4.19",
                eslint: "^8.57.0",
                "eslint-plugin-react-hooks": "^4.6.0",
                "eslint-plugin-react-refresh": "^0.4.6",
                postcss: "^8.4.38",
                tailwindcss: "^3.4.3",
                typescript: "^5.2.2",
                vite: "^5.2.0"
            }
        }, null, 2);
    }

    /**
     * Generate index.html
     */
    protected generateIndexHtml(appType: string): string {
        const title = appType.charAt(0).toUpperCase() + appType.slice(1) + ' App';

        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    }

    /**
     * Generate main.tsx
     */
    protected generateMainTsx(): string {
        return `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    }

    /**
     * Generate App.tsx based on app type
     */
    protected generateAppTsx(appType: string, userInput: string): string {
        switch (appType) {
            case 'todo':
                return this.generateTodoApp(userInput);
            case 'dashboard':
                return this.generateDashboardApp(userInput);
            case 'form':
                return this.generateFormApp(userInput);
            case 'landing':
                return this.generateLandingApp(userInput);
            default:
                return this.generateGeneralApp(userInput);
        }
    }

    /**
     * Generate Todo application
     */
    protected generateTodoApp(userInput: string): string {
        return `import React, { useState } from 'react'

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

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Todo App
        </h1>
        
        <div className="flex mb-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="px-6 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="w-5 h-5 text-blue-600"
              />
              <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}\`}>
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {todos.length === 0 && (
          <p className="text-center text-gray-500 mt-6">No todos yet. Add one above!</p>
        )}
      </div>
    </div>
  )
}

export default App`;
    }

    /**
     * Generate general application
     */
    protected generateGeneralApp(userInput: string): string {
        return `import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            Generated Application
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Based on your request: "<em>${userInput}</em>"
          </p>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Interactive Counter
            </h2>
            
            <div className="text-6xl font-bold text-indigo-600 mb-6">
              {count}
            </div>

            <div className="space-x-4">
              <button
                onClick={() => setCount(count - 1)}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Decrease
              </button>
              
              <button
                onClick={() => setCount(0)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Reset
              </button>
              
              <button
                onClick={() => setCount(count + 1)}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Increase
              </button>
            </div>
          </div>

          <div className="mt-8 p-6 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Application Features
            </h3>
            <ul className="text-left space-y-2 text-gray-600">
              <li>✅ Modern React with TypeScript</li>
              <li>✅ Responsive design with Tailwind CSS</li>
              <li>✅ Interactive components</li>
              <li>✅ Clean, maintainable code</li>
              <li>✅ Production-ready structure</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App`;
    }

    /**
     * Generate other app types (simplified for brevity)
     */
    protected generateDashboardApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Dashboard Overview').replace('Generated Application', 'Admin Dashboard');
    }

    protected generateFormApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Contact Form').replace('Generated Application', 'Contact Us');
    }

    protected generateLandingApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Landing Section').replace('Generated Application', 'Welcome');
    }

    /**
     * Generate CSS file
     */
    protected generateAppCss(): string {
        return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors;
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors;
  }
}`;
    }

    /**
     * Generate Tailwind config
     */
    protected generateTailwindConfig(): string {
        return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}`;
    }

    /**
     * Generate Vite config
     */
    protected generateViteConfig(): string {
        return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
})`;
    }

    /**
     * Generate TypeScript config
     */
    protected generateTsConfig(): string {
        return JSON.stringify({
            compilerOptions: {
                target: "ES2020",
                useDefineForClassFields: true,
                lib: ["ES2020", "DOM", "DOM.Iterable"],
                module: "ESNext",
                skipLibCheck: true,
                moduleResolution: "bundler",
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: "react-jsx",
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true
            },
            include: ["src"],
            references: [{ path: "./tsconfig.node.json" }]
        }, null, 2);
    }

    /**
     * Generate README
     */
    protected generateReadme(appType: string, userInput: string): string {
        const title = appType.charAt(0).toUpperCase() + appType.slice(1) + ' App';

        return `# ${title}

Generated application based on: "${userInput}"

## Features

- Modern React with TypeScript
- Responsive design with Tailwind CSS
- Clean component architecture
- Production-ready code structure

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:5173](http://localhost:5173) to view the app

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

Generated by AI App Builder 🤖`;
    }

    /**
     * Generate modification response
     */
    protected generateModificationResponse(context: Context): string {
        return `## Code Modification

I'm updating the existing application based on your feedback:

### Changes Being Made
- Analyzing current implementation
- Applying requested modifications
- Maintaining code quality and structure
- Testing updated functionality

### Updated Features
- Enhanced user interface
- Improved functionality
- Better error handling
- Optimized performance

The modifications will be applied while preserving existing functionality.`;
    }

    /**
     * Emit AG-UI event through context
     */
    protected emitAgUiEvent(context: Context, event: AgUiEvent): void {
        context.events.emit('aguiEvent', event);
    }

    /**
     * Emit step-related events
     */
    protected emitStepEvent(context: Context, type: EventType, data: any): void {
        this.emitAgUiEvent(context, {
            type,
            conversationId: context.conversationId,
            timestamp: Date.now(),
            ...data
        } as AgUiEvent);
    }
}
