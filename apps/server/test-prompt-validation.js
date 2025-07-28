#!/usr/bin/env node

/**
 * Test script to validate the updated prompt templates
 */

async function testPromptTemplates() {
    console.log('🧪 Testing Updated Prompt Templates...\n');

    try {
        // Import the prompt templates
        const {
            getRequirementsPrompt,
            getCodingPrompt,
            getWireframePrompt
        } = await import('./dist/src/langgraph/prompts.js');

        console.log('✅ Prompt templates imported successfully');

        // Test requirements prompt
        const requirementsPrompt = getRequirementsPrompt();
        const requirementsMessages = await requirementsPrompt.formatMessages({
            userInput: "I want to build a todo app",
            clarification: "No clarification needed",
            conversationHistory: "[]"
        });

        const requirementsSystemPrompt = requirementsMessages[0].content;

        // Validate requirements constraints
        const hasStackConstraints = requirementsSystemPrompt.includes('TECHNOLOGY CONSTRAINTS');
        const hasAllowedTech = requirementsSystemPrompt.includes('ALLOWED TECHNOLOGIES');
        const hasNotAllowed = requirementsSystemPrompt.includes('NOT ALLOWED');
        const mentionsReact = requirementsSystemPrompt.includes('React + TypeScript + Vite');
        const mentionsMIT = requirementsSystemPrompt.includes('MIT-licensed');
        const mentionsNoBackend = requirementsSystemPrompt.includes('NO backend server');

        console.log('\n📋 Requirements Agent Validation:');
        console.log(`   ✅ Technology Constraints: ${hasStackConstraints ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Allowed Technologies: ${hasAllowedTech ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Not Allowed Section: ${hasNotAllowed ? 'Present' : 'Missing'}`);
        console.log(`   ✅ React Stack Mentioned: ${mentionsReact ? 'Present' : 'Missing'}`);
        console.log(`   ✅ MIT License Requirement: ${mentionsMIT ? 'Present' : 'Missing'}`);
        console.log(`   ✅ No Backend Constraint: ${mentionsNoBackend ? 'Present' : 'Missing'}`);

        // Test coding prompt
        const codingPrompt = getCodingPrompt();
        const codingMessages = await codingPrompt.formatMessages({
            requirements: "Build a todo app",
            wireframe: "Simple layout",
            containerStatus: "{}",
            conversationHistory: "[]"
        });

        const codingSystemPrompt = codingMessages[0].content;

        // Validate coding constraints
        const hasFrontendOnly = codingSystemPrompt.includes('FRONTEND-ONLY');
        const hasPackageExamples = codingSystemPrompt.includes('npm install d3');
        const hasLocalStorage = codingSystemPrompt.includes('localStorage');
        const hasDataHandling = codingSystemPrompt.includes('DATA HANDLING');

        console.log('\n💻 Coding Agent Validation:');
        console.log(`   ✅ Frontend-Only Emphasis: ${hasFrontendOnly ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Package Installation Examples: ${hasPackageExamples ? 'Present' : 'Missing'}`);
        console.log(`   ✅ LocalStorage Mentioned: ${hasLocalStorage ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Data Handling Section: ${hasDataHandling ? 'Present' : 'Missing'}`);

        // Test wireframe prompt
        const wireframePrompt = getWireframePrompt();
        const wireframeMessages = await wireframePrompt.formatMessages({
            requirements: "Build a todo app",
            conversationHistory: "[]"
        });

        const wireframeSystemPrompt = wireframeMessages[0].content;

        // Validate wireframe constraints
        const hasClientSideOnly = wireframeSystemPrompt.includes('FRONTEND-ONLY');
        const hasDataFlow = wireframeSystemPrompt.includes('Data Flow Design');
        const hasSPAMention = wireframeSystemPrompt.includes('single-page React application');

        console.log('\n🎨 Wireframe Agent Validation:');
        console.log(`   ✅ Frontend-Only Constraints: ${hasClientSideOnly ? 'Present' : 'Missing'}`);
        console.log(`   ✅ Data Flow Design: ${hasDataFlow ? 'Present' : 'Missing'}`);
        console.log(`   ✅ SPA Architecture: ${hasSPAMention ? 'Present' : 'Missing'}`);

        // Overall validation
        const allValidationsPassed = hasStackConstraints && hasAllowedTech && hasNotAllowed &&
            mentionsReact && mentionsMIT && mentionsNoBackend &&
            hasFrontendOnly && hasPackageExamples && hasLocalStorage &&
            hasDataHandling && hasClientSideOnly && hasDataFlow && hasSPAMention;

        console.log('\n' + '='.repeat(60));
        console.log('📊 Prompt Template Validation Summary');
        console.log('='.repeat(60));

        if (allValidationsPassed) {
            console.log('✅ All validations passed!');
            console.log('✅ Technology stack constraints properly defined');
            console.log('✅ Frontend-only limitations clearly stated');
            console.log('✅ MIT license requirements included');
            console.log('✅ Allowed and not-allowed technologies specified');
            console.log('✅ Data storage constraints properly communicated');
            console.log('\n🎉 Prompt templates updated successfully!');
        } else {
            console.log('❌ Some validations failed - check implementation');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testPromptTemplates();
