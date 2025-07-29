#!/bin/bash

# Change to server directory
cd "${WORKSPACE_FOLDER:-$(dirname "$0")/..}/apps/server"

# Start the server with debugging enabled
exec npx tsx watch --inspect=9229 src/server.ts
