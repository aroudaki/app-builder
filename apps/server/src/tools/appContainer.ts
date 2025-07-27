import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import * as net from 'net';

/**
 * Helper function to safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Command result interface for Linux-like command execution
 */
export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration?: number;
}

/**
 * File information for directory listings
 */
export interface FileInfo {
    name: string;
    size: number;
    isDirectory: boolean;
    permissions: string;
    modified: Date;
}

/**
 * Process information for running processes
 */
export interface ProcessInfo {
    pid: number;
    name: string;
    command: string;
    startTime: Date;
    status: 'running' | 'stopped' | 'error';
}

/**
 * Command parsing result
 */
interface ParsedCommand {
    command: string;
    args: string[];
    flags: string[];
    redirect?: {
        type: '>' | '>>' | '<' | '|';
        target: string;
    };
    pipes?: string[];
}

/**
 * App Container Tool - Provides a Linux-like terminal environment for generated applications
 * 
 * This tool simulates a container environment where the coding agent can execute
 * bash commands as if working in a real Linux terminal. It supports file operations,
 * process management, and all common shell commands needed for development.
 */
export class AppContainer {
    private workDir: string;
    private processes: Map<string, ChildProcess> = new Map();
    private currentDir: string = '/app';
    private environment: Map<string, string> = new Map();
    private commandHistory: string[] = [];
    private events: EventEmitter = new EventEmitter();

    constructor(private conversationId: string) {
        // Create isolated workspace for this conversation
        this.workDir = path.join(os.tmpdir(), 'app-builder', this.conversationId);
        this.initializeEnvironment();
    }

    /**
     * Initialize the container environment with boilerplate React app
     */
    private async initializeEnvironment(): Promise<void> {
        // Ensure workspace directory exists
        await fs.mkdir(this.workDir, { recursive: true });

        // Set up default environment variables
        this.environment.set('PWD', this.currentDir);
        this.environment.set('HOME', '/app');
        this.environment.set('USER', 'developer');
        this.environment.set('SHELL', '/bin/bash');
        this.environment.set('PATH', '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin');
        this.environment.set('NODE_ENV', 'development');

        // Create initial directory structure
        await fs.mkdir(this.toRealPath('/app'), { recursive: true });

        // Create boilerplate React app
        await this.createBoilerplateApp();

        console.log(`🐳 Container initialized for conversation: ${this.conversationId}`);
        console.log(`📁 Workspace: ${this.workDir}`);
        console.log(`🚀 Boilerplate React app created and ready for modifications`);
    }

    /**
     * Create a boilerplate React app with TypeScript, Vite, Tailwind, and Shadcn
     */
    private async createBoilerplateApp(): Promise<void> {
        const appPath = this.toRealPath('/app');

        // Create directory structure
        await fs.mkdir(path.join(appPath, 'src', 'components', 'ui'), { recursive: true });
        await fs.mkdir(path.join(appPath, 'src', 'lib'), { recursive: true });
        await fs.mkdir(path.join(appPath, 'public'), { recursive: true });

        // Create package.json
        await fs.writeFile(path.join(appPath, 'package.json'), JSON.stringify({
            "name": "react-app",
            "private": true,
            "version": "0.0.0",
            "type": "module",
            "scripts": {
                "dev": "vite",
                "build": "tsc && vite build",
                "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
                "preview": "vite preview"
            },
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "class-variance-authority": "^0.7.0",
                "clsx": "^2.0.0",
                "lucide-react": "^0.294.0",
                "tailwind-merge": "^2.0.0"
            },
            "devDependencies": {
                "@types/react": "^18.2.43",
                "@types/react-dom": "^18.2.17",
                "@typescript-eslint/eslint-plugin": "^6.14.0",
                "@typescript-eslint/parser": "^6.14.0",
                "@vitejs/plugin-react": "^4.2.1",
                "autoprefixer": "^10.4.16",
                "eslint": "^8.55.0",
                "eslint-plugin-react-hooks": "^4.6.0",
                "eslint-plugin-react-refresh": "^0.4.5",
                "postcss": "^8.4.32",
                "tailwindcss": "^3.3.6",
                "typescript": "^5.2.2",
                "vite": "^5.0.8"
            }
        }, null, 2));

