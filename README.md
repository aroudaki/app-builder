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

## Architecture Documentation

See `docs/architecture_design_and_execution_plan.md` for detailed technical specifications.
