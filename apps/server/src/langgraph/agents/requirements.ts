/**
 * Requirements Agent - LangGraph Implementation
 * 
 * Analyzes user input and creates detailed technical specifications.
 * This agent converts user requirements into structured technical documentation.
 */

import { AIMessage } from "@langchain/core/messages";
import { createLLMForAgent } from "../llm.js";
import { getPromptTemplate, getAgentTemperature } from "../prompts.js";
import { AppBuilderStateType, createAGUIEvent, generateId } from "../state.js";

/**
 * Requirements Agent Node Function
 * 
 * @param state - Current LangGraph state
 * @returns Partial state update with detailed requirements analysis
 */
export async function requirementsAgent(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    console.log("🤖 Executing Requirements Agent");

    try {
        // Get the latest user message and any clarification
        const lastMessage = state.messages[state.messages.length - 1];
        const userInput = lastMessage?.content?.toString() || '';

        // Find clarification response if exists
        const clarificationMessage = state.messages.find(msg =>
            msg._getType() === 'ai' &&
            msg.content?.toString().includes('You can respond to one or more')
        );
        const clarification = clarificationMessage?.content?.toString() || 'No clarification provided';

        // Build conversation history for context
        const conversationHistory = state.messages
            .map(msg => `${msg._getType()}: ${msg.content}`)
            .join('\n');

        // Create LLM with proper configuration
        const llm = createLLMForAgent('requirements', {
            temperature: getAgentTemperature('requirements'),
            streaming: true // Enable streaming for real-time responses
        }); try {
            // Get prompt template and format with variables
            const promptTemplate = getPromptTemplate('requirements');
            const formattedPrompt = await promptTemplate.format({
                userInput,
                clarification,
                conversationHistory: conversationHistory || 'No previous conversation'
            });

            // Execute LLM call with streaming
            console.log("🧠 Calling LLM for requirements analysis with streaming...");

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
            const isValid = validateRequirementsOutput(fullResponse);
            if (!isValid) {
                console.warn("⚠️ Requirements response validation failed, retrying...");

                // Implement retry logic
                if ((state.retryCount || 0) < 3) {
                    return {
                        currentAgent: "requirements",
                        retryCount: (state.retryCount || 0) + 1,
                        lastError: {
                            agent: "requirements",
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

            console.log("✅ Requirements agent completed successfully");

            return {
                messages: [new AIMessage(fullResponse)],
                currentAgent: "requirements",
                requirements: fullResponse, // Store requirements for future agents
                aguiEvents: events,
                retryCount: 0 // Reset retry count on success
            };

        } catch (error) {
            console.error("❌ Requirements agent failed:", error);

            // Implement retry logic for errors
            if ((state.retryCount || 0) < 3) {
                const retryEvent = createAGUIEvent("ERROR", state.conversationId, {
                    error: `Attempt ${(state.retryCount || 0) + 1}/3 failed: ${error instanceof Error ? error.message : String(error)}`,
                    retryCount: (state.retryCount || 0) + 1
                });

                return {
                    currentAgent: "requirements",
                    retryCount: (state.retryCount || 0) + 1,
                    lastError: {
                        agent: "requirements",
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: new Date().toISOString()
                    },
                    aguiEvents: [retryEvent]
                };
            }

            // Max retries exceeded - return fallback response
            const fallbackRequirements = `## Application Overview
Basic web application to meet user needs.

## Core Features
- User-friendly interface
- Essential functionality
- Responsive design

## Technical Requirements
- Frontend: React + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- Styling: Responsive design with mobile-first approach
- State Management: React hooks (useState, useEffect)
- Data Storage: localStorage for client-side persistence

## Success Criteria
- Application loads successfully
- Core functionality works as intended
- Responsive design on all devices`;

            return {
                messages: [new AIMessage(fallbackRequirements)],
                currentAgent: "requirements",
                requirements: fallbackRequirements,
                lastError: {
                    agent: "requirements",
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
        console.error("❌ Requirements agent failed:", error);

        // Return error state with fallback message
        const fallbackRequirements = `## Application Overview
Basic web application to meet user needs.

## Core Features
- User interface for primary functionality
- Responsive design for all devices
- Basic interactions and feedback

## Technical Requirements
- Frontend: React + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- Styling: Responsive design with mobile-first approach
- State Management: React hooks (useState, useEffect)
- Data Storage: Local storage for data persistence

## Success Criteria
Application should be functional, responsive, and meet basic user needs.`;

        return {
            messages: [new AIMessage(fallbackRequirements)],
            currentAgent: "requirements",
            requirements: fallbackRequirements,
            lastError: {
                agent: "requirements",
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * Validation logic from existing requirements agent configuration
 */
function validateRequirementsOutput(response: string): boolean {
    // Check if the agent result has a proper response
    return response.length > 200 &&
        response.includes('##') &&
        (response.includes('features') || response.includes('requirements'));
}
