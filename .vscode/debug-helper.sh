#!/bin/bash

# VS Code Debug Helper Script
# This script helps diagnose and fix common debugging issues

echo "🔍 VS Code Debug Helper for AI App Generator"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project root directory"
    echo "Please run this script from the project root"
    exit 1
fi

echo "✅ In project root directory"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your actual values."
else
    echo "✅ .env file exists"
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "⚠️  Warning: node_modules not found"
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies installed"
fi

# Check if server can be built
echo "🔨 Testing server build..."
cd apps/server
if npm run build; then
    echo "✅ Server builds successfully"
else
    echo "❌ Server build failed. Check TypeScript errors above."
    exit 1
fi

cd ../..

# Check if TypeScript is working
echo "🔍 Checking TypeScript configuration..."
if npx tsc --noEmit --project apps/server/tsconfig.json; then
    echo "✅ Server TypeScript configuration is valid"
else
    echo "❌ TypeScript configuration issues found"
    exit 1
fi

# Check if ports are available
echo "🌐 Checking if ports are available..."
if lsof -ti:3000 > /dev/null; then
    echo "⚠️  Warning: Port 3000 is already in use"
    echo "🛑 Killing processes on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo "✅ Port 3000 is now available"
else
    echo "✅ Port 3000 is available"
fi

if lsof -ti:5173 > /dev/null; then
    echo "⚠️  Warning: Port 5173 is already in use"
    echo "🛑 Killing processes on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    echo "✅ Port 5173 is now available"
else
    echo "✅ Port 5173 is available"
fi

echo ""
echo "🎉 Debug environment check complete!"
echo ""
echo "🚀 Quick start options:"
echo "  1. Press F5 in VS Code to start debugging"
echo "  2. Use Cmd+Shift+P → 'Tasks: Run Task' → 'start:fullstack'"
echo "  3. Use Cmd+Shift+D to start full stack development"
echo ""
echo "📚 See .vscode/README.md for more detailed instructions"
