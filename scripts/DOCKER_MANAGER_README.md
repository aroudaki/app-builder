# Docker Manager Script

A comprehensive script to manage Docker containers locally for the App Builder project.

## Location

- Main script: `scripts/docker-manager.sh`
- Wrapper script: `docker-manager` (in project root)

## Quick Start

```bash
# Build the base Docker image
./docker-manager build

# Create and test a container
./docker-manager test

# Create a named container on specific port
./docker-manager create my-app 3002

# Start dev server in container
./docker-manager start-dev my-app

# List all containers
./docker-manager list

# Stop and remove container
./docker-manager stop my-app
```

## Available Commands

### `build`
Builds the base Docker image from `docker/base/Dockerfile`.

```bash
./docker-manager build
```

### `create [NAME] [PORT]`
Creates and starts a new container.

- `NAME`: Optional container name (auto-generated if not provided)
- `PORT`: Optional host port (default: 3001)

```bash
# Auto-generated name and default port
./docker-manager create

# Custom name and port
./docker-manager create my-app 3002
```

### `start-dev [NAME]`
Starts the development server in an existing container.

```bash
./docker-manager start-dev my-app
```

### `exec [NAME] [COMMAND]`
Executes a command in a running container.

```bash
./docker-manager exec my-app "pnpm install react-router-dom"
./docker-manager exec my-app "ls -la src/"
```

### `test [NAME] [PORT]`
Runs a comprehensive test suite including:
- Container creation
- File system tests
- Package manager tests
- File modification tests
- Dev server tests

```bash
# Auto-generated test container
./docker-manager test

# Named test container on specific port
./docker-manager test test-app 3003
```

### `list`
Lists all App Builder containers with their status and ports.

```bash
./docker-manager list
```

### `stop [NAME]`
Stops and removes a specific container.

```bash
./docker-manager stop my-app
```

### `cleanup`
Stops and removes all App Builder containers.

```bash
./docker-manager cleanup
```

### `logs [NAME] [LINES]`
Shows container logs.

- `LINES`: Number of lines to show (default: 50)

```bash
./docker-manager logs my-app
./docker-manager logs my-app 100
```

## Features

### Security
- Containers run as non-root user (`appuser`)
- Resource limits (512MB RAM, 0.5 CPU)
- Proper file permissions

### Performance
- Optimized Docker layer caching
- Fast container startup (~0.12 seconds)
- pnpm for efficient package management

### Development
- Live development server with hot reload
- File modification support (base64 encoding)
- Interactive command execution
- Comprehensive logging

### Management
- Auto-generated container names with timestamps
- Port conflict detection and resolution
- Graceful container cleanup
- Health checks and status monitoring

## Examples

### Basic Workflow

```bash
# 1. Build the base image
./docker-manager build

# 2. Create a development container
./docker-manager create dev-container 3001

# 3. Start the dev server
./docker-manager start-dev dev-container

# 4. Access the app at http://localhost:3001

# 5. Make changes to the app
./docker-manager exec dev-container "echo 'console.log(\"Hello World\");' > src/test.js"

# 6. When done, cleanup
./docker-manager stop dev-container
```

### Testing Workflow

```bash
# Run full test suite
./docker-manager test

# The test will:
# - Create a test container
# - Verify all functionality
# - Start dev server
# - Test HTTP responses
# - Leave container running for manual testing
```

### Multiple Containers

```bash
# Create multiple containers for different projects
./docker-manager create project-a 3001
./docker-manager create project-b 3002
./docker-manager create project-c 3003

# Start dev servers for all
./docker-manager start-dev project-a
./docker-manager start-dev project-b
./docker-manager start-dev project-c

# List all containers
./docker-manager list

# Cleanup all when done
./docker-manager cleanup
```

## Troubleshooting

### Docker Not Running
```bash
# Error: Docker daemon is not running
# Solution: Start Docker Desktop
```

### Port Already in Use
```bash
# Error: Port 3001 already in use
# Solution: Use a different port
./docker-manager create my-app 3002
```

### Container Won't Start
```bash
# Check container logs
./docker-manager logs my-app

# Try rebuilding the base image
./docker-manager build
```

### Permission Issues
```bash
# The script runs containers as non-root user 'appuser'
# If you see permission errors, rebuild the base image
./docker-manager build
```

## Integration with App Builder

This script is designed to work with the App Builder's Docker containerization system:

1. **Base Image**: Uses the same Dockerfile as the main system
2. **Container Naming**: Follows the `app-builder-*` convention
3. **Port Mapping**: Compatible with the app builder's port expectations
4. **File Structure**: Maintains the `/generated-app` working directory
5. **Commands**: Supports the same exec commands used by coding agents

## Environment Variables

- `DOCKER_HOST`: Docker daemon socket (auto-detected by default)

## File Locations

- Main script: `scripts/docker-manager.sh`
- Wrapper: `docker-manager` (project root)
- Docker files: `docker/base/`
- Generated app: `/generated-app` (inside containers)

## Script Architecture

The script is organized into logical functions:

- **Prerequisites**: Docker availability checks
- **Core Operations**: Build, create, manage containers
- **Testing**: Comprehensive validation suite
- **Utilities**: Logging, name generation, cleanup
- **Help System**: Comprehensive documentation and examples
