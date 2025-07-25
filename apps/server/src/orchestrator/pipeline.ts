import {
    Context,
    AgUiEventType,
    generateUUID,
    getTimestamp
} from '@shared/index.js';
import { emitEvent } from '../utils/events.js';
import { WebSocket } from 'ws';

/**
 * Mock pipeline for Task 4 - will be replaced with LangGraph in Task 6
 */
interface MockPipeline {
    id: string;
    name: string;
    run: (context: Context, ws: WebSocket) => Promise<Context>;
}

/**
 * Mock implementation of initial app generator pipeline
 */
const mockInitialPipeline: MockPipeline = {
    id: 'initial-app-generator',
    name: 'Initial App Generator',
    
    async run(context: Context, ws: WebSocket): Promise<Context> {
        console.log(`🔄 Running initial pipeline for: ${context.conversationId}`);
        
        // Simulate pipeline steps with events
        
        // Step 1: Clarification
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'clarification', percentage: 25 }
        });
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: 'Thank you for your request! I\'ll help you build your application.' }
        });
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 2: Requirements analysis
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'requirements', percentage: 50 }
        });
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: 'Analyzing your requirements...' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 3: Wireframe generation
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'wireframe', percentage: 75 }
        });
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: 'Creating wireframe...' }
        });
        
        // Mock wireframe HTML
        const mockWireframe = `
            <div style="padding: 20px; border: 2px dashed #ccc; margin: 10px; font-family: Arial;">
                <h2>📋 Application Wireframe</h2>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
                    <h3>Header Section</h3>
                    <p>Navigation menu and app title</p>
                </div>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
                    <h3>Main Content</h3>
                    <p>Primary application features and content</p>
                </div>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
                    <h3>Footer Section</h3>
                    <p>Additional links and information</p>
                </div>
            </div>
        `;
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.RENDER_CONTENT,
            payload: { html: mockWireframe, type: 'wireframe' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 4: Final completion
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'complete', percentage: 100 }
        });
        
        // Update context with results
        return {
            ...context,
            requirements: `User request: ${context.userInput}`,
            wireframe: mockWireframe,
            generatedCode: {
                'index.html': '<html><body><h1>Generated App</h1></body></html>',
                'app.js': 'console.log("Generated application");'
            }
        };
    }
};

/**
 * Mock implementation of modification pipeline
 */
const mockModificationPipeline: MockPipeline = {
    id: 'modification-app-generator',
    name: 'Modification App Generator',
    
    async run(context: Context, ws: WebSocket): Promise<Context> {
        console.log(`🔄 Running modification pipeline for: ${context.conversationId}`);
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'modification', percentage: 50 }
        });
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: 'Modifying your application based on feedback...' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.PROGRESS,
            payload: { stage: 'complete', percentage: 100 }
        });
        
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.TEXT_MESSAGE_CONTENT,
            payload: { text: 'Modifications completed successfully!' }
        });
        
        return {
            ...context,
            generatedCode: {
                ...context.generatedCode,
                'modified.js': `// Modified based on: ${context.userInput}\nconsole.log("Application modified");`
            }
        };
    }
};

/**
 * Selects the appropriate pipeline based on context
 */
export function selectPipeline(context: Context): MockPipeline {
    if (context.isFirstRequest) {
        console.log(`🎯 Selected initial pipeline for conversation: ${context.conversationId}`);
        return mockInitialPipeline;
    } else {
        console.log(`🎯 Selected modification pipeline for conversation: ${context.conversationId}`);
        return mockModificationPipeline;
    }
}

/**
 * Runs the selected pipeline with error handling
 */
export async function runPipeline(context: Context, ws: WebSocket): Promise<Context> {
    try {
        const pipeline = selectPipeline(context);
        console.log(`🚀 Starting pipeline: ${pipeline.name}`);
        
        const updatedContext = await pipeline.run(context, ws);
        
        console.log(`✅ Pipeline completed successfully: ${pipeline.name}`);
        return updatedContext;
        
    } catch (error) {
        console.error('❌ Pipeline execution failed:', error);
        
        // Send error event
        emitEvent(ws, {
            sessionId: context.conversationId,
            type: AgUiEventType.ERROR,
            payload: {
                message: error instanceof Error ? error.message : 'Pipeline execution failed',
                recoverable: true
            }
        });
        
        // Update context with error information
        return {
            ...context,
            lastError: {
                agent: 'pipeline',
                error: error instanceof Error ? error.message : 'Unknown pipeline error',
                timestamp: getTimestamp()
            },
            retryCount: (context.retryCount || 0) + 1
        };
    }
}
