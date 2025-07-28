/**
 * Container service types and interfaces
 */

export interface ContainerConfig {
    conversationId: string;
    image?: string;
    memory?: number; // Memory limit in bytes
    cpu?: number; // CPU shares (Docker shares, relative weight)
    port?: number; // Host port for dev server
    workingDir?: string;
    environment?: Record<string, string>;
}

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface FileUpload {
    path: string;
    content: string;
    mode?: string; // File permissions (e.g., '0755')
}

export interface FileDownload {
    path: string;
    content: string;
    size: number;
    modified: Date;
}

export interface ContainerInfo {
    id: string;
    name: string;
    status: string;
    ports: string[];
    created: Date;
    conversationId: string;
}

export interface ContainerStats {
    memory: {
        usage: number;
        limit: number;
        percentage: number;
    };
    cpu: {
        usage: number;
        percentage: number;
    };
    network: {
        rx: number;
        tx: number;
    };
}

/**
 * Container Runtime Interface
 * Defines the common API for all container runtime implementations
 */
export interface ContainerRuntime {
    /**
     * Create and start a new container
     */
    createContainer(config: ContainerConfig): Promise<string>;

    /**
     * Execute a command in the container
     */
    executeCommand(containerId: string, command: string): Promise<CommandResult>;

    /**
     * Get the URL to access the container's dev server
     */
    getContainerUrl(containerId: string): Promise<string>;

    /**
     * Upload files to the container
     */
    uploadFiles(containerId: string, files: FileUpload[]): Promise<void>;

    /**
     * Download files from the container
     */
    downloadFiles(containerId: string, paths: string[]): Promise<FileDownload[]>;

    /**
     * Get container information
     */
    getContainerInfo(containerId: string): Promise<ContainerInfo>;

    /**
     * Get container statistics
     */
    getContainerStats(containerId: string): Promise<ContainerStats>;

    /**
     * Check if container is running
     */
    isContainerRunning(containerId: string): Promise<boolean>;

    /**
     * Stop and remove the container
     */
    stopContainer(containerId: string): Promise<void>;

    /**
     * List all containers managed by this runtime
     */
    listContainers(): Promise<ContainerInfo[]>;

    /**
     * Clean up all containers (for maintenance)
     */
    cleanup(): Promise<void>;
}

/**
 * Container Security Configuration
 */
export interface SecurityOptions {
    readonlyRootfs?: boolean;
    capDrop?: string[];
    capAdd?: string[];
    securityOpt?: string[];
    noNewPrivileges?: boolean;
}

/**
 * Container Resource Limits
 */
export interface ResourceLimits {
    memory?: number; // Memory limit in bytes
    memorySwap?: number; // Memory + swap limit
    cpuQuota?: number; // CPU quota in microseconds
    cpuPeriod?: number; // CPU period in microseconds
    cpuShares?: number; // CPU shares (relative weight)
    pidsLimit?: number; // Maximum number of processes
}

/**
 * Network Configuration
 */
export interface NetworkConfig {
    networkMode?: string;
    portBindings?: Record<string, Array<{ HostPort: string }>>;
    exposedPorts?: Record<string, {}>;
}

/**
 * Container Creation Options
 */
export interface ContainerCreateOptions {
    Image: string;
    name?: string;
    Env?: string[];
    WorkingDir?: string;
    Cmd?: string[];
    ExposedPorts?: Record<string, {}>;
    HostConfig?: {
        Memory?: number;
        MemorySwap?: number;
        CpuShares?: number;
        CpuQuota?: number;
        CpuPeriod?: number;
        PidsLimit?: number;
        AutoRemove?: boolean;
        NetworkMode?: string;
        PortBindings?: Record<string, Array<{ HostPort: string }>>;
        ReadonlyRootfs?: boolean;
        CapDrop?: string[];
        CapAdd?: string[];
        SecurityOpt?: string[];
        Resources?: ResourceLimits;
    };
}

/**
 * Exec Options for command execution
 */
export interface ExecOptions {
    Cmd: string[];
    AttachStdout?: boolean;
    AttachStderr?: boolean;
    AttachStdin?: boolean;
    Tty?: boolean;
    WorkingDir?: string;
    Env?: string[];
    User?: string;
}

/**
 * Stream processing result
 */
export interface StreamResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Container error types
 */
export class ContainerError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly containerId?: string
    ) {
        super(message);
        this.name = 'ContainerError';
    }
}

export class ContainerNotFoundError extends ContainerError {
    constructor(containerId: string) {
        super(`Container not found: ${containerId}`, 'CONTAINER_NOT_FOUND', containerId);
        this.name = 'ContainerNotFoundError';
    }
}

export class ContainerExecutionError extends ContainerError {
    constructor(
        message: string,
        public readonly exitCode: number,
        containerId?: string
    ) {
        super(message, 'EXECUTION_ERROR', containerId);
        this.name = 'ContainerExecutionError';
    }
}

export class ContainerTimeoutError extends ContainerError {
    constructor(containerId: string, timeout: number) {
        super(`Container operation timed out after ${timeout}ms: ${containerId}`, 'TIMEOUT', containerId);
        this.name = 'ContainerTimeoutError';
    }
}
