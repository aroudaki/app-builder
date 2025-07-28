/**
 * LangGraph Agents Module
 * 
 * This module exports all the agent implementations for the LangGraph pipeline.
 * Each agent is a specialized function that performs a specific role in the
 * application generation workflow.
 */

// Agent implementations
export { clarificationAgent } from './clarification.js';
export { requirementsAgent } from './requirements.js';
export { wireframeAgent } from './wireframe.js';
export { codingAgent, codingAgentWithTools } from './coding.js';
export { modificationAgent } from './modification.js';

// Import for internal use
import { clarificationAgent } from './clarification.js';
import { requirementsAgent } from './requirements.js';
import { wireframeAgent } from './wireframe.js';
import { codingAgent } from './coding.js';
import { modificationAgent } from './modification.js';

/**
 * Agent type definitions for type safety
 */
export type AgentType = 'clarification' | 'requirements' | 'wireframe' | 'coding' | 'modification';

/**
 * Agent function type for consistent interfaces
 */
export type AgentFunction = (state: import('../state.js').AppBuilderStateType) => Promise<Partial<import('../state.js').AppBuilderStateType>>;

/**
 * Agent registry for dynamic agent selection
 */
export const AGENT_REGISTRY: Record<AgentType, AgentFunction> = {
    clarification: clarificationAgent,
    requirements: requirementsAgent,
    wireframe: wireframeAgent,
    coding: codingAgent,
    modification: modificationAgent
};

/**
 * Get agent function by type
 * 
 * @param agentType - The type of agent to retrieve
 * @returns The agent function
 */
export function getAgent(agentType: AgentType): AgentFunction {
    const agent = AGENT_REGISTRY[agentType];
    if (!agent) {
        throw new Error(`Unknown agent type: ${agentType}`);
    }
    return agent;
}

/**
 * Get all available agent types
 * 
 * @returns Array of agent type names
 */
export function getAvailableAgentTypes(): AgentType[] {
    return Object.keys(AGENT_REGISTRY) as AgentType[];
}

/**
 * Validate agent type
 * 
 * @param agentType - The agent type to validate
 * @returns True if valid agent type
 */
export function isValidAgentType(agentType: string): agentType is AgentType {
    return agentType in AGENT_REGISTRY;
}
