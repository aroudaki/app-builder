FROM node:18-alpine

# Install necessary tools and dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    make \
    g++ \
    # For better shell experience
    ncurses \
    && rm -rf /var/cache/apk/*

# Install pnpm globally
RUN npm install -g pnpm@9.6.0

# Create app user for security
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

# Create app directory with proper permissions
WORKDIR /generated-app
RUN chown -R appuser:appuser /generated-app

# Switch to app user
USER appuser

# Copy package files first (this layer will be cached)
# Note: This is the starting point that will be modified based on user requests
COPY --chown=appuser:appuser ./generated-app/package.json ./generated-app/pnpm-lock.yaml ./

# Install dependencies using pnpm (this layer will be cached when package files don't change)
RUN pnpm install --frozen-lockfile && \
    pnpm store prune

# Copy the rest of the boilerplate app
# This forms the base that the coding agent will modify
COPY --chown=appuser:appuser ./generated-app/ ./

# Pre-build the app to cache build artifacts
RUN pnpm run build || true

# Create directories that will be used during runtime
RUN mkdir -p /generated-app/src /generated-app/public /generated-app/dist

# Expose port for dev server
EXPOSE 3001

# Health check to ensure container is ready
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Container is healthy')" || exit 1

# Use bash as the default shell for exec commands
SHELL ["/bin/bash", "-c"]

# Default command keeps container running and ready for exec commands
CMD ["tail", "-f", "/dev/null"]
