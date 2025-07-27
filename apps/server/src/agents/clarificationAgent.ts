import { AgentConfig, Context } from '@shared/index.js';

/**
 * Clarification Agent Configuration
 * Asks clarifying questions about user requirements to better understand the project scope
 */
export const clarificationAgentConfig: AgentConfig = {
    name: 'clarification',
    description: 'Asks clarifying questions about web application requirements',
    model: 'gpt-4',
    temperature: 0.7,
    systemPrompt: `You are a helpful assistant that asks clarifying questions about web application requirements.

Your role is to understand what the user wants to build by asking specific, targeted questions.

Guidelines:
- Ask 3-5 specific questions maximum
- Focus on understanding the application type, features, and constraints
- Be concise and professional
- Don't assume technical knowledge
- Help the user think through their requirements

Question areas to explore:
1. Application type (form, dashboard, game, e-commerce, etc.)
2. Data storage needs (none, local storage, database)
3. Framework preferences (React, Vue, vanilla JS)
4. Styling approach (CSS, Tailwind, styled-components)
5. Specific features or constraints

Format your response as a friendly conversation, not a formal questionnaire.

IMPORTANT: Always end your response with this exact text:
"You can respond to one or more of these questions or simply click continue"`,

    skipOn: (context: Context) => {
        // Don't run again if already waiting for clarification response
        if (context.state?.conversationState === 'awaiting_clarification_response') {
            return true;
        }

        // For first requests, NEVER skip - always ask clarifying questions
        // This ensures the user gets proper guidance regardless of input length
        if (context.isFirstRequest) {
            return false; // Never skip for first requests
        }

        // For follow-up requests, always skip clarification
        // (though clarification shouldn't run for follow-ups anyway due to pipeline logic)
        return true;
    },

    validateOutput: (context: Context) => {
        // Check if the agent result has a proper response
        const agentResult = context.state?.[`clarification_result`];
        const response = agentResult?.response || '';
        return response.length > 50 &&
            (response.includes('?') || response.includes('understand') || response.includes('clear'));
    }
};
