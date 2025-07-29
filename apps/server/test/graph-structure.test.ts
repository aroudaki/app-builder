/**
 * Basic Graph Structure Test
 * 
 * Tests the skeleton graph implementation to ensure LangGraph integration
 * is working correctly before implementing full agent logic.
 */

import { validateAllGraphs } from '../dist/src/langgraph/graphs/index.js';

console.log('🧪 Testing Basic Graph Structure...\n');

async function runGraphTests() {
    try {
        // Test basic graph compilation and validation (no execution)
        console.log('🔍 Running graph structure validation...');
        const isValid = await validateAllGraphs();

        if (!isValid) {
            throw new Error('Graph validation failed');
        }

        console.log('\n🎉 All graph structure tests passed! LangGraph integration is working correctly.');

    } catch (error) {
        console.error('\n❌ Graph structure test failed:', error);
        process.exit(1);
    }
}

runGraphTests();
