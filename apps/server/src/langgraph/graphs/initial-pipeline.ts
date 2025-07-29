/**
 * Initial Pipeline Graph Implementation
 * 
 * This graph handles the complete initial application generation workflow:
 * 1. Clarification (if needed)
 * 2. Requirements Analysis
 * 3. Wireframe Design
 * 4. Coding Implementation
 * 5. Tool Execution and Completion
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AppBuilderState, AppBuilderStateType } from "../state.js";
import {
    clarificationAgent,
    requirementsAgent,
    wireframeAgent,
    codingAgentWithTools
} from "../agents/index.js";
import { toolNode, routeAfterTools } from "../tools/index.js";

/**
 * Wait for user response node
 * This node pauses the graph execution to wait for user input
 */
async function waitForUserNode(state: AppBuilderStateType): Promise<Partial<AppBuilderStateType>> {
    console.log("⏸️  Waiting for user response...");

    // This node essentially pauses execution
    // The graph will be resumed when a new user message is received
    return {
        currentAgent: "wait_for_user",
        aguiEvents: [{
            type: "WAITING_FOR_USER",
            conversationId: state.conversationId,
            message: "Please provide your response to continue",
            timestamp: Date.now()
        }]
    };
}

/**
 * Router function for clarification agent
 * Determines if clarification is complete or needs to continue
 */
export function routeAfterClarification(state: AppBuilderStateType): string {
    console.log("🔀 Routing after clarification...");

    const lastMessage = state.messages[state.messages.length - 1];

    // Check if the clarification response indicates the request is clear
    if (lastMessage?.content && typeof lastMessage.content === "string") {
        const content = lastMessage.content.toLowerCase();

        // If clarification says to continue, go directly to requirements
        if (content.includes("click continue to proceed") ||
            content.includes("please click continue") ||
            content.includes("clear enough") ||
            content.includes("already clear")) {
            console.log("✅ Request is clear, proceeding to requirements");
            return "requirements_agent";
        }

        // If clarification questions were asked, wait for user response
        if (content.includes("you can respond to one or more") ||
            content.includes("questions") ||
            content.includes("clarify") ||
            content.includes("understand better")) {
            console.log("❓ Clarification questions asked, waiting for user");
            return "wait_for_user";
        }
    }

    // Default to waiting for user response if unclear
    console.log("❓ Default to waiting for user response");
    return "wait_for_user";
}

/**
 * Router function for non-clarification agents  
 * Handles routing after requirements, wireframe, and coding agents
 */
export function routeAfterAgent(state: AppBuilderStateType): string {
    console.log(`🔀 Routing after agent: ${state.currentAgent}`);

    const lastMessage = state.messages[state.messages.length - 1];

    // Check if agent made tool calls
    if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
        console.log(`🔧 Agent made ${lastMessage.tool_calls.length} tool calls, routing to tools`);
        return "tools";
    }

    // Route to next agent in pipeline based on current agent
    switch (state.currentAgent) {
        case "requirements":
            console.log("📐 Requirements complete, routing to wireframe");
            return "wireframe_agent";
        case "wireframe":
            console.log("🎨 Wireframe complete, routing to coding");
            return "coding_agent";
        case "coding":
            // If coding agent responded without tool calls, it might need to continue
            console.log("💻 Coding agent responded without tool calls, continuing coding");
            return "coding_agent";
        default:
            console.log("🏁 Unknown agent, ending pipeline");
            return END;
    }
}

/**
 * Enhanced routing function to determine pipeline entry point
 * Checks if this is a first request or continuation
 */
function routeInitialPipeline(state: AppBuilderStateType): string {
    console.log("🚀 Routing initial pipeline entry...");

    // For first requests, always start with clarification
    if (state.isFirstRequest) {
        console.log("👋 First request detected, starting with clarification");
        return "clarification_agent";
    }

    // For follow-up requests in initial pipeline, determine where to resume
    const lastAgent = state.currentAgent;

    switch (lastAgent) {
        case "wait_for_user":
            // User provided response to clarification, go to requirements
            console.log("💬 User response received, proceeding to requirements");
            return "requirements_agent";
        case "clarification":
            console.log("❓ Resuming from clarification");
            return "requirements_agent";
        case "requirements":
            console.log("📋 Resuming from requirements");
            return "wireframe_agent";
        case "wireframe":
            console.log("🎨 Resuming from wireframe");
            return "coding_agent";
        default:
            console.log("💻 Default to coding");
            return "coding_agent";
    }
}

/**
 * Build the complete initial pipeline graph
 * This implements the full application generation workflow
 */
