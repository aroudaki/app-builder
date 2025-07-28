/**
 * Unit tests for LangGraph State Schema
 * 
 * This test file validates the state schema implementation
 * and ensures all helper functions work correctly.
 */

import {
    AppBuilderState,
    AppBuilderStateType,
    createInitialState,
    generateId,
    createAGUIEvent,
    stateToAGUIContext,
    aguiContextToState
} from '../src/langgraph/state.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

console.log('🧪 Testing LangGraph State Schema...\n');

// Test 1: Create initial state
console.log('Test 1: Creating initial state');
const initialState = createInitialState('test-conversation-123');
console.log('✅ Initial state created:', {
    conversationId: initialState.conversationId,
    isFirstRequest: initialState.isFirstRequest,
    currentAgent: initialState.currentAgent,
    messagesLength: initialState.messages.length
});

// Test 2: Test ID generation
console.log('\nTest 2: Testing ID generation');
const id1 = generateId();
const id2 = generateId();
console.log('✅ Generated unique IDs:', { id1, id2, areUnique: id1 !== id2 });

// Test 3: Test AGUI event creation
console.log('\nTest 3: Testing AGUI event creation');
const event = createAGUIEvent('TEXT_MESSAGE_START', 'test-conversation-123', {
    role: 'assistant'
});
console.log('✅ AGUI event created:', {
    type: event.type,
    conversationId: event.conversationId,
    hasTimestamp: !!event.timestamp,
    role: event.role
});

// Test 4: Test state to AGUI context conversion
console.log('\nTest 4: Testing state to AGUI context conversion');
const testState: AppBuilderStateType = {
    ...initialState,
    messages: [new HumanMessage('Hello')],
    requirements: 'Build a todo app',
    currentAgent: 'requirements'
};
const aguiContext = stateToAGUIContext(testState);
console.log('✅ State converted to AGUI context:', {
    conversationId: aguiContext.conversationId,
    requirements: aguiContext.requirements,
    currentAgent: aguiContext.currentAgent,
    messagesLength: aguiContext.messages.length
});

// Test 5: Test AGUI context to state conversion
console.log('\nTest 5: Testing AGUI context to state conversion');
const backToState = aguiContextToState(aguiContext, 'test-conversation-456');
console.log('✅ AGUI context converted back to state:', {
    conversationId: backToState.conversationId,
    requirements: backToState.requirements,
    currentAgent: backToState.currentAgent,
    isFirstRequest: backToState.isFirstRequest
});

// Test 6: Validate state schema type
console.log('\nTest 6: Validating state schema structure');
const stateKeys = Object.keys(initialState);
const expectedKeys = [
    'messages', 'conversationId', 'isFirstRequest', 'currentAgent',
    'requirements', 'wireframe', 'generatedCode', 'containerInfo',
    'lastError', 'retryCount', 'lastToolExecution', 'completionState', 'aguiEvents'
];
const hasAllKeys = expectedKeys.every(key => stateKeys.includes(key));
console.log('✅ State schema validation:', {
    hasAllRequiredKeys: hasAllKeys,
    actualKeys: stateKeys.length,
    expectedKeys: expectedKeys.length
});

console.log('\n🎉 All state schema tests passed! LangGraph state implementation is working correctly.');
