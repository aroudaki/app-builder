import { useState, useEffect } from 'react'
import './App.css'

interface AppState {
    isConnected: boolean;
    currentStep: string;
    progress: number;
    logs: string[];
}

function App() {
    const [state, setState] = useState<AppState>({
        isConnected: false,
        currentStep: 'Initializing...',
        progress: 0,
        logs: []
    });

    useEffect(() => {
        // WebSocket connection will be implemented in future tasks
        setState(prev => ({
            ...prev,
            currentStep: 'Ready for development',
            progress: 100
        }));
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="container mx-auto px-4 py-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-primary mb-2">
                        AI App Generator
                    </h1>
                    <p className="text-muted-foreground">
                        Generate web applications through natural language interactions
                    </p>
                </header>

                <main className="space-y-6">
                    <div className="bg-card p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold mb-4">Status</h2>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span>Connection: {state.isConnected ? 'Connected' : 'Disconnected'}</span>
                            </div>
                            <div>Current Step: {state.currentStep}</div>
                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${state.progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <h3 className="font-semibold mb-2">1. Start the Development Server</h3>
                                <code className="text-sm bg-background p-2 rounded block">
                                    npm run dev
                                </code>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <h3 className="font-semibold mb-2">2. Connect to Backend</h3>
                                <p className="text-sm text-muted-foreground">
                                    The client will automatically connect to the backend server running on port 3000
                                </p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <h3 className="font-semibold mb-2">3. Start Building</h3>
                                <p className="text-sm text-muted-foreground">
                                    Use the AG-UI interface to interact with AI agents and generate your application
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default App
