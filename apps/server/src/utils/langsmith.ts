/**
 * LangSmith Configuration and Utilities
 * 
 * This module provides utilities for configuring and working with LangSmith
 * for observability and tracing in the AI App Builder.
 */

import { Client } from 'langsmith';

/**
 * LangSmith configuration interface
 */
export interface LangSmithConfig {
    apiKey?: string;
    project?: string;
    tracingEnabled?: boolean;
}

/**
 * Initialize LangSmith configuration
 * 
 * This function sets up the environment variables needed for LangSmith tracing
 * and returns a client instance if API key is available.
 * 
 * @param config - Optional configuration object
 * @returns LangSmith client instance or null if not configured
 */
export function initializeLangSmith(config?: LangSmithConfig): Client | null {
    const apiKey = config?.apiKey || process.env.LANGSMITH_API_KEY;
    const project = config?.project || process.env.LANGSMITH_PROJECT || 'app-builder';
    const tracingEnabled = config?.tracingEnabled !== false &&
        (process.env.LANGSMITH_TRACING === 'true' || config?.tracingEnabled);

    if (!apiKey) {
        console.warn('⚠️  LangSmith API key not found - tracing disabled');
        return null;
    }

    if (tracingEnabled) {
        // Set LangChain environment variables for automatic tracing
        process.env.LANGCHAIN_TRACING_V2 = 'true';
        process.env.LANGCHAIN_PROJECT = project;
        process.env.LANGCHAIN_API_KEY = apiKey;

        console.log(`🔍 LangSmith tracing enabled for project: ${project}`);

        try {
            return new Client({
                apiKey,
                // You can add additional configuration here
            });
        } catch (error) {
            console.error('❌ Failed to initialize LangSmith client:', error);
            return null;
        }
    } else {
        console.log('📊 LangSmith tracing disabled');
        return null;
    }
}

/**
 * Check if LangSmith is properly configured
 * 
 * @returns True if LangSmith can be used
 */
export function isLangSmithConfigured(): boolean {
    return Boolean(process.env.LANGSMITH_API_KEY);
}

/**
 * Get current LangSmith configuration status
 * 
 * @returns Configuration status object
 */
export function getLangSmithStatus() {
    return {
        configured: isLangSmithConfigured(),
        tracingEnabled: process.env.LANGCHAIN_TRACING_V2 === 'true',
        project: process.env.LANGCHAIN_PROJECT || 'app-builder',
        apiKeyPresent: Boolean(process.env.LANGSMITH_API_KEY),
    };
}

/**
 * Create a run name for LangSmith traces
 * 
 * @param operation - The operation being performed
 * @param details - Additional details to include in the name
 * @returns Formatted run name
 */
export function createRunName(operation: string, details?: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const suffix = details ? `-${details}` : '';
    return `${operation}-${timestamp}${suffix}`;
}

/**
 * Add metadata to a LangSmith run
 * 
 * This can be used to add custom metadata to traces for better organization
 * and filtering in the LangSmith UI.
 * 
 * @param metadata - Metadata object to add
 * @returns Metadata formatted for LangSmith
 */
export function formatMetadata(metadata: Record<string, any>): Record<string, any> {
    return {
        ...metadata,
        timestamp: new Date().toISOString(),
        service: 'ai-app-builder',
        version: process.env.npm_package_version || '1.0.0',
    };
}

/**
 * Tags for categorizing different types of operations
 */
export const LANGSMITH_TAGS = {
    AGENT: 'agent',
    WORKFLOW: 'workflow',
    PIPELINE: 'pipeline',
    TOOL: 'tool',
    CLARIFICATION: 'clarification',
    REQUIREMENTS: 'requirements',
    WIREFRAME: 'wireframe',
    CODING: 'coding',
    MODIFICATION: 'modification',
    VALIDATION: 'validation',
    ERROR: 'error',
    SUCCESS: 'success',
} as const;

/**
 * Helper to create standardized tags for LangSmith runs
 * 
 * @param operation - The main operation type
 * @param additional - Additional tags to include
 * @returns Array of tags for LangSmith
 */
export function createTags(
    operation: keyof typeof LANGSMITH_TAGS,
    ...additional: string[]
): string[] {
    return [LANGSMITH_TAGS[operation], ...additional];
}

/**
 * Environment validation for LangSmith
 * 
 * @throws Error if LangSmith is enabled but not properly configured
 */
export function validateLangSmithEnvironment(): void {
    const tracingEnabled = process.env.LANGSMITH_TRACING === 'true';

    if (tracingEnabled && !process.env.LANGSMITH_API_KEY) {
        throw new Error(
            'LangSmith tracing is enabled but LANGSMITH_API_KEY is not set. ' +
            'Please add your LangSmith API key to the .env file or disable tracing.'
        );
    }
}

/**
 * Test LangSmith connectivity
 * 
 * @param client - LangSmith client instance
 * @returns Promise that resolves if connection is successful
 */
export async function testLangSmithConnection(client: Client): Promise<void> {
    try {
        // Test the connection by getting the current project
        const projectName = process.env.LANGCHAIN_PROJECT || 'app-builder';
        await client.readProject({ projectName });
        console.log('✅ LangSmith connection test successful');
    } catch (error) {
        console.error('❌ LangSmith connection test failed:', error);
        throw error;
    }
}
