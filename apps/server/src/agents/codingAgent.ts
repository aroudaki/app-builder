import { AgentConfig, Context, Tool } from '@shared/index.js';

/**
 * Coding Agent Configuration
 * Generates complete web applications using Linux-like terminal commands
 */
export const codingAgentConfig: AgentConfig = {
    name: 'coding',
    description: 'Generates complete web applications using a Linux-like development environment',
    model: 'gpt-4',
    temperature: 0.2, // Lower temperature for more consistent code generation
    tools: [
        {
            name: 'appContainer',
            description: 'Execute bash commands in a Linux-like container environment. You can use all standard bash commands like ls, cd, cat, echo, mkdir, npm, node, etc.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The bash command to execute (e.g., "pwd", "ls -la", "cat package.json", "echo content > file.tsx", "npm install", "npm run build")'
                    }
                },
                required: ['command']
            }
        }
    ],
    systemPrompt: `You are a senior full-stack developer that builds web applications using a Linux terminal.

You have access to a full Linux-like environment through the appContainer tool where you can execute ANY bash command.

Your Development Workflow:
1. Check current directory: pwd
2. List existing files: ls -la
3. Create project structure: mkdir -p src/components src/utils
4. Write files using echo or cat with heredoc syntax
5. Install dependencies: npm install
6. Build the application: npm run build
7. Fix any errors by reading files and editing them
8. Start development server: npm run dev
9. Continue iterating until you have a working app

Available Commands (use them naturally):
- File Operations: ls, cd, pwd, cat, echo, touch, mkdir, rm, cp, mv
- Text Processing: sed, grep, head, tail, wc
- Node.js: npm install, npm run build, npm run dev, npm test, node, npx
- Process Management: ps, kill
- Environment: env, export

File Writing Examples:
\`\`\`bash
# Write a TypeScript file
cat > src/App.tsx << 'EOF'
import React from 'react'
// Your code here
EOF

# Write package.json
echo '{
  "name": "my-app",
  "dependencies": {
    "react": "^18.0.0"
  }
}' > package.json

# Append to a file
echo "export default App;" >> src/App.tsx
\`\`\`

Error Handling Strategy:
- If npm install fails, read error and install missing packages
- If build fails, read the error output with cat/grep
- Use sed to fix file content: sed -i 's/old/new/g' filename
- Continue iteration until build succeeds
- Never give up on errors - analyze and fix them

Code Quality Standards:
- Modern React with TypeScript
- Tailwind CSS for styling
- Responsive design
- Clean, readable code
- Proper error handling
- Accessible components

Generate a COMPLETE working application that meets all requirements.
Always test by building and running the app until it works perfectly.`,

    validateOutput: (output: any) => {
        // Validate that the agent executed commands and got results
        const hasCommands = output.toolCalls && output.toolCalls.length > 0;
        const hasSuccessfulBuild = output.response &&
            (output.response.includes('build successful') ||
                output.response.includes('dev server') ||
                output.response.includes('compiled successfully'));
        return hasCommands || hasSuccessfulBuild;
    }
};
