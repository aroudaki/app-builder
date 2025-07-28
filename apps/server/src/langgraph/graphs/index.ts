/**
 * LangGraph Pipeline Implementations
 * 
 *export async function validateAllGraphs(): Promise<boolean> {
    console.log("🔍 Running graph validation suite...");

    console.log("🔍 Running graph validation suite...");
 * - Initial Pipeline: For new application generation
 * - Modification Pipeline: For modifying existing applications  
 * - Main Orchestrator: Master graph that routes between pipelines
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AppBuilderState, AppBuilderStateType } from "../state.js";

// Import pipeline implementations
export {
    buildInitialPipelineGraph,
    validateInitialPipelineGraph,
    testInitialPipelineGraph,
    getLastUserMessage as getLastUserMessageInitial,
    routeAfterClarification,
    routeAfterAgent as routeAfterAgentInitial
} from "./initial-pipeline.js";

export {
    buildModificationPipelineGraph,
    validateModificationPipelineGraph,
    testModificationPipelineGraph,
    getLastUserMessage as getLastUserMessageModification,
    isDirectCodeChange,
    isComplexModification,
    extractModificationIntent,
    routeAfterModification,
    routeAfterCodingModification
} from "./modification-pipeline.js";

export {
    buildMainGraph,
    validateMainGraph,
    testMainGraph,
    createInitialState,
    createModificationState,
    analyzeUserIntent,
    executeAppBuilder
} from "./main-orchestrator.js";

/**
 * Graph Validation Suite
 * Validates all graph implementations for proper structure and compilation
 */
export async function validateAllGraphs(): Promise<boolean> {
    console.log("🔍 Running graph validation suite...");

    try {
        // Import validation functions
        const { validateInitialPipelineGraph } = await import("./initial-pipeline.js");
        const { validateModificationPipelineGraph } = await import("./modification-pipeline.js");
        const { validateMainGraph } = await import("./main-orchestrator.js");

        // Validate each graph
        const initialValid = validateInitialPipelineGraph();
        const modificationValid = validateModificationPipelineGraph();
        const mainValid = validateMainGraph();

        const allValid = initialValid && modificationValid && mainValid;

        if (allValid) {
            console.log("✅ All graphs validated successfully");
        } else {
            console.error("❌ Graph validation failed");
        }

        return allValid;

    } catch (error) {
        console.error("❌ Graph validation suite failed:", error);
        return false;
    }
}

/**
 * Graph Testing Suite
 * Tests all graph implementations with sample data
 */
export async function testAllGraphs(): Promise<void> {
    console.log("🧪 Running graph testing suite...");

    try {
        // Import test functions
        const { testInitialPipelineGraph } = await import("./initial-pipeline.js");
        const { testModificationPipelineGraph } = await import("./modification-pipeline.js");
        const { testMainGraph } = await import("./main-orchestrator.js");

        // Test each graph
        console.log("📋 Testing initial pipeline graph...");
        await testInitialPipelineGraph("test-initial-suite");

        console.log("📋 Testing modification pipeline graph...");
        await testModificationPipelineGraph("test-modification-suite");

        console.log("📋 Testing main orchestrator graph...");
        await testMainGraph();

        console.log("🎉 All graph tests passed successfully");

    } catch (error) {
        console.error("❌ Graph testing suite failed:", error);
        throw error;
    }
}

/**
 * Main entry point for App Builder execution
 * This is the primary function that external code should call
 */
export async function runAppBuilder(
    userMessage: string,
    existingState?: Partial<AppBuilderStateType>,
    conversationId?: string
): Promise<AppBuilderStateType> {
    console.log("🚀 App Builder - Production Implementation");

    // Import and execute the main orchestrator
    const { executeAppBuilder } = await import("./main-orchestrator.js");
    return await executeAppBuilder(userMessage, existingState, conversationId);
}

/**
 * Get the appropriate graph for a given scenario
 * Useful for advanced use cases that need direct graph access
 */
export async function getGraph(type: 'initial' | 'modification' | 'main') {
    switch (type) {
        case 'initial':
            const { buildInitialPipelineGraph } = await import("./initial-pipeline.js");
            return buildInitialPipelineGraph();

        case 'modification':
            const { buildModificationPipelineGraph } = await import("./modification-pipeline.js");
            return buildModificationPipelineGraph();

        case 'main':
            const { buildMainGraph } = await import("./main-orchestrator.js");
            return buildMainGraph();

        default:
            throw new Error(`Unknown graph type: ${type}`);
    }
}

/**
 * Implementation Status
 * Reports the current status of the graph system implementation
 */
export function getGraphSystemStatus(): {
    system: string;
    status: 'complete' | 'in-progress' | 'not-started';
    components: Record<string, boolean>;
    description: string;
} {
    return {
        system: "LangGraph Pipeline System",
        status: 'complete',
        components: {
            initialPipelineGraph: true,
            modificationPipelineGraph: true,
            mainOrchestratorGraph: true,
            graphValidation: true,
            graphTesting: true,
            typeScriptIntegration: true
        },
        description: "Complete LangGraph workflow implementation with initial and modification pipelines orchestrated by main graph. Includes validation, testing, and full TypeScript integration."
    };
}

/**
 * Legacy placeholder functions for backward compatibility
 * These are maintained for any existing code that might reference them
 */
async function placeholderNode(state: AppBuilderStateType): Promise<Partial<AppBuilderStateType>> {
    console.log(`⚠️  Legacy placeholder node called - use current graph implementation instead`);
    return { currentAgent: state.currentAgent };
}

function basicRouter(state: AppBuilderStateType): string {
    console.log(`⚠️  Legacy basic router called - use current graph implementation instead`);
    return END;
}

// Export legacy functions for compatibility
export {
    placeholderNode,
    basicRouter
};
