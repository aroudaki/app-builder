/**
 * LLM Module Structure Test
 * 
 * This test validates the LLM module exports and structure without requiring
 * Azure OpenAI credentials, ensuring the implementation is correct.
 */

import {
    createLLM,
    createGPT41LLM,
    createO3LLM,
    createLLMForAgent,
    testLLMConnection,
    getAvailableModelTypes,
    isModelAvailable,
    type ModelType,
    type LLMConfig
} from '../src/langgraph/llm.js';

function testLLMModuleStructure() {
    console.log("🧪 Testing LLM Module Structure - Phase 2 Task 2.1");
    console.log("=".repeat(50));
    
    let allTestsPassed = true;
    
    // Test 1: Verify all exports are available
    console.log("\n1️⃣ Testing Module Exports");
    
    const expectedFunctions = [
        'createLLM',
        'createGPT41LLM', 
        'createO3LLM',
        'createLLMForAgent',
        'testLLMConnection',
        'getAvailableModelTypes',
        'isModelAvailable'
    ];
    
    const exportedFunctions = {
        createLLM,
        createGPT41LLM,
        createO3LLM,
        createLLMForAgent,
        testLLMConnection,
        getAvailableModelTypes,
        isModelAvailable
    };
    
    expectedFunctions.forEach(funcName => {
        const func = exportedFunctions[funcName];
        if (typeof func === 'function') {
            console.log(`   ✅ ${funcName}: Function exported`);
        } else {
            console.log(`   ❌ ${funcName}: Missing or not a function`);
            allTestsPassed = false;
        }
    });
    
    // Test 2: Verify types are exported
    console.log("\n2️⃣ Testing Type Exports");
    
    try {
        // This will compile if types are properly exported
        const modelType: ModelType = 'gpt-4.1';
        const config: LLMConfig = {
            model: 'gpt-4.1',
            azureOpenAIApiKey: 'test',
            azureOpenAIApiInstanceName: 'test',
            azureOpenAIApiDeploymentName: 'test',
            azureOpenAIApiVersion: 'test'
        };
        
        console.log(`   ✅ ModelType: Type properly exported`);
        console.log(`   ✅ LLMConfig: Type properly exported`);
    } catch (error) {
        console.log(`   ❌ Type exports failed: ${error.message}`);
        allTestsPassed = false;
    }
    
    // Test 3: Test function signatures without execution
    console.log("\n3️⃣ Testing Function Signatures");
    
    try {
        // Test getAvailableModelTypes (doesn't require env vars)
        const modelTypes = getAvailableModelTypes();
        if (Array.isArray(modelTypes) && modelTypes.includes('gpt-4.1') && modelTypes.includes('o3')) {
            console.log(`   ✅ getAvailableModelTypes: Returns correct model types`);
        } else {
            console.log(`   ❌ getAvailableModelTypes: Unexpected return value`);
            allTestsPassed = false;
        }
        
        // Test isModelAvailable (doesn't require env vars)
        const isGPT41Available = isModelAvailable('gpt-4.1');
        const isO3Available = isModelAvailable('o3');
        
        if (typeof isGPT41Available === 'boolean' && typeof isO3Available === 'boolean') {
            console.log(`   ✅ isModelAvailable: Returns boolean values`);
        } else {
            console.log(`   ❌ isModelAvailable: Should return boolean`);
            allTestsPassed = false;
        }
        
    } catch (error) {
        console.log(`   ❌ Function signature test failed: ${error.message}`);
        allTestsPassed = false;
    }
    
    // Test 4: Verify error handling
    console.log("\n4️⃣ Testing Error Handling");
    
    try {
        // Should throw error due to missing environment variables
        createLLM('gpt-4.1');
        console.log(`   ❌ Error handling: Should have thrown error for missing env vars`);
        allTestsPassed = false;
    } catch (error) {
        if (error.message.includes('Missing required environment variables')) {
            console.log(`   ✅ Error handling: Properly validates environment variables`);
        } else {
            console.log(`   ❌ Error handling: Unexpected error message: ${error.message}`);
            allTestsPassed = false;
        }
    }
    
    // Test Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 LLM Module Structure Test Results");
    console.log("=".repeat(50));
    
    if (allTestsPassed) {
        console.log(`✅ All structure tests passed!`);
        console.log(`✅ Module exports: Complete`);
        console.log(`✅ Type definitions: Correct`);
        console.log(`✅ Function signatures: Valid`);
        console.log(`✅ Error handling: Robust`);
        console.log(`\n🎉 Phase 2 Task 2.1 (OpenAI/Azure OpenAI Setup): IMPLEMENTATION COMPLETE!`);
        console.log(`📋 Module is ready for Phase 2 Task 2.2: Prompt Templates`);
        console.log(`🔧 Add Azure OpenAI credentials to .env to enable live testing`);
    } else {
        console.log(`❌ Some structure tests failed - check implementation`);
        process.exit(1);
    }
}

// Run the test
testLLMModuleStructure();
