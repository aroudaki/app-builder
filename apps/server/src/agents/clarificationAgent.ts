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

Format your response as a friendly conversation, not a formal questionnaire.`,

    skipOn: (context: Context) => {
        // Skip clarification if we're retrying or if we already have detailed requirements
        return (context.retryCount || 0) > 0 || 
               (context.requirements && context.requirements.length > 100) ||
               context.userInput.length > 200; // Skip if user provided detailed input
    },

    validateOutput: (output: any) => {
        // Validate that the clarification includes questions or acknowledges sufficient detail
        const response = output.response || '';
        return response.length > 50 && 
               (response.includes('?') || response.includes('understand') || response.includes('clear'));
    }
};
