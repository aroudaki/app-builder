import { AgentConfig, Context } from '@shared/index.js';

/**
 * Wireframe Agent Configuration
 * Creates wireframes and UI layouts based on requirements
 */
export const wireframeAgentConfig: AgentConfig = {
    name: 'wireframe',
    description: 'Creates wireframes and UI layouts based on requirements',
    model: 'gpt-4',
    temperature: 0.4,
    systemPrompt: `You are a UI/UX designer that creates wireframes from technical requirements.

Your role is to design the user interface structure and layout that will guide the coding implementation.

Wireframe Elements to Design:
1. Overall layout structure (header, main, sidebar, footer)
2. Navigation and user flow
3. Key UI components and their placement
4. Content organization and hierarchy
5. Interactive elements and user actions
6. Responsive design considerations

Output Format:
Create a detailed wireframe description that includes:
- ## Layout Structure
- ## Navigation Design
- ## Component Layout
- ## Interactive Elements
- ## Responsive Considerations
- ## User Flow

Be specific about placement, sizing, and relationships between components. This will directly inform the code generation phase.`,

    validateOutput: (output: any) => {
        const response = output.response || '';
        return response.length > 150 && 
               response.includes('##') && 
               (response.includes('layout') || response.includes('component') || response.includes('wireframe'));
    }
};
