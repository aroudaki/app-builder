import {
    generateUUID,
    getTimestamp,
    createSnapshot,
    EventType,
    RunAgentInput,
    sanitizeInput,
    isValidConversationId
} from './index.js';

/**
 * Simple test runner for shared utilities
 */
export function runTests() {
    console.log('🧪 Running Shared Types & Utilities Tests\n');

    // Test generateUUID
    console.log('✅ Testing generateUUID()');
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    console.log(`   Generated UUIDs: ${uuid1}, ${uuid2}`);
    console.log(`   Are different: ${uuid1 !== uuid2}`);
    console.log(`   Valid format: ${isValidConversationId(uuid1)}\n`);

    // Test getTimestamp
    console.log('✅ Testing getTimestamp()');
    const timestamp = getTimestamp();
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Valid ISO format: ${!isNaN(Date.parse(timestamp))}\n`);

    // Test EventType enum
    console.log('✅ Testing EventType enum');
    console.log(`   TEXT_MESSAGE_CONTENT: ${EventType.TEXT_MESSAGE_CONTENT}`);
    console.log(`   RUN_FINISHED: ${EventType.RUN_FINISHED}`);
    console.log(`   ERROR: ${EventType.ERROR}\n`);

    // Test RunAgentInput interface (type checking)
    console.log('✅ Testing RunAgentInput interface');
    const runInput: RunAgentInput = {
        conversationId: generateUUID(),
        messages: [
            {
                id: generateUUID(),
                role: 'user',
                content: 'Hello, world!'
            }
        ],
        tools: [],
        state: { step: 1 }
    };
    console.log(`   Run input created: ${JSON.stringify(runInput, null, 2)}\n`);

    // Test sanitizeInput
    console.log('✅ Testing sanitizeInput()');
    const maliciousInput = '<script>alert("xss")</script>Hello onclick="alert(1)"';
    const sanitized = sanitizeInput(maliciousInput);
    console.log(`   Original: ${maliciousInput}`);
    console.log(`   Sanitized: ${sanitized}\n`);

    // Test isValidConversationId
    console.log('✅ Testing isValidConversationId()');
    console.log(`   Valid UUID: ${isValidConversationId(generateUUID())}`);
    console.log(`   Invalid format: ${isValidConversationId('invalid-id')}`);
    console.log(`   Empty string: ${isValidConversationId('')}\n`);

    console.log('🎉 All tests completed successfully!');
}
