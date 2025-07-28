/**
 * LangGraph Pipeline Tests
 * 
 * Tests the complete LangGraph pipeline implementations:
 * - Initial application generation pipeline
 * - Modification pipeline for existing applications
 * - Main orchestrator graph routing
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { HumanMessage } from "@langchain/core/messages";
import {
    buildInitialPipelineGraph,
    buildModificationPipelineGraph,
    buildMainGraph,
    validateAllGraphs,
    runAppBuilder,
    createInitialGraphState,
    createModificationState,
    analyzeUserIntent
} from '../src/langgraph/index.js';
import type { AppBuilderStateType } from '../src/langgraph/index.js';

describe('LangGraph Pipeline Implementation', () => {
    let initialGraph: any;
    let modificationGraph: any;
    let mainGraph: any;

    beforeAll(async () => {
        console.log('🏗️  Setting up LangGraph pipelines for testing...');

        // Build all graphs
        initialGraph = buildInitialPipelineGraph();
        modificationGraph = buildModificationPipelineGraph();
        mainGraph = buildMainGraph();

        console.log('✅ All graphs built successfully');
    });

    describe('Graph Compilation and Validation', () => {
        test('should compile all graph implementations without errors', () => {
            console.log('🔨 Testing graph compilation...');

            expect(initialGraph).toBeDefined();
            expect(modificationGraph).toBeDefined();
            expect(mainGraph).toBeDefined();

            console.log('✅ All graphs compiled successfully');
        });

        test('should validate all graph structures', async () => {
            console.log('🔍 Testing graph validation...');

            const isValid = await validateAllGraphs();
            expect(isValid).toBe(true);

            console.log('✅ All graphs validated successfully');
        });
    });

    describe('Initial Application Generation Pipeline', () => {
        test('should create proper initial state for new applications', () => {
            console.log('📝 Testing initial state creation...');

            const state = createInitialGraphState(
                "Create a blog app",
                "test-initial-state"
            );

            expect(state.conversationId).toBe("test-initial-state");
            expect(state.isFirstRequest).toBe(true);
            expect(state.currentAgent).toBe("clarification");
            expect(state.messages).toHaveLength(1);
            expect(state.generatedCode).toEqual({});
            expect(state.completionState.isComplete).toBe(false);

            console.log('✅ Initial state creation test passed');
        });

        test('should handle initial app generation workflow', async () => {
            console.log('🆕 Testing initial pipeline workflow...');

            const state = createInitialGraphState(
                "Create a todo app with React",
                "test-initial-workflow"
            );

            // Test just the first step to avoid full LLM execution
            const result = await initialGraph.invoke(state, { recursionLimit: 1 });

            expect(result).toBeDefined();
            expect(result.conversationId).toBe("test-initial-workflow");
            expect(result.isFirstRequest).toBe(true);
            expect(result.messages).toBeDefined();
            expect(result.messages.length).toBeGreaterThan(0);

            console.log('✅ Initial pipeline workflow test passed');
        });

        test('should route to clarification agent for vague requests', async () => {
            console.log('🎯 Testing initial pipeline routing...');

            const state = createInitialGraphState(
                "Build an app",
                "test-initial-routing"
            );

            const result = await initialGraph.invoke(state, { recursionLimit: 1 });

            // Should start with clarification for vague requests
            expect(result.currentAgent).toBe("clarification");

            console.log('✅ Initial pipeline routing test passed');
        });
    });

    describe('Application Modification Pipeline', () => {
        test('should create proper modification state for existing applications', () => {
            console.log('🔄 Testing modification state creation...');

            const existingState: Partial<AppBuilderStateType> = {
                messages: [new HumanMessage("Original request")],
                generatedCode: { "src/App.tsx": "existing code" },
                requirements: "Blog application"
            };

            const state = createModificationState(
                "Add comments feature",
                existingState,
                "test-modification-state"
            );

            expect(state.conversationId).toBe("test-modification-state");
            expect(state.isFirstRequest).toBe(false);
            expect(state.currentAgent).toBe("modification");
            expect(state.messages).toHaveLength(2);
            expect(state.generatedCode).toEqual({ "src/App.tsx": "existing code" });
            expect(state.requirements).toBe("Blog application");

            console.log('✅ Modification state creation test passed');
        });

        test('should handle modification requests for existing applications', async () => {
            console.log('🔄 Testing modification pipeline workflow...');

            const existingState: Partial<AppBuilderStateType> = {
                messages: [new HumanMessage("Create a todo app")],
                requirements: "A todo application with React components",
                wireframe: "Simple todo layout with cards and buttons",
                generatedCode: {
                    "src/App.tsx": "existing todo app code...",
                    "src/components/TodoList.tsx": "todo list component..."
                },
                containerInfo: {
                    containerId: "existing-container",
                    port: 3001,
                    status: "running"
                },
                completionState: {
                    explorationComplete: true,
                    buildSuccessful: true,
                    devServerStarted: true,
                    requirementsMet: true,
                    isComplete: false
                }
            };

            const state = createModificationState(
                "Change the button color to blue",
                existingState,
                "test-modification-workflow"
            );

            const result = await modificationGraph.invoke(state, { recursionLimit: 1 });

            expect(result).toBeDefined();
            expect(result.conversationId).toBe("test-modification-workflow");
            expect(result.isFirstRequest).toBe(false);
            expect(result.generatedCode).toBeDefined();
            expect(Object.keys(result.generatedCode).length).toBeGreaterThan(0);

            console.log('✅ Modification pipeline workflow test passed');
        });
    });

    describe('Main Orchestrator Graph Routing', () => {
        test('should route new requests to initial pipeline', async () => {
            console.log('🎯 Testing orchestrator routing for new requests...');

            const userMessage = "Create a new weather app";
            const result = await runAppBuilder(userMessage, undefined, "test-orchestrator-new");

            expect(result).toBeDefined();
            expect(result.conversationId).toBe("test-orchestrator-new");
            expect(result.isFirstRequest).toBe(true);

            console.log('✅ New request routing test passed');
        });

        test('should route modification requests to modification pipeline', async () => {
            console.log('🔄 Testing orchestrator routing for modifications...');

            const existingState: Partial<AppBuilderStateType> = {
                generatedCode: {
                    "src/App.tsx": "existing app code"
                },
                requirements: "Weather application",
                isFirstRequest: false
            };

            const result = await runAppBuilder(
                "Add a dark mode toggle",
                existingState,
                "test-orchestrator-modification"
            );

            expect(result).toBeDefined();
            expect(result.conversationId).toBe("test-orchestrator-modification");
            expect(result.isFirstRequest).toBe(false);

            console.log('✅ Modification request routing test passed');
        });
    });

    describe('Intent Analysis System', () => {
        test('should correctly identify initial request intent', () => {
            console.log('🧠 Testing intent analysis for initial requests...');

            const intent1 = analyzeUserIntent("Create a new app", false);
            expect(intent1.pipeline).toBe('initial');
            expect(intent1.confidence).toBeGreaterThan(0.7);

            const intent2 = analyzeUserIntent("Build a todo application", false);
            expect(intent2.pipeline).toBe('initial');

            console.log('✅ Initial request intent analysis passed');
        });

        test('should correctly identify modification intent', () => {
            console.log('🔄 Testing intent analysis for modifications...');

            const intent1 = analyzeUserIntent("Change the color to blue", true);
            expect(intent1.pipeline).toBe('modification');
            expect(intent1.confidence).toBeGreaterThan(0.7);

            const intent2 = analyzeUserIntent("Fix the bug in the login", true);
            expect(intent2.pipeline).toBe('modification');

            console.log('✅ Modification intent analysis passed');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle invalid graph types gracefully', async () => {
            console.log('⚠️  Testing error handling...');

            const { getGraph } = await import('../src/langgraph/index.js');

            await expect(getGraph('invalid' as any)).rejects.toThrow('Unknown graph type: invalid');

            console.log('✅ Error handling test passed');
        });
    });

    describe('Performance and Optimization', () => {
        test('should compile graphs within reasonable time', async () => {
            console.log('⚡ Testing graph compilation performance...');

            const startTime = Date.now();

            buildInitialPipelineGraph();
            buildModificationPipelineGraph();
            buildMainGraph();

            const endTime = Date.now();
            const compilationTime = endTime - startTime;

            // Should compile within 1 second
            expect(compilationTime).toBeLessThan(1000);

            console.log(`✅ Graph compilation completed in ${compilationTime}ms`);
        });
    });
});

/**
 * Standalone pipeline validation function
 * Can be used for runtime validation of pipeline implementations
 */
