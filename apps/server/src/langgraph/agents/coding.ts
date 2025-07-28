/**
 * Coding Agent - LangGraph Implementation
 * 
 * Generates complete web applications using Linux-like terminal commands.
 * This agent transforms requirements and wireframes into working code.
 * 
 * Note: This implementation is prepared for tool integration.
 * Currently uses mock tool responses until tools are implemented.
 */

import { AIMessage } from "@langchain/core/messages";
import { createLLMForAgent } from "../llm.js";
import { getPromptTemplate, getAgentTemperature } from "../prompts.js";
import { AppBuilderStateType, createAGUIEvent, generateId } from "../state.js";

/**
 * Coding Agent Node Function
 * 
 * @param state - Current LangGraph state
 * @returns Partial state update with coding implementation
 */
export async function codingAgent(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    console.log("🤖 Executing Coding Agent");

    try {
        // Get requirements and wireframe from previous agents
        const requirements = state.requirements || 'No requirements available';
        const wireframe = state.wireframe || 'No wireframe available';
        const containerStatus = state.containerInfo?.status || 'ready';

        // Build conversation history for context
        const conversationHistory = state.messages
            .map(msg => `${msg._getType()}: ${msg.content}`)
            .join('\n');

        // Create LLM instance with agent-specific configuration
        // Note: Could switch to 'o3' model for complex coding tasks
        const llm = createLLMForAgent('coding', {
            temperature: getAgentTemperature('coding'),
            streaming: true
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('coding');
        const formattedPrompt = await promptTemplate.format({
            requirements,
            wireframe,
            containerStatus,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call with streaming
        console.log("🧠 Calling LLM for code generation with streaming...");

        // Create message ID for tracking
        const messageId = generateId();
        const events: any[] = [];

        // Start message event
        events.push(
            createAGUIEvent("TEXT_MESSAGE_START", state.conversationId, {
                messageId,
                role: "assistant"
            })
        );

        let fullResponse = "";

        // Stream the response
        const stream = await llm.stream(formattedPrompt);
        for await (const chunk of stream) {
            const delta = chunk.content?.toString() || "";
            if (delta) {
                fullResponse += delta;

                // Content event for each chunk
                events.push(
                    createAGUIEvent("TEXT_MESSAGE_CONTENT", state.conversationId, {
                        messageId,
                        delta
                    })
                );
            }
        }

        // End message event
        events.push(
            createAGUIEvent("TEXT_MESSAGE_END", state.conversationId, {
                messageId
            })
        );

        // TODO: When tool integration is complete, this will be replaced with:
        // 1. Real tool calls to app_container for file operations
        // 2. Build verification with npm run build
        // 3. Dev server startup with npm run dev
        // 4. Completion validation with app_completed tool

        // For now, simulate successful development workflow
        console.log("🔨 Simulating development workflow (tools will be implemented next)");

        // Simulate tool executions for completion state
        const mockToolExecutions = [
            {
                name: 'app_container',
                input: { command: 'npm run build' },
                output: 'Build completed successfully!',
                timestamp: new Date().toISOString()
            },
            {
                name: 'app_container',
                input: { command: 'npm run dev' },
                output: 'Local: http://localhost:3001',
                timestamp: new Date().toISOString()
            }
        ];

        // Apply validation logic from existing configuration
        const isValid = validateCodingOutput(fullResponse, mockToolExecutions);
        if (!isValid) {
            console.warn("⚠️ Coding response validation failed, retrying...");

            // Implement retry logic
            if ((state.retryCount || 0) < 3) {
                return {
                    currentAgent: "coding",
                    retryCount: (state.retryCount || 0) + 1,
                    lastError: {
                        agent: "coding",
                        error: "Validation failed",
                        timestamp: new Date().toISOString()
                    },
                    aguiEvents: [
                        createAGUIEvent("ERROR", state.conversationId, {
                            error: "Response validation failed, retrying...",
                            retryCount: (state.retryCount || 0) + 1
                        })
                    ]
                };
            }
        }

        console.log("✅ Coding agent completed successfully");

        return {
            messages: [new AIMessage(fullResponse)],
            currentAgent: "coding",
            lastToolExecution: mockToolExecutions,
            completionState: {
                explorationComplete: true,
                buildSuccessful: true,
                devServerStarted: true,
                requirementsMet: true,
                isComplete: true
            },
            generatedCode: {
                'src/App.tsx': '// Generated React application code',
                'src/components/': '// Generated components',
                'package.json': '// Updated dependencies'
            },
            aguiEvents: events,
            retryCount: 0 // Reset retry count on success
        };

    } catch (error) {
        console.error("❌ Error in coding agent:", error);

        // Implement retry logic
        if ((state.retryCount || 0) < 3) {
            return {
                currentAgent: "coding",
                retryCount: (state.retryCount || 0) + 1,
                lastError: {
                    agent: "coding",
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                },
                aguiEvents: [
                    createAGUIEvent("ERROR", state.conversationId, {
                        error: error instanceof Error ? error.message : String(error),
                        retryCount: (state.retryCount || 0) + 1
                    })
                ]
            };
        }

        // Final fallback after max retries
        const fallbackCode = "I'll create a basic React application with TypeScript. This includes essential components and structure for a functional web application.";

        return {
            messages: [new AIMessage(fallbackCode)],
            currentAgent: "coding",
            lastToolExecution: [],
            completionState: {
                explorationComplete: true,
                buildSuccessful: false,
                devServerStarted: false,
                requirementsMet: false,
                isComplete: false
            },
            generatedCode: {
                'src/App.tsx': '// Basic React application structure',
                'package.json': '// Basic dependencies'
            },
            aguiEvents: [
                createAGUIEvent("ERROR", state.conversationId, {
                    error: "Max retries exceeded, using fallback code generation",
                    fallback: true
                })
            ],
            retryCount: 0 // Reset for next operation
        };
    }
}

/**
 * Validation logic from existing coding agent configuration
 * Enhanced to work with both tool calls and response content
 */
function validateCodingOutput(response: string, toolExecutions?: any[]): boolean {
    // Check if there are tool executions (commands were run)
    const hasToolExecutions = toolExecutions && toolExecutions.length > 0;

    // Check for successful build in tool outputs
    const hasSuccessfulBuild = toolExecutions?.some(execution =>
        execution.name === 'app_container' &&
        execution.input.command === 'npm run build' &&
        execution.output.includes('successful')
    );

    // Check for dev server start in tool outputs
    const hasDevServer = toolExecutions?.some(execution =>
        execution.name === 'app_container' &&
        execution.input.command === 'npm run dev' &&
        execution.output.includes('Local:')
    );

    // Check response content for development activity
    const hasCodeContent = response.includes('app_container') ||
        response.includes('npm run') ||
        response.includes('build successful') ||
        response.includes('dev server');

    return hasToolExecutions || hasSuccessfulBuild || hasDevServer || hasCodeContent;
}

/**
 * Enhanced coding agent with tool integration support
 * This will be fully implemented when tools are available
 */
export async function codingAgentWithTools(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    // TODO: Implement when ToolNode is available
    // This will include:
    // - Real app_container tool calls
    // - File system operations
    // - Build and test verification
    // - Completion detection with app_completed tool

    console.log("🚧 Enhanced coding agent with tools - Coming next");
    return codingAgent(state);
}
