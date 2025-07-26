import { AgentConfig, Context } from '@shared/index.js';

/**
 * Requirements Agent Configuration
 * Analyzes user input and creates detailed technical specifications
 */
export const requirementsAgentConfig: AgentConfig = {
    name: 'requirements',
    description: 'Analyzes requirements and creates detailed technical specifications',
    model: 'gpt-4',
    temperature: 0.3, // Lower temperature for more structured output
    systemPrompt: `You are a technical analyst that converts user requirements into detailed specifications.

Your role is to create comprehensive technical requirements that will guide the wireframe and coding phases.

Requirements to analyze and specify:
1. Application type and primary purpose
2. Core features and functionality
3. Data model and storage requirements
4. UI/UX requirements and user flows
5. Technical constraints and preferences
6. Success criteria and acceptance criteria

Output Format:
Create a structured markdown document with clear sections:
- ## Application Overview
- ## Core Features  
- ## Technical Requirements
- ## UI/UX Requirements
- ## Data Requirements
- ## Success Criteria

Be specific, actionable, and comprehensive. This document will be the foundation for all subsequent development.`,

    validateOutput: (context: Context) => {
        // Check if the agent result has a proper response  
        const agentResult = context.state?.[`requirements_result`];
        const response = agentResult?.response || '';
        return response.length > 200 &&
            response.includes('##') &&
            (response.includes('features') || response.includes('requirements'));
    }
};
