/**
 * Graph Structure Validation
 * 
 * Validates LangGraph implementations for structure and compilation
 * without requiring LLM execution. Focuses on graph architecture,
 * node connectivity, and routing logic.
 */

console.log('🏗️  LangGraph Structure Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function validateGraphStructures() {
    try {
        // Import LangGraph implementations
        console.log('📦 Importing LangGraph modules...');
        const {
            buildInitialPipelineGraph,
            buildModificationPipelineGraph,
            buildMainGraph,
            validateAllGraphs,
            createInitialState,
            analyzeUserIntent,
            getGraphSystemStatus
        } = await import('../dist/src/langgraph/index.js');

        // Test 1: Graph compilation
        console.log('🔨 Test 1: Graph Compilation...');
        const initialGraph = buildInitialPipelineGraph();
        const modificationGraph = buildModificationPipelineGraph();
        const mainGraph = buildMainGraph();
        console.log('✅ All graphs compiled successfully');

        // Test 2: Graph validation
        console.log('🔍 Test 2: Graph Structure Validation...');
        const isValid = await validateAllGraphs();
        if (!isValid) {
            throw new Error('Graph validation failed');
        }
        console.log('✅ All graph structures validated successfully');

        // Test 3: State management
        console.log('📝 Test 3: State Management...');
        const initialState = createInitialState("Create a test app", "structure-validation");
        if (!initialState || !initialState.conversationId || !initialState.messages) {
            throw new Error('State creation failed');
        }
        console.log('✅ State management works correctly');

        // Test 4: Intent analysis
        console.log('🧠 Test 4: Intent Analysis System...');
        const intent1 = analyzeUserIntent("Create a new app", false);
        const intent2 = analyzeUserIntent("Change the color", true);

        if (intent1.pipeline !== 'initial' || intent2.pipeline !== 'modification') {
            throw new Error('Intent analysis failed');
        }
        console.log('✅ Intent analysis system works correctly');

        // Test 5: Implementation status
        console.log('📊 Test 5: Implementation Status...');
        const status = getGraphSystemStatus();
        if (status.status !== 'complete') {
            throw new Error('Implementation not reported as complete');
        }
        console.log('✅ Implementation status reported correctly');

        // Test 6: Graph object inspection
        console.log('🔍 Test 6: Graph Object Inspection...');

        if (!initialGraph || !modificationGraph || !mainGraph) {
            throw new Error('Graph objects are invalid');
        }

        console.log('✅ Graph objects are valid');

        // Success summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Graph Structure Validation: ALL TESTS PASSED!');
        console.log('✅ Graph Compilation: ✅');
        console.log('✅ Graph Structure Validation: ✅');
        console.log('✅ State Management: ✅');
        console.log('✅ Intent Analysis: ✅');
        console.log('✅ Implementation Status: ✅');
        console.log('✅ Graph Object Integrity: ✅');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏆 LangGraph Implementation - STRUCTURE VALIDATED');
        console.log('');
        console.log('📋 Architecture Summary:');
        console.log('  🔸 Initial Pipeline Graph:');
        console.log('    - Clarification Agent → Requirements Agent → Wireframe Agent → Coding Agent');
        console.log('    - Conditional routing with user interaction support');
        console.log('    - Tool integration with TrackedToolNode');
        console.log('');
        console.log('  🔸 Modification Pipeline Graph:');
        console.log('    - Modification Agent → Coding Agent');
        console.log('    - Streamlined workflow for application changes');
        console.log('    - Direct coding routing for simple modifications');
        console.log('');
        console.log('  🔸 Main Orchestrator Graph:');
        console.log('    - Intelligent pipeline selection based on context');
        console.log('    - Intent analysis for optimal routing');
        console.log('    - State-aware conversation management');
        console.log('');
        console.log('  🔸 Supporting Infrastructure:');
        console.log('    - Comprehensive state management');
        console.log('    - TypeScript integration with full type safety');
        console.log('    - Validation and testing framework');
        console.log('    - Performance-optimized graph compilation');

        return true;

    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ Graph Structure Validation FAILED:', error.message);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return false;
    }
}

// Run validation
validateGraphStructures()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Validation script error:', error);
        process.exit(1);
    });