        // Create index.html
        await fs.writeFile(path.join(appPath, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

        // Create vite.config.ts - use port 3001 to avoid conflicts with main app
        await fs.writeFile(path.join(appPath, 'vite.config.ts'), `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external access
    port: 3001, // Use a different port to avoid conflicts
    strictPort: false, // Allow automatic port selection if busy
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})`);

        // Create tsconfig.json
        await fs.writeFile(path.join(appPath, 'tsconfig.json'), JSON.stringify({
            "compilerOptions": {
                "target": "ES2020",
                "useDefineForClassFields": true,
                "lib": ["ES2020", "DOM", "DOM.Iterable"],
                "module": "ESNext",
                "skipLibCheck": true,
                "moduleResolution": "bundler",
                "allowImportingTsExtensions": true,
                "resolveJsonModule": true,
                "isolatedModules": true,
                "noEmit": true,
                "jsx": "react-jsx",
                "strict": true,
                "noUnusedLocals": true,
                "noUnusedParameters": true,
                "noFallthroughCasesInSwitch": true,
                "baseUrl": ".",
                "paths": {
                    "@/*": ["./src/*"]
                }
            },
            "include": ["src"],
            "references": [{ "path": "./tsconfig.node.json" }]
        }, null, 2));

        // Create tsconfig.node.json
        await fs.writeFile(path.join(appPath, 'tsconfig.node.json'), JSON.stringify({
            "compilerOptions": {
                "composite": true,
                "skipLibCheck": true,
                "module": "ESNext",
                "moduleResolution": "bundler",
                "allowSyntheticDefaultImports": true
            },
            "include": ["vite.config.ts"]
        }, null, 2));

        // Create tailwind.config.js
        await fs.writeFile(path.join(appPath, 'tailwind.config.js'), `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}`);

        // Create postcss.config.js
        await fs.writeFile(path.join(appPath, 'postcss.config.js'), `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);

        // Create src/main.tsx
        await fs.writeFile(path.join(appPath, 'src', 'main.tsx'), `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`);

        // Create src/App.tsx - Hello World component
        await fs.writeFile(path.join(appPath, 'src', 'App.tsx'), `import { useState } from 'react'
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
                Your app is ready to be customized
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                This is a boilerplate React application with TypeScript, Vite, Tailwind CSS, and Shadcn/ui components.
              </p>
              <Button onClick={() => setCount((count) => count + 1)} className="w-full">
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
                Enhanced development experience with static type checking and IntelliSense.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🎯 Shadcn/ui</CardTitle>
              <CardDescription>
                Beautiful UI components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Copy and paste components built with Radix UI and Tailwind CSS.
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

export default App`);

        // Create src/index.css with Tailwind and CSS variables
        await fs.writeFile(path.join(appPath, 'src', 'index.css'), `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`);

        // Create lib/utils.ts
        await fs.writeFile(path.join(appPath, 'src', 'lib', 'utils.ts'), `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`);

        // Create UI components - Button
        await fs.writeFile(path.join(appPath, 'src', 'components', 'ui', 'button.tsx'), `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`);

        // Create UI components - Card
        await fs.writeFile(path.join(appPath, 'src', 'components', 'ui', 'card.tsx'), `import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }`);

        // Create public/vite.svg
        await fs.writeFile(path.join(appPath, 'public', 'vite.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`);

        // Create eslint config
        await fs.writeFile(path.join(appPath, '.eslintrc.cjs'), `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'eslint-plugin-react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}`);

        console.log(`✅ Boilerplate React app created with:`);
        console.log(`   - React 18 + TypeScript`);
        console.log(`   - Vite build tool`);
        console.log(`   - Tailwind CSS + Shadcn/ui`);
        console.log(`   - Hello World demo app`);
        console.log(`   - Ready for customization`);
    }

