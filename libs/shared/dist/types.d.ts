export interface ClientMessage {
    type: 'GENERATE_APP' | 'UPDATE_APP' | 'GET_STATUS';
    payload: any;
    messageId: string;
}
export interface ServerMessage {
    type: 'PROGRESS' | 'COMPLETE' | 'ERROR' | 'STATUS';
    payload: any;
    messageId?: string;
}
export interface AppGenerationRequest {
    description: string;
    features?: string[];
    targetFramework?: 'react' | 'vue' | 'angular';
    styling?: 'tailwind' | 'css' | 'styled-components';
}
export interface AppGenerationProgress {
    step: string;
    progress: number;
    logs: string[];
}
export interface GeneratedApp {
    name: string;
    framework: string;
    files: GeneratedFile[];
    packageJson: object;
    readme: string;
}
export interface GeneratedFile {
    path: string;
    content: string;
    type: 'component' | 'page' | 'style' | 'config' | 'other';
}
export interface Agent {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    status: 'idle' | 'working' | 'error';
}
export interface AgentTask {
    id: string;
    agentId: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
}
export interface Pipeline {
    id: string;
    name: string;
    steps: PipelineStep[];
    status: 'pending' | 'running' | 'completed' | 'failed';
}
export interface PipelineStep {
    id: string;
    name: string;
    agentId: string;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: any;
}
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
}
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map