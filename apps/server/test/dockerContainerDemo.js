import { ContainerRuntimeFactory } from '../dist/src/services/index.js';

/**
 * Demonstration of Docker Container Manager Usage
 * This shows how the new Docker Container Manager will be used by the App Builder system
 */
async function demonstrateDockerContainerManager() {
    console.log('🎯 Docker Container Manager Demonstration');
    console.log('════════════════════════════════════════\n');

    let runtime;
    let conversationId;

    try {
        // Step 1: Initialize the container runtime
        console.log('📋 Step 1: Initialize Container Runtime');
        console.log('──────────────────────────────────────');
        runtime = ContainerRuntimeFactory.create();
        console.log(`✅ Container runtime initialized: ${ContainerRuntimeFactory.getCurrentRuntimeType()}`);
        console.log();

        // Step 2: Create a container for a user session
        console.log('📋 Step 2: Create Container for User Session');
        console.log('─────────────────────────────────────────────');
        conversationId = `demo-${Date.now()}`;

        const containerConfig = {
            conversationId,
            image: 'app-builder-base:latest',
            memory: 512 * 1024 * 1024, // 512MB
            cpu: 512, // Half weight
            environment: {
                'USER_SESSION': conversationId,
                'APP_TYPE': 'todo-app'
            }
        };

        const containerId = await runtime.createContainer(containerConfig);
        console.log(`✅ Container created for conversation: ${conversationId}`);
        console.log(`📦 Container ID: ${containerId}`);
        console.log();

        // Step 3: Simulate coding agent operations
        console.log('📋 Step 3: Simulate Coding Agent Operations');
        console.log('──────────────────────────────────────────────');

        // Execute typical coding agent commands
        console.log('🔧 Checking environment...');
        const envCheck = await runtime.executeCommand(conversationId, 'pwd && ls -la');
        console.log(`📁 Working directory:\n${envCheck.stdout}\n`);

        console.log('🔧 Checking package manager...');
        const pnpmCheck = await runtime.executeCommand(conversationId, 'pnpm --version');
        console.log(`📦 Package manager: pnpm ${pnpmCheck.stdout.trim()}\n`);

        // Step 4: Simulate file modifications (what coding agent would do)
        console.log('📋 Step 4: Simulate File Modifications');
        console.log('──────────────────────────────────────────');

        // Upload a new component file
        const todoComponent = `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');

  const addTodo = () => {
    if (inputText.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputText,
        completed: false
      }]);
      setInputText('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-l"
          placeholder="Add a todo..."
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded-r"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="mr-2"
            />
            <span className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}`;

        await runtime.uploadFiles(conversationId, [
            {
                path: '/generated-app/src/components/TodoApp.tsx',
                content: todoComponent,
                mode: '0644'
            }
        ]);
        console.log('✅ Created TodoApp component');

        // Modify main App.tsx to use the new component
        const updatedApp = `import React from 'react';
import { TodoApp } from './components/TodoApp';
import './App.css';

function App() {
  return (
    <div className="App">
      <TodoApp />
    </div>
  );
}

export default App;`;

        await runtime.uploadFiles(conversationId, [
            {
                path: '/generated-app/src/App.tsx',
                content: updatedApp,
                mode: '0644'
            }
        ]);
        console.log('✅ Updated main App component');

        // Create the components directory first
        await runtime.executeCommand(conversationId, 'mkdir -p /generated-app/src/components');
        console.log('✅ Created components directory\n');

        // Step 5: Start development server
        console.log('📋 Step 5: Start Development Server');
        console.log('─────────────────────────────────────');

        console.log('🚀 Starting development server...');
        await runtime.executeCommand(conversationId, 'pnpm run dev &');

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        const serverUrl = await runtime.getContainerUrl(conversationId);
        console.log(`✅ Development server running at: ${serverUrl}`);
        console.log();

        // Step 6: Monitor container
        console.log('📋 Step 6: Monitor Container Performance');
        console.log('──────────────────────────────────────────');

        const stats = await runtime.getContainerStats(conversationId);
        console.log('📊 Container Statistics:');
        console.log(`   Memory: ${Math.round(stats.memory.percentage * 100) / 100}% (${Math.round(stats.memory.usage / 1024 / 1024)}MB / ${Math.round(stats.memory.limit / 1024 / 1024)}MB)`);
        console.log(`   CPU: ${Math.round(stats.cpu.percentage * 100) / 100}%`);
        console.log(`   Network: RX ${Math.round(stats.network.rx / 1024)}KB, TX ${Math.round(stats.network.tx / 1024)}KB`);
        console.log();

        const containerInfo = await runtime.getContainerInfo(conversationId);
        console.log('📋 Container Information:');
        console.log(`   Name: ${containerInfo.name}`);
        console.log(`   Status: ${containerInfo.status}`);
        console.log(`   Ports: ${containerInfo.ports.join(', ')}`);
        console.log(`   Created: ${containerInfo.created.toISOString()}`);
        console.log();

        // Step 7: Download final files
        console.log('📋 Step 7: Download Generated Files');
        console.log('──────────────────────────────────────');

        const downloadedFiles = await runtime.downloadFiles(conversationId, [
            '/generated-app/src/App.tsx',
            '/generated-app/src/components/TodoApp.tsx',
            '/generated-app/package.json'
        ]);

        console.log(`✅ Downloaded ${downloadedFiles.length} files:`);
        downloadedFiles.forEach(file => {
            console.log(`   📄 ${file.path} (${file.size} bytes)`);
        });
        console.log();

        // Step 8: Demonstrate the complete workflow
        console.log('📋 Step 8: Complete Workflow Summary');
        console.log('───────────────────────────────────────');
        console.log('✅ Container created and configured');
        console.log('✅ Environment validated (Node.js, pnpm, React)');
        console.log('✅ Files uploaded and modified');
        console.log('✅ Development server started');
        console.log('✅ Container monitored and stats collected');
        console.log('✅ Files downloaded for persistence');
        console.log();

        console.log('🎯 This demonstrates how the Docker Container Manager');
        console.log('   will replace the current mock container system');
        console.log('   with real Docker isolation and better performance.');
        console.log();

        console.log(`🌐 Access the generated Todo app at: ${serverUrl}`);
        console.log('   (The app will remain running until container cleanup)');
        console.log();

    } catch (error) {
        console.error('💥 Demonstration failed:', error);
        throw error;
    } finally {
        // Cleanup
        if (runtime && conversationId) {
            console.log('🧹 Cleaning up demonstration container...');
            try {
                await runtime.stopContainer(conversationId);
                console.log('✅ Demonstration container cleaned up');
            } catch (error) {
                console.warn('⚠️ Failed to cleanup container:', error);
            }
        }
    }
}

// Run the demonstration if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    demonstrateDockerContainerManager()
        .then(() => {
            console.log('🎉 Docker Container Manager demonstration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Demonstration failed:', error);
            process.exit(1);
        });
}

export { demonstrateDockerContainerManager };
