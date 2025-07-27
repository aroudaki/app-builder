# Docker Container Migration Plan

## Overview
This document outlines the migration from the current mock container system to real Docker containers. The implementation is organized in two phases: **Local Docker Implementation** first, followed by **Azure Cloud Deployment** once local testing is complete.

## Current vs Target Architecture

### Current State
- Mock container using temp directories
- Node.js child processes for command execution
- File system isolation through path mapping

### Target State - Phase 1 (Local)
- Real Docker containers for each user session
- Docker Desktop for local development
- Docker API for container management

### Target State - Phase 2 (Azure)
- Azure Container Instances (ACI) for production
- Azure Container Registry for image storage
- Azure Web App Service deployment

---

## Phase 1: Local Docker Implementation

### Task 1.1: Local Development Environment Setup
### Task 1.1: Local Development Environment Setup
- [ ] Install Docker Desktop locally
- [ ] Verify Docker daemon is running
- [ ] Test basic Docker commands (`docker ps`, `docker run hello-world`)
- [ ] Create `docker-compose.yml` in project root for development

```yaml
version: '3.8'
services:
  app-builder-server:
    build: ./apps/server
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - CONTAINER_RUNTIME=docker
      - NODE_ENV=development
```

### Task 1.2: Base Docker Image Creation
- [ ] Create `docker/base/Dockerfile` with React environment
- [ ] Install Node.js 18 and necessary tools
- [ ] Configure working directory and permissions
- [ ] Install global npm packages required for React development
- [ ] Set up proper entrypoint and health checks

