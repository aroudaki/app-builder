/**
 * LangGraph Module Entry Point
 * 
 * This module contains the LangGraph implementation for the AI App Builder,
 * providing sophisticated multi-agent workflows with real LLM integration.
 */

export {
    AppBuilderState,
    createInitialState,
    generateId,
    createAGUIEvent,
    stateToAGUIContext,
    aguiContextToState,
    type AGUIEvent
} from './state.js';
export type { AppBuilderStateType } from './state.js';

// Complete LangGraph Implementation exports  
export {
    buildInitialPipelineGraph,
    buildModificationPipelineGraph,
    buildMainGraph,
    validateAllGraphs,
    testAllGraphs,
    runAppBuilder,
    getGraph,
    getGraphSystemStatus,
    // Router functions
    routeAfterClarification,
    routeAfterAgentInitial,
    routeAfterModification,
    routeAfterCodingModification,
    // Helper functions
    getLastUserMessageInitial,
    getLastUserMessageModification,
    isDirectCodeChange,
    isComplexModification,
    extractModificationIntent,
    createInitialState as createInitialGraphState,
    createModificationState,
    analyzeUserIntent,
    executeAppBuilder,
    // Legacy compatibility
    placeholderNode,
    basicRouter
} from './graphs/index.js';

// Agent exports
export {
    TrackedToolNode,
    toolNode,
    appContainerTool,
    browserTool,
    appCompletedTool,
    fileOperationsTool,
    allTools,
    validateCodingCompletion,
    routeAfterTools
} from './tools/index.js';

// LLM exports
export {
    createLLM,
    createGPT41LLM,
    createO3LLM,
    createLLMForAgent,
    testLLMConnection,
    getAvailableModelTypes,
    isModelAvailable,
    type ModelType,
    type LLMConfig
} from './llm.js';

// Prompt Template exports
export {
    getPromptTemplate,
    getAgentTemperature,
    getAgentModel,
    setAgentModel,
    getClarificationPrompt,
    getRequirementsPrompt,
    getWireframePrompt,
    getCodingPrompt,
    getModificationPrompt,
    AGENT_TEMPERATURES,
    AGENT_MODELS,
    clarificationPromptTemplate,
    requirementsPromptTemplate,
    wireframePromptTemplate,
    codingPromptTemplate,
    modificationPromptTemplate
} from './prompts.js';

// Agent exports
export {
    clarificationAgent,
    requirementsAgent,
    wireframeAgent,
    codingAgent,
    codingAgentWithTools,
    modificationAgent,
    getAgent,
    getAvailableAgentTypes,
    isValidAgentType,
    AGENT_REGISTRY,
    type AgentType,
    type AgentFunction
} from './agents/index.js';
