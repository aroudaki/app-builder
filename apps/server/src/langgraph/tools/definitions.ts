import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { AppContainer } from "../../tools/appContainer.js";
import { BrowserAutomation } from "../../tools/browser.js";

/**
 * LangGraph Tool Definitions
 * 
 * This file converts existing tools to LangGraph format with proper Zod schemas
 * for robust tool calling and execution validation.
 */

// Convert AppContainer to LangGraph tool
export const appContainerTool = tool(
    async ({ command, conversationId }: { command: string; conversationId?: string }) => {
        console.log(`🔧 Executing container command: ${command}`);

        try {
            // Use conversationId from parameters or fallback to "default"
            const contextId = conversationId || "default";
            const appContainer = new AppContainer(contextId);

            // Execute the command in the container
            const result = await appContainer.executeCommand(command);

            return JSON.stringify({
                success: result.exitCode === 0,
                output: result.stdout,
                error: result.stderr,
                exitCode: result.exitCode,
                command: command,
                conversationId: contextId,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("❌ App container tool execution failed:", error);
            return JSON.stringify({
                success: false,
                output: "",
                error: error instanceof Error ? error.message : String(error),
                exitCode: 1,
                command: command,
                timestamp: new Date().toISOString()
            });
        }
    },
    {
        name: "app_container",
        description: `Execute bash commands in a Docker container environment for app development.

This tool provides a full Linux-like environment with:
- File operations (ls, cat, touch, mkdir, rm, cp, mv, etc.)
- Text processing (sed, grep, head, tail, wc, etc.)
- Node.js development (npm, pnpm, node, npx commands)
- Process management (ps, kill, background processes)
- Environment variables and shell features

The container starts with a React + TypeScript + Vite + Tailwind boilerplate.

Examples:
- "ls -la" - List files and directories
- "cat src/App.tsx" - Read file contents
- "npm run build" - Build the React application
- "npm run dev" - Start development server
- "touch src/components/NewComponent.tsx" - Create new file
- "sed -i 's/old/new/g' src/App.tsx" - Find and replace in file`,
        schema: z.object({
            command: z.string().describe("The bash command to execute in the container environment"),
            conversationId: z.string().optional().describe("The conversation ID for container context (optional)")
        })
    }
);

// Convert BrowserAutomation to LangGraph tool
export const browserTool = tool(
    async ({ action, url, options, conversationId }: {
        action: string;
        url?: string;
        options?: any;
        conversationId?: string;
    }) => {
        console.log(`🌐 Executing browser action: ${action}`);

        try {
            // Use conversationId from parameters or fallback to "default"
            const contextId = conversationId || "default";
            const browser = new BrowserAutomation(contextId, {
                headless: true,
                viewport: { width: 1280, height: 720 }
            });

            // Initialize browser if not already done
            await browser.initialize();

            let result: any;

            switch (action) {
                case "screenshot":
                    if (url) {
                        await browser.navigateToApp(url);
                    }
                    const screenshot = await browser.takeScreenshot(options || {});
                    result = {
                        success: true,
                        action: "screenshot",
                        size: screenshot.length,
                        format: options?.format || "png"
                    };
                    break;

                case "navigate":
                    if (!url) {
                        throw new Error("URL is required for navigate action");
                    }
                    await browser.navigateToApp(url);
                    result = {
                        success: true,
                        action: "navigate",
                        url: url
                    };
                    break;

                case "test":
                    if (url) {
                        await browser.navigateToApp(url);
                    }
                    const viewport = await browser.captureViewport();
                    const errors = await browser.getConsoleErrors();
                    const performance = await browser.measurePerformance();

                    result = {
                        success: true,
                        action: "test",
                        url: url,
                        elementsFound: viewport.elements.length,
                        consoleErrors: errors.length,
                        performance: {
                            loadTime: performance.loadTime,
                            domContentLoaded: performance.domContentLoaded
                        }
                    };
                    break;

                case "inspect":
                    if (url) {
                        await browser.navigateToApp(url);
                    }
                    const inspectViewport = await browser.captureViewport();
                    result = {
                        success: true,
                        action: "inspect",
                        url: url,
                        elements: inspectViewport.elements.slice(0, 10) // Limit to first 10 elements
                    };
                    break;

                default:
                    throw new Error(`Unknown browser action: ${action}`);
            }

            // Cleanup browser after action
            await browser.cleanup();

            return JSON.stringify({
                ...result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("❌ Browser tool execution failed:", error);
            return JSON.stringify({
                success: false,
                action: action,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    },
    {
        name: "browser_automation",
        description: `Perform browser automation tasks for testing and validation of generated applications.

Available actions:
- "screenshot": Capture screenshot of the current page or specified URL
- "navigate": Navigate to a specific URL
- "test": Comprehensive testing including element detection, console errors, and performance
- "inspect": Inspect page elements and their properties

Examples:
- {"action": "screenshot", "url": "http://localhost:3001"} - Screenshot of dev server
- {"action": "navigate", "url": "http://localhost:3001"} - Navigate to app
- {"action": "test", "url": "http://localhost:3001"} - Full test of running app
- {"action": "inspect", "url": "http://localhost:3001"} - Inspect page elements`,
        schema: z.object({
            action: z.enum(["screenshot", "navigate", "test", "inspect"]).describe("The browser action to perform"),
            url: z.string().optional().describe("The URL to navigate to (optional for some actions)"),
            options: z.any().optional().describe("Additional options for the action (e.g., screenshot format)"),
            conversationId: z.string().optional().describe("The conversation ID for browser context (optional)")
        })
    }
);

// Application completion tool - explicit completion signal
export const appCompletedTool = tool(
    async ({
        buildSuccessful,
        devServerRunning,
        requirementsMet,
        summary
    }: {
        buildSuccessful: boolean;
        devServerRunning: boolean;
        requirementsMet: boolean;
        summary: string;
    }) => {
        console.log("🎯 Validating application completion criteria...");

        // Validate completion criteria
        const isValid = buildSuccessful && devServerRunning && requirementsMet;

        if (!isValid) {
            console.warn("⚠️ Completion criteria not met");
            return JSON.stringify({
                success: false,
                message: "Completion criteria not met. Please ensure build succeeds, dev server runs, and all requirements are implemented.",
                criteria: {
                    buildSuccessful,
                    devServerRunning,
                    requirementsMet
                },
                timestamp: new Date().toISOString()
            });
        }

        console.log("✅ Application development completed successfully!");
        return JSON.stringify({
            success: true,
            message: "Application development completed successfully!",
            summary,
            criteria: {
                buildSuccessful,
                devServerRunning,
                requirementsMet
            },
            timestamp: new Date().toISOString()
        });
    },
    {
        name: "app_completed",
        description: `Signal that application development is complete and validate completion criteria.

This tool should ONLY be called when ALL of the following criteria are met:
1. Build succeeds: 'npm run build' completes without errors
2. Dev server runs: 'npm run dev' starts successfully and serves the app
3. Requirements met: All user requirements have been implemented

The tool validates these criteria and provides clear feedback about completion status.`,
        schema: z.object({
            buildSuccessful: z.boolean().describe("True if 'npm run build' completed successfully without any errors"),
            devServerRunning: z.boolean().describe("True if 'npm run dev' started successfully and is serving the application"),
            requirementsMet: z.boolean().describe("True if all user requirements have been fully implemented"),
            summary: z.string().describe("Brief summary of what was built, key features implemented, and any important notes")
        })
    }
);

// File operations tool for container file management
export const fileOperationsTool = tool(
    async ({ operation, path, content, mode, conversationId }: {
        operation: string;
        path: string;
        content?: string;
        mode?: string;
        conversationId?: string;
    }) => {
        console.log(`📁 Executing file operation: ${operation} on ${path}`);

        try {
            const contextId = conversationId || "default";
            const appContainer = new AppContainer(contextId);

            let result: any;

            switch (operation) {
                case "upload":
                    if (!content) {
                        throw new Error("Content is required for upload operation");
                    }
                    await appContainer.uploadFiles([{
                        path: path,
                        content: content,
                        mode: mode || "0644"
                    }]);
                    result = {
                        success: true,
                        operation: "upload",
                        path: path,
                        size: content.length
                    };
                    break;

                case "download":
                    const downloads = await appContainer.downloadFiles([path]);
                    if (downloads.length === 0) {
                        throw new Error(`File not found: ${path}`);
                    }
                    result = {
                        success: true,
                        operation: "download",
                        path: path,
                        content: downloads[0].content,
                        size: downloads[0].size,
                        modified: downloads[0].modified
                    };
                    break;

                case "read":
                    const readResult = await appContainer.executeCommand(`cat "${path}"`);
                    if (readResult.exitCode !== 0) {
                        throw new Error(`Failed to read file: ${readResult.stderr}`);
                    }
                    result = {
                        success: true,
                        operation: "read",
                        path: path,
                        content: readResult.stdout
                    };
                    break;

                default:
                    throw new Error(`Unknown file operation: ${operation}`);
            }

            return JSON.stringify({
                ...result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("❌ File operation failed:", error);
            return JSON.stringify({
                success: false,
                operation: operation,
                path: path,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    },
    {
        name: "file_operations",
        description: `Perform file operations in the container environment.

Available operations:
- "upload": Upload file content to the container
- "download": Download file content from the container  
- "read": Read file content from the container

This tool is useful for bulk file operations or when you need to work with file content directly.`,
        schema: z.object({
            operation: z.enum(["upload", "download", "read"]).describe("The file operation to perform"),
            path: z.string().describe("The file path in the container"),
            content: z.string().optional().describe("File content for upload operation"),
            mode: z.string().optional().describe("File permissions mode (default: 0644)"),
            conversationId: z.string().optional().describe("The conversation ID for container context (optional)")
        })
    }
);

// Export all tools for ToolNode
export const allTools = [
    appContainerTool,
    browserTool,
    appCompletedTool,
    fileOperationsTool
];
