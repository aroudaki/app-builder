/**
 * Modification Pipeline Graph Implementation
 * 
 * This graph handles modification requests for existing applications:
 * 1. Modification Analysis (understand what needs to change)
 * 2. Coding Implementation (apply the changes)
 * 3. Tool Execution and Completion
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AppBuilderState, AppBuilderStateType } from "../state.js";
import { modificationAgent, codingAgentWithTools } from "../agents/index.js";
import { toolNode, routeAfterTools } from "../tools/index.js";

/**
 * Router function for modification agent
 * Determines if modification agent needs to route to coding or tools
 */
export function routeAfterModification(state: AppBuilderStateType): string {
    console.log("🔀 Routing after modification agent...");

    const lastMessage = state.messages[state.messages.length - 1];

    // Check if agent made tool calls
    if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
        console.log(`🔧 Modification agent made ${lastMessage.tool_calls.length} tool calls, routing to tools`);
        return "tools";
    }

    // If no tool calls, route to coding for implementation
    console.log("💻 Modification analyzed, routing to coding for implementation");
    return "coding_agent";
}

/**
 * Router function for coding agent in modification pipeline
 * Similar to initial pipeline but focused on modification context
 */
export function routeAfterCodingModification(state: AppBuilderStateType): string {
    console.log("🔀 Routing after coding in modification pipeline...");

    const lastMessage = state.messages[state.messages.length - 1];

    // Check if agent made tool calls
    if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
        console.log(`🔧 Coding agent made ${lastMessage.tool_calls.length} tool calls, routing to tools`);
        return "tools";
    }

    // If coding agent responded without tool calls, continue coding
    console.log("💻 Coding agent responded without tool calls, continuing modification");
    return "coding_agent";
}

/**
 * Enhanced routing function for modification pipeline entry point
 * Determines how to start modification based on context
 */
function routeModificationPipeline(state: AppBuilderStateType): string {
    console.log("🚀 Routing modification pipeline entry...");

    const lastUserMessage = getLastUserMessage(state);
    const userInput = lastUserMessage?.content?.toString() || '';

    // Analyze the type of modification request
    if (isDirectCodeChange(userInput)) {
        console.log("💻 Direct code change detected, routing to coding");
        return "coding_agent";
    }

    // For complex modifications, start with modification analysis
    console.log("🔄 Complex modification detected, starting with modification analysis");
    return "modification_agent";
}

/**
 * Build the complete modification pipeline graph
 * This implements the modification workflow for existing applications
 */
export function buildModificationPipelineGraph() {
    console.log("🏗️  Building modification pipeline graph...");

    const graph = new StateGraph(AppBuilderState)
        // Add agent nodes for modification workflow
        .addNode("modification_agent", modificationAgent)
        .addNode("coding_agent", codingAgentWithTools)
        .addNode("tools", toolNode);

    // Define the modification flow with conditional routing
    graph
        // Start with modification pipeline routing
        .addConditionalEdges(START, routeModificationPipeline, {
            modification_agent: "modification_agent",
            coding_agent: "coding_agent"
        })

        // Modification agent routing
        .addConditionalEdges("modification_agent", routeAfterModification, {
            coding_agent: "coding_agent",
            tools: "tools",
            [END]: END
        })

        // Coding agent routing in modification context
        .addConditionalEdges("coding_agent", routeAfterCodingModification, {
            tools: "tools",
            coding_agent: "coding_agent", // Allow coding to loop back to itself
            [END]: END
        })

        // Tool execution routing
        .addConditionalEdges("tools", routeAfterTools, {
            modification_agent: "modification_agent",
            coding_agent: "coding_agent",
            [END]: END
        });

    console.log("✅ Modification pipeline graph built successfully");
    return graph.compile();
}

/**
 * Validate modification pipeline graph structure
 * Ensures all nodes and edges are properly configured
 */
export function validateModificationPipelineGraph(): boolean {
    try {
        const graph = buildModificationPipelineGraph();
        console.log("✅ Modification pipeline graph validation passed");
        return true;
    } catch (error) {
        console.error("❌ Modification pipeline graph validation failed:", error);
        return false;
    }
}

/**
 * Test modification pipeline graph execution with sample state
 */
