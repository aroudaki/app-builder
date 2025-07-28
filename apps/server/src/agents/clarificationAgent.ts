import { AgentConfig, Context } from '@shared/index.js';

/**
 * Clarification Agent Configuration
 * Asks clarifying questions about user requirements to better understand the project scope
 */
export const clarificationAgentConfig: AgentConfig = {
    name: 'clarification',
    description: 'Asks clarifying questions about user requests to better understand the project scope',
    model: 'gpt-4',
    temperature: 0.7,
    systemPrompt: `You are a helpful assistant that asks clarifying questions about web application requirements.

Your role is to understand what the user wants to build by asking specific, targeted questions.

Guidelines:
- Ask max 5 specific questions
- Focus on understanding the user request and what they try to build.
- Be concise and professional
- Don't assume user has any technical knowledge. 
- The questions should be to clarify user request and what they want to build.
- Avoid generic questions like "What do you want to build?" - be specific.
- Don't ask about technical details like frameworks, languages, or libraries.
- Help the user think through their requirements.
- You can skip asking questions if the user request is already clear. In that case you can thanks the user for their request and say please click continue to proceed.

Question areas to explore:
1. Application type (form, dashboard, game, e-commerce, etc.)
2. Specific features or constraints.
3. Any ambiguities in the request.

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
