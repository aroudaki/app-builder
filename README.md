# AI App Generator

An AI-powered web application generator built with React, Node.js, and Azure OpenAI.

## Architecture

This is a monorepo containing:
- **Server**: Node.js/Express backend with WebSocket support
- **Client**: React/TypeScript frontend with real-time agent communication
- **Shared**: Common types and utilities

## Quick Setup

```bash
npm install
npm run dev
```

## Docker Development

For local Docker container development and testing:

```bash
# Build base Docker image
./docker-manager build

# Create and test a container
./docker-manager test

# See DOCKER_QUICK_START.md for more commands
```

**See [`DOCKER_QUICK_START.md`](DOCKER_QUICK_START.md) for the complete Docker workflow.**

## Development

- `npm run dev` - Start both server and client in development mode
- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages

### 🧪 Testing

The project includes comprehensive tests for the Container and Browser Automation tools:

```bash
# Run all tests (recommended after changes)
npm test

# Run complete CI workflow
npm run test:ci

# Run specific tool tests
cd apps/server
npm run test:container  # App Container tool tests
npm run test:browser    # Browser Automation tool tests
```

**See [`apps/server/TESTING.md`](apps/server/TESTING.md) for detailed testing documentation.**

Tests run automatically:
- Before every Git commit (pre-commit build validation)
- Manually with `npm run test` (full test suite)
- On GitHub Actions CI/CD
- After code builds (postbuild hook)

## Environment Variables

Copy `.env.example` to `.env` and configure your Azure credentials.

## VS Code Development

The project includes comprehensive VS Code configuration for debugging and development.

### Quick Start
1. Open the workspace in VS Code
2. Install recommended extensions when prompted
3. Press `F5` to start debugging the server

### Debug Configurations
- **Debug Server** - Debug Node.js server with hot reload
- **Debug Server with Tracing** - Debug with LangSmith tracing enabled
- **Debug Server Tests** - Debug all server tests
- **Debug Container Tests** - Debug container-specific tests
- **Debug Browser Tests** - Debug browser automation tests
- **Debug Full Stack** - Debug server and auto-start client

### VS Code Tasks
Available via Command Palette (`Cmd+Shift+P` → "Tasks: Run Task"):

**Build**: `build:server`, `build:client`, `build:all`
**Start**: `start:server`, `start:client`, `start:fullstack`, `start:server:trace`
**Test**: `test:server`, `test:container`, `test:browser`, `test:ci`, `test:all`
**Utility**: `clean:all`, `lint:all`, `type-check:all`, `docker:build`, `docker:test`

### Custom Keyboard Shortcuts
- `Cmd+Shift+D` - Start full stack development
- `Cmd+Shift+S` - Start server only
- `Cmd+Shift+C` - Start client only
- `Cmd+K Cmd+T` - Run all tests
- `F5` - Start debugging

### Troubleshooting
Run the debug helper script for environment validation:
```bash
./.vscode/debug-helper.sh
```

## Architecture Documentation

See `docs/architecture_design_and_execution_plan.md` for detailed technical specifications.
