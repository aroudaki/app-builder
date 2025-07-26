import { AgentConfig } from '@shared/index.js';
import { BaseAgent } from './index.js';
import { clarificationAgentConfig } from './clarificationAgent.js';
import { requirementsAgentConfig } from './requirementsAgent.js';
import { wireframeAgentConfig } from './wireframeAgent.js';
import { codingAgentConfig } from './codingAgent.js';
import { modificationAgentConfig } from './modificationAgent.js';

/**
 * Agent Registry - Central management of all available agents
 */
export class AgentRegistry {
    private static agents: Map<string, AgentConfig> = new Map();

    static {
        // Register all available agents
        this.registerAgent(clarificationAgentConfig);
        this.registerAgent(requirementsAgentConfig);
        this.registerAgent(wireframeAgentConfig);
        this.registerAgent(codingAgentConfig);
        this.registerAgent(modificationAgentConfig);
    }

    /**
     * Register a new agent configuration
     */
    static registerAgent(config: AgentConfig): void {
        this.agents.set(config.name, config);
        console.log(`🤖 Registered agent: ${config.name}`);
    }

    /**
     * Get an agent configuration by name
     */
    static getAgentConfig(name: string): AgentConfig | undefined {
        return this.agents.get(name);
    }

    /**
     * Create an agent instance by name
     */
    static createAgent(name: string): BaseAgent {
        const config = this.getAgentConfig(name);
        if (!config) {
            throw new Error(`Agent not found: ${name}`);
        }
        return new BaseAgent(config);
    }

    /**
     * Get all registered agent names
     */
    static getAvailableAgents(): string[] {
        return Array.from(this.agents.keys());
    }

    /**
     * Get agent configuration for a specific pipeline
     */
    static getInitialPipelineAgents(): string[] {
        return ['clarification', 'requirements', 'wireframe', 'coding'];
    }

    /**
     * Get agent configuration for modification pipeline
     */
    static getModificationPipelineAgents(): string[] {
        return ['modification', 'coding'];
    }

    /**
     * Check if an agent exists
     */
    static hasAgent(name: string): boolean {
        return this.agents.has(name);
    }

    /**
     * Get all agent configurations
     */
    static getAllConfigs(): AgentConfig[] {
        return Array.from(this.agents.values());
    }
}

// Export individual agent configs for direct use
export {
    clarificationAgentConfig,
    requirementsAgentConfig,
    wireframeAgentConfig,
    codingAgentConfig,
    modificationAgentConfig
};
