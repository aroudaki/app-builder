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

        // Create LLM instance with agent-specific configuration
        const llm = createLLMForAgent('requirements', {
            temperature: getAgentTemperature('requirements'),
            streaming: false
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('requirements');
        const formattedPrompt = await promptTemplate.format({
            userInput,
            clarification,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call
        console.log("🧠 Calling LLM for requirements analysis...");
        const response = await llm.invoke(formattedPrompt);
        const responseContent = response.content?.toString() || '';

        // Apply validation logic from existing configuration
        const isValid = validateRequirementsOutput(responseContent);
        if (!isValid) {
            console.warn("⚠️ Requirements response validation failed, but continuing...");
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

        console.log("✅ Requirements agent completed successfully");

        return {
            messages: [new AIMessage(responseContent)],
            currentAgent: "requirements",
            requirements: responseContent, // Store requirements for future agents
            aguiEvents: events
        };

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
