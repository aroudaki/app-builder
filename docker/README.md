# Docker Base Image for App Builder

This directory contains the Docker base image and boilerplate application for the AI App Builder system.

## Structure

```
docker/base/
├── Dockerfile              # Base image definition
├── .dockerignore           # Docker build context exclusions
└── boilerplate-app/        # React boilerplate application
    ├── package.json        # Dependencies and scripts
    ├── package-lock.json   # Locked dependency versions
    ├── index.html          # HTML template
    ├── vite.config.ts      # Vite configuration
    ├── tsconfig.json       # TypeScript configuration
    ├── tailwind.config.js  # Tailwind CSS configuration
    ├── postcss.config.js   # PostCSS configuration
    ├── .eslintrc.cjs       # ESLint configuration
    ├── .gitignore          # Git ignore rules
    ├── public/
    │   └── vite.svg        # Vite logo
    └── src/
        ├── main.tsx        # Application entry point
        ├── App.tsx         # Main React component
        ├── index.css       # Global styles with Tailwind
        ├── vite-env.d.ts   # Vite type definitions
        ├── lib/
        │   └── utils.ts    # Utility functions
        └── components/ui/
            ├── button.tsx  # Button component
            └── card.tsx    # Card component
```

## Base Image Details

- **Base**: `node:18-alpine`
- **Size**: ~810MB
- **User**: `appuser` (non-root for security)
- **Working Directory**: `/generated-app`
- **Port**: 3001
- **Startup Time**: ~0.12 seconds

## Technologies Included

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Component library
- **ESLint** - Code linting
- **PostCSS** - CSS processing

## Building the Image

```bash
cd docker/base
docker build -t app-builder-base:latest .
```

## Testing the Image

```bash
# Create and run a container
docker run -d --name test-container -p 3001:3001 app-builder-base:latest

# Test exec commands
docker exec test-container ls -la /generated-app

# Test file modification (as coding agent would do)
echo "console.log('Hello from coding agent')" | base64 | \
  docker exec -i test-container sh -c 'base64 -d > /generated-app/test.js'

# Start dev server
docker exec -d test-container npm run dev

# Check if server is running
curl http://localhost:3001

# Cleanup
docker stop test-container && docker rm test-container
```

## Architecture Notes

- The container runs as non-root user (`appuser`) for security
- Uses Docker's `exec` API for command execution (no SSH/VNC needed)
- Optimized layer caching for fast rebuilds
- Pre-installed dependencies for quick container startup
- Base64 encoding used for file modifications by coding agents
- Health checks ensure container readiness

## Usage in App Builder

1. **Container Creation**: Each user session gets a temporary container
2. **File Modification**: Coding agents modify files using base64 encoding
3. **Dev Server**: Vite dev server provides live preview at port 3001
4. **Cleanup**: Containers are automatically removed after session ends

## Security Features

- Non-root user execution
- Resource limits (512MB RAM, 0.5 CPU)
- Network isolation
- Container auto-removal
- No persistent data storage

## Performance

- **Container Startup**: ~0.12 seconds
- **Dev Server Start**: ~3 seconds
- **Concurrent Containers**: Tested up to 10 simultaneous containers
- **Memory Usage**: ~100-200MB per container during development
