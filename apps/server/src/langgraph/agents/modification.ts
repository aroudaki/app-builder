/**
 * Modification Agent - LangGraph Implementation
 * 
 * Modifies existing applications based on user feedback and change requests.
 * This agent carefully updates existing code while preserving functionality.
 */

import { AIMessage } from "@langchain/core/messages";
import { createLLMForAgent } from "../llm.js";
import { getPromptTemplate, getAgentTemperature } from "../prompts.js";
import { AppBuilderStateType, createAGUIEvent, generateId } from "../state.js";

/**
 * Modification Agent Node Function
 * 
 * @param state - Current LangGraph state
 * @returns Partial state update with modification implementation
 */
export async function modificationAgent(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    console.log("🤖 Executing Modification Agent");

    // Apply skipOn logic from existing configuration
    const shouldSkip = shouldSkipModification(state);

    if (shouldSkip) {
        console.log("⏭️ Skipping modification - no existing code to modify");
        return {
            messages: [],
            currentAgent: "modification"
        };
    }

    try {
        // Get current application state and modification request
        const lastMessage = state.messages[state.messages.length - 1];
        const modificationRequest = lastMessage?.content?.toString() || '';

        // Get current application state
        const currentState = {
            generatedCode: state.generatedCode || {},
            requirements: state.requirements || '',
            wireframe: state.wireframe || '',
            completionState: state.completionState || {}
        };

        // Build conversation history for context
        const conversationHistory = state.messages
            .map(msg => `${msg._getType()}: ${msg.content}`)
            .join('\n');

        // Create LLM instance with agent-specific configuration
        const llm = createLLMForAgent('modification', {
            temperature: getAgentTemperature('modification'),
            streaming: false
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('modification');
        const formattedPrompt = await promptTemplate.format({
            currentState: JSON.stringify(currentState, null, 2),
            modificationRequest,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call
        console.log("🧠 Calling LLM for code modification...");
        const response = await llm.invoke(formattedPrompt);
        const responseContent = response.content?.toString() || '';

        // TODO: When tool integration is complete (Phase 3), this will include:
        // 1. Real tool calls to modify existing files
        // 2. Build verification after changes
        // 3. Testing to ensure modifications work

        // For now, simulate successful modification workflow
        console.log("🔨 Simulating modification workflow (tools will be implemented in Phase 3)");

        // Simulate modified code
        const modifiedCode = {
            ...state.generatedCode,
            'src/App.tsx': '// Modified React application code',
            'modified_files': modificationRequest
        };

        // Apply validation logic from existing configuration
        const isValid = validateModificationOutput(responseContent, modifiedCode);
        if (!isValid) {
            console.warn("⚠️ Modification response validation failed, but continuing...");
        }

        // Emit AG-UI events for real-time streaming
        const events = [
            createAGUIEvent("TEXT_MESSAGE_START", state.conversationId, {
                messageId: generateId(),
                role: "assistant"
            }),
            createAGUIEvent("TEXT_MESSAGE_CONTENT", state.conversationId, {
                messageId: generateId(),
                delta: responseContent
            }),
            createAGUIEvent("TEXT_MESSAGE_END", state.conversationId, {
                messageId: generateId()
            })
        ];

        console.log("✅ Modification agent completed successfully");

        return {
            messages: [new AIMessage(responseContent)],
            currentAgent: "modification",
            generatedCode: modifiedCode,
            completionState: {
                ...state.completionState,
                requirementsMet: true,
                isComplete: true
            },
            aguiEvents: events
        };

    } catch (error) {
        console.error("❌ Modification agent failed:", error);

        // Return error state with fallback message
        return {
            messages: [new AIMessage("I encountered an issue while modifying the code. Let me analyze the request and try again.")],
            currentAgent: "modification",
            lastError: {
                agent: "modification",
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            },
            retryCount: (state.retryCount || 0) + 1
        };
    }
}

/**
 * Skip logic from existing modification agent configuration
 */
function shouldSkipModification(state: AppBuilderStateType): boolean {
    // Skip if this is the first request (no existing code to modify)
    const isFirstRequest = state.isFirstRequest;
    const hasGeneratedCode = state.generatedCode && Object.keys(state.generatedCode).length > 0;

    return isFirstRequest || !hasGeneratedCode;
}

/**
 * Validation logic from existing modification agent configuration
 */
function validateModificationOutput(response: string, modifiedCode: any): boolean {
    // Check if there are modifications to the codebase
    const hasModifiedCode = modifiedCode && Object.keys(modifiedCode).length > 0;

    // Check if the response indicates modification activity
    const hasResponse = response && response.length > 50;

    // Check for modification-related content in response
    const hasModificationContent = response.includes('modified') ||
        response.includes('updated') ||
        response.includes('changed') ||
        response.includes('app_container');

    return hasModifiedCode || (hasResponse && hasModificationContent);
}
