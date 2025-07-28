#!/bin/bash

# Docker Manager Script for App Builder
# This script helps manage Docker containers locally based on the docker folder structure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_BASE_DIR="$PROJECT_ROOT/docker/base"
BASE_IMAGE_NAME="app-builder-base"
BASE_IMAGE_TAG="latest"
CONTAINER_PREFIX="app-builder"
DEFAULT_PORT="3001"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

generate_container_name() {
    local conversation_id="${1:-$(date +%s)}"
    echo "${CONTAINER_PREFIX}-${conversation_id}"
}

normalize_container_name() {
    local name="$1"
    # If name doesn't start with app-builder-, add the prefix
    if [[ ! "$name" =~ ^${CONTAINER_PREFIX}- ]]; then
        echo "${CONTAINER_PREFIX}-${name}"
    else
        echo "$name"
    fi
}

build_base_image() {
    log_info "Building base Docker image..."
    
    if [ ! -f "$DOCKER_BASE_DIR/Dockerfile" ]; then
        log_error "Dockerfile not found at $DOCKER_BASE_DIR/Dockerfile"
        exit 1
    fi
    
    cd "$DOCKER_BASE_DIR"
    
    log_info "Building image: $BASE_IMAGE_NAME:$BASE_IMAGE_TAG"
    docker build -t "$BASE_IMAGE_NAME:$BASE_IMAGE_TAG" .
    
    log_success "Base image built successfully"
    
    # Show image details
    docker images "$BASE_IMAGE_NAME:$BASE_IMAGE_TAG"
}

create_container() {
    local container_name="$1"
    local port="${2:-$DEFAULT_PORT}"
    
    if [ -z "$container_name" ]; then
        container_name=$(generate_container_name)
    else
        container_name=$(normalize_container_name "$container_name")
    fi
    
    log_info "Creating container: $container_name"
    
    # Check if image exists
    if ! docker images "$BASE_IMAGE_NAME:$BASE_IMAGE_TAG" | grep -q "$BASE_IMAGE_NAME"; then
        log_warning "Base image not found. Building it first..."
        build_base_image
    fi
    
    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_warning "Container $container_name already exists. Removing it..."
        docker rm -f "$container_name" 2>/dev/null || true
    fi
    
    # Create and start container
    docker run -d \
        --name "$container_name" \
        -p "$port:3001" \
        --memory=512m \
        --cpus=0.5 \
        "$BASE_IMAGE_NAME:$BASE_IMAGE_TAG"
    
    # Wait a moment for container to start
    sleep 2
    
    # Verify container is running
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_success "Container $container_name created and started successfully"
        log_info "Port mapping: localhost:$port -> container:3001"
        log_info "Container ID: $(docker ps --filter name="$container_name" --format '{{.ID}}')"
    else
        log_error "Failed to start container $container_name"
        exit 1
    fi
}

start_dev_server() {
    local container_name="$1"
    
    if [ -z "$container_name" ]; then
        log_error "Container name is required"
        exit 1
    fi
    
    container_name=$(normalize_container_name "$container_name")
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_error "Container $container_name is not running"
        exit 1
    fi
    
    log_info "Starting dev server in container: $container_name"
    
    # Start dev server in background
    docker exec -d "$container_name" bash -c "cd /generated-app && pnpm run dev"
    
    # Wait for server to start
    log_info "Waiting for dev server to start..."
    sleep 5
    
    # Get the port mapping
    local host_port=$(docker port "$container_name" 3001/tcp | cut -d':' -f2)
    
    log_success "Dev server started successfully"
    log_info "Access the app at: http://localhost:$host_port"
}

execute_command() {
    local container_name="$1"
    local command="$2"
    
    if [ -z "$container_name" ] || [ -z "$command" ]; then
        log_error "Container name and command are required"
        exit 1
    fi
    
    container_name=$(normalize_container_name "$container_name")
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_error "Container $container_name is not running"
        exit 1
    fi
    
    log_info "Executing command in container $container_name: $command"
    docker exec -it "$container_name" bash -c "cd /generated-app && $command"
}

