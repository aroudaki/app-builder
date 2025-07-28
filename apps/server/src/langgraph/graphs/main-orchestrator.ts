/**
 * Main Graph Orchestrator
 * 
 * This is the master graph that determines which pipeline to execute:
 * - Initial Pipeline: For new application generation
 * - Modification Pipeline: For modifying existing applications
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AppBuilderState, AppBuilderStateType } from "../state.js";
import { buildInitialPipelineGraph } from "./initial-pipeline.js";
import { buildModificationPipelineGraph } from "./modification-pipeline.js";

/**
 * Main router function that determines which pipeline to execute
 * Based on conversation state and user intent
 */
function routeToPipeline(state: AppBuilderStateType): string {
    console.log("🎯 Routing to appropriate pipeline...");

    // Check if this is the first request in the conversation
    if (state.isFirstRequest || !state.generatedCode || Object.keys(state.generatedCode).length === 0) {
        console.log("🆕 First request or no existing code, routing to initial pipeline");
        return "initial_pipeline";
    }

    // Check if we have an existing application that can be modified
    if (state.generatedCode && Object.keys(state.generatedCode).length > 0) {
        console.log("🔄 Existing application detected, routing to modification pipeline");
        return "modification_pipeline";
    }

    // Default to initial pipeline if uncertain
    console.log("❓ Uncertain context, defaulting to initial pipeline");
    return "initial_pipeline";
}

/**
 * Router for pipeline completion
 * Determines if we need to continue processing or end
 */
function routeFromPipeline(state: AppBuilderStateType): string {
    console.log("🔀 Routing from pipeline completion...");

    // Check completion state
    if (state.completionState?.isComplete) {
        console.log("✅ Application is complete, ending workflow");
        return END;
    }

    // Check if there are errors that need addressing
    if (state.lastError) {
        console.log("⚠️ Error detected, continuing with appropriate pipeline");
        return state.isFirstRequest ? "initial_pipeline" : "modification_pipeline";
    }

    // Default to ending if no clear next step
    console.log("🏁 No clear next step, ending workflow");
    return END;
}

/**
 * Build the main orchestrator graph
 * This is the entry point for all application building workflows
 */
export function buildMainGraph() {
    console.log("🏗️  Building main orchestrator graph...");

    // Create the pipeline graphs
    const initialPipeline = buildInitialPipelineGraph();
    const modificationPipeline = buildModificationPipelineGraph();

    const graph = new StateGraph(AppBuilderState)
        // Add pipeline nodes that delegate to subgraphs
        .addNode("initial_pipeline", async (state: AppBuilderStateType) => {
            console.log("🚀 Executing initial pipeline...");
            return await initialPipeline.invoke(state);
        })
        .addNode("modification_pipeline", async (state: AppBuilderStateType) => {
            console.log("🔄 Executing modification pipeline...");
            return await modificationPipeline.invoke(state);
        });

    // Define the main routing flow
    graph
        // Start by routing to the appropriate pipeline
        .addConditionalEdges(START, routeToPipeline, {
            initial_pipeline: "initial_pipeline",
            modification_pipeline: "modification_pipeline"
        })

        // Route from pipeline completion
        .addConditionalEdges("initial_pipeline", routeFromPipeline, {
            initial_pipeline: "initial_pipeline",
            modification_pipeline: "modification_pipeline",
            [END]: END
        })

        .addConditionalEdges("modification_pipeline", routeFromPipeline, {
            initial_pipeline: "initial_pipeline",
            modification_pipeline: "modification_pipeline",
            [END]: END
        });

    console.log("✅ Main orchestrator graph built successfully");
    return graph.compile();
}

/**
 * Validate the main graph structure
 * Ensures all pipelines and routing are properly configured
 */
export function validateMainGraph(): boolean {
    try {
        const graph = buildMainGraph();
        console.log("✅ Main graph validation passed");
        return true;
    } catch (error) {
        console.error("❌ Main graph validation failed:", error);
        return false;
    }
}

/**
 * Test the main graph with both pipeline scenarios
 */
