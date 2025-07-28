import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

/**
 * LangGraph State Definition for App Builder
 * 
 * This state schema defines the central state object that flows between all nodes
 * in the LangGraph workflow. It includes conversation data, agent state, application
 * generation progress, and AG-UI compatibility fields.
 */
export const AppBuilderState = Annotation.Root({
    // Core conversation data
    messages: Annotation<BaseMessage[]>({
        value: (current, update) => current.concat(update),
        default: () => []
    }),

    // Conversation metadata
    conversationId: Annotation<string>(),
    isFirstRequest: Annotation<boolean>({
        value: (current, update) => update ?? current,
        default: () => true
    }),

    // Agent workflow state
    currentAgent: Annotation<string>({
        value: (current, update) => update ?? current,
        default: () => "start"
    }),

    // Application generation state
    requirements: Annotation<string | null>({
        value: (current, update) => update ?? current,
        default: () => null
    }),

    wireframe: Annotation<string | null>({
        value: (current, update) => update ?? current,
        default: () => null
    }),

    generatedCode: Annotation<Record<string, string>>({
        value: (current, update) => ({ ...current, ...update }),
        default: () => ({})
    }),

    // Container and deployment info
    containerInfo: Annotation<{
        containerId?: string;
        port?: number;
        status?: string;
    }>({
        value: (current, update) => ({ ...current, ...update }),
        default: () => ({})
    }),

    // Error handling
    lastError: Annotation<{
        agent: string;
        error: string;
        timestamp: string;
    } | null>({
        value: (current, update) => update ?? current,
        default: () => null
    }),

    retryCount: Annotation<number>({
        value: (current, update) => update ?? current ?? 0,
        default: () => 0
    }),

    // Completion tracking
    lastToolExecution: Annotation<Array<{
        name: string;
        input: any;
        output: string;
        timestamp: string;
    }>>({
        value: (current, update) => update ?? current,
        default: () => []
    }),

    completionState: Annotation<{
        explorationComplete: boolean;
        buildSuccessful: boolean;
        devServerStarted: boolean;
        requirementsMet: boolean;
        isComplete: boolean;
    }>({
        value: (current, update) => ({ ...current, ...update }),
        default: () => ({
            explorationComplete: false,
            buildSuccessful: false,
            devServerStarted: false,
            requirementsMet: false,
            isComplete: false
        })
    }),

    // AG-UI compatibility
    aguiEvents: Annotation<any[]>({
        value: (current, update) => current.concat(update),
        default: () => []
    })
});

export type AppBuilderStateType = typeof AppBuilderState.State;

/**
 * Utility function to generate unique IDs for events and messages
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Helper function to create initial state for a new conversation
 */
export function createInitialState(conversationId: string, isFirstRequest: boolean = true): AppBuilderStateType {
    return {
        messages: [],
        conversationId,
        isFirstRequest,
        currentAgent: "start",
        requirements: null,
        wireframe: null,
        generatedCode: {},
        containerInfo: {},
        lastError: null,
        retryCount: 0,
        lastToolExecution: [],
        completionState: {
            explorationComplete: false,
            buildSuccessful: false,
            devServerStarted: false,
            requirementsMet: false,
            isComplete: false
        },
        aguiEvents: []
    };
}

/**
 * Type definitions for AG-UI compatibility
 */
export interface AGUIEvent {
    type: string;
    conversationId: string;
    messageId?: string;
    role?: string;
    timestamp: number;
    delta?: string;
    [key: string]: any;
}

/**
 * Helper function to create AG-UI compatible events from LangGraph state
 */
export function createAGUIEvent(
    type: string,
    conversationId: string,
    additionalData: Partial<AGUIEvent> = {}
): AGUIEvent {
    return {
        type,
        conversationId,
        timestamp: Date.now(),
        messageId: generateId(),
        ...additionalData
    };
}

/**
 * Adapter function to convert LangGraph state to AG-UI context format
 * This maintains compatibility with existing AG-UI protocol
 */
export function stateToAGUIContext(state: AppBuilderStateType): any {
    return {
        conversationId: state.conversationId,
        isFirstRequest: state.isFirstRequest,
        messages: state.messages,
        currentAgent: state.currentAgent,
        requirements: state.requirements,
        wireframe: state.wireframe,
        generatedCode: state.generatedCode,
        containerInfo: state.containerInfo,
        completionState: state.completionState,
        lastError: state.lastError,
        retryCount: state.retryCount
    };
}

/**
 * Adapter function to convert AG-UI context to LangGraph state
 * This helps during migration from old system to new LangGraph system
 */
export function aguiContextToState(context: any, conversationId: string): Partial<AppBuilderStateType> {
    return {
        conversationId,
        isFirstRequest: context.isFirstRequest ?? true,
        messages: context.messages ?? [],
        currentAgent: context.currentAgent ?? "start",
        requirements: context.requirements ?? null,
        wireframe: context.wireframe ?? null,
        generatedCode: context.generatedCode ?? {},
        containerInfo: context.containerInfo ?? {},
        lastError: context.lastError ?? null,
        retryCount: context.retryCount ?? 0,
        completionState: context.completionState ?? {
            explorationComplete: false,
            buildSuccessful: false,
            devServerStarted: false,
            requirementsMet: false,
            isComplete: false
        }
    };
}
