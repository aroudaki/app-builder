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

## Development

- `npm run dev` - Start both server and client in development mode
- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages

## Environment Variables

Copy `.env.example` to `.env` and configure your Azure credentials.

## Architecture Documentation

See `docs/architecture_design_and_execution_plan.md` for detailed technical specifications.
