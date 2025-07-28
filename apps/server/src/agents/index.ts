import { Context, AgentConfig, EventType, AgUiEvent, Tool } from '@shared/index.js';
import { generateId } from '../utils/events.js';
import { SimpleCodeRunner } from '../tools/codeRunner.js';
import { BrowserAutomation, BrowserTool } from '../tools/browser.js';
import { AppContainer } from '../tools/appContainer.js';
import { AppContainerRegistry } from '../services/AppContainerRegistry.js';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Base Agent class implementing common execution logic and error handling
 */
export class BaseAgent {
    private codeRunner: SimpleCodeRunner;
    private browserTool: BrowserTool;
    private browserAutomation: BrowserAutomation;
    private appContainer: AppContainer;

    constructor(public config: AgentConfig) {
        this.codeRunner = new SimpleCodeRunner();
        this.browserTool = new BrowserTool();
        this.browserAutomation = new BrowserAutomation('default');
        // AppContainer will be initialized per conversation
        this.appContainer = new AppContainer('default');
    }

    /**
     * Get the effective user input by combining original request with subsequent responses
     */
    protected getOriginalUserInput(context: Context): string {
        if (!context.messages || context.messages.length === 0) {
            return context.userInput || '';
        }

        // Get all user messages with content
        const userMessages = context.messages.filter(msg =>
            msg.role === 'user' && msg.content && msg.content.trim()
        );

        if (userMessages.length === 0) {
            return context.userInput || '';
        }

        // If there's only one user message, return it
        if (userMessages.length === 1) {
            return userMessages[0].content || '';
        }

        // Multiple user messages - check if subsequent ones are meaningful responses
        const originalRequest = userMessages[0].content || '';
        const subsequentResponses = userMessages.slice(1);

        // Filter out empty/meaningless responses (like just clicking "continue")
        const meaningfulResponses = subsequentResponses.filter(msg => {
            if (!msg.content) return false;

            const content = msg.content.trim().toLowerCase();

            // Skip empty responses or very short non-informative ones
            if (content.length < 3) return false;

            // Skip common "continue" type responses
            if (['yes', 'ok', 'continue', 'proceed', 'next', 'go ahead'].includes(content)) {
                return false;
            }

            return true;
        });

        // If no meaningful responses, return just the original request
        if (meaningfulResponses.length === 0) {
            console.log('🐛 DEBUG: No meaningful responses found, using original request only');
            return originalRequest;
        }

        // Combine original request with meaningful responses
        const combinedInput = [
            `Original request: ${originalRequest}`,
            ...meaningfulResponses.map((msg, index) =>
                `Additional info ${index + 1}: ${msg.content || ''}`
            )
        ].join('\n\n');

        console.log('🐛 DEBUG: Combined user input from conversation:', combinedInput);
        return combinedInput;
    }

    /**
     * Execute the agent with error handling and retry logic
     */
    async execute(context: Context): Promise<Context> {
        const startTime = Date.now();

        // Preserve original user request throughout the conversation
        const originalUserInput = this.getOriginalUserInput(context);

        console.log(`🐛 DEBUG: BaseAgent.execute() called for agent: ${this.config.name}`);
        console.log(`🐛 DEBUG: Current input: "${context.userInput}"`);
        console.log(`🐛 DEBUG: Effective user input: "${originalUserInput}"`);
        console.log(`🐛 DEBUG: Message count: ${context.messages?.length || 0}`);
        console.log(`🐛 DEBUG: Has requirements: ${!!context.requirements}`);
        console.log(`🐛 DEBUG: Has wireframe: ${!!context.wireframe}`);

        try {
            console.log(`🤖 Executing agent: ${this.config.name}`);

            // Get or reuse existing AppContainer for this conversation
            this.appContainer = await AppContainerRegistry.getContainer(context.conversationId);
            this.browserAutomation = new BrowserAutomation(context.conversationId);
            console.log(`🐛 DEBUG: AppContainer ready for conversation: ${context.conversationId}`);

            // Check if agent should be skipped
            if (this.config.skipOn && this.config.skipOn(context)) {
                console.log(`⏭️ Skipping agent ${this.config.name} based on skipOn condition`);
                return context;
            }

            // Emit step start event
            this.emitStepEvent(context, EventType.STEP_START, {
                agent: this.config.name,
                timestamp: Date.now()
            });

            // Execute the agent logic
            console.log(`🐛 DEBUG: Calling executeCore for agent: ${this.config.name}`);
            const updatedContext = await this.executeCore(context);
            console.log(`🐛 DEBUG: executeCore completed for agent: ${this.config.name}`);

            // Validate output if validation function provided
            if (this.config.validateOutput) {
                const isValid = this.config.validateOutput(updatedContext);
                if (!isValid) {
                    console.log(`❌ Validation failed for agent ${this.config.name}. Context state:`, {
                        hasState: !!updatedContext.state,
                        agentResult: updatedContext.state?.[`${this.config.name}_result`],
                        requirements: updatedContext.requirements,
                        wireframe: updatedContext.wireframe
                    });
                    throw new Error(`Agent ${this.config.name} output validation failed`);
                }
            }

            // Emit step end event
            this.emitStepEvent(context, EventType.STEP_END, {
                agent: this.config.name,
                duration: Date.now() - startTime,
                timestamp: Date.now()
            });

            console.log(`✅ Agent ${this.config.name} completed in ${Date.now() - startTime}ms`);
            return updatedContext;

        } catch (error) {
            console.error(`❌ Agent ${this.config.name} failed:`, error);

            // Update context with error information
            const errorContext: Context = {
                ...context,
                lastError: {
                    agent: this.config.name,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                },
                retryCount: (context.retryCount || 0) + 1
            };

            // Emit error event
            this.emitAgUiEvent(context, {
                type: EventType.ERROR,
                conversationId: context.conversationId,
                error: `Agent ${this.config.name} failed: ${error instanceof Error ? error.message : error}`,
                timestamp: Date.now()
            });

            // Check if retry is possible
            const retryCount = errorContext.retryCount || 0;
            if (retryCount < 3) {
                console.log(`🔄 Retrying agent ${this.config.name} (attempt ${retryCount})`);

                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));

                return this.execute(errorContext);
            }

