/**
 * Basic Graph Structure Test
 * 
 * Tests the skeleton graph implementation to ensure LangGraph integration
 * is working correctly before implementing full agent logic.
 */

import { testGraphExecution } from '../src/langgraph/graphs/index.js';

console.log('🧪 Testing Basic Graph Structure...\n');

async function runGraphTests() {
    try {
        // Test basic graph compilation and execution
        await testGraphExecution('test-graph-execution');

        console.log('\n🎉 All graph structure tests passed! LangGraph integration is working correctly.');

    } catch (error) {
        console.error('\n❌ Graph structure test failed:', error);
        process.exit(1);
    }
}

runGraphTests();
