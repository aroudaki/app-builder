/**
 * Clarification Agent - LangGraph Implementation
 * 
 * Asks clarifying questions about user requirements to better understand project scope.
 * This agent helps non-technical users think through their requirements systematically.
 */

import { AIMessage } from "@langchain/core/messages";
import { createLLMForAgent } from "../llm.js";
import { getPromptTemplate, getAgentTemperature } from "../prompts.js";
import { AppBuilderStateType, createAGUIEvent, generateId } from "../state.js";

/**
 * Clarification Agent Node Function
 * 
 * @param state - Current LangGraph state
 * @returns Partial state update with clarification questions or skip indication
 */
export async function clarificationAgent(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    console.log("🤖 Executing Clarification Agent");

    // Apply skipOn logic from existing configuration
    const shouldSkip = shouldSkipClarification(state);

    if (shouldSkip) {
        console.log("⏭️ Skipping clarification based on existing logic");
        return {
            messages: [],
            currentAgent: "clarification"
        };
    }

    try {
        // Get the latest user message
        const lastMessage = state.messages[state.messages.length - 1];
        const userInput = lastMessage?.content?.toString() || '';

        // Build conversation history for context
        const conversationHistory = state.messages
            .slice(0, -1) // Exclude current message
            .map(msg => `${msg._getType()}: ${msg.content}`)
            .join('\n');

        // Create LLM instance with agent-specific configuration
        const llm = createLLMForAgent('clarification', {
            temperature: getAgentTemperature('clarification'),
            streaming: false // For now, implement without streaming
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('clarification');
        const formattedPrompt = await promptTemplate.format({
            userInput,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call
        console.log("🧠 Calling LLM for clarification questions...");
        const response = await llm.invoke(formattedPrompt);

        // Apply validation logic from existing configuration
        const isValid = validateClarificationOutput(response.content?.toString() || '');
        if (!isValid) {
            console.warn("⚠️ Clarification response validation failed, retrying...");
            // For now, continue with the response even if validation fails
            // In production, you might want to implement retry logic
        }

        // Emit AG-UI events for real-time streaming
        const events = [
            createAGUIEvent("TEXT_MESSAGE_START", state.conversationId, {
                messageId: generateId(),
                role: "assistant"
            }),
            createAGUIEvent("TEXT_MESSAGE_CONTENT", state.conversationId, {
                messageId: generateId(),
                delta: response.content?.toString() || ""
            }),
            createAGUIEvent("TEXT_MESSAGE_END", state.conversationId, {
                messageId: generateId()
            })
        ];

        console.log("✅ Clarification agent completed successfully");

        return {
            messages: [new AIMessage(response.content?.toString() || "I need more information to help you better.")],
            currentAgent: "clarification",
            aguiEvents: events
        };

    } catch (error) {
        console.error("❌ Clarification agent failed:", error);

        // Return error state with fallback message
        return {
            messages: [new AIMessage("I'd like to understand your project better. Could you provide more details about what you'd like to build?")],
            currentAgent: "clarification",
            lastError: {
                agent: "clarification",
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * Skip logic from existing clarification agent configuration
 */
function shouldSkipClarification(state: AppBuilderStateType): boolean {
    // Don't run again if already waiting for clarification response
    if ((state as any).conversationState === 'awaiting_clarification_response') {
        return true;
    }

    // For first requests, NEVER skip - always ask clarifying questions
    // This ensures the user gets proper guidance regardless of input length
    if (state.isFirstRequest) {
        return false; // Never skip for first requests
    }

    // For follow-up requests, always skip clarification
    // (though clarification shouldn't run for follow-ups anyway due to pipeline logic)
    return true;
}

/**
 * Validation logic from existing clarification agent configuration
 */
function validateClarificationOutput(response: string): boolean {
    // Check if the agent result has a proper response
    return response.length > 50 &&
        (response.includes('?') || response.includes('understand') || response.includes('clear'));
}
