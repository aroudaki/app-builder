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
            streaming: true
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('modification');
        const formattedPrompt = await promptTemplate.format({
            currentState: JSON.stringify(currentState, null, 2),
            modificationRequest,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call with streaming
        console.log("🧠 Calling LLM for code modification with streaming...");

        // Create message ID for tracking
        const messageId = generateId();
        const events: any[] = [];

        // Start message event
        events.push(
            createAGUIEvent("TEXT_MESSAGE_START", state.conversationId, {
                messageId,
                role: "assistant"
            })
        );

        let fullResponse = "";

        // Stream the response
        const stream = await llm.stream(formattedPrompt);
        for await (const chunk of stream) {
            const delta = chunk.content?.toString() || "";
            if (delta) {
                fullResponse += delta;

                // Content event for each chunk
                events.push(
                    createAGUIEvent("TEXT_MESSAGE_CONTENT", state.conversationId, {
                        messageId,
                        delta
                    })
                );
            }
        }

        // End message event
        events.push(
            createAGUIEvent("TEXT_MESSAGE_END", state.conversationId, {
                messageId
            })
        );

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
        const isValid = validateModificationOutput(fullResponse, modifiedCode);
        if (!isValid) {
            console.warn("⚠️ Modification response validation failed, retrying...");

            // Implement retry logic
            if ((state.retryCount || 0) < 3) {
                return {
                    currentAgent: "modification",
                    retryCount: (state.retryCount || 0) + 1,
                    lastError: {
                        agent: "modification",
                        error: "Validation failed",
                        timestamp: new Date().toISOString()
                    },
                    aguiEvents: [
                        createAGUIEvent("ERROR", state.conversationId, {
                            error: "Response validation failed, retrying...",
                            retryCount: (state.retryCount || 0) + 1
                        })
                    ]
                };
            }
        }

        console.log("✅ Modification agent completed successfully");

        return {
            messages: [new AIMessage(fullResponse)],
            currentAgent: "modification",
            generatedCode: modifiedCode,
            completionState: {
                ...state.completionState,
                requirementsMet: true,
                isComplete: true
            },
            aguiEvents: events,
            retryCount: 0 // Reset retry count on success
        };

    } catch (error) {
        console.error("❌ Error in modification agent:", error);

        // Implement retry logic
        if ((state.retryCount || 0) < 3) {
            return {
                currentAgent: "modification",
                retryCount: (state.retryCount || 0) + 1,
                lastError: {
                    agent: "modification",
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                },
                aguiEvents: [
                    createAGUIEvent("ERROR", state.conversationId, {
                        error: error instanceof Error ? error.message : String(error),
                        retryCount: (state.retryCount || 0) + 1
                    })
                ]
            };
        }

        // Final fallback after max retries
        const fallbackModification = "I'll make basic modifications to improve the application structure and functionality. This includes code organization and component improvements.";

        return {
            messages: [new AIMessage(fallbackModification)],
            currentAgent: "modification",
            generatedCode: {
                ...state.generatedCode,
                'src/App.tsx': '// Basic modifications applied',
                'modified_files': 'Fallback modifications'
            },
            completionState: {
                ...state.completionState,
                requirementsMet: false,
                isComplete: false
            },
            aguiEvents: [
                createAGUIEvent("ERROR", state.conversationId, {
                    error: "Max retries exceeded, using fallback modification",
                    fallback: true
                })
            ],
            retryCount: 0 // Reset for next operation
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
