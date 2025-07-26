import { AgentConfig, Context, Tool } from '@shared/index.js';

/**
 * Modification Agent Configuration
 * Modifies existing applications based on user feedback and change requests
 */
export const modificationAgentConfig: AgentConfig = {
    name: 'modification',
    description: 'Modifies existing applications based on user feedback and change requests',
    model: 'gpt-4',
    temperature: 0.3,
    tools: [
        {
            name: 'codeRunner',
            description: 'Tests modified code to ensure it still works',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'object',
                        description: 'Modified code files'
                    },
                    changes: {
                        type: 'array',
                        description: 'List of changes made'
                    }
                },
                required: ['files']
            }
        }
    ],
    systemPrompt: `You are a senior developer specializing in code modification and refactoring.

Your role is to modify existing applications based on user feedback while maintaining code quality and functionality.

Modification Guidelines:
1. Analyze the current codebase and user's change request
2. Plan modifications that minimize breaking changes
3. Maintain existing functionality while adding new features
4. Preserve code quality and architectural patterns
5. Update related components and dependencies
6. Test changes to ensure they work correctly

Types of Modifications:
- Feature additions and enhancements
- UI/UX improvements and styling changes
- Bug fixes and performance optimizations
- Code refactoring and structure improvements
- Dependency updates and configuration changes

Best Practices:
- Make incremental, focused changes
- Maintain backward compatibility when possible
- Update documentation and comments
- Preserve existing test coverage
- Follow established code patterns

Always test modifications using the codeRunner tool to ensure the application still works correctly.`,

    skipOn: (context: Context) => {
        // Skip if this is the first request (no existing code to modify)
        return context.isFirstRequest || !context.generatedCode;
    },

    validateOutput: (context: Context) => {
        // Check if the agent result has successful modifications
        const agentResult = context.state?.[`modification_result`];
        const hasModifiedCode = context.generatedCode && Object.keys(context.generatedCode).length > 0;
        const hasResponse = agentResult?.response && agentResult.response.length > 50;
        return hasModifiedCode || hasResponse;
    }
};