export async function testModificationPipelineGraph(conversationId: string = "test-modification"): Promise<void> {
    console.log("🧪 Testing modification pipeline graph execution...");

    try {
        const graph = buildModificationPipelineGraph();

        const modificationState: AppBuilderStateType = {
            messages: [new HumanMessage("Change the button color to blue")],
            conversationId,
            isFirstRequest: false, // This is a modification, not initial request
            currentAgent: "modification",
            requirements: "A todo application with React components",
            wireframe: "Simple todo layout with cards and buttons",
            generatedCode: {
                "src/App.tsx": "existing todo app code..."
            },
            containerInfo: {
                containerId: "existing-container",
                port: 3001,
                status: "running"
            },
            lastError: null,
            retryCount: 0,
            lastToolExecution: [],
            completionState: {
                explorationComplete: true,
                buildSuccessful: true,
                devServerStarted: true,
                requirementsMet: true,
                isComplete: false // Need to apply modification
            },
            aguiEvents: []
        };

        console.log("🚀 Starting modification pipeline test execution...");

        // Execute just the first step for testing
        const result = await graph.invoke(modificationState);

        console.log("✅ Modification pipeline test successful:", {
            conversationId: result.conversationId,
            currentAgent: result.currentAgent,
            messageCount: result.messages?.length || 0,
            hasEvents: (result.aguiEvents?.length || 0) > 0
        });

    } catch (error) {
        console.error("❌ Modification pipeline test failed:", error);
        throw error;
    }
}

/**
 * Helper function to get the last user message from state
 * Used by agents to access user input in modification context
 */
export function getLastUserMessage(state: AppBuilderStateType): HumanMessage | undefined {
    const userMessages = state.messages.filter(msg => msg._getType() === 'human');
    return userMessages[userMessages.length - 1] as HumanMessage;
}

/**
 * Helper function to check if user request is a direct code change
 * Simple changes can skip modification analysis and go straight to coding
 */
export function isDirectCodeChange(userInput: string): boolean {
    const directChangeKeywords = [
        'change the color',
        'make the button',
        'fix the bug',
        'update the text',
        'remove the',
        'add a',
        'replace'
    ];

    const input = userInput.toLowerCase();
    return directChangeKeywords.some(keyword => input.includes(keyword));
}

/**
 * Helper function to check if this is a complex modification
 * Complex modifications need analysis before implementation
 */
export function isComplexModification(userInput: string): boolean {
    const complexKeywords = [
        'completely change',
        'redesign',
        'add new feature',
        'restructure',
        'refactor',
        'new functionality',
        'different approach'
    ];

    const input = userInput.toLowerCase();
    return complexKeywords.some(keyword => input.includes(keyword));
}

/**
 * Helper function to extract modification intent from user input
 * Analyzes what type of modification the user is requesting
 */
export function extractModificationIntent(userInput: string): {
    type: 'ui_change' | 'feature_addition' | 'bug_fix' | 'refactor' | 'content_update';
    complexity: 'simple' | 'moderate' | 'complex';
    target: string;
} {
    const input = userInput.toLowerCase();

    // Determine modification type
    let type: 'ui_change' | 'feature_addition' | 'bug_fix' | 'refactor' | 'content_update' = 'ui_change';

    if (input.includes('add') || input.includes('new feature')) {
        type = 'feature_addition';
    } else if (input.includes('fix') || input.includes('bug') || input.includes('error')) {
        type = 'bug_fix';
    } else if (input.includes('refactor') || input.includes('restructure')) {
        type = 'refactor';
    } else if (input.includes('text') || input.includes('content') || input.includes('wording')) {
        type = 'content_update';
    }

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';

    if (isComplexModification(userInput)) {
        complexity = 'complex';
    } else if (input.length > 50 || input.includes('and') || input.includes('also')) {
        complexity = 'moderate';
    }

    // Extract target (what's being modified)
    const target = extractTarget(userInput);

    return { type, complexity, target };
}

/**
 * Helper function to extract the target of modification
 * Identifies what component or element is being modified
 */
function extractTarget(userInput: string): string {
    const commonTargets = [
        'button', 'input', 'form', 'card', 'header', 'footer',
        'navbar', 'sidebar', 'modal', 'text', 'color', 'style',
        'layout', 'component', 'page', 'menu', 'list', 'table'
    ];

    const input = userInput.toLowerCase();
    const foundTarget = commonTargets.find(target => input.includes(target));

    return foundTarget || 'general';
}