    /**
     * Main terminal interface - executes bash commands like a real Linux terminal
     */
    async executeCommand(command: string): Promise<CommandResult> {
        const startTime = Date.now();

        try {
            // Add to command history
            this.commandHistory.push(command);

            // Parse the command
            const parsed = this.parseCommand(command.trim());

            console.log(`🔧 Executing: ${command} in ${this.currentDir}`);

            // Handle built-in commands
            let result: CommandResult;

            switch (parsed.command) {
                case 'pwd':
                    result = await this.pwd();
                    break;
                case 'cd':
                    result = await this.cd(parsed.args[0] || '/app');
                    break;
                case 'ls':
                    result = await this.ls(parsed.args, parsed.flags);
                    break;
                case 'cat':
                    result = await this.cat(parsed.args);
                    break;
                case 'echo':
                    result = await this.echo(parsed.args, parsed.redirect);
                    break;
                case 'mkdir':
                    result = await this.mkdir(parsed.args, parsed.flags);
                    break;
                case 'rm':
                    result = await this.rm(parsed.args, parsed.flags);
                    break;
                case 'cp':
                    result = await this.cp(parsed.args[0], parsed.args[1], parsed.flags);
                    break;
                case 'mv':
                    result = await this.mv(parsed.args[0], parsed.args[1]);
                    break;
                case 'touch':
                    result = await this.touch(parsed.args);
                    break;
                case 'sed':
                    result = await this.sed(parsed.args, parsed.flags);
                    break;
                case 'grep':
                    result = await this.grep(parsed.args, parsed.flags);
                    break;
                case 'find':
                    result = await this.find(parsed.args, parsed.flags);
                    break;
                case 'head':
                    result = await this.head(parsed.args, parsed.flags);
                    break;
                case 'tail':
                    result = await this.tail(parsed.args, parsed.flags);
                    break;
                case 'wc':
                    result = await this.wc(parsed.args, parsed.flags);
                    break;
                case 'env':
                    result = await this.env();
                    break;
                case 'export':
                    result = await this.export(parsed.args);
                    break;
                case 'history':
                    result = await this.history();
                    break;
                case 'ps':
                    result = await this.ps();
                    break;
                case 'kill':
                    result = await this.kill(parsed.args);
                    break;
                case 'npm':
                    result = await this.npm(parsed.args);
                    break;
                case 'node':
                    result = await this.node(parsed.args);
                    break;
                case 'npx':
                    result = await this.npx(parsed.args);
                    break;
                case 'which':
                    result = await this.which(parsed.args);
                    break;
                default:
                    // Try to execute as a system command
                    result = await this.execSystemCommand(command);
                    break;
            }

            const duration = Date.now() - startTime;
            result.duration = duration;

            console.log(`✅ Command completed in ${duration}ms (exit code: ${result.exitCode})`);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = getErrorMessage(error);
            console.error(`❌ Command failed: ${errorMessage}`);

            return {
                stdout: '',
                stderr: `bash: ${command}: ${errorMessage}`,
                exitCode: 1,
                duration
            };
        }
    }