export function buildInitialPipelineGraph() {
    console.log("🏗️  Building initial pipeline graph...");

    const graph = new StateGraph(AppBuilderState)
        // Add agent nodes for workflow
        .addNode("clarification_agent", clarificationAgent)
        .addNode("requirements_agent", requirementsAgent)
        .addNode("wireframe_agent", wireframeAgent)
        .addNode("coding_agent", codingAgentWithTools)
        .addNode("tools", toolNode)

        // Add wait_for_user node for conversation pausing
        .addNode("wait_for_user", async (state: AppBuilderStateType) => {
            console.log("⏸️  Waiting for user input...");
            // This node just returns the state unchanged
            // The conversation will be paused here until user provides input
            return state;
        });

    // Define the flow with conditional routing
    graph
        // Start by routing to the appropriate entry point
        .addConditionalEdges(START, routeInitialPipeline, {
            clarification_agent: "clarification_agent",
            requirements_agent: "requirements_agent",
            wireframe_agent: "wireframe_agent",
            coding_agent: "coding_agent"
        })

        // Clarification agent routing  
        .addConditionalEdges("clarification_agent", routeAfterClarification, {
            requirements_agent: "requirements_agent",
            wait_for_user: "wait_for_user",
            [END]: END
        })

        // After user input, continue to requirements
        .addEdge("wait_for_user", "requirements_agent")

        // Requirements agent routing
        .addConditionalEdges("requirements_agent", routeAfterAgent, {
            wireframe_agent: "wireframe_agent",
            tools: "tools",
            [END]: END
        })

        // Wireframe agent routing
        .addConditionalEdges("wireframe_agent", routeAfterAgent, {
            coding_agent: "coding_agent",
            tools: "tools",
            [END]: END
        })

        // Coding agent routing
        .addConditionalEdges("coding_agent", routeAfterAgent, {
            tools: "tools",
            coding_agent: "coding_agent", // Allow coding to loop back to itself
            [END]: END
        })

        // Tool execution routing
        .addConditionalEdges("tools", routeAfterTools, {
            requirements_agent: "requirements_agent",
            wireframe_agent: "wireframe_agent",
            coding_agent: "coding_agent",
            [END]: END
        });

    console.log("✅ Initial pipeline graph built successfully");
    return graph.compile();
}

/**
 * Validate initial pipeline graph structure
 * Ensures all nodes and edges are properly configured
 */
export function validateInitialPipelineGraph(): boolean {
    try {
        const graph = buildInitialPipelineGraph();
        console.log("✅ Initial pipeline graph validation passed");
        return true;
    } catch (error) {
        console.error("❌ Initial pipeline graph validation failed:", error);
        return false;
    }
}

/**
 * Test initial pipeline graph execution with sample state
 */
export async function testInitialPipelineGraph(conversationId: string = "test-initial"): Promise<void> {
    console.log("🧪 Testing initial pipeline graph execution...");

    try {
        const graph = buildInitialPipelineGraph();

        const initialState: AppBuilderStateType = {
            messages: [new HumanMessage("I want to build a todo app")],
            conversationId,
            isFirstRequest: true,
            currentAgent: "start",
            requirements: null,
            wireframe: null,
            generatedCode: {},
            containerInfo: {},
            lastError: null,
            retryCount: 0,
            lastToolExecution: [],
            completionState: {
                explorationComplete: false,
                buildSuccessful: false,
                devServerStarted: false,
                requirementsMet: false,
                isComplete: false
            },
            aguiEvents: []
        };

        console.log("🚀 Starting initial pipeline test execution...");

        // Execute just the first step for testing
        const result = await graph.invoke(initialState);

        console.log("✅ Initial pipeline test successful:", {
            conversationId: result.conversationId,
            currentAgent: result.currentAgent,
            messageCount: result.messages?.length || 0,
            hasEvents: (result.aguiEvents?.length || 0) > 0
        });

    } catch (error) {
        console.error("❌ Initial pipeline test failed:", error);
        throw error;
    }
}

/**
 * Helper function to determine if a state needs clarification
 * Used by routing logic to decide pipeline flow
 */
export function needsClarification(state: AppBuilderStateType): boolean {
    // Always run clarification for first requests
    if (state.isFirstRequest) {
        return true;
    }

    // Check if we're waiting for user clarification response
    if (state.currentAgent === "wait_for_user") {
        return false; // User has provided response, no more clarification needed
    }

    // Check if requirements are already clear
    if (state.requirements && state.requirements.length > 100) {
        return false; // Requirements already established
    }

    return false; // Default to no clarification for non-first requests
}

/**
 * Helper function to get the last user message from state
 * Used by agents to access user input
 */
export function getLastUserMessage(state: AppBuilderStateType): HumanMessage {
    const userMessages = state.messages.filter(msg => msg._getType() === 'human');
    return userMessages[userMessages.length - 1] as HumanMessage;
}

/**
 * Helper function to check if this is a code modification request
 * Used to determine if we should use modification pipeline instead
 */
export function isCodeModification(userInput: string): boolean {
    const modificationKeywords = [
        'change', 'modify', 'update', 'fix', 'edit', 'adjust',
        'make it', 'can you', 'please change', 'instead of'
    ];

    const input = userInput.toLowerCase();
    return modificationKeywords.some(keyword => input.includes(keyword));
}