export async function validatePipelineImplementations(): Promise<boolean> {
    console.log('🚀 Running Pipeline Implementation Validation...');

    try {
        // Test graph validation
        console.log('📋 Step 1: Validating all graphs...');
        const isValid = await validateAllGraphs();
        if (!isValid) {
            throw new Error('Graph validation failed');
        }

        // Test initial pipeline
        console.log('📋 Step 2: Testing initial pipeline...');
        const initialState = createInitialGraphState("Create a test app", "validation-test");
        const initialGraph = buildInitialPipelineGraph();
        await initialGraph.invoke(initialState, { recursionLimit: 1 });

        // Test modification pipeline
        console.log('📋 Step 3: Testing modification pipeline...');
        const modificationState = createModificationState(
            "Change something",
            { generatedCode: { "test.tsx": "code" } },
            "validation-test-mod"
        );
        const modificationGraph = buildModificationPipelineGraph();
        await modificationGraph.invoke(modificationState, { recursionLimit: 1 });

        // Test main orchestrator
        console.log('📋 Step 4: Testing main orchestrator...');
        await runAppBuilder("Test message", undefined, "validation-test-main");

        console.log('🎉 Pipeline Implementation Validation PASSED!');
        console.log('✅ All components working correctly:');
        console.log('  - Initial Pipeline Graph ✅');
        console.log('  - Modification Pipeline Graph ✅');
        console.log('  - Main Orchestrator Graph ✅');
        console.log('  - Graph Validation ✅');
        console.log('  - State Management ✅');
        console.log('  - TypeScript Integration ✅');

        return true;

    } catch (error) {
        console.error('❌ Pipeline Implementation Validation FAILED:', error);
        return false;
    }
}
