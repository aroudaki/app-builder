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

        // Create LLM with proper configuration  
        const llm = createLLMForAgent('clarification', {
            temperature: getAgentTemperature('clarification'),
            streaming: true // Enable streaming for real-time responses
        });
        try {
            // Get prompt template and format with variables
            const promptTemplate = getPromptTemplate('clarification');
            const formattedPrompt = await promptTemplate.format({
                userInput,
                conversationHistory: conversationHistory || 'No previous conversation'
            });

            // Execute LLM call with streaming
            console.log("🧠 Calling LLM for clarification questions with streaming...");

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

            // Apply validation logic from existing configuration
            const isValid = validateClarificationOutput(fullResponse);
            if (!isValid) {
                console.warn("⚠️ Clarification response validation failed, retrying...");

                // Implement retry logic
                if ((state.retryCount || 0) < 3) {
                    return {
                        currentAgent: "clarification",
                        retryCount: (state.retryCount || 0) + 1,
                        lastError: {
                            agent: "clarification",
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

            console.log("✅ Clarification agent completed successfully");

            return {
                messages: [new AIMessage(fullResponse)],
                currentAgent: "clarification",
                aguiEvents: events,
                retryCount: 0 // Reset retry count on success
            };

        } catch (error) {
            console.error("❌ Clarification agent failed:", error);

            // Implement retry logic for errors
            if ((state.retryCount || 0) < 3) {
                const retryEvent = createAGUIEvent("ERROR", state.conversationId, {
                    error: `Attempt ${(state.retryCount || 0) + 1}/3 failed: ${error instanceof Error ? error.message : String(error)}`,
                    retryCount: (state.retryCount || 0) + 1
                });

                return {
                    currentAgent: "clarification",
                    retryCount: (state.retryCount || 0) + 1,
                    lastError: {
                        agent: "clarification",
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: new Date().toISOString()
                    },
                    aguiEvents: [retryEvent]
                };
            }

            // Max retries exceeded - return fallback response
            return {
                messages: [new AIMessage("I'd like to understand your project better. Could you provide more details about what you'd like to build?")],
                currentAgent: "clarification",
                lastError: {
                    agent: "clarification",
                    error: `Max retries exceeded: ${error instanceof Error ? error.message : String(error)}`,
                    timestamp: new Date().toISOString()
                },
                aguiEvents: [
                    createAGUIEvent("ERROR", state.conversationId, {
                        error: `Max retries exceeded: ${error instanceof Error ? error.message : String(error)}`,
                        retryCount: state.retryCount || 0
                    })
                ]
            };
        }

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
