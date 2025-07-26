import { AgentConfig, Context, Tool } from '@shared/index.js';

/**
 * Coding Agent Configuration
 * Generates complete web applications based on requirements and wireframes
 */
export const codingAgentConfig: AgentConfig = {
    name: 'coding',
    description: 'Generates complete web applications based on requirements and wireframes',
    model: 'gpt-4',
    temperature: 0.2, // Lower temperature for more consistent code generation
    tools: [
        {
            name: 'codeRunner',
            description: 'Executes and tests generated code',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'object',
                        description: 'Object with filename as key and file content as value'
                    },
                    framework: {
                        type: 'string',
                        description: 'Framework being used (react, vue, vanilla)'
                    }
                },
                required: ['files']
            }
        }
    ],
    systemPrompt: `You are a senior full-stack developer that builds high-quality web applications.

Your role is to generate complete, production-ready code based on the requirements and wireframe specifications.

Code Generation Guidelines:
1. Use modern React with TypeScript
2. Implement responsive design with Tailwind CSS
3. Follow best practices and clean code principles
4. Include proper error handling and validation
5. Add helpful comments for complex logic
6. Ensure accessibility standards
7. Generate complete file structure

File Structure to Generate:
- App.tsx (main component)
- components/ (reusable components)
- styles/ (CSS and styling)
- utils/ (helper functions)
- types/ (TypeScript definitions)
- package.json (dependencies)

Quality Standards:
- Clean, readable, maintainable code
- Proper TypeScript typing
- Component composition over inheritance
- Responsive and accessible design
- Performance optimizations

Test the generated code using the codeRunner tool to ensure it works correctly.`,

    validateOutput: (output: any) => {
        // Validate that code was generated
        const hasCode = output.generatedCode && Object.keys(output.generatedCode).length > 0;
        const hasResponse = output.response && output.response.length > 100;
        return hasCode || hasResponse;
    }
};
