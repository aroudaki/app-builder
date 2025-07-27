import { Context, EventType, AgUiEvent } from '@shared/index.js';
import { AgentRegistry } from '../agents/registry.js';

/**
 * Pipeline interface for agent orchestration
 */
export interface Pipeline {
    name: string;
    description: string;
    agents: string[];
    run: (context: Context) => Promise<Context>;
}

/**
 * Select pipeline based on user input and context
 */
export function selectPipeline(context: Context): Pipeline {
    // Check if we're in the middle of a conversation flow
    const conversationState = context.state?.conversationState;

    if (conversationState === 'awaiting_clarification_response') {
        // User is responding to clarification questions
        return continueAfterClarificationPipeline;
    }

    // Check if this is a modification request (follow-up messages)
    if (!context.isFirstRequest || context.generatedCode) {
        return modificationPipeline;
    }

    // For first requests, always start with clarification
    // The clarification agent itself will decide whether to skip based on message content
    console.log(`🔍 First request detected, starting with clarification pipeline`);
    return clarificationOnlyPipeline;
}

/**
 * Clarification Only Pipeline
 * Runs only the clarification agent and waits for user response
 */
export const clarificationOnlyPipeline: Pipeline = {
    name: 'clarification-only',
    description: 'Clarification questions only, then wait for user response',
    agents: ['clarification'],

    run: async (context: Context): Promise<Context> => {
        console.log(`❓ Starting clarification pipeline`);

        let currentContext: Context = {
            ...context,
            state: {
                ...context.state,
                conversationState: 'clarification_in_progress'
            }
        };

        try {
            // Execute clarification agent
            const agent = AgentRegistry.createAgent('clarification');
            currentContext = await agent.execute(currentContext);

            // Mark that we're waiting for user response
            currentContext.state = {
                ...currentContext.state,
                conversationState: 'awaiting_clarification_response'
            };

            console.log(`❓ Clarification completed, waiting for user response`);
            return currentContext;

        } catch (error) {
            console.error(`❌ Clarification pipeline failed:`, error);

            return {
                ...currentContext,
                lastError: {
                    agent: 'clarification',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
};

/**
 * Continue After Clarification Pipeline  
 * Runs requirements → wireframe → coding after user responds to clarification
 */
export const continueAfterClarificationPipeline: Pipeline = {
    name: 'continue-after-clarification',
    description: 'Continue with requirements, wireframe, and coding after clarification',
    agents: ['requirements', 'wireframe', 'coding'],

    run: async (context: Context): Promise<Context> => {
        console.log(`🔄 Continuing pipeline after clarification: ${continueAfterClarificationPipeline.agents.join(' → ')}`);

        let currentContext: Context = {
            ...context,
            state: {
                ...context.state,
                conversationState: 'processing'
            }
        };

        try {
            // Execute remaining agents in sequence
            for (const agentName of continueAfterClarificationPipeline.agents) {
                console.log(`🤖 Executing agent: ${agentName}`);

                const agent = AgentRegistry.createAgent(agentName);
                currentContext = await agent.execute(currentContext);

                // Check if agent failed critically
                if (currentContext.lastError && (currentContext.retryCount || 0) >= 3) {
                    console.error(`💥 Pipeline failed at agent: ${agentName}`);
                    break;
                }
            }

            // Mark conversation as complete
            currentContext.state = {
                ...currentContext.state,
                conversationState: 'completed'
            };

            console.log(`✅ Continue pipeline completed successfully`);
            return currentContext;

        } catch (error) {
            console.error(`❌ Continue pipeline failed:`, error);

            return {
                ...currentContext,
                lastError: {
                    agent: 'pipeline',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
};

/**
 * Initial Application Generation Pipeline
 * Runs the full pipeline: Clarification → Requirements → Wireframe → Coding
 */
export const initialPipeline: Pipeline = {
    name: 'initial-app-generator',
    description: 'Complete application generation pipeline for new requests',
    agents: AgentRegistry.getInitialPipelineAgents(),

    run: async (context: Context): Promise<Context> => {
        console.log(`🚀 Starting initial pipeline with agents: ${initialPipeline.agents.join(' → ')}`);

        let currentContext = { ...context };

        try {
            // Execute each agent in sequence
            for (const agentName of initialPipeline.agents) {
                console.log(`🤖 Executing agent: ${agentName}`);

                const agent = AgentRegistry.createAgent(agentName);
                currentContext = await agent.execute(currentContext);

                // Check if agent failed critically
                if (currentContext.lastError && (currentContext.retryCount || 0) >= 3) {
                    console.error(`💥 Pipeline failed at agent: ${agentName}`);
                    break;
                }
            }

            console.log(`✅ Initial pipeline completed successfully`);
            return currentContext;

        } catch (error) {
            console.error(`❌ Initial pipeline failed:`, error);

            // Update context with pipeline error
            return {
                ...currentContext,
                lastError: {
                    agent: 'pipeline',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
};

/**
 * Modification Pipeline
 * Runs modification-focused pipeline: Modification → Coding
 */
export const modificationPipeline: Pipeline = {
    name: 'modification-app-generator',
    description: 'Application modification pipeline for existing code updates',
    agents: AgentRegistry.getModificationPipelineAgents(),

    run: async (context: Context): Promise<Context> => {
        console.log(`🔄 Starting modification pipeline with agents: ${modificationPipeline.agents.join(' → ')}`);

        let currentContext = { ...context };

        try {
            // Execute each agent in sequence
            for (const agentName of modificationPipeline.agents) {
                console.log(`🤖 Executing agent: ${agentName}`);

                const agent = AgentRegistry.createAgent(agentName);
                currentContext = await agent.execute(currentContext);

                // Check if agent failed critically
                if (currentContext.lastError && (currentContext.retryCount || 0) >= 3) {
                    console.error(`💥 Pipeline failed at agent: ${agentName}`);
                    break;
                }
            }

            console.log(`✅ Modification pipeline completed successfully`);
            return currentContext;

        } catch (error) {
            console.error(`❌ Modification pipeline failed:`, error);

            // Update context with pipeline error
            return {
                ...currentContext,
                lastError: {
                    agent: 'pipeline',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
};

/**
 * Simple Response Pipeline
 * For basic queries that don't require full app generation
 */
export const simplePipeline: Pipeline = {
    name: 'simple-response',
    description: 'Simple response pipeline for basic queries',
    agents: [], // No agents, just direct response

    run: async (context: Context): Promise<Context> => {
        console.log(`💬 Starting simple response pipeline`);

        const messageId = generateId();

        // Emit AG-UI events for simple response
        emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_START,
            conversationId: context.conversationId,
            messageId,
            role: 'assistant',
            timestamp: Date.now()
        });

        const response = generateHelpResponse(context.userInput);

        emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_CONTENT,
            conversationId: context.conversationId,
            messageId,
            delta: response,
            timestamp: Date.now()
        });

        emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_END,
            conversationId: context.conversationId,
            messageId,
            timestamp: Date.now()
        });

        return context;
    }
};

/**
 * Enhanced pipeline selection with intelligent routing
 */
export function selectPipelineIntelligent(context: Context): Pipeline {
    const userInput = context.userInput.toLowerCase();

    // Check for help or general queries
    if (userInput.includes('help') || userInput.includes('what can you') || userInput.includes('how do')) {
        return simplePipeline;
    }

    // Check for modification requests
    if (!context.isFirstRequest ||
        context.generatedCode ||
        userInput.includes('modify') ||
        userInput.includes('change') ||
        userInput.includes('update') ||
        userInput.includes('fix')) {
        return modificationPipeline;
    }

    // Default to initial pipeline for new app generation
    return initialPipeline;
}

/**
 * Generate helpful response for general queries
 */
function generateHelpResponse(userInput: string): string {
    return `I understand you'd like help with: "${userInput}". 

I'm an AI assistant that can help you create web applications! Here's what I can do:

🎨 **Design & Planning**
- Create wireframes and layouts
- Analyze requirements and specifications
- Plan application architecture

💻 **Code Generation**
- Build complete React applications
- Generate TypeScript components
- Create responsive designs with Tailwind CSS

🔧 **Modifications**
- Update existing applications
- Add new features
- Fix bugs and improve performance

**Example requests:**
- "Build a todo app with dark mode"
- "Create a dashboard for project management"
- "Generate a contact form with validation"
- "Add a search feature to the existing app"

What would you like to build today?`;
}

/**
 * Generate unique ID for AG-UI events
 */
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Emit AG-UI event through context
 */
function emitAgUiEvent(context: Context, event: AgUiEvent): void {
    context.events.emit('aguiEvent', event);
}
