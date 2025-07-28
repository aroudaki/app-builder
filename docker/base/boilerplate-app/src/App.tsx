import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function App() {
    const [count, setCount] = useState(0)

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Welcome to React + TypeScript + Vite
                    </h1>
                    <p className="text-xl text-gray-600">
                        A modern development stack with Tailwind CSS and Shadcn/ui
                    </p>
                </header>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>🚀 Quick Start</CardTitle>
                            <CardDescription>
                                Click the button to get started
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => setCount((count) => count + 1)}>
                                Count is {count}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>⚡ Vite</CardTitle>
                            <CardDescription>
                                Lightning fast build tool
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                Vite provides instant server start, lightning fast HMR, and optimized builds.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>🎨 Tailwind CSS</CardTitle>
                            <CardDescription>
                                Utility-first CSS framework
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                Build modern designs quickly with utility classes and responsive design.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>🔷 TypeScript</CardTitle>
                            <CardDescription>
                                Type-safe JavaScript
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                Catch errors early and improve your development experience with TypeScript.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>🛠️ Ready to Customize</CardTitle>
                            <CardDescription>
                                Start building your app
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                This boilerplate is ready for you to modify and build your custom application.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <footer className="text-center mt-12 text-gray-500">
                    <p>Built with ❤️ using modern React development tools</p>
                </footer>
            </div>
        </div>
    )
}

export default App
