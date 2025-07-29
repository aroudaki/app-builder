# VS Code Development Setup

This document describes the VS Code configuration for the AI App Generator project.

## Quick Start

1. **Open the workspace**: Open the root folder `/Users/alroudak/repos2/app-builder` in VS Code
2. **Install recommended extensions**: VS Code will prompt you to install recommended extensions
3. **Start debugging**: Press `F5` or use the Run and Debug panel

## Debug Configurations

### Available Debug Configurations

1. **Debug Server** - Debug the Node.js server with hot reload
2. **Debug Server with Tracing** - Debug server with LangSmith tracing enabled
3. **Debug Server Tests** - Debug all server tests
4. **Debug Container Tests** - Debug container-specific tests
5. **Debug Browser Tests** - Debug browser automation tests
6. **Attach to Running Server** - Attach debugger to an already running server process
7. **Debug Full Stack** - Debug server and automatically start client

### How to Debug

1. **Set breakpoints** in your TypeScript files
2. **Select a debug configuration** from the dropdown in the Run and Debug panel
3. **Press F5** or click the green play button
4. **Debug console** will show output and allow interaction

### Environment Variables

Debug configurations will automatically load environment variables from:
- `.env` file in the project root
- Configuration-specific environment variables

## Tasks

### Available Tasks

You can run these tasks from the Command Palette (`Cmd+Shift+P` → "Tasks: Run Task"):

#### Build Tasks
- `build:server` - Build the server TypeScript code
- `build:client` - Build the client React app
- `build:all` - Build both server and client (default build task)

#### Start Tasks
- `start:server` - Start server in development mode with hot reload
- `start:server:trace` - Start server with LangSmith tracing
- `start:client` - Start client development server
- `start:fullstack` - Start both server and client

#### Test Tasks
- `test:server` - Run server tests
- `test:container` - Run container tests
- `test:browser` - Run browser automation tests
- `test:ci` - Run full CI test suite
- `test:all` - Run all tests (default test task)

#### Utility Tasks
- `clean:all` - Clean all build artifacts
- `lint:all` - Lint all code
- `type-check:all` - Type check all TypeScript code
- `docker:build` - Build Docker images
- `docker:test` - Test Docker containers

### Running Tasks

1. **Command Palette**: `Cmd+Shift+P` → "Tasks: Run Task"
2. **Keyboard Shortcuts**:
   - `Cmd+Shift+B` - Run default build task
   - `Cmd+Shift+T` - Run default test task
3. **Terminal**: Tasks run in the integrated terminal

## Keyboard Shortcuts

- `F5` - Start debugging
- `Shift+F5` - Stop debugging
- `Cmd+Shift+F5` - Restart debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into
- `Shift+F11` - Step out
- `Cmd+Shift+B` - Build
- `Cmd+Shift+T` - Test

## Project Structure

```
.vscode/
├── launch.json      # Debug configurations
├── tasks.json       # Task definitions
└── settings.json    # Workspace settings
```

## Settings

The workspace includes optimized settings for:
- **TypeScript**: Auto-imports, path mapping, and IntelliSense
- **ESLint**: Automatic fixing on save
- **Prettier**: Code formatting on save
- **File exclusions**: Hide build artifacts and dependencies from search
- **Monorepo support**: Proper ESLint working directories for each package

## Recommended Extensions

The workspace recommends these extensions:
- **Prettier**: Code formatting
- **ESLint**: Linting and code quality
- **TypeScript**: Enhanced TypeScript support
- **Tailwind CSS**: CSS class IntelliSense
- **Playwright**: Browser testing support
- **Remote Containers**: Docker development support

## Tips

1. **Use the integrated terminal** for running commands
2. **Set breakpoints in TypeScript files** - they work directly without source maps
3. **Use the Problems panel** to see TypeScript and ESLint issues
4. **Use the Test Explorer** for running individual tests
5. **Enable auto-save** to trigger format-on-save consistently

## Troubleshooting

### Debug Issues
- **Breakpoints not working**: Ensure you're debugging the TypeScript files, not compiled JavaScript
- **Can't attach debugger**: Make sure the server is running with `--inspect` flag
- **Environment variables not loading**: Check that `.env` exists in project root

### Build Issues
- **TypeScript errors**: Run the `type-check:all` task to see all type errors
- **Module resolution**: Check that paths in `tsconfig.json` are correct
- **Dependencies**: Run `npm install` in the relevant package directory

### Performance
- **Slow IntelliSense**: Close unused TypeScript files
- **High CPU usage**: Exclude large directories in settings
- **Memory issues**: Restart TypeScript service (`Cmd+Shift+P` → "TypeScript: Restart TS Server")
