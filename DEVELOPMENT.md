# Development Guide

## Quick Development Workflow

### Fast Commits ⚡
We've optimized commits for speed! The pre-commit hook now only runs builds:

```bash
git add .
git commit -m "your changes"  # Only ~1-2 seconds for build validation
```

### When to Run Full Tests 🧪

Run the comprehensive test suite manually when:
- Before pushing to main
- After major changes
- Before releases
- When debugging issues

```bash
# Full test suite (includes Docker, browser automation, etc.)
npm run test:full

# Or from server directory
cd apps/server && npm run test:ci
```

### Development Commands

```bash
# Start development servers
npm run dev                    # Both client & server
npm run dev:server            # Server only  
npm run dev:client            # Client only

# Building
npm run build                 # Build both
npm run build:server          # Server only
npm run build:client          # Client only

# Testing
npm run test                  # Quick turbo tests
npm run test:full             # Comprehensive test suite
npm run lint                  # Code linting
npm run type-check            # TypeScript validation
```

### Pre-commit Hook Details

The pre-commit hook runs:
1. **Server Build** - TypeScript compilation & validation
2. **Client Build** - Vite production build
3. **Success** - Commit proceeds if builds pass

**Benefits:**
- ⚡ **Fast commits** (~1-2 seconds vs ~30+ seconds)
- 🔒 **Build safety** - Prevents broken code from being committed
- 🧪 **Manual testing** - Run full tests when you need them
- 🚀 **Better DX** - No waiting for comprehensive tests on every commit

### Docker Container Testing

For container-related changes, test manually:

```bash
cd apps/server
npm run test:container        # Container tool tests
npm run test:docker          # Docker manager tests
```

### Browser Automation Testing

For UI/browser changes, test manually:

```bash
cd apps/server  
npm run test:browser         # Browser automation tests
```

## Best Practices

1. **Commit Often** - Fast commits encourage frequent saves
2. **Test Before Push** - Run full tests before pushing to shared branches
3. **Build Validation** - Trust the pre-commit hook to catch build issues
4. **Manual Testing** - Use comprehensive tests for complex changes

This approach balances speed with safety, ensuring rapid development without sacrificing code quality.