    /**
     * Parse a bash command into components
     */
    private parseCommand(command: string): ParsedCommand {
        // Handle simple command parsing (can be enhanced for complex cases)
        const parts = command.split(/\s+/);
        const cmd = parts[0];
        const args: string[] = [];
        const flags: string[] = [];

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('-')) {
                flags.push(part);
            } else {
                args.push(part);
            }
        }

        // Handle redirections (basic support)
        let redirect;
        const redirectMatch = command.match(/(>>?|<|\|)\s*(.+)$/);
        if (redirectMatch) {
            redirect = {
                type: redirectMatch[1] as '>' | '>>' | '<' | '|',
                target: redirectMatch[2].trim()
            };
        }

        return { command: cmd, args, flags, redirect };
    }

    /**
     * Print working directory
     */
    private async pwd(): Promise<CommandResult> {
        return {
            stdout: this.currentDir,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Change directory
     */
    private async cd(targetDir?: string): Promise<CommandResult> {
        if (!targetDir || targetDir === '~') {
            this.currentDir = '/app';
        } else {
            const newDir = this.resolvePath(targetDir);
            const realPath = this.toRealPath(newDir);

            try {
                const stats = await fs.stat(realPath);
                if (stats.isDirectory()) {
                    this.currentDir = newDir;
                    this.environment.set('PWD', this.currentDir);
                } else {
                    return {
                        stdout: '',
                        stderr: `cd: ${targetDir}: Not a directory`,
                        exitCode: 1
                    };
                }
            } catch (error) {
                return {
                    stdout: '',
                    stderr: `cd: ${targetDir}: No such file or directory`,
                    exitCode: 1
                };
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * List directory contents
     */
    private async ls(args: string[], flags: string[]): Promise<CommandResult> {
        const targetPath = this.resolvePath(args[0] || '.');
        const realPath = this.toRealPath(targetPath);

        try {
            const files = await fs.readdir(realPath);

            if (flags.includes('-l')) {
                // Long format
                const details = await Promise.all(files.map(async (file) => {
                    const filePath = path.join(realPath, file);
                    const stats = await fs.stat(filePath);
                    return this.formatLsLine(file, stats);
                }));
                return {
                    stdout: details.join('\n'),
                    stderr: '',
                    exitCode: 0
                };
            } else {
                // Simple format
                const output = flags.includes('-a')
                    ? ['.', '..', ...files].join('  ')
                    : files.join('  ');

                return {
                    stdout: output,
                    stderr: '',
                    exitCode: 0
                };
            }
        } catch (error) {
            return {
                stdout: '',
                stderr: `ls: ${args[0] || '.'}: No such file or directory`,
                exitCode: 1
            };
        }
    }

    /**
     * Format a single line for ls -l output
     */
    private formatLsLine(filename: string, stats: any): string {
        const permissions = this.formatPermissions(stats.mode);
        const size = stats.size.toString().padStart(8);
        const date = stats.mtime.toISOString().slice(0, 16).replace('T', ' ');
        return `${permissions} 1 developer developer ${size} ${date} ${filename}`;
    }

    /**
     * Format file permissions for ls -l
     */
    private formatPermissions(mode: number): string {
        const type = (mode & 0o170000) === 0o040000 ? 'd' : '-';
        const owner = [
            (mode & 0o400) ? 'r' : '-',
            (mode & 0o200) ? 'w' : '-',
            (mode & 0o100) ? 'x' : '-'
        ].join('');
        const group = [
            (mode & 0o040) ? 'r' : '-',
            (mode & 0o020) ? 'w' : '-',
            (mode & 0o010) ? 'x' : '-'
        ].join('');
        const other = [
            (mode & 0o004) ? 'r' : '-',
            (mode & 0o002) ? 'w' : '-',
            (mode & 0o001) ? 'x' : '-'
        ].join('');

        return type + owner + group + other;
    }

    // ... Rest of the methods (cat, echo, mkdir, rm, etc.) ...
    // I'll include the key ones needed for the boilerplate app functionality

    /**
     * Display file contents
     */
    private async cat(files: string[]): Promise<CommandResult> {
        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'cat: missing file operand',
                exitCode: 1
            };
        }

        try {
            const contents = await Promise.all(
                files.map(file => {
                    const realPath = this.toRealPath(this.resolvePath(file));
                    return fs.readFile(realPath, 'utf-8');
                })
            );

            return {
                stdout: contents.join('\n'),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `cat: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Echo text or write to file
     */
    private async echo(args: string[], redirect?: ParsedCommand['redirect']): Promise<CommandResult> {
        const text = args.join(' ');

        if (redirect) {
            const targetFile = this.toRealPath(this.resolvePath(redirect.target));

            try {
                if (redirect.type === '>') {
                    await fs.writeFile(targetFile, text + '\n');
                } else if (redirect.type === '>>') {
                    await fs.appendFile(targetFile, text + '\n');
                }

                return {
                    stdout: '',
                    stderr: '',
                    exitCode: 0
                };
            } catch (error) {
                return {
                    stdout: '',
                    stderr: `echo: ${getErrorMessage(error)}`,
                    exitCode: 1
                };
            }
        } else {
            return {
                stdout: text,
                stderr: '',
                exitCode: 0
            };
        }
    }

    /**
     * Check if a port is available/responding
     */
    private checkPort(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();

            socket.setTimeout(1000);

            socket.on('connect', () => {
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Port check timeout'));
            });

            socket.on('error', (error) => {
                socket.destroy();
                reject(error);
            });

            socket.connect(port, 'localhost');
        });
    }

    /**
     * Start the development server and return the URL
     */
    async startDevServer(): Promise<CommandResult> {
        const port = 3001; // Same as configured in vite.config.ts

        try {
            console.log('🚀 Starting development server...');

            // First, install dependencies if not already done
            console.log('📦 Installing dependencies...');
            const installResult = await this.executeCommand('npm install');

            if (installResult.exitCode !== 0) {
                console.warn('⚠️ npm install failed, continuing anyway...');
            }

            // Start npm run dev in background - use proper backgrounding
            const devCommand = 'npm run dev';
            console.log(`🔧 Executing: ${devCommand} in ${this.currentDir}`);

            const realPath = this.toRealPath(this.currentDir);

            // Start the process directly without shell backgrounding
            const devProcess = spawn('npm', ['run', 'dev'], {
                cwd: realPath,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ...Object.fromEntries(this.environment),
                    PATH: process.env.PATH
                }
            });

            let output = '';

            // Collect output to detect when server is ready
            devProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });

            devProcess.stderr?.on('data', (data) => {
                output += data.toString();
            });

            // Store the process
            this.processes.set('npm-dev', devProcess);

            // Wait for the server to start by checking output or port
            let serverReady = false;
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds total

            while (!serverReady && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;

                // Check if process is still running
                if (devProcess.killed || devProcess.exitCode !== null) {
                    console.error('❌ Dev server process died unexpectedly');
                    break;
                }

                // Check output for ready indicators
                if (output.includes('ready') || output.includes('Local:') || output.includes('localhost')) {
                    serverReady = true;
                    break;
                }

                // Try to connect to the port
                try {
                    await this.checkPort(port);
                    serverReady = true;
                    break;
                } catch (error) {
                    // Port not ready yet, continue waiting
                }
            }

            if (serverReady) {
                const url = `http://localhost:${port}`;
                console.log(`✅ Development server started at ${url}`);

                return {
                    stdout: `Development server started successfully!\nLocal: ${url}\npress h + enter to show help\n\n${output}`,
                    stderr: '',
                    exitCode: 0
                };
            } else {
                console.error('❌ Development server failed to start within timeout');
                return {
                    stdout: '',
                    stderr: `Development server failed to start within timeout. Output: ${output || 'Server startup timeout'}`,
                    exitCode: 1
                };
            }
        } catch (error) {
            console.error('❌ Failed to start development server:', error);
            return {
                stdout: '',
                stderr: `Failed to start development server: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Get running development server info
     */
    getDevServerInfo(): { isRunning: boolean; url?: string; port?: number } {
        const devProcess = this.processes.get('npm-dev');

        if (devProcess && !devProcess.killed && devProcess.exitCode === null) {
            return {
                isRunning: true,
                url: 'http://localhost:3001',
                port: 3001
            };
        }

        return {
            isRunning: false
        };
    }

    /**
     * Stop the development server
     */
    async stopDevServer(): Promise<boolean> {
        const devProcess = this.processes.get('npm-dev');

        if (devProcess && !devProcess.killed) {
            try {
                devProcess.kill('SIGTERM');
                this.processes.delete('npm-dev');
                console.log('🛑 Development server stopped');
                return true;
            } catch (error) {
                console.error('❌ Failed to stop development server:', error);
                return false;
            }
        }

        return false;
    }

    /**
     * Execute npm commands
     */
    private async npm(args: string[]): Promise<CommandResult> {
        const subcommand = args[0];
        const realPath = this.toRealPath(this.currentDir);

        // Special handling for npm run dev to return dev server URL
        if (subcommand === 'run' && args[1] === 'dev') {
            return this.startDevServer();
        }

        return new Promise((resolve) => {
            // Use Node.js and npm from the system PATH
            const npm = spawn('npm', args, {
                cwd: realPath,
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ...Object.fromEntries(this.environment),
                    PATH: process.env.PATH // Ensure npm is in PATH
                }
            });

            let stdout = '';
            let stderr = '';

            npm.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            npm.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            npm.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            npm.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `npm: ${getErrorMessage(error)}`,
                    exitCode: 1
                });
            });

            // Store long-running processes
            if (subcommand === 'run' && (args[1] === 'dev' || args[1] === 'start')) {
                this.processes.set(`npm-${args[1]}`, npm);
            }
        });
    }

    // Include other essential methods like mkdir, rm, sed, etc.
    // (I'll add the key ones needed for the demo)

    /**
     * Create directories
     */
    private async mkdir(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'mkdir: missing operand',
                exitCode: 1
            };
        }

        const recursive = flags.includes('-p');

        try {
            for (const dir of args) {
                const realPath = this.toRealPath(this.resolvePath(dir));
                await fs.mkdir(realPath, { recursive });
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `mkdir: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Stream editor (sed) - supports basic find/replace operations
     */
    private async sed(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length < 2) {
            return {
                stdout: '',
                stderr: 'sed: missing operand',
                exitCode: 1
            };
        }

        const inPlace = flags.includes('-i');
        const pattern = args[0];
        const files = args.slice(1);

        // Parse sed pattern (e.g., s/search/replace/g)
        const match = pattern.match(/^s\/(.+?)\/(.+?)\/(g?)$/);
        if (!match) {
            return {
                stdout: '',
                stderr: 'sed: invalid command',
                exitCode: 1
            };
        }

        const [, search, replace, global] = match;
        const regex = new RegExp(search, global ? 'g' : '');

        try {
            let output = '';

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');
                const modified = content.replace(regex, replace);

                if (inPlace) {
                    await fs.writeFile(realPath, modified);
                } else {
                    output += modified;
                }
            }

            return {
                stdout: output,
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `sed: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Helper: Resolve relative paths to absolute virtual paths
     */
    private resolvePath(inputPath: string): string {
        if (inputPath.startsWith('/')) {
            return inputPath;
        }
        if (inputPath === '.') {
            return this.currentDir;
        }
        if (inputPath === '..') {
            const parts = this.currentDir.split('/').filter(p => p);
            parts.pop();
            return '/' + parts.join('/') || '/app';
        }
        if (inputPath.startsWith('./')) {
            inputPath = inputPath.slice(2);
        }
        if (inputPath.startsWith('../')) {
            const parts = this.currentDir.split('/').filter(p => p);
            const pathParts = inputPath.split('/');

            for (const part of pathParts) {
                if (part === '..') {
                    parts.pop();
                } else if (part !== '.' && part !== '') {
                    parts.push(part);
                }
            }

            return '/' + parts.join('/') || '/app';
        }

        return path.posix.join(this.currentDir, inputPath).replace(/\/+/g, '/');
    }

    /**
     * Helper: Convert virtual path to real filesystem path
     */
    private toRealPath(virtualPath: string): string {
        // Remove leading slash and join with workspace
        const relativePath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
        return path.join(this.workDir, relativePath);
    }

    /**
     * Execute system commands (fallback)
     */
    private async execSystemCommand(command: string): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const child = spawn(command, [], {
                cwd: realPath,
                shell: true,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            child.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `bash: ${command}: command not found`,
                    exitCode: 127
                });
            });
        });
    }

    /**
     * Remove files and directories
     */
    private async rm(args: string[], flags: string[]): Promise<CommandResult> {
        const recursive = flags.includes('-r') || flags.includes('-rf');
        const force = flags.includes('-f') || flags.includes('-rf');

        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'rm: missing operand',
                exitCode: 1
            };
        }

        let output = '';
        let hasError = false;

        for (const arg of args) {
            try {
                const fullPath = this.toRealPath(this.resolvePath(arg));
                await fs.rm(fullPath, { recursive, force });
                output += `removed '${arg}'\n`;
            } catch (error) {
                if (!force) {
                    output += `rm: cannot remove '${arg}': ${getErrorMessage(error)}\n`;
                    hasError = true;
                }
            }
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: hasError ? 1 : 0
        };
    }

    /**
     * Copy files and directories
     */
    private async cp(source: string, dest: string, flags: string[]): Promise<CommandResult> {
        const recursive = flags.includes('-r') || flags.includes('-R');

        try {
            const sourcePath = this.toRealPath(this.resolvePath(source));
            const destPath = this.toRealPath(this.resolvePath(dest));

            const sourceStats = await fs.stat(sourcePath);

            if (sourceStats.isDirectory()) {
                if (!recursive) {
                    return {
                        stdout: '',
                        stderr: `cp: ${source} is a directory (not copied).`,
                        exitCode: 1
                    };
                }
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `cp: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Move/rename files and directories
     */
    private async mv(source: string, dest: string): Promise<CommandResult> {
        try {
            const sourcePath = this.toRealPath(this.resolvePath(source));
            const destPath = this.toRealPath(this.resolvePath(dest));

            await fs.rename(sourcePath, destPath);

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `mv: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Create empty files or update timestamps
     */
    private async touch(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'touch: missing file operand',
                exitCode: 1
            };
        }

        for (const arg of args) {
            try {
                const fullPath = this.toRealPath(this.resolvePath(arg));
                try {
                    await fs.access(fullPath);
                    // File exists, update timestamp
                    const now = new Date();
                    await fs.utimes(fullPath, now, now);
                } catch {
                    // File doesn't exist, create it
                    await fs.writeFile(fullPath, '');
                }
            } catch (error) {
                return {
                    stdout: '',
                    stderr: `touch: ${getErrorMessage(error)}`,
                    exitCode: 1
                };
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Search text patterns in files
     */
    private async grep(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length < 2) {
            return {
                stdout: '',
                stderr: 'grep: missing pattern or file',
                exitCode: 1
            };
        }

        const pattern = args[0];
        const files = args.slice(1);
        let output = '';

        try {
            for (const file of files) {
                const fullPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    if (line.includes(pattern)) {
                        output += `${file}:${index + 1}:${line}\n`;
                    }
                });
            }

            return {
                stdout: output,
                stderr: '',
                exitCode: output ? 0 : 1
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `grep: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Find files and directories
     */
    private async find(args: string[], flags: string[]): Promise<CommandResult> {
        const startPath = args[0] || '.';
        const realStartPath = this.toRealPath(this.resolvePath(startPath));

        try {
            const results: string[] = [];
            await this.findRecursive(realStartPath, this.resolvePath(startPath), results);

            return {
                stdout: results.join('\n') + '\n',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `find: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Show first lines of files
     */
    private async head(args: string[], flags: string[]): Promise<CommandResult> {
        const lines = flags.includes('-n') ? parseInt(flags[flags.indexOf('-n') + 1]) || 10 : 10;
        const files = args.filter(arg => !arg.startsWith('-') && !arg.match(/^\d+$/));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'head: missing file operand',
                exitCode: 1
            };
        }

        let output = '';

        for (const file of files) {
            try {
                const fullPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(fullPath, 'utf-8');
                const fileLines = content.split('\n').slice(0, lines);

                if (files.length > 1) {
                    output += `==> ${file} <==\n`;
                }
                output += fileLines.join('\n') + '\n';

                if (files.length > 1) {
                    output += '\n';
                }
            } catch (error) {
                output += `head: ${getErrorMessage(error)}\n`;
            }
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Show last lines of files
     */
    private async tail(args: string[], flags: string[]): Promise<CommandResult> {
        const lines = flags.includes('-n') ? parseInt(flags[flags.indexOf('-n') + 1]) || 10 : 10;
        const files = args.filter(arg => !arg.startsWith('-') && !arg.match(/^\d+$/));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'tail: missing file operand',
                exitCode: 1
            };
        }

        let output = '';

        for (const file of files) {
            try {
                const fullPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(fullPath, 'utf-8');
                const fileLines = content.split('\n');
                const tailLines = fileLines.slice(-lines);

                if (files.length > 1) {
                    output += `==> ${file} <==\n`;
                }
                output += tailLines.join('\n') + '\n';

                if (files.length > 1) {
                    output += '\n';
                }
            } catch (error) {
                output += `tail: ${getErrorMessage(error)}\n`;
            }
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Count lines, words, and characters
     */
    private async wc(args: string[], flags: string[]): Promise<CommandResult> {
        const files = args.filter(arg => !arg.startsWith('-'));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'wc: missing file operand',
                exitCode: 1
            };
        }

        let output = '';
        let totalLines = 0;
        let totalWords = 0;
        let totalChars = 0;

        for (const file of files) {
            try {
                const fullPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(fullPath, 'utf-8');

                const lines = content.split('\n').length - 1;
                const words = content.split(/\s+/).filter(w => w.length > 0).length;
                const chars = content.length;

                totalLines += lines;
                totalWords += words;
                totalChars += chars;

                output += `${lines.toString().padStart(8)} ${words.toString().padStart(8)} ${chars.toString().padStart(8)} ${file}\n`;
            } catch (error) {
                output += `wc: ${getErrorMessage(error)}\n`;
            }
        }

        if (files.length > 1) {
            output += `${totalLines.toString().padStart(8)} ${totalWords.toString().padStart(8)} ${totalChars.toString().padStart(8)} total\n`;
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Show environment variables
     */
    private async env(): Promise<CommandResult> {
        const output = Array.from(this.environment.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Set environment variables
     */
    private async export(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return this.env();
        }

        for (const arg of args) {
            const [key, ...valueParts] = arg.split('=');
            if (valueParts.length > 0) {
                this.environment.set(key, valueParts.join('='));
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Show command history
     */
    private async history(): Promise<CommandResult> {
        const output = this.commandHistory
            .map((cmd, index) => `${(index + 1).toString().padStart(5)}  ${cmd}`)
            .join('\n');

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Show running processes
     */
    private async ps(): Promise<CommandResult> {
        const output = ['  PID TTY          TIME CMD'];

        for (const [name, process] of this.processes) {
            const pid = process.pid?.toString().padStart(5) || '    ?';
            output.push(`${pid} pts/0    00:00:00 ${name}`);
        }

        return {
            stdout: output.join('\n'),
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Kill processes
     */
    private async kill(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]',
                exitCode: 1
            };
        }

        let output = '';
        let hasError = false;

        for (const arg of args) {
            try {
                const pid = parseInt(arg);
                let found = false;

                for (const [name, process] of this.processes) {
                    if (process.pid === pid) {
                        process.kill();
                        this.processes.delete(name);
                        output += `Killed process ${name} (${pid})\n`;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    output += `kill: (${pid}) - No such process\n`;
                    hasError = true;
                }
            } catch (error) {
                output += `kill: ${getErrorMessage(error)}\n`;
                hasError = true;
            }
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: hasError ? 1 : 0
        };
    }

    /**
     * Execute Node.js
     */
    private async node(args: string[]): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const child = spawn('node', args, {
                cwd: realPath,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            child.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: getErrorMessage(error),
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Execute npx commands
     */
    private async npx(args: string[]): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const child = spawn('npx', args, {
                cwd: realPath,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            child.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: getErrorMessage(error),
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Locate commands
     */
    private async which(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'which: missing operand',
                exitCode: 1
            };
        }

        let output = '';
        let hasError = false;

        for (const command of args) {
            const builtinCommands = [
                'pwd', 'cd', 'ls', 'cat', 'echo', 'mkdir', 'rm', 'cp', 'mv', 'touch',
                'grep', 'find', 'head', 'tail', 'wc', 'env', 'export', 'history', 'ps', 'kill'
            ];

            if (builtinCommands.includes(command)) {
                output += `${command}: shell builtin command\n`;
            } else if (command === 'npm' || command === 'node' || command === 'npx') {
                // These are system commands that should be available
                output += `/usr/local/bin/${command}\n`;
            } else {
                output += `which: no ${command} in (built-in commands)\n`;
                hasError = true;
            }
        }

        return {
            stdout: output,
            stderr: '',
            exitCode: hasError ? 1 : 0
        };
    }

    /**
     * Copy directory recursively
     */
    private async copyDirectory(source: string, dest: string): Promise<void> {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(source, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Find files recursively
     */
    private async findRecursive(realPath: string, virtualPath: string, results: string[]): Promise<void> {
        try {
            const entries = await fs.readdir(realPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryVirtualPath = path.join(virtualPath, entry.name);
                results.push(entryVirtualPath);

                if (entry.isDirectory()) {
                    await this.findRecursive(path.join(realPath, entry.name), entryVirtualPath, results);
                }
            }
        } catch (error) {
            // Ignore permission errors or other issues
        }
    }

    /**
     * Cleanup container resources
     */
    async cleanup(delay: number = 5 * 60 * 1000): Promise<void> {
        // Kill all running processes
        for (const [name, process] of this.processes) {
            try {
                process.kill();
            } catch (error) {
                console.warn(`Failed to kill process ${name}:`, getErrorMessage(error));
            }
        }
        this.processes.clear();

        // Schedule workspace cleanup
        setTimeout(async () => {
            try {
                await fs.rm(this.workDir, { recursive: true, force: true });
                console.log(`🗑️ Cleaned up workspace: ${this.workDir}`);
            } catch (error) {
                console.warn(`Failed to cleanup workspace:`, getErrorMessage(error));
            }
        }, delay);

        console.log(`🐳 Container cleanup scheduled for conversation: ${this.conversationId}`);
    }
}
