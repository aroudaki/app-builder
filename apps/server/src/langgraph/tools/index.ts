import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, AIMessage } from "@langchain/core/messages";
import {
    appContainerTool,
    browserTool,
    appCompletedTool,
    fileOperationsTool,
    allTools
} from "./definitions.js";
import { AppBuilderStateType } from "../state.js";

/**
 * Enhanced ToolNode with execution tracking and completion validation
 * 
 * This implementation extends the standard LangGraph ToolNode to provide:
 * - Tool execution tracking for state management
 * - Completion state analysis based on tool results
 * - Error handling and recovery mechanisms
 * - AG-UI event integration for real-time feedback
 */
export class TrackedToolNode extends ToolNode {
    constructor() {
        super(allTools);
    }

    /**
     * Override invoke to add execution tracking and completion validation
     */
    async invoke(state: AppBuilderStateType): Promise<Partial<AppBuilderStateType>> {
        console.log("🔧 Executing tool node with tracked execution...");

        try {
            // Get the last AI message which should contain tool calls
            const lastMessage = state.messages[state.messages.length - 1];

            if (!lastMessage || !(lastMessage instanceof AIMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
                console.warn("⚠️ No tool calls found in last message");
                return {
                    aguiEvents: [{
                        type: "ERROR",
                        conversationId: state.conversationId,
                        error: "No tool calls found in message",
                        timestamp: Date.now()
                    }]
                };
            }

            console.log(`🔧 Processing ${lastMessage.tool_calls.length} tool calls...`);

            // Execute the tools using parent ToolNode
            const result = await super.invoke(state);

            // Track tool executions for completion validation
            const toolExecutions: Array<{
                name: string;
                input: any;
                output: string;
                timestamp: string;
                success: boolean;
            }> = [];

            // Process tool results from the response
            if (result.messages && result.messages.length > 0) {
                const toolMessage = result.messages[0];

                // Parse tool results and track executions
                for (let i = 0; i < lastMessage.tool_calls.length; i++) {
                    const toolCall = lastMessage.tool_calls[i];

                    // Get tool result content
                    let toolOutput = "";
                    let toolSuccess = false;

                    if ('tool_call_id' in toolMessage && toolMessage.tool_call_id === toolCall.id) {
                        toolOutput = toolMessage.content?.toString() || "";

                        // Try to parse JSON output to determine success
                        try {
                            const parsed = JSON.parse(toolOutput);
                            toolSuccess = parsed.success === true;
                        } catch {
                            // If not JSON, assume success if no obvious error
                            toolSuccess = !toolOutput.toLowerCase().includes('error') &&
                                !toolOutput.toLowerCase().includes('failed');
                        }
                    }

                    toolExecutions.push({
                        name: toolCall.name,
                        input: toolCall.args,
                        output: toolOutput,
                        timestamp: new Date().toISOString(),
                        success: toolSuccess
                    });
                }
            }

            // Update completion state based on tool results
            const completionUpdates = this.analyzeToolResults(toolExecutions);

            // Generate AG-UI events for tool execution feedback
            const aguiEvents = this.generateToolEvents(state.conversationId, toolExecutions);

            console.log(`✅ Tool node completed with ${toolExecutions.length} executions`);

            return {
                ...result,
                lastToolExecution: toolExecutions,
                completionState: {
                    ...state.completionState,
                    ...completionUpdates
                },
                aguiEvents: aguiEvents
            };

        } catch (error) {
            console.error("❌ Tool node execution failed:", error);

            return {
                aguiEvents: [{
                    type: "ERROR",
                    conversationId: state.conversationId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                }],
                lastError: {
                    agent: "tools",
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Analyze tool results to update completion state
     */
    private analyzeToolResults(executions: any[]): Partial<any> {
        const updates: any = {};

        for (const execution of executions) {
            try {
                const result = JSON.parse(execution.output);

                // Check for successful build
                if (execution.name === 'app_container' &&
                    execution.input.command === 'npm run build' &&
                    execution.success) {
                    updates.buildSuccessful = true;
                    console.log("✅ Build successful detected");
                }

                // Check for dev server start
                if (execution.name === 'app_container' &&
                    execution.input.command &&
                    execution.input.command.includes('npm run dev') &&
                    execution.success) {
                    updates.devServerStarted = true;
                    console.log("✅ Dev server started detected");
                }

                // Check for application completion
                if (execution.name === 'app_completed' && execution.success) {
                    updates.isComplete = true;
                    updates.requirementsMet = result.criteria?.requirementsMet || false;
                    console.log("✅ Application completion detected");
                }

                // Check for successful file operations
                if ((execution.name === 'file_operations' || execution.name === 'app_container') &&
                    execution.success) {
                    updates.explorationComplete = true;
                }

            } catch (error) {
                // Skip parsing errors for non-JSON outputs
                console.debug("Tool output not JSON, skipping analysis:", execution.name);
            }
        }

        return updates;
    }

    /**
     * Generate AG-UI events for tool execution feedback
     */
    private generateToolEvents(conversationId: string, executions: any[]): any[] {
        const events: any[] = [];

        for (const execution of executions) {
            // Tool execution start event
            events.push({
                type: "TOOL_EXECUTION_START",
                conversationId: conversationId,
                toolName: execution.name,
                toolInput: execution.input,
                timestamp: Date.now()
            });

            // Tool execution result event
            events.push({
                type: "TOOL_EXECUTION_END",
                conversationId: conversationId,
                toolName: execution.name,
                success: execution.success,
                output: execution.output,
                timestamp: Date.now()
            });

            // Special events for important tool results
            if (execution.name === 'app_completed' && execution.success) {
                events.push({
                    type: "APPLICATION_COMPLETED",
                    conversationId: conversationId,
                    summary: execution.input.summary,
                    timestamp: Date.now()
                });
            }

            if (execution.name === 'app_container' &&
                execution.input.command === 'npm run dev' &&
                execution.success) {
                events.push({
                    type: "DEV_SERVER_STARTED",
                    conversationId: conversationId,
                    command: execution.input.command,
                    timestamp: Date.now()
                });
            }
        }

        return events;
    }
}

// Create the main tool node instance
export const toolNode = new TrackedToolNode();

// Export individual tools for direct access
export {
    appContainerTool,
    browserTool,
    appCompletedTool,
    fileOperationsTool,
    allTools
};

// Utility function to check if completion criteria are met
export function validateCodingCompletion(state: AppBuilderStateType): boolean {
    const lastToolExecutions = state.lastToolExecution || [];

    // Check if app_completed tool was called successfully
    const completionCall = lastToolExecutions.find(tool =>
        tool.name === 'app_completed'
    );

    if (!completionCall) {
        return false;
    }

    // Parse completion tool result
    try {
        const result = JSON.parse(completionCall.output);
        return result.success === true;
    } catch (error) {
        console.error("Failed to parse completion tool result:", error);
        return false;
    }
}

// Helper function for routing after tool execution
export function routeAfterTools(state: AppBuilderStateType): string {
    const lastToolExecutions = state.lastToolExecution || [];

    console.log(`🔀 Routing after tools with ${lastToolExecutions.length} executions`);

    // Check if completion tool was executed successfully
    const completionTool = lastToolExecutions.find(tool =>
        tool.name === 'app_completed'
    );

    if (completionTool) {
        try {
            const result = JSON.parse(completionTool.output);
            if (result.success) {
                // Completion validated - end the pipeline
                console.log("✅ Application completed successfully, ending pipeline");
                return "END";
            } else {
                // Completion failed validation - continue coding
                console.log("🔄 Completion validation failed, continuing development...");
                return "coding";
            }
        } catch (error) {
            console.error("Error parsing completion result:", error);
            return "coding";
        }
    }

    // Regular tool execution - route back to current agent
    const currentAgent = state.currentAgent || "coding";
    console.log(`🔄 Returning to agent: ${currentAgent}`);
    return currentAgent;
}