export async function testMainGraph(): Promise<void> {
    console.log("🧪 Testing main graph with both scenarios...");

    try {
        const graph = buildMainGraph();

        // Test 1: Initial request (should route to initial pipeline)
        console.log("📋 Test 1: Initial application request");
        const initialState: AppBuilderStateType = {
            messages: [new HumanMessage("Create a todo application")],
            conversationId: "test-initial",
            isFirstRequest: true,
            currentAgent: "clarification",
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

        const initialResult = await graph.invoke(initialState, { recursionLimit: 1 });
        console.log("✅ Initial pipeline test passed");

        // Test 2: Modification request (should route to modification pipeline)
        console.log("📋 Test 2: Modification request");
        const modificationState: AppBuilderStateType = {
            messages: [new HumanMessage("Change the button color to blue")],
            conversationId: "test-modification",
            isFirstRequest: false,
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
                isComplete: false
            },
            aguiEvents: []
        };

        const modificationResult = await graph.invoke(modificationState, { recursionLimit: 1 });
        console.log("✅ Modification pipeline test passed");

        console.log("🎉 All main graph tests passed successfully");

    } catch (error) {
        console.error("❌ Main graph test failed:", error);
        throw error;
    }
}

/**
 * Helper function to create initial state for new conversations
 */
export function createInitialState(
    userMessage: string,
    conversationId: string = generateConversationId()
): AppBuilderStateType {
    return {
        messages: [new HumanMessage(userMessage)],
        conversationId,
        isFirstRequest: true,
        currentAgent: "clarification",
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
}

/**
 * Helper function to create modification state for existing conversations
 */
export function createModificationState(
    userMessage: string,
    existingState: Partial<AppBuilderStateType>,
    conversationId: string
): AppBuilderStateType {
    return {
        ...existingState,
        messages: [...(existingState.messages || []), new HumanMessage(userMessage)],
        conversationId,
        isFirstRequest: false,
        currentAgent: "modification",
        lastError: null,
        retryCount: 0,
        completionState: {
            ...existingState.completionState,
            isComplete: false // Modification means we're not complete anymore
        }
    } as AppBuilderStateType;
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Analyze user intent to help with pipeline routing
 */
export function analyzeUserIntent(userMessage: string, hasExistingCode: boolean): {
    pipeline: 'initial' | 'modification';
    confidence: number;
    reasoning: string;
} {
    const message = userMessage.toLowerCase();

    // Strong indicators for initial pipeline
    const initialKeywords = [
        'create', 'build', 'make', 'new', 'generate',
        'start', 'begin', 'initialize'
    ];

    // Strong indicators for modification pipeline
    const modificationKeywords = [
        'change', 'update', 'modify', 'edit', 'fix',
        'improve', 'enhance', 'adjust', 'tweak'
    ];

    let pipeline: 'initial' | 'modification' = hasExistingCode ? 'modification' : 'initial';
    let confidence = 0.5;
    let reasoning = 'Default based on existing code state';

    // Check for initial indicators
    const initialMatches = initialKeywords.filter(keyword => message.includes(keyword));
    const modificationMatches = modificationKeywords.filter(keyword => message.includes(keyword));

    if (initialMatches.length > modificationMatches.length && !hasExistingCode) {
        pipeline = 'initial';
        confidence = 0.8;
        reasoning = `Initial keywords detected: ${initialMatches.join(', ')}`;
    } else if (modificationMatches.length > 0 && hasExistingCode) {
        pipeline = 'modification';
        confidence = 0.8;
        reasoning = `Modification keywords detected: ${modificationMatches.join(', ')}`;
    } else if (hasExistingCode) {
        pipeline = 'modification';
        confidence = 0.7;
        reasoning = 'Existing code present, defaulting to modification';
    }

    return { pipeline, confidence, reasoning };
}

/**
 * Main execution function for the application builder
 * This is the primary entry point for processing user requests
 */
export async function executeAppBuilder(
    userMessage: string,
    existingState?: Partial<AppBuilderStateType>,
    conversationId?: string
): Promise<AppBuilderStateType> {
    console.log("🚀 Starting App Builder execution...");
    console.log(`📝 User message: ${userMessage}`);

    try {
        const graph = buildMainGraph();

        // Determine if this is initial or modification
        const hasExistingCode = existingState?.generatedCode &&
            Object.keys(existingState.generatedCode).length > 0;

        // Create appropriate state
        let state: AppBuilderStateType;
        if (hasExistingCode && existingState) {
            state = createModificationState(userMessage, existingState, conversationId || existingState.conversationId || generateConversationId());
        } else {
            state = createInitialState(userMessage, conversationId);
        }

        // Analyze intent for logging
        const intent = analyzeUserIntent(userMessage, hasExistingCode || false);
        console.log(`🎯 Intent analysis: ${intent.pipeline} (confidence: ${intent.confidence}) - ${intent.reasoning}`);

        // Execute the graph
        console.log("⚡ Executing graph...");
        const result = await graph.invoke(state);

        console.log("✅ App Builder execution completed successfully");
        return result;

    } catch (error) {
        console.error("❌ App Builder execution failed:", error);
        throw error;
    }
}