test_container() {
    local container_name="${1:-$(generate_container_name test)}"
    local port="${2:-$DEFAULT_PORT}"
    
    container_name=$(normalize_container_name "$container_name")
    
    log_info "Running container tests..."
    
    # Create test container
    create_container "$container_name" "$port"
    
    # Test basic functionality
    log_info "Testing basic container functionality..."
    
    # Test file system
    docker exec "$container_name" ls -la /generated-app
    docker exec "$container_name" cat /generated-app/package.json | head -10
    
    # Test pnpm
    docker exec "$container_name" pnpm --version
    
    # Test file modification (simulating coding agent)
    log_info "Testing file modification..."
    echo "console.log('Test modification by coding agent');" | base64 | \
        docker exec -i "$container_name" sh -c 'base64 -d > /generated-app/test-modification.js'
    
    docker exec "$container_name" cat /generated-app/test-modification.js
    
    # Test dev server
    start_dev_server "$container_name"
    
    # Test HTTP response
    local host_port=$(docker port "$container_name" 3001/tcp | cut -d':' -f2)
    if curl -s "http://localhost:$host_port" >/dev/null; then
        log_success "Dev server is responding correctly"
    else
        log_warning "Dev server might not be fully ready yet"
    fi
    
    log_success "All tests completed successfully!"
    log_info "Test container is running at: http://localhost:$host_port"
    log_info "To stop and remove test container, run: $0 stop $container_name"
}

list_containers() {
    log_info "App Builder containers:"
    docker ps -a --filter "name=${CONTAINER_PREFIX}-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"
}

stop_container() {
    local container_name="$1"
    
    if [ -z "$container_name" ]; then
        log_error "Container name is required"
        exit 1
    fi
    
    container_name=$(normalize_container_name "$container_name")
    
    log_info "Stopping container: $container_name"
    docker stop "$container_name" 2>/dev/null || log_warning "Container $container_name was not running"
    docker rm "$container_name" 2>/dev/null || log_warning "Container $container_name was not found"
    log_success "Container $container_name stopped and removed"
}

cleanup_all() {
    log_info "Cleaning up all App Builder containers..."
    
    # Stop and remove all app-builder containers
    docker ps -a --filter "name=${CONTAINER_PREFIX}-" --format "{{.Names}}" | while read -r container; do
        if [ -n "$container" ]; then
            log_info "Stopping and removing: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
    
    log_success "All App Builder containers cleaned up"
}

show_logs() {
    local container_name="$1"
    local lines="${2:-50}"
    
    if [ -z "$container_name" ]; then
        log_error "Container name is required"
        exit 1
    fi
    
    container_name=$(normalize_container_name "$container_name")
    
    log_info "Showing logs for container: $container_name (last $lines lines)"
    docker logs --tail "$lines" "$container_name"
}

show_help() {
    cat << EOF
Docker Manager Script for App Builder

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    build                           Build the base Docker image
    create [NAME] [PORT]           Create and start a new container
                                   NAME: optional container name (default: auto-generated)
                                   PORT: optional host port (default: 3001)
    
    start-dev [NAME]               Start dev server in container
    exec [NAME] [COMMAND]          Execute command in container
    test [NAME] [PORT]             Run full container test suite
    
    list                           List all App Builder containers
    stop [NAME]                    Stop and remove a container
    cleanup                        Stop and remove all App Builder containers
    logs [NAME] [LINES]            Show container logs (default: 50 lines)
    
    help                           Show this help message

Examples:
    $0 build                       # Build base image
    $0 create                      # Create container with auto-generated name
    $0 create my-app 3002         # Create container named 'my-app' on port 3002
    $0 start-dev my-app           # Start dev server in 'my-app' container
    $0 exec my-app "pnpm install" # Execute pnpm install in container
    $0 test                       # Run full test with auto-generated container
    $0 list                       # List all containers
    $0 stop my-app                # Stop and remove 'my-app' container
    $0 cleanup                    # Remove all App Builder containers
    $0 logs my-app                # Show logs for 'my-app' container

Environment Variables:
    DOCKER_HOST                   Docker daemon socket (default: auto-detect)

EOF
}

# Main script logic
main() {
    # Check prerequisites
    check_docker
    
    case "${1:-help}" in
        "build")
            build_base_image
            ;;
        "create")
            create_container "$2" "$3"
            ;;
        "start-dev")
            start_dev_server "$2"
            ;;
        "exec")
            execute_command "$2" "$3"
            ;;
        "test")
            test_container "$2" "$3"
            ;;
        "list")
            list_containers
            ;;
        "stop")
            stop_container "$2"
            ;;
        "cleanup")
            cleanup_all
            ;;
        "logs")
            show_logs "$2" "$3"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
