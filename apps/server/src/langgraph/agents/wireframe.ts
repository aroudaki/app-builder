/**
 * Wireframe Agent - LangGraph Implementation
 * 
 * Creates wireframes and UI layouts based on requirements.
 * This agent designs the user interface structure that guides coding implementation.
 */

import { AIMessage } from "@langchain/core/messages";
import { createLLMForAgent } from "../llm.js";
import { getPromptTemplate, getAgentTemperature } from "../prompts.js";
import { AppBuilderStateType, createAGUIEvent, generateId } from "../state.js";

/**
 * Wireframe Agent Node Function
 * 
 * @param state - Current LangGraph state
 * @returns Partial state update with detailed wireframe design
 */
export async function wireframeAgent(
    state: AppBuilderStateType
): Promise<Partial<AppBuilderStateType>> {
    console.log("🤖 Executing Wireframe Agent");

    try {
        // Get requirements from previous agent
        const requirements = state.requirements || 'No requirements available';

        // Build conversation history for context
        const conversationHistory = state.messages
            .map(msg => `${msg._getType()}: ${msg.content}`)
            .join('\n');

        // Create LLM instance with agent-specific configuration
        const llm = createLLMForAgent('wireframe', {
            temperature: getAgentTemperature('wireframe'),
            streaming: false
        });

        // Get prompt template and format with variables
        const promptTemplate = getPromptTemplate('wireframe');
        const formattedPrompt = await promptTemplate.format({
            requirements,
            conversationHistory: conversationHistory || 'No previous conversation'
        });

        // Execute LLM call
        console.log("🧠 Calling LLM for wireframe design...");
        const response = await llm.invoke(formattedPrompt);
        const responseContent = response.content?.toString() || '';

        // Apply validation logic from existing configuration
        const isValid = validateWireframeOutput(responseContent);
        if (!isValid) {
            console.warn("⚠️ Wireframe response validation failed, but continuing...");
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

        console.log("✅ Wireframe agent completed successfully");

        return {
            messages: [new AIMessage(responseContent)],
            currentAgent: "wireframe",
            wireframe: responseContent, // Store wireframe for coding agent
            aguiEvents: events
        };

    } catch (error) {
        console.error("❌ Wireframe agent failed:", error);

        // Return error state with fallback wireframe
        const fallbackWireframe = `## Layout Structure
Simple, clean layout with header, main content area, and optional footer.

## Component Layout
- Header: Navigation and branding
- Main: Primary content and functionality
- Cards: Use Shadcn/ui Card components for content organization
- Buttons: Use Shadcn/ui Button components for interactions

## Interactive Elements
- Form inputs with proper validation
- Buttons for primary actions
- Navigation between sections

## Responsive Considerations
- Mobile-first design approach
- Responsive grid layout
- Touch-friendly interaction elements

## Shadcn/ui Components
- Button: For primary and secondary actions
- Card: For content organization
- Input: For form fields
- Typography: Consistent text styling`;

        return {
            messages: [new AIMessage(fallbackWireframe)],
            currentAgent: "wireframe",
            wireframe: fallbackWireframe,
            lastError: {
                agent: "wireframe",
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * Validation logic from existing wireframe agent configuration
 */
function validateWireframeOutput(response: string): boolean {
    // Check if the agent result has a proper response
    return response.length > 150 &&
        response.includes('##') &&
        (response.includes('layout') || response.includes('component') || response.includes('wireframe'));
}