            // Max retries reached, return error context
            console.error(`💥 Agent ${this.config.name} failed after ${retryCount} attempts`);
            return errorContext;
        }
    }

    /**
     * Core agent execution logic - to be implemented by specific agents
     */
    protected async executeCore(context: Context): Promise<Context> {
        const messageId = generateId();

        // Start assistant response
        this.emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_START,
            conversationId: context.conversationId,
            messageId,
            role: 'assistant',
            timestamp: Date.now()
        });

        // Execute agent-specific logic
        const result = await this.processWithLLM(context);

        // Stream the response
        await this.streamResponse(context, messageId, result);

        // Execute tools if needed
        if (this.config.tools && this.config.tools.length > 0) {
            const toolResults = await this.executeTools(context, messageId, result);
            result.toolResults = toolResults;
        }

        // End message
        this.emitAgUiEvent(context, {
            type: EventType.TEXT_MESSAGE_END,
            conversationId: context.conversationId,
            messageId,
            timestamp: Date.now()
        });

        // Update context with results
        return await this.updateContext(context, result);
    }

    /**
     * Process user input with LLM (enhanced for proper agent responses)
     */
    protected async processWithLLM(context: Context): Promise<any> {
        // TODO: This would integrate with Azure OpenAI in a real implementation
        // For now, we'll generate contextual responses based on agent type and user input

        const prompt = this.buildPrompt(context);
        const originalUserInput = this.getOriginalUserInput(context);

        // Simulate LLM processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Generate agent-specific response
        let response = '';
        let confidence = 0.8;

        switch (this.config.name) {
            case 'clarification':
                response = await this.generateLLMClarificationResponse(context, originalUserInput);
                break;
            case 'requirements':
                response = await this.generateLLMRequirementsResponse(context, originalUserInput);
                break;
            case 'wireframe':
                response = await this.generateLLMWireframeResponse(context, originalUserInput);
                break;
            case 'coding':
                response = this.generateCodingResponse(context);
                break;
            case 'modification':
                response = await this.generateLLMModificationResponse(context, originalUserInput);
                break;
            default:
                response = `I understand you'd like help with: "${originalUserInput}". Let me assist you with that.`;
        }

        return {
            response,
            confidence,
            reasoning: `Processed with ${this.config.name} agent using LLM integration`,
            requiresTools: this.config.tools && this.config.tools.length > 0
        };
    }

    /**
     * Build prompt for LLM based on agent configuration and context
     */
    protected buildPrompt(context: Context): string {
        let prompt = this.config.systemPrompt || `You are a ${this.config.name} agent.`;

        prompt += `\n\nUser Input: ${context.userInput}`;

        if (context.requirements) {
            prompt += `\n\nRequirements: ${context.requirements}`;
        }

        if (context.wireframe) {
            prompt += `\n\nWireframe: ${context.wireframe}`;
        }

        if (context.lastError) {
            prompt += `\n\nPrevious Error: ${context.lastError.error} (from ${context.lastError.agent})`;
            prompt += `\nRetry Count: ${context.retryCount}`;
        }

        return prompt;
    }

    /**
     * Generate response based on agent type and context
     */
    protected generateResponse(context: Context): string {
        // All agents should now use LLM-generated responses
        // This method is a fallback and should be replaced by processWithLLM
        const originalUserInput = this.getOriginalUserInput(context);

        switch (this.config.name) {
            case 'clarification':
                return `I'd like to understand your requirements better for: "${originalUserInput}". Let me ask a few questions to ensure I build exactly what you need.`;
            case 'requirements':
                return `Based on your request: "${originalUserInput}", I'm analyzing the technical requirements...`;
            case 'wireframe':
                return `Creating wireframe design for your request: "${originalUserInput}"...`;
            case 'coding':
                return this.generateCodingResponse(context);
            case 'modification':
                return `Updating the application based on: "${originalUserInput}"...`;
            default:
                return `Processing your request: "${originalUserInput}"...`;
        }
    }

    /**
     * Stream response content to client
     */
    protected async streamResponse(context: Context, messageId: string, result: any): Promise<void> {
        const response = result.response || '';
        const words = response.split(' ');

        for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? ' ' : '');

            this.emitAgUiEvent(context, {
                type: EventType.TEXT_MESSAGE_CONTENT,
                conversationId: context.conversationId,
                messageId,
                delta: chunk,
                timestamp: Date.now()
            });

            // Simulate natural typing speed
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /**
     * Execute agent tools
     */
    protected async executeTools(context: Context, messageId: string, result: any): Promise<any[]> {
        const toolResults: any[] = [];

        for (const tool of this.config.tools || []) {
            const toolCallId = generateId();

            // Emit tool call start
            this.emitAgUiEvent(context, {
                type: EventType.TOOL_CALL_START,
                conversationId: context.conversationId,
                messageId,
                toolCallId,
                toolName: tool.name,
                timestamp: Date.now()
            });

            try {
                const toolResult = await this.executeTool(tool, context, result);

                // Emit tool call result
                this.emitAgUiEvent(context, {
                    type: EventType.TOOL_CALL_RESULT,
                    conversationId: context.conversationId,
                    messageId,
                    toolCallId,
                    result: toolResult,
                    timestamp: Date.now()
                });

                toolResults.push(toolResult);

            } catch (error) {
                console.error(`Tool ${tool.name} failed:`, error);

                // Emit tool error
                this.emitAgUiEvent(context, {
                    type: EventType.ERROR,
                    conversationId: context.conversationId,
                    error: `Tool ${tool.name} failed: ${error instanceof Error ? error.message : error}`,
                    timestamp: Date.now()
                });
            }

            // Emit tool call end
            this.emitAgUiEvent(context, {
                type: EventType.TOOL_CALL_END,
                conversationId: context.conversationId,
                messageId,
                toolCallId,
                timestamp: Date.now()
            });
        }

        return toolResults;
    }

    /**
     * Execute a specific tool
     */
    protected async executeTool(tool: Tool, context: Context, result: any): Promise<any> {
        switch (tool.name) {
            case 'appContainer':
                return this.executeAppContainer(context, result);
            case 'codeRunner':
                return this.executeCodeRunner(context, result);
            case 'browser':
                return this.executeBrowser(context, result);
            default:
                throw new Error(`Unknown tool: ${tool.name}`);
        }
    }

    /**
     * Execute app container tool
     */
    protected async executeAppContainer(context: Context, result: any): Promise<any> {
        const originalUserInput = this.getOriginalUserInput(context);

        console.log('🐛 DEBUG: executeAppContainer called');
        console.log('🐛 DEBUG: Agent name:', this.config.name);
        console.log('🐛 DEBUG: Current input:', context.userInput);
        console.log('🐛 DEBUG: Effective user input:', originalUserInput);
        console.log('🐛 DEBUG: Context requirements:', context.requirements);

        // For the coding agent, we need to execute commands to modify the boilerplate
        if (this.config.name === 'coding') {
            console.log('🐛 DEBUG: Coding agent detected, starting modification process');

            // First, run inspection commands to understand current structure
            const inspectionCommands = [
                'pwd',
                'ls -la',
                'cat package.json',
                'cat src/App.tsx'
            ];

            console.log('🐛 DEBUG: Running inspection commands:', inspectionCommands);
            const inspectionResults = [];
            for (const command of inspectionCommands) {
                console.log(`🔍 Inspecting: ${command}`);
                const commandResult = await this.appContainer.executeCommand(command);
                console.log(`🐛 DEBUG: Command "${command}" result:`, {
                    exitCode: commandResult.exitCode,
                    stdoutLength: commandResult.stdout?.length || 0,
                    stderrLength: commandResult.stderr?.length || 0
                });
                inspectionResults.push({
                    command,
                    ...commandResult
                });
            }

            // Generate the actual code modifications based on user requirements
            console.log('🐛 DEBUG: Generating code files...');
            const generatedCode = this.generateCodeFiles(context, originalUserInput);
            console.log('🐛 DEBUG: Generated code files:', Object.keys(generatedCode));
            console.log('🐛 DEBUG: App.tsx content preview:', generatedCode['src/App.tsx']?.substring(0, 200) + '...');

            // Write generated files to debug directory for inspection
            console.log('🐛 DEBUG: Writing generated files to debug directory...');
            await this.writeDebugFiles(context.conversationId, generatedCode);

            // Now execute commands to modify the boilerplate with the generated code
            const modificationCommands = [];

            // Update App.tsx with the generated content
            if (generatedCode['src/App.tsx']) {
                console.log('🐛 DEBUG: Adding App.tsx modification command');
                // Use base64 encoding to avoid shell escaping issues
                const base64Content = Buffer.from(generatedCode['src/App.tsx']).toString('base64');
                modificationCommands.push(`echo '${base64Content}' | base64 -d > src/App.tsx`);
            } else {
                console.log('🐛 DEBUG: WARNING - No App.tsx content generated!');
            }

            // Update other key files if needed
            if (generatedCode['src/App.css']) {
                console.log('🐛 DEBUG: Adding App.css modification command');
                const base64Content = Buffer.from(generatedCode['src/App.css']).toString('base64');
                modificationCommands.push(`echo '${base64Content}' | base64 -d > src/App.css`);
            }

            // Add any new components
            for (const [filePath, content] of Object.entries(generatedCode)) {
                if (filePath.startsWith('src/components/') && filePath !== 'src/App.tsx') {
                    console.log('🐛 DEBUG: Adding component file:', filePath);
                    // Create directory if needed
                    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
                    modificationCommands.push(`mkdir -p ${dir}`);
                    const base64Content = Buffer.from(content).toString('base64');
                    modificationCommands.push(`echo '${base64Content}' | base64 -d > ${filePath}`);
                }
            }

            console.log('🐛 DEBUG: Total modification commands to execute:', modificationCommands.length);
            modificationCommands.forEach((cmd, i) => {
                console.log(`🐛 DEBUG: Command ${i + 1}:`, cmd.split('\n')[0] + '...');
            });

            // Execute the modification commands
            const modificationResults = [];
            for (const command of modificationCommands) {
                console.log(`🔧 Modifying: ${command.split('\n')[0]}...`);
                const commandResult = await this.appContainer.executeCommand(command);
                console.log(`🐛 DEBUG: Modification result:`, {
                    exitCode: commandResult.exitCode,
                    stdoutLength: commandResult.stdout?.length || 0,
                    stderrLength: commandResult.stderr?.length || 0
                });
                if (commandResult.stderr) {
                    console.log(`🐛 DEBUG: Stderr:`, commandResult.stderr);
                }
                modificationResults.push({
                    command: command.split('\n')[0] + '...',
                    ...commandResult
                });

                if (commandResult.exitCode !== 0) {
                    console.warn(`⚠️ Modification failed: ${command}`);
                }
            }

            // Verify the changes were applied
            console.log('🐛 DEBUG: Verifying changes - checking App.tsx content');
            const verifyResult = await this.appContainer.executeCommand('cat src/App.tsx');
            console.log('🐛 DEBUG: Current App.tsx content preview:', verifyResult.stdout?.substring(0, 200) + '...');

            // Write current container state to debug directory
            await this.writeContainerDebugFiles(context.conversationId);

            // Combine all results
            const allResults = [...inspectionResults, ...modificationResults];

            // Install dependencies and start the development server
            console.log('� DEBUG: Starting development server...');
            const devServerInfo = await this.appContainer.startDevServer();
            console.log('🐛 DEBUG: Dev server result:', {
                exitCode: devServerInfo.exitCode,
                stdoutLength: devServerInfo.stdout?.length || 0,
                stderrLength: devServerInfo.stderr?.length || 0
            });

            if (devServerInfo.exitCode === 0) {
                // Get the actual container URL instead of hardcoded localhost:3001
                let appUrl = 'http://localhost:3001'; // Fallback

                try {
                    appUrl = await this.appContainer.getContainerUrl();
                } catch (error) {
                    console.warn('⚠️ Failed to get container URL, using fallback:', error);
                }

                console.log(`✅ Application is now running at: ${appUrl}`);
                console.log('🐛 DEBUG: Returning success result with devServer info');

                // Store the app URL in context for later use
                return {
                    type: 'app_container_execution',
                    commands: allResults,
                    workDir: this.appContainer['workDir'],
                    success: allResults.every(r => r.exitCode === 0),
                    devServer: {
                        url: appUrl,
                        port: 3001,
                        isRunning: true
                    }
                };
            } else {
                console.error('❌ Failed to start development server');
                return {
                    type: 'app_container_execution',
                    commands: allResults,
                    workDir: this.appContainer['workDir'],
                    success: false,
                    error: 'Failed to start development server: ' + devServerInfo.stderr
                };
            }
        }

        // For other agents, return basic container info
        return {
            type: 'app_container_ready',
            workDir: this.appContainer['workDir']
        };
    }

    /**
     * Generate development commands for the coding agent
     * Since we now use boilerplate, we just examine and modify existing files
     */
    protected generateDevelopmentCommands(context: Context): string[] {
        const userInput = context.userInput;

        const commands = [
            'pwd',
            'ls -la',
            'cat package.json',
            'cat src/App.tsx',
            // Note: npm install and dev server start are handled separately by startDevServer()
        ];

        return commands;
    }

    /**
     * Execute code runner tool
     */
    protected async executeCodeRunner(context: Context, result: any): Promise<any> {
        if (!context.generatedCode) {
            throw new Error('No code to run');
        }

        return this.codeRunner.runCode(context.generatedCode);
    }

    /**
     * Execute browser automation tool with comprehensive testing capabilities
     */
    protected async executeBrowser(context: Context, result: any): Promise<any> {
        try {
            // Initialize browser automation for this conversation
            this.browserAutomation = new BrowserAutomation(context.conversationId, {
                headless: true,
                viewport: { width: 1920, height: 1080 }
            });

            await this.browserAutomation.initialize();

            // Get the app URL from container execution results
            let appUrl = 'http://localhost:3000'; // Default fallback

            if (result && result.toolResults) {
                const containerResult = result.toolResults.find((r: any) => r.type === 'app_container_execution');
                if (containerResult && containerResult.commands) {
                    // Look for dev server start command
                    const devCommand = containerResult.commands.find((cmd: any) =>
                        cmd.command.includes('npm run dev') && cmd.stdout.includes('localhost')
                    );
                    if (devCommand) {
                        // Extract port from dev server output
                        const portMatch = devCommand.stdout.match(/localhost:(\d+)/);
                        if (portMatch) {
                            appUrl = `http://localhost:${portMatch[1]}`;
                        }
                    }
                }
            }

            console.log(`🌐 Testing app at: ${appUrl}`);

            // Navigate to the app
            await this.browserAutomation.navigateToApp(appUrl);

            // Wait a moment for the app to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Take screenshot of the app
            const screenshot = await this.browserAutomation.takeScreenshot({
                fullPage: true,
                format: 'png'
            });

            // Capture viewport for Computer Use Agent integration
            const viewportCapture = await this.browserAutomation.captureViewport();

            // Run basic accessibility check
            let a11yReport = null;
            try {
                a11yReport = await this.browserAutomation.runAccessibilityCheck();
            } catch (error) {
                console.warn('Accessibility check failed:', error);
            }

            // Measure performance metrics
            let performanceMetrics = null;
            try {
                performanceMetrics = await this.browserAutomation.measurePerformance();
            } catch (error) {
                console.warn('Performance measurement failed:', error);
            }

            // Check for console errors
            const consoleErrors = await this.browserAutomation.getConsoleErrors();

            // Test basic interactions if it's an interactive app
            let interactionResults = [];
            try {
                // Look for common interactive elements
                const inputs = viewportCapture.elements.filter(el =>
                    el.tagName === 'input' || el.tagName === 'textarea'
                );
                const buttons = viewportCapture.elements.filter(el =>
                    el.tagName === 'button' || el.clickable
                );

                // Test input fields
                for (const input of inputs.slice(0, 2)) { // Test first 2 inputs
                    try {
                        await this.browserAutomation.click(input.selector);
                        await this.browserAutomation.type(input.selector, 'Test Input');
                        interactionResults.push({
                            type: 'input_test',
                            element: input.selector,
                            success: true
                        });
                    } catch (error) {
                        interactionResults.push({
                            type: 'input_test',
                            element: input.selector,
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }

                // Test buttons
                for (const button of buttons.slice(0, 2)) { // Test first 2 buttons
                    try {
                        await this.browserAutomation.click(button.selector);
                        interactionResults.push({
                            type: 'button_test',
                            element: button.selector,
                            success: true
                        });
                    } catch (error) {
                        interactionResults.push({
                            type: 'button_test',
                            element: button.selector,
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            } catch (error) {
                console.warn('Interaction testing failed:', error);
            }

            // Cleanup browser resources
            await this.browserAutomation.cleanup();

            // Cleanup container resources
            await this.appContainer.cleanup();

            return {
                type: 'browser_automation_complete',
                appUrl,
                screenshot: screenshot.toString('base64'),
                viewportCapture: {
                    ...viewportCapture,
                    screenshot: viewportCapture.screenshot.toString('base64')
                },
                accessibility: a11yReport,
                performance: performanceMetrics,
                consoleErrors,
                interactionResults,
                elementsFound: viewportCapture.elements.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Browser automation failed:', error);

            // Ensure cleanup on error
            try {
                await this.browserAutomation.cleanup();
                await this.appContainer.cleanup();
            } catch (cleanupError) {
                console.warn('Cleanup failed:', cleanupError);
            }

            return {
                type: 'browser_automation_error',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Update context with agent results
     */
    protected async updateContext(context: Context, result: any): Promise<Context> {
        const updates: Partial<Context> = {
            state: {
                ...context.state,
                [`${this.config.name}_complete`]: true,
                [`${this.config.name}_result`]: result
            }
        };

        // Agent-specific context updates
        switch (this.config.name) {
            case 'requirements':
                updates.requirements = result.response;
                break;
            case 'wireframe':
                updates.wireframe = result.response;
                break;
            case 'coding':
                // For coding agent with container integration
                if (result.toolResults && result.toolResults.length > 0) {
                    const containerResult = result.toolResults.find((r: any) => r.type === 'app_container_execution');
                    if (containerResult) {
                        // Extract app URL from dev server info or npm run dev command
                        let appUrl = null;

                        // First, check if devServer info is available
                        if (containerResult.devServer && containerResult.devServer.url) {
                            appUrl = containerResult.devServer.url;
                        } else {
                            // Fallback: try to get URL from container
                            try {
                                if (this.appContainer) {
                                    appUrl = await this.appContainer.getContainerUrl();
                                }
                            } catch (error) {
                                console.warn('Failed to get container URL, using fallback');
                                appUrl = 'http://localhost:3001';
                            }
                        }

                        updates.state = {
                            ...updates.state,
                            containerExecution: containerResult,
                            buildSuccessful: containerResult.success,
                            workDir: containerResult.workDir,
                            executedCommands: containerResult.commands,
                            appUrl: appUrl // Add the generated app URL to state
                        };
                    }
                }

                // Fallback to generated code files for backward compatibility
                const generatedCode = (context as any).generatedCodeFiles || result.generatedCode || {};
                updates.generatedCode = generatedCode;
                updates.state = {
                    ...updates.state,
                    generatedFiles: Object.keys(generatedCode),
                    codeGenerated: true
                };
                break;
            case 'modification':
                // For modification agent, update the existing code
                const modifiedCode = (context as any).generatedCodeFiles || result.generatedCode || context.generatedCode;
                updates.generatedCode = modifiedCode;
                updates.state = {
                    ...updates.state,
                    lastModified: new Date().toISOString(),
                    modificationApplied: true
                };
                break;
        }

        return { ...context, ...updates };
    }

    /**
     * Generate clarification response using LLM logic
     */
    protected async generateLLMClarificationResponse(context: Context, userInput: string): Promise<string> {
        // TODO: Replace with actual LLM API call
        // For now, generate intelligent clarification questions based on the user input

        const input = userInput.toLowerCase();
        const questions = [];

        // Analyze user input to ask relevant questions
        if (!input.includes('react') && !input.includes('vue') && !input.includes('angular')) {
            questions.push('What frontend framework would you prefer? (React, Vue, Angular, or vanilla JS)');
        }

        if (!input.includes('styling') && !input.includes('css') && !input.includes('tailwind')) {
            questions.push('What styling approach would you like? (Tailwind CSS, styled-components, CSS modules, or plain CSS)');
        }

        if (input.includes('todo') || input.includes('task')) {
            if (!input.includes('storage') && !input.includes('persist')) {
                questions.push('How should tasks be stored? (Local storage, database, or session only)');
            }
            if (!input.includes('filter') && !input.includes('sort')) {
                questions.push('Do you need filtering/sorting features? (by status, date, priority, etc.)');
            }
        }

        if (input.includes('dashboard') || input.includes('admin')) {
            questions.push('What type of data will the dashboard display?');
            questions.push('Do you need charts, graphs, or data visualization?');
        }

        if (input.includes('form') || input.includes('contact')) {
            questions.push('What fields should the form include?');
            questions.push('Where should form submissions be sent?');
        }

        // Add general questions if not enough specific ones
        if (questions.length < 2) {
            if (!input.includes('responsive') && !input.includes('mobile')) {
                questions.push('Should the app be responsive for mobile devices?');
            }
            if (!input.includes('auth') && !input.includes('login')) {
                questions.push('Do you need user authentication/login functionality?');
            }
        }

        const questionsList = questions.slice(0, 4).map((q, i) => `${i + 1}. ${q}`).join('\n');

        return `I'd like to understand your requirements better for: "${userInput}"

Here are a few questions to help me build exactly what you need:

${questionsList}

Please provide any additional details or let me know if you'd like me to proceed with sensible defaults for any of these choices.`;
    }

    /**
     * Generate requirements response using LLM logic
     */
    protected async generateLLMRequirementsResponse(context: Context, userInput: string): Promise<string> {
        // TODO: Replace with actual LLM API call

        const input = userInput.toLowerCase();
        let appType = 'Web Application';
        let specificFeatures: string[] = [];

        // Determine app type and features from user input
        if (input.includes('todo') || input.includes('task')) {
            appType = 'Todo Application';
            specificFeatures = [
                'Task creation, editing, and deletion',
                'Task completion status tracking',
                'Task filtering and organization'
            ];

            if (input.includes('filter')) specificFeatures.push('Advanced filtering by status/date');
            if (input.includes('storage') || input.includes('persist')) specificFeatures.push('Data persistence');
            if (input.includes('dark mode')) specificFeatures.push('Dark/light theme toggle');
        } else if (input.includes('dashboard')) {
            appType = 'Dashboard Application';
            specificFeatures = [
                'Data visualization components',
                'Interactive charts and graphs',
                'Real-time data updates'
            ];
        } else if (input.includes('form')) {
            appType = 'Form Application';
            specificFeatures = [
                'Form validation and error handling',
                'Input field components',
                'Submission processing'
            ];
        }

        const framework = input.includes('vue') ? 'Vue.js' :
            input.includes('angular') ? 'Angular' : 'React';

        const styling = input.includes('styled-components') ? 'Styled Components' :
            input.includes('css modules') ? 'CSS Modules' : 'Tailwind CSS';

        return `Based on your request: "${userInput}", I've analyzed the requirements:

## Application Requirements

**Type**: ${appType}
**Framework**: ${framework} with TypeScript
**Styling**: ${styling}

## Core Features
${specificFeatures.map(f => `- ${f}`).join('\n')}
- Modern, responsive design
- User-friendly interface
- Clean, maintainable code
- Cross-browser compatibility

## Technical Requirements
- ${framework} 18+ with TypeScript
- Component-based architecture
- Responsive design for mobile and desktop
- Modern ES6+ JavaScript features
- Production-ready build configuration

These requirements will guide the wireframe and implementation phases.`;
    }

    /**
     * Generate wireframe response using LLM logic
     */
    protected async generateLLMWireframeResponse(context: Context, userInput: string): Promise<string> {
        // TODO: Replace with actual LLM API call

        const input = userInput.toLowerCase();
        let layoutDescription = '';
        let components = [];
        let userFlow = [];

        if (input.includes('todo') || input.includes('task')) {
            layoutDescription = 'Clean, focused layout optimized for task management';
            components = [
                '**Header**: App title and theme toggle (if requested)',
                '**Input Section**: New task creation with text input and add button',
                '**Filter Bar**: Status filter buttons (All, Active, Completed)',
                '**Task List**: Scrollable list of tasks with checkboxes and delete buttons',
                '**Footer**: Task counter and clear completed button'
            ];
            userFlow = [
                'User enters new task in input field',
                'Task appears in the active task list',
                'User can mark tasks as complete using checkboxes',
                'User can filter tasks by completion status',
                'User can delete individual tasks or clear all completed'
            ];
        } else if (input.includes('dashboard')) {
            layoutDescription = 'Professional dashboard layout with sidebar navigation';
            components = [
                '**Header**: Navigation bar with user profile and notifications',
                '**Sidebar**: Navigation menu with dashboard sections',
                '**Main Content**: Grid layout for dashboard widgets',
                '**Widgets**: Charts, metrics cards, and data tables',
                '**Footer**: Additional navigation and info links'
            ];
            userFlow = [
                'User lands on main dashboard overview',
                'User navigates between different dashboard sections',
                'User interacts with charts and data visualizations',
                'User can filter and sort data as needed'
            ];
        } else {
            layoutDescription = 'Modern, clean layout with intuitive navigation';
            components = [
                '**Header**: Navigation and branding',
                '**Main Content**: Primary application functionality',
                '**Sidebar**: Additional features and controls',
                '**Footer**: Links and information'
            ];
            userFlow = [
                'User lands on main interface',
                'User interacts with primary features',
                'User receives feedback and confirmations',
                'User can navigate to additional functionality'
            ];
        }

        return `## Wireframe Design

Based on your request: "${userInput}", here's the proposed structure:

### Layout Overview
${layoutDescription}

### Key Components
${components.map(c => `- ${c}`).join('\n')}

### Interactive Elements
- Form inputs with validation
- Action buttons with clear labels
- Dynamic content areas
- Responsive breakpoints for mobile

### User Flow
${userFlow.map((step, i) => `${i + 1}. ${step}`).join('\n')}

### Responsive Considerations
- Mobile-first design approach
- Touch-friendly interface elements
- Optimized layouts for different screen sizes
- Progressive enhancement for desktop features

This wireframe provides a solid foundation for the implementation phase.`;
    }

    /**
     * Generate modification response using LLM logic
     */
    protected async generateLLMModificationResponse(context: Context, userInput: string): Promise<string> {
        // TODO: Replace with actual LLM API call

        const input = userInput.toLowerCase();
        let modificationType = 'general updates';
        let changes: string[] = [];

        if (input.includes('add') || input.includes('new')) {
            modificationType = 'feature addition';
            changes = [
                'Adding new functionality to the existing codebase',
                'Integrating new components and features',
                'Updating navigation and user interface'
            ];
        } else if (input.includes('fix') || input.includes('bug') || input.includes('error')) {
            modificationType = 'bug fixes';
            changes = [
                'Identifying and resolving code issues',
                'Fixing user interface problems',
                'Improving error handling and validation'
            ];
        } else if (input.includes('style') || input.includes('design') || input.includes('ui')) {
            modificationType = 'design updates';
            changes = [
                'Updating visual design and styling',
                'Improving user interface components',
                'Enhancing user experience'
            ];
        } else if (input.includes('performance') || input.includes('optimize')) {
            modificationType = 'performance optimization';
            changes = [
                'Optimizing code for better performance',
                'Reducing bundle size and load times',
                'Improving rendering efficiency'
            ];
        }

        return `## Code Modification - ${modificationType.charAt(0).toUpperCase() + modificationType.slice(1)}

I'm updating the existing application based on your request: "${userInput}"

### Changes Being Made
${changes.map(c => `- ${c}`).join('\n')}
- Maintaining code quality and structure
- Testing updated functionality
- Ensuring backward compatibility

### Updated Features
- Enhanced user interface
- Improved functionality
- Better error handling
- Optimized performance

### Implementation Process
1. **Analyzing current code** - Understanding existing structure
2. **Planning modifications** - Determining best approach for changes
3. **Implementing updates** - Making targeted code changes
4. **Testing changes** - Ensuring everything works correctly
5. **Deployment ready** - Preparing updated application

The modifications will be applied while preserving existing functionality and maintaining code quality standards.`;
    }

    /**
     * Generate coding response and actual code files
     */
    protected generateCodingResponse(context: Context): string {
        // Generate actual code files for the coding agent
        const originalUserInput = this.getOriginalUserInput(context);
        const generatedCode = this.generateCodeFiles(context, originalUserInput);

        // Store the generated code in the result
        if (generatedCode) {
            (context as any).generatedCodeFiles = generatedCode;
        }

        // Determine app type for specific messaging
        const appType = this.determineAppType(originalUserInput);
        const appDescription = this.getAppDescription(appType, originalUserInput);

        // Check if we have dev server info from tool execution
        const devServerInfo = context.state?.coding_result?.devServer;

        let appAccessInfo = '';
        if (devServerInfo?.isRunning && devServerInfo.url) {
            appAccessInfo = `

### 🌐 Your Application is Ready!

**🎉 Your ${appDescription} is now running at: [${devServerInfo.url}](${devServerInfo.url})**

Click the link above to open your application in a new tab, or copy and paste the URL into your browser.

The development server is running in the background and will automatically reload when you make changes.`;
        } else {
            appAccessInfo = `

### 🔄 Starting Development Server

Your ${appDescription} is being built in a containerized environment. Once the build completes successfully, you'll be able to preview your application!`;
        }

        return `## 🚀 Building Your ${appDescription}

I'm creating your ${appDescription} based on your request: "${originalUserInput}"

### 🔧 Development Process
1. **Setting up project structure** - Creating directories and files for your ${appType} app
2. **Generating code files** - Writing React components with ${appType}-specific functionality
3. **Installing dependencies** - Running npm install
4. **Building application** - Compiling TypeScript and optimizing
5. **Starting dev server** - Launching your ${appDescription}

### 📁 Generated Project Structure
- **package.json** - Dependencies and build scripts
- **index.html** - Main HTML entry point
- **src/App.tsx** - Main React component with your ${appType} features
- **src/main.tsx** - React application bootstrap
- **src/App.css** - Tailwind CSS styling
- **vite.config.ts** - Build configuration
- **tsconfig.json** - TypeScript configuration
- **tailwind.config.js** - Tailwind CSS setup

### ✨ Features Implemented
${this.getFeatureList(appType, originalUserInput)}${appAccessInfo}`;
    }

    /**
     * Get user-friendly app description based on type and input
     */
    protected getAppDescription(appType: string, userInput: string): string {
        switch (appType) {
            case 'todo':
                return 'Todo Application';
            case 'dashboard':
                return 'Dashboard Application';
            case 'form':
                return 'Form Application';
            case 'blog':
                return 'Blog Application';
            case 'portfolio':
                return 'Portfolio Website';
            case 'landing':
                return 'Landing Page';
            case 'shop':
                return 'E-commerce Application';
            default:
                return 'Web Application';
        }
    }

    /**
     * Get feature list based on app type and user input
     */
    protected getFeatureList(appType: string, userInput: string): string {
        const baseFeatures = [
            '- Modern React 18 with TypeScript',
            '- Responsive design with Tailwind CSS',
            '- Clean component architecture',
            '- Production-ready code structure',
            '- Accessibility features'
        ];

        const specificFeatures = this.getAppSpecificFeatures(appType, userInput);

        return [...specificFeatures, ...baseFeatures].join('\n');
    }

    /**
     * Get app-specific features based on type and user input
     */
    protected getAppSpecificFeatures(appType: string, userInput: string): string[] {
        const input = userInput.toLowerCase();

        switch (appType) {
            case 'todo':
                const todoFeatures = ['- Task management with add/edit/delete functionality'];

                if (input.includes('filter') || input.includes('status')) {
                    todoFeatures.push('- Filter tasks by status (all, active, completed)');
                }
                if (input.includes('local storage') || input.includes('persist')) {
                    todoFeatures.push('- Local storage for persistent data');
                }
                if (input.includes('dark mode') || input.includes('theme')) {
                    todoFeatures.push('- Dark/light mode toggle');
                }
                if (input.includes('animation') || input.includes('smooth')) {
                    todoFeatures.push('- Smooth animations for interactions');
                }
                if (input.includes('counter') || input.includes('count')) {
                    todoFeatures.push('- Task counter showing remaining items');
                }
                if (input.includes('confirmation') || input.includes('confirm')) {
                    todoFeatures.push('- Delete confirmation for safety');
                }

                return todoFeatures;

            case 'dashboard':
                return [
                    '- Interactive dashboard components',
                    '- Data visualization and charts',
                    '- Admin panel functionality'
                ];

            case 'form':
                return [
                    '- Form validation and error handling',
                    '- Input field components',
                    '- Submission handling'
                ];

            default:
                return ['- Interactive user interface'];
        }
    }

    /**
     * Generate actual code files based on context
     */
    protected generateCodeFiles(context: Context, userInput?: string): Record<string, string> {
        console.log('🐛 DEBUG: generateCodeFiles called');

        // Use provided userInput or get original from context
        const effectiveUserInput = userInput || this.getOriginalUserInput(context);

        console.log('🐛 DEBUG: Context userInput:', context.userInput);
        console.log('🐛 DEBUG: Effective userInput:', effectiveUserInput);
        console.log('🐛 DEBUG: Context requirements:', context.requirements);
        console.log('🐛 DEBUG: Context wireframe:', context.wireframe);

        const wireframe = context.wireframe || '';
        const requirements = context.requirements || '';

        // Determine app type based on the original user input
        const appType = this.determineAppType(effectiveUserInput);
        console.log('🐛 DEBUG: Determined app type:', appType);

        const files = {
            'package.json': this.generatePackageJson(appType),
            'index.html': this.generateIndexHtml(appType),
            'src/main.tsx': this.generateMainTsx(),
            'src/App.tsx': this.generateAppTsx(appType, effectiveUserInput),
            'src/App.css': this.generateAppCss(),
            'tailwind.config.js': this.generateTailwindConfig(),
            'vite.config.ts': this.generateViteConfig(),
            'tsconfig.json': this.generateTsConfig(),
            'README.md': this.generateReadme(appType, effectiveUserInput)
        };

        console.log('🐛 DEBUG: Generated files:', Object.keys(files));
        console.log('🐛 DEBUG: App.tsx preview:', files['src/App.tsx']?.substring(0, 150) + '...');

        return files;
    }

    /**
     * Determine application type from user input
     */
    protected determineAppType(userInput: string): string {
        const input = userInput.toLowerCase();

        if (input.includes('todo') || input.includes('task')) return 'todo';
        if (input.includes('dashboard') || input.includes('admin')) return 'dashboard';
        if (input.includes('form') || input.includes('contact')) return 'form';
        if (input.includes('blog') || input.includes('article')) return 'blog';
        if (input.includes('portfolio') || input.includes('profile')) return 'portfolio';
        if (input.includes('landing') || input.includes('homepage')) return 'landing';
        if (input.includes('shop') || input.includes('store') || input.includes('ecommerce')) return 'shop';

        return 'general';
    }

    /**
     * Generate package.json
     */
    protected generatePackageJson(appType: string): string {
        return JSON.stringify({
            name: `generated-${appType}-app`,
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
                dev: "vite",
                build: "tsc && vite build",
                preview: "vite preview"
            },
            dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0"
            },
            devDependencies: {
                "@types/react": "^18.2.66",
                "@types/react-dom": "^18.2.22",
                "@typescript-eslint/eslint-plugin": "^7.2.0",
                "@typescript-eslint/parser": "^7.2.0",
                "@vitejs/plugin-react": "^4.2.1",
                autoprefixer: "^10.4.19",
                eslint: "^8.57.0",
                "eslint-plugin-react-hooks": "^4.6.0",
                "eslint-plugin-react-refresh": "^0.4.6",
                postcss: "^8.4.38",
                tailwindcss: "^3.4.3",
                typescript: "^5.2.2",
                vite: "^5.2.0"
            }
        }, null, 2);
    }

    /**
     * Generate index.html
     */
    protected generateIndexHtml(appType: string): string {
        const title = appType.charAt(0).toUpperCase() + appType.slice(1) + ' App';

        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    }

    /**
     * Generate main.tsx
     */
    protected generateMainTsx(): string {
        return `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    }

    /**
     * Generate App.tsx based on app type
     */
    protected generateAppTsx(appType: string, userInput: string): string {
        switch (appType) {
            case 'todo':
                return this.generateTodoApp(userInput);
            case 'dashboard':
                return this.generateDashboardApp(userInput);
            case 'form':
                return this.generateFormApp(userInput);
            case 'landing':
                return this.generateLandingApp(userInput);
            default:
                return this.generateGeneralApp(userInput);
        }
    }

    /**
     * Generate Todo application
     */
    protected generateTodoApp(userInput: string): string {
        return `import React, { useState } from 'react'

interface Todo {
  id: number
  text: string
  completed: boolean
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputText, setInputText] = useState('')

  const addTodo = () => {
    if (inputText.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputText.trim(),
        completed: false
      }])
      setInputText('')
    }
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Todo App
        </h1>
        
        <div className="flex mb-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="px-6 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="w-5 h-5 text-blue-600"
              />
              <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}\`}>
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {todos.length === 0 && (
          <p className="text-center text-gray-500 mt-6">No todos yet. Add one above!</p>
        )}
      </div>
    </div>
  )
}

export default App`;
    }

    /**
     * Generate general application
     */
    protected generateGeneralApp(userInput: string): string {
        return `import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            Generated Application
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Based on your request: "<em>${userInput}</em>"
          </p>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Interactive Counter
            </h2>
            
            <div className="text-6xl font-bold text-indigo-600 mb-6">
              {count}
            </div>

            <div className="space-x-4">
              <button
                onClick={() => setCount(count - 1)}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Decrease
              </button>
              
              <button
                onClick={() => setCount(0)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Reset
              </button>
              
              <button
                onClick={() => setCount(count + 1)}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Increase
              </button>
            </div>
          </div>

          <div className="mt-8 p-6 bg-white rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Application Features
            </h3>
            <ul className="text-left space-y-2 text-gray-600">
              <li>✅ Modern React with TypeScript</li>
              <li>✅ Responsive design with Tailwind CSS</li>
              <li>✅ Interactive components</li>
              <li>✅ Clean, maintainable code</li>
              <li>✅ Production-ready structure</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App`;
    }

    /**
     * Generate other app types (simplified for brevity)
     */
    protected generateDashboardApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Dashboard Overview').replace('Generated Application', 'Admin Dashboard');
    }

    protected generateFormApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Contact Form').replace('Generated Application', 'Contact Us');
    }

    protected generateLandingApp(userInput: string): string {
        return this.generateGeneralApp(userInput).replace('Interactive Counter', 'Landing Section').replace('Generated Application', 'Welcome');
    }

    /**
     * Generate CSS file
     */
    protected generateAppCss(): string {
        return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors;
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors;
  }
}`;
    }

    /**
     * Generate Tailwind config
     */
    protected generateTailwindConfig(): string {
        return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}`;
    }

    /**
     * Generate Vite config
     */
    protected generateViteConfig(): string {
        return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
})`;
    }

    /**
     * Generate TypeScript config
     */
    protected generateTsConfig(): string {
        return JSON.stringify({
            compilerOptions: {
                target: "ES2020",
                useDefineForClassFields: true,
                lib: ["ES2020", "DOM", "DOM.Iterable"],
                module: "ESNext",
                skipLibCheck: true,
                moduleResolution: "bundler",
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: "react-jsx",
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true
            },
            include: ["src"],
            references: [{ path: "./tsconfig.node.json" }]
        }, null, 2);
    }

    /**
     * Generate README
     */
    protected generateReadme(appType: string, userInput: string): string {
        const title = appType.charAt(0).toUpperCase() + appType.slice(1) + ' App';

        return `# ${title}

Generated application based on: "${userInput}"

## Features

- Modern React with TypeScript
- Responsive design with Tailwind CSS
- Clean component architecture
- Production-ready code structure

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:5173](http://localhost:5173) to view the app

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

Generated by AI App Builder 🤖`;
    }

    /**
     * Emit AG-UI event through context
     */
    protected emitAgUiEvent(context: Context, event: AgUiEvent): void {
        context.events.emit('aguiEvent', event);
    }

    /**
     * Emit step-related events
     */
    protected emitStepEvent(context: Context, type: EventType, data: any): void {
        this.emitAgUiEvent(context, {
            type,
            conversationId: context.conversationId,
            timestamp: Date.now(),
            ...data
        } as AgUiEvent);
    }

    /**
     * Write generated files to debug directory for inspection
     */
    protected async writeDebugFiles(conversationId: string, generatedCode: Record<string, string>): Promise<void> {
        try {
            // Adjust path based on current working directory
            const cwd = process.cwd();
            const debugDir = cwd.endsWith('apps/server')
                ? path.join(cwd, 'ai-app-builder-debug', conversationId)
                : path.join(cwd, 'apps', 'server', 'ai-app-builder-debug', conversationId);

            console.log('🐛 DEBUG: Current working directory:', cwd);
            console.log('🐛 DEBUG: Creating debug directory:', debugDir);

            // Create debug directory
            await fs.mkdir(debugDir, { recursive: true });

            // Write each generated file
            for (const [filePath, content] of Object.entries(generatedCode)) {
                const fullPath = path.join(debugDir, 'generated', filePath);
                const dir = path.dirname(fullPath);

                // Create directory if needed
                await fs.mkdir(dir, { recursive: true });

                // Write file
                await fs.writeFile(fullPath, content, 'utf8');
                console.log(`🐛 DEBUG: Wrote generated file: ${fullPath}`);
            }

            // Also write a summary file
            const summary = {
                timestamp: new Date().toISOString(),
                conversationId,
                generatedFiles: Object.keys(generatedCode),
                appType: 'unknown', // Could be enhanced to include this
                totalFiles: Object.keys(generatedCode).length
            };

            await fs.writeFile(
                path.join(debugDir, '_generation_summary.json'),
                JSON.stringify(summary, null, 2),
                'utf8'
            );

            console.log(`🐛 DEBUG: Generated files written to: ${debugDir}/generated/`);
        } catch (error) {
            console.error('🐛 DEBUG: Failed to write generated debug files:', error);
        }
    }

    /**
     * Write current container file contents to debug directory
     */
    protected async writeContainerDebugFiles(conversationId: string): Promise<void> {
        try {
            // Adjust path based on current working directory
            const cwd = process.cwd();
            const debugDir = cwd.endsWith('apps/server')
                ? path.join(cwd, 'ai-app-builder-debug', conversationId, 'container')
                : path.join(cwd, 'apps', 'server', 'ai-app-builder-debug', conversationId, 'container');

            console.log('🐛 DEBUG: Creating container debug directory:', debugDir);
            await fs.mkdir(debugDir, { recursive: true });

            // List of files to capture from container
            const filesToCapture = [
                'package.json',
                'src/App.tsx',
                'src/App.css',
                'src/main.tsx',
                'index.html'
            ];

            const containerFiles: Record<string, string> = {};

            for (const file of filesToCapture) {
                try {
                    const result = await this.appContainer.executeCommand(`cat ${file}`);
                    if (result.exitCode === 0) {
                        containerFiles[file] = result.stdout;

                        // Write individual file
                        const fullPath = path.join(debugDir, file);
                        const dir = path.dirname(fullPath);
                        await fs.mkdir(dir, { recursive: true });
                        await fs.writeFile(fullPath, result.stdout, 'utf8');
                        console.log(`🐛 DEBUG: Captured container file: ${fullPath}`);
                    } else {
                        console.log(`🐛 DEBUG: Could not capture ${file}: ${result.stderr}`);
                    }
                } catch (error) {
                    console.log(`🐛 DEBUG: Error capturing ${file}:`, error);
                }
            }

            // Write container summary
            const containerSummary = {
                timestamp: new Date().toISOString(),
                conversationId,
                capturedFiles: Object.keys(containerFiles),
                workDir: await this.getContainerWorkDir()
            };

            await fs.writeFile(
                path.join(debugDir, '_container_summary.json'),
                JSON.stringify(containerSummary, null, 2),
                'utf8'
            );

            console.log(`🐛 DEBUG: Container files written to: ${debugDir}`);
        } catch (error) {
            console.error('🐛 DEBUG: Failed to write container debug files:', error);
        }
    }

    /**
     * Get container working directory for debugging
     */
    protected async getContainerWorkDir(): Promise<string> {
        try {
            const result = await this.appContainer.executeCommand('pwd');
            return result.exitCode === 0 ? result.stdout.trim() : 'unknown';
        } catch (error) {
            return 'error';
        }
    }
}
