import { Context, EventType, AgUiEvent, RunAgentInput } from '@shared/index.js';
import { generateId } from '../utils/events';

/**
 * Select pipeline based on user input and context
 */
export function selectPipeline(context: Context): Pipeline {
  const userInput = context.userInput.toLowerCase();
  
  if (userInput.includes('wireframe') || userInput.includes('layout') || userInput.includes('design')) {
    return wireframePipeline;
  }
  
  if (userInput.includes('code') || userInput.includes('implement') || userInput.includes('build')) {
    return codePipeline;
  }
  
  return defaultPipeline;
}

/**
 * Pipeline interface
 */
interface Pipeline {
  name: string;
  run: (context: Context) => Promise<Context>;
}

/**
 * Wireframe generation pipeline
 */
const wireframePipeline: Pipeline = {
  name: 'wireframe',
  run: async (context: Context) => {
    const messageId = generateId();
    
    // Start assistant response
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_START,
      conversationId: context.conversationId,
      messageId,
      role: 'assistant',
      timestamp: Date.now()
    });
    
    // Stream wireframe analysis
    const analysis = "I'll analyze your requirements and create a wireframe for your application.";
    for (const chunk of analysis.split(' ')) {
      emitAgUiEvent(context, {
        type: EventType.TEXT_MESSAGE_CONTENT,
        conversationId: context.conversationId,
        messageId,
        delta: chunk + ' ',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Generate wireframe content
    const wireframeContent = generateWireframeContent(context.userInput);
    
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_CONTENT,
      conversationId: context.conversationId,
      messageId,
      delta: `\n\n${wireframeContent}`,
      timestamp: Date.now()
    });
    
    // End message
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_END,
      conversationId: context.conversationId,
      messageId,
      timestamp: Date.now()
    });
    
    // Update context
    return {
      ...context,
      wireframe: wireframeContent,
      state: {
        ...context.state,
        wireframe: wireframeContent,
        stage: 'wireframe_complete'
      }
    };
  }
};

/**
 * Code generation pipeline
 */
const codePipeline: Pipeline = {
  name: 'code',
  run: async (context: Context) => {
    const messageId = generateId();
    
    // Start assistant response
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_START,
      conversationId: context.conversationId,
      messageId,
      role: 'assistant',
      timestamp: Date.now()
    });
    
    // Stream code generation progress
    const steps = [
      "Analyzing requirements...",
      "Generating React components...", 
      "Adding TypeScript types...",
      "Implementing event handlers...",
      "Finalizing code structure..."
    ];
    
    for (const step of steps) {
      emitAgUiEvent(context, {
        type: EventType.TEXT_MESSAGE_CONTENT,
        conversationId: context.conversationId,
        messageId,
        delta: step + '\n',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Tool call for code generation
    const toolCallId = generateId();
    emitAgUiEvent(context, {
      type: EventType.TOOL_CALL_START,
      conversationId: context.conversationId,
      messageId,
      toolCallId,
      toolName: 'codeGenerator',
      timestamp: Date.now()
    });
    
    const generatedCode = generateCodeContent(context);
    
    emitAgUiEvent(context, {
      type: EventType.TOOL_CALL_ARGS,
      conversationId: context.conversationId,
      messageId,
      toolCallId,
      args: { 
        requirements: context.userInput,
        wireframe: context.wireframe,
        framework: 'react'
      },
      timestamp: Date.now()
    });
    
    emitAgUiEvent(context, {
      type: EventType.TOOL_CALL_RESULT,
      conversationId: context.conversationId,
      messageId,
      toolCallId,
      result: generatedCode,
      timestamp: Date.now()
    });
    
    emitAgUiEvent(context, {
      type: EventType.TOOL_CALL_END,
      conversationId: context.conversationId,
      messageId,
      toolCallId,
      timestamp: Date.now()
    });
    
    // End message
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_END,
      conversationId: context.conversationId,
      messageId,
      timestamp: Date.now()
    });
    
    // Update context
    return {
      ...context,
      generatedCode,
      state: {
        ...context.state,
        generatedCode,
        stage: 'code_complete'
      }
    };
  }
};

/**
 * Default response pipeline
 */
const defaultPipeline: Pipeline = {
  name: 'default',
  run: async (context: Context) => {
    const messageId = generateId();
    
    // Start assistant response
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_START,
      conversationId: context.conversationId,
      messageId,
      role: 'assistant',
      timestamp: Date.now()
    });
    
    // Generate response
    const response = generateDefaultResponse(context.userInput);
    
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_CONTENT,
      conversationId: context.conversationId,
      messageId,
      delta: response,
      timestamp: Date.now()
    });
    
    // End message
    emitAgUiEvent(context, {
      type: EventType.TEXT_MESSAGE_END,
      conversationId: context.conversationId,
      messageId,
      timestamp: Date.now()
    });
    
    return context;
  }
};

/**
 * Emit AG-UI event through context
 */
function emitAgUiEvent(context: Context, event: AgUiEvent): void {
  context.events.emit('aguiEvent', event);
}

/**
 * Generate wireframe content
 */
function generateWireframeContent(userInput: string): string {
  return `
## Wireframe Structure

Based on your request: "${userInput}"

### Layout Components
- Header with navigation
- Main content area  
- Sidebar for additional features
- Footer with links

### Interactive Elements
- Form inputs for user data
- Buttons for actions
- Dynamic content areas
- Responsive design breakpoints

This wireframe provides the foundation for your application structure.
  `.trim();
}

/**
 * Generate code content
 */
function generateCodeContent(context: Context): Record<string, string> {
  return {
    'App.tsx': `
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Generated App</h1>
      </header>
      <main className="app-main">
        <p>Your app based on: ${context.userInput}</p>
      </main>
    </div>
  );
}

export default App;
    `.trim(),
    
    'App.css': `
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  text-align: center;
}

.app-main {
  flex: 1;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
    `.trim()
  };
}

/**
 * Generate default response
 */
function generateDefaultResponse(userInput: string): string {
  return `I understand you'd like help with: "${userInput}". 

I can help you create wireframes and generate code for web applications. Here are some things you can ask me:

- "Create a wireframe for a todo app"
- "Generate code for a dashboard interface" 
- "Build a contact form component"

What would you like to build today?`;
}