```dockerfile
FROM node:18-alpine

# Install necessary tools
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Install global npm packages
RUN npm install -g \
    vite \
    typescript \
    @types/node \
    @types/react \
    @types/react-dom

# Create package.json for base React app
COPY package.base.json ./package.json

# Install base dependencies
RUN npm install

# Copy base app structure
COPY ./base-app ./

# Expose port for dev server
EXPOSE 3001

# Default command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### Task 1.3: Create Base Package Configuration
- [ ] Create `docker/base/package.base.json` with React dependencies
- [ ] Include all necessary dev dependencies
- [ ] Configure scripts for development and building

```json
{
  "name": "react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

### Task 1.4: Create Base App Structure
- [ ] Create `docker/base/base-app/` directory structure
- [ ] Add boilerplate React files (App.tsx, main.tsx, index.html)
- [ ] Configure Vite and Tailwind CSS
- [ ] Add TypeScript configuration

### Task 1.5: Build and Test Base Image
- [ ] Build the base Docker image locally
- [ ] Test image creation and startup
- [ ] Verify React app runs correctly in container
- [ ] Test port mapping and connectivity

```bash
# Build the base image
cd docker/base
docker build -t app-builder-base:latest .

# Test the image
docker run -p 3001:3001 app-builder-base:latest
```

---

### Task 2.1: Docker Container Manager Implementation
### Task 2.1: Docker Container Manager Implementation
- [ ] Install dockerode dependency (`npm install dockerode @types/dockerode`)
- [ ] Create `apps/server/src/services/DockerContainerManager.ts`
- [ ] Implement `createContainer()` method with proper configuration
- [ ] Implement `executeCommand()` method for running shell commands
- [ ] Implement `stopContainer()` method for cleanup
- [ ] Add container lifecycle management
- [ ] Add error handling and logging

```typescript
export class DockerContainerManager {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  
  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
    });
  }

  async createContainer(config: ContainerConfig): Promise<string> {
    const container = await this.docker.createContainer({
      Image: config.image || 'app-builder-base:latest',
      name: `app-builder-${config.conversationId}`,
      HostConfig: {
        Memory: config.memory || 512 * 1024 * 1024,
        CpuShares: config.cpu || 512,
        AutoRemove: false,
        NetworkMode: 'bridge',
        PortBindings: {
          '3001/tcp': [{ HostPort: '0' }]
        }
      },
      Env: [
        `CONVERSATION_ID=${config.conversationId}`,
        'NODE_ENV=development'
      ],
      WorkingDir: '/app'
    });

    await container.start();
    this.containers.set(config.conversationId, container);
    return container.id;
  }

  async executeCommand(conversationId: string, command: string): Promise<CommandResult> {
    const container = this.containers.get(conversationId);
    if (!container) throw new Error('Container not found');

    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/app'
    });

    const stream = await exec.start({ Detach: false });
    return this.parseExecStream(stream);
  }

  async stopContainer(conversationId: string): Promise<void> {
    const container = this.containers.get(conversationId);
    if (container) {
      await container.stop();
      await container.remove();
      this.containers.delete(conversationId);
    }
  }
}
```

### Task 2.2: Container Runtime Interface
- [ ] Create `apps/server/src/services/ContainerRuntime.ts` interface
- [ ] Define common methods for all container runtimes
- [ ] Create factory pattern for runtime selection (Docker only for now)
- [ ] Add proper TypeScript interfaces for all operations

```typescript
export interface ContainerRuntime {
  createContainer(config: ContainerConfig): Promise<string>;
  executeCommand(containerId: string, command: string): Promise<CommandResult>;
  getContainerUrl(containerId: string): Promise<string>;
  stopContainer(containerId: string): Promise<void>;
  uploadFiles(containerId: string, files: FileUpload[]): Promise<void>;
  downloadFiles(containerId: string, paths: string[]): Promise<FileDownload[]>;
}

export class ContainerRuntimeFactory {
  static create(): ContainerRuntime {
    const runtime = process.env.CONTAINER_RUNTIME || 'docker';
    
    switch (runtime) {
      case 'docker':
        return new DockerContainerManager();
      default:
        throw new Error(`Unknown container runtime: ${runtime}`);
    }
  }
}
```

### Task 2.3: Configuration Interfaces
- [ ] Define `ContainerConfig` interface
- [ ] Define `FileUpload` and `FileDownload` interfaces
- [ ] Add validation for configuration parameters
- [ ] Create type guards for runtime detection

---

### Task 3.1: Update AppContainer Tool
### Task 3.1: Update AppContainer to Use Runtime Abstraction
- [ ] Modify `apps/server/src/tools/appContainer.ts`
- [ ] Replace direct file system operations with container runtime calls
- [ ] Update `executeCommand()` method to use container runtime
- [ ] Add proper initialization and cleanup methods
- [ ] Remove all mock container logic

```typescript
export class AppContainer {
  private runtime: ContainerRuntime;
  private containerId?: string;
  
  constructor(private conversationId: string) {
    this.runtime = ContainerRuntimeFactory.create();
  }

  async initialize(): Promise<void> {
    this.containerId = await this.runtime.createContainer({
      conversationId: this.conversationId,
      image: 'app-builder-base:latest'
    });

    // Initialize with boilerplate files
    await this.runtime.uploadFiles(this.containerId, [
      { path: '/app/src/App.tsx', content: this.getBoilerplateApp() },
      { path: '/app/src/main.tsx', content: this.getBoilerplateMain() },
      // ... other files
    ]);
  }

  async executeCommand(command: string): Promise<CommandResult> {
    if (!this.containerId) throw new Error('Container not initialized');
    return this.runtime.executeCommand(this.containerId, command);
  }

  async getDevServerUrl(): Promise<string> {
    if (!this.containerId) throw new Error('Container not initialized');
    return this.runtime.getContainerUrl(this.containerId);
  }

  async cleanup(): Promise<void> {
    if (this.containerId) {
      await this.runtime.stopContainer(this.containerId);
    }
  }
}
```

### Task 3.2: Update Agent Integration
- [ ] Modify agents to call `initialize()` before using containers
- [ ] Add proper cleanup in agent execution lifecycle
- [ ] Update error handling for container-specific errors
- [ ] Add retry logic for container operations
- [ ] Remove all references to mock container system

---

### Task 4.1: Local Testing and Validation
- [ ] Test container creation and startup
- [ ] Test command execution in containers
- [ ] Test file upload/download functionality
- [ ] Test React app generation and modification
- [ ] Test container cleanup and resource management
- [ ] Verify base64 file modification still works in containers
- [ ] Test multiple concurrent containers
- [ ] Performance testing vs mock system

### Task 4.2: Security and Resource Management
- [ ] Implement container resource limits (CPU, memory)
- [ ] Add container timeout policies
- [ ] Configure security options and capabilities
- [ ] Test container isolation
- [ ] Add network isolation for containers

```typescript
export class ContainerSecurity {
  static getSecurityOptions(): Docker.ContainerCreateOptions {
    return {
      HostConfig: {
        ReadonlyRootfs: false,
        CapDrop: ['ALL'],
        CapAdd: ['CHOWN', 'SETUID', 'SETGID'],
        SecurityOpt: ['no-new-privileges'],
        Resources: {
          CpuQuota: 50000, // 50% CPU
          Memory: 512 * 1024 * 1024, // 512MB
          MemorySwap: 512 * 1024 * 1024,
          PidsLimit: 100
        }
      }
    };
  }
}
```

### Task 4.3: Monitoring and Logging
- [ ] Add container health checks
- [ ] Implement container statistics collection
- [ ] Add structured logging for container operations
- [ ] Create basic monitoring dashboard

---

## Phase 2: Azure Cloud Implementation

### Task 5.1: Azure Infrastructure Setup
- [ ] Create Azure Resource Group
- [ ] Set up Azure Container Registry (ACR)
- [ ] Configure Azure Container Instances
- [ ] Set up Azure Storage for persistent data
- [ ] Configure networking and security groups

```terraform
# infrastructure/terraform/main.tf
resource "azurerm_container_registry" "acr" {
  name                = "appbuilderacr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
}

resource "azurerm_container_group" "aci_pool" {
  # Container instances for user apps
}

resource "azurerm_storage_account" "storage" {
  # For persistent storage of generated apps
}
```

### Task 5.2: Azure Container Manager Implementation
- [ ] Install Azure SDK dependencies
- [ ] Create `apps/server/src/services/AzureContainerManager.ts`
- [ ] Implement Azure Container Instances API integration
- [ ] Add authentication with Azure credentials
- [ ] Implement container lifecycle management for ACI
- [ ] Add proper error handling for Azure-specific issues

```typescript
export class AzureContainerManager {
  private client: ContainerInstanceManagementClient;
  private resourceGroup: string;
  
  constructor() {
    const credential = new DefaultAzureCredential();
    this.client = new ContainerInstanceManagementClient(
      credential,
      process.env.AZURE_SUBSCRIPTION_ID!
    );
    this.resourceGroup = process.env.AZURE_RESOURCE_GROUP!;
  }

  async createContainer(config: ContainerConfig): Promise<string> {
    const containerGroup = await this.client.containerGroups.beginCreateOrUpdate(
      this.resourceGroup,
      `app-builder-${config.conversationId}`,
      {
        location: process.env.AZURE_LOCATION || 'eastus',
        containers: [{
          name: 'app-container',
          image: `${process.env.ACR_URL}/app-builder-base:latest`,
          resources: {
            requests: {
              cpu: 0.5,
              memoryInGB: 0.5
            }
          },
          ports: [{ port: 3001 }],
          environmentVariables: [
            { name: 'CONVERSATION_ID', value: config.conversationId }
          ]
        }],
        osType: 'Linux',
        ipAddress: {
          type: 'Public',
          ports: [{ protocol: 'TCP', port: 3001 }]
        },
        imageRegistryCredentials: [{
          server: process.env.ACR_URL!,
          username: process.env.ACR_USERNAME!,
          password: process.env.ACR_PASSWORD!
        }]
      }
    );

    return containerGroup.id!;
  }

  async executeCommand(conversationId: string, command: string): Promise<CommandResult> {
    const response = await this.client.containers.executeCommand(
      this.resourceGroup,
      `app-builder-${conversationId}`,
      'app-container',
      {
        command: command,
        terminalSize: { rows: 24, cols: 80 }
      }
    );

    return {
      stdout: response.standardOutput || '',
      stderr: response.standardError || '',
      exitCode: response.exitCode || 0
    };
  }
}
```

### Task 5.3: Update Container Runtime Factory
- [ ] Update `ContainerRuntimeFactory` to support Azure runtime
- [ ] Add environment-based runtime selection
- [ ] Test Azure container creation and management

```typescript
export class ContainerRuntimeFactory {
  static create(): ContainerRuntime {
    const runtime = process.env.CONTAINER_RUNTIME || 'docker';
    
    switch (runtime) {
      case 'docker':
        return new DockerContainerManager();
      case 'azure':
        return new AzureContainerManager();
      default:
        throw new Error(`Unknown container runtime: ${runtime}`);
    }
  }
}
```

---

### Task 6.1: Azure Deployment Pipeline
### Task 6.1: Azure Deployment Pipeline
- [ ] Create `azure-pipelines.yml` in project root
- [ ] Configure Docker image builds for both server and base images
- [ ] Set up Azure Container Registry integration
- [ ] Configure deployment to Azure Web App

```yaml
trigger:
  - main

variables:
  azureSubscription: 'Azure Subscription'
  resourceGroup: 'app-builder-rg'
  webAppName: 'app-builder-webapp'
  acrName: 'appbuilderacr'

stages:
  - stage: Build
    jobs:
      - job: BuildImages
        steps:
          - task: Docker@2
            inputs:
              containerRegistry: $(acrName)
              repository: 'app-builder-server'
              command: 'buildAndPush'
              Dockerfile: 'apps/server/Dockerfile'
          
          - task: Docker@2
            inputs:
              containerRegistry: $(acrName)
              repository: 'app-builder-base'
              command: 'buildAndPush'
              Dockerfile: 'docker/base/Dockerfile'

  - stage: Deploy
    jobs:
      - job: DeployWebApp
        steps:
          - task: AzureWebAppContainer@1
            inputs:
              azureSubscription: $(azureSubscription)
              appName: $(webAppName)
              containers: |
                $(acrName).azurecr.io/app-builder-server:$(Build.BuildId)
```

### Task 6.2: Configure Environment Variables
- [ ] Set up Azure Web App environment variables
- [ ] Configure Azure Container Registry credentials
- [ ] Set up Azure Storage connection strings
- [ ] Configure container runtime selection

```bash
# Azure Web App Configuration
CONTAINER_RUNTIME=azure
AZURE_SUBSCRIPTION_ID=xxx
AZURE_RESOURCE_GROUP=app-builder-rg
ACR_URL=appbuilderacr.azurecr.io
ACR_USERNAME=xxx
ACR_PASSWORD=xxx
AZURE_STORAGE_CONNECTION_STRING=xxx
```

### Task 6.3: Production Deployment
- [ ] Deploy Docker images to Azure Container Registry
- [ ] Update Azure Web App configuration
- [ ] Switch container runtime to Azure in production
- [ ] Monitor system performance and user experience

---

### Task 7.1: Final Testing and Documentation
- [ ] End-to-end testing of complete workflow
- [ ] Test todo app generation with real Docker containers
- [ ] Verify Azure deployment works correctly
- [ ] Update API documentation for new container methods
- [ ] Create deployment guides for Azure
- [ ] Document troubleshooting procedures
- [ ] Update development setup instructions

---

## Implementation Phases Summary

### Phase 1: Local Docker (Complete First)
1. **Infrastructure Setup** - Docker Desktop, base images
2. **Docker Manager** - Local container management
3. **AppContainer Update** - Integration with Docker runtime
4. **Local Testing** - Full validation before Azure

### Phase 2: Azure Cloud (After Local Success)
5. **Azure Infrastructure** - ACR, ACI, storage
6. **Azure Manager** - Cloud container management  
7. **Deployment Pipeline** - CI/CD and production deployment
8. **Final Testing** - End-to-end cloud validation

## Benefits of Real Docker Containers

1. **True Isolation**: Complete process and filesystem isolation
2. **Scalability**: Horizontal scaling with Azure Container Instances
3. **Security**: Proper sandboxing and resource limits
4. **Portability**: Consistent environment across local and cloud
5. **Monitoring**: Better observability and debugging capabilities

## Success Criteria

### Phase 1 (Local) Success Criteria
- [ ] Docker containers create and start successfully
- [ ] All existing functionality works with Docker containers
- [ ] Performance is equal or better than mock system
- [ ] Proper resource isolation and security
- [ ] Base64 file modification works correctly in containers
- [ ] React apps generate and run properly in containers

### Phase 2 (Azure) Success Criteria  
- [ ] Successful deployment to Azure Web App Service
- [ ] Azure Container Instances work correctly
- [ ] Cost-effective scaling in Azure
- [ ] Production monitoring and logging functional

---

This migration plan is organized to ensure **local Docker implementation is fully working and tested** before proceeding to Azure cloud deployment, reducing risk and ensuring a solid foundation.

This migration plan provides a comprehensive roadmap for transitioning from mock containers to real Docker containers while maintaining system reliability and ensuring smooth deployment to Azure.
