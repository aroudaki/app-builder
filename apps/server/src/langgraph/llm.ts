/**
 * LLM Configuration Module for LangGraph Integration
 * 
 * This module provides factory functions for creating LLM instances
 * with proper Azure OpenAI configuration for different models.
 * 
 * Supports:
 * - GPT-4.1 (primary model for most agents)
 * - O3 (advanced reasoning model for complex tasks)
 */

import { AzureChatOpenAI } from "@langchain/openai";

/**
 * Model types supported by the system
 */
export type ModelType = 'gpt-4.1' | 'o3';

/**
 * LLM configuration interface
 */
export interface LLMConfig {
  model: string;
  temperature?: number;
  streaming?: boolean;
  azureOpenAIApiKey: string;
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiDeploymentName: string;
  azureOpenAIApiVersion: string;
}

/**
 * Create a configured LLM instance with Azure OpenAI
 * 
 * @param modelType - The model type to use ('gpt-4.1' or 'o3')
 * @param options - Additional configuration options
 * @returns Configured AzureChatOpenAI instance
 */
export function createLLM(
  modelType: ModelType = 'gpt-4.1',
  options: {
    temperature?: number;
    streaming?: boolean;
    maxTokens?: number;
  } = {}
): AzureChatOpenAI {
  const {
    temperature = 0.3,
    streaming = true,
    maxTokens
  } = options;

  // Get model-specific configuration
  const config = getModelConfig(modelType);
  
  // Validate environment variables
  validateEnvironmentVariables(modelType);

  return new AzureChatOpenAI({
    azureOpenAIApiKey: config.azureOpenAIApiKey,
    azureOpenAIApiInstanceName: config.azureOpenAIApiInstanceName,
    azureOpenAIApiDeploymentName: config.azureOpenAIApiDeploymentName,
    azureOpenAIApiVersion: config.azureOpenAIApiVersion,
    temperature,
    streaming,
    maxTokens,
  });
}

/**
 * Get model-specific configuration from environment variables
 * 
 * @param modelType - The model type to configure
 * @returns LLM configuration object
 */
function getModelConfig(modelType: ModelType): LLMConfig {
  if (modelType === 'o3') {
    return {
      model: "o3",
      azureOpenAIApiKey: process.env.AOAI_o3_API_KEY!,
      azureOpenAIApiInstanceName: process.env.AOAI_o3_INSTANCE_NAME!,
      azureOpenAIApiDeploymentName: process.env.AOAI_o3_DEPLOYMENT_NAME!,
      azureOpenAIApiVersion: process.env.AOAI_o3_VERSION!,
    };
  }

  // Default to gpt-4.1
  return {
    model: "gpt-4.1",
    azureOpenAIApiKey: process.env.AOAI_4_1_API_KEY!,
    azureOpenAIApiInstanceName: process.env.AOAI_4_1_INSTANCE_NAME!,
    azureOpenAIApiDeploymentName: process.env.AOAI_4_1_DEPLOYMENT_NAME!,
    azureOpenAIApiVersion: process.env.AOAI_4_1_VERSION!,
  };
}

/**
 * Validate that required environment variables are set
 * 
 * @param modelType - The model type to validate
 * @throws Error if required environment variables are missing
 */
function validateEnvironmentVariables(modelType: ModelType): void {
  const requiredVars = modelType === 'o3' 
    ? ['AOAI_o3_API_KEY', 'AOAI_o3_INSTANCE_NAME', 'AOAI_o3_DEPLOYMENT_NAME', 'AOAI_o3_VERSION']
    : ['AOAI_4_1_API_KEY', 'AOAI_4_1_INSTANCE_NAME', 'AOAI_4_1_DEPLOYMENT_NAME', 'AOAI_4_1_VERSION'];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for ${modelType} model: ${missingVars.join(', ')}\n` +
      `Please check your .env file and ensure all Azure OpenAI configuration is set.`
    );
  }
}

/**
 * Convenience function to create GPT-4.1 LLM instance
 * 
 * GPT-4.1 is the primary model for most agents:
 * - General conversation and clarification
 * - Requirements analysis
 * - Wireframe generation
 * - General coding tasks
 * 
 * @param options - Configuration options
 * @returns Configured AzureChatOpenAI instance for GPT-4.1
 */
export function createGPT41LLM(options?: {
  temperature?: number;
  streaming?: boolean;
  maxTokens?: number;
}): AzureChatOpenAI {
  return createLLM('gpt-4.1', options);
}

/**
 * Convenience function to create O3 LLM instance
 * 
 * O3 is the advanced reasoning model for complex tasks:
 * - Complex application architecture
 * - Advanced coding problems
 * - Sophisticated debugging and error resolution
 * - Multi-step reasoning tasks
 * 
 * @param options - Configuration options
 * @returns Configured AzureChatOpenAI instance for O3
 */
export function createO3LLM(options?: {
  temperature?: number;
  streaming?: boolean;
  maxTokens?: number;
}): AzureChatOpenAI {
  return createLLM('o3', options);
}

/**
 * Factory function to create LLM instances based on agent requirements
 * 
 * @param agentType - The type of agent requiring the LLM
 * @param options - Configuration options
 * @returns Appropriately configured LLM instance
 */
export function createLLMForAgent(
  agentType: 'clarification' | 'requirements' | 'wireframe' | 'coding' | 'modification',
  options?: {
    temperature?: number;
    streaming?: boolean;
    maxTokens?: number;
  }
): AzureChatOpenAI {
  // Use O3 for complex coding tasks, GPT-4.1 for everything else
  const modelType: ModelType = agentType === 'coding' ? 'o3' : 'gpt-4.1';
  
  // Agent-specific temperature settings
  const temperature = options?.temperature ?? getDefaultTemperature(agentType);
  
  return createLLM(modelType, {
    ...options,
    temperature
  });
}

/**
 * Get default temperature settings for different agent types
 * 
 * @param agentType - The type of agent
 * @returns Recommended temperature value
 */
function getDefaultTemperature(agentType: string): number {
  switch (agentType) {
    case 'clarification':
      return 0.4; // Slightly creative for engaging questions
    case 'requirements':
      return 0.2; // More focused for structured analysis
    case 'wireframe':
      return 0.3; // Balanced for structured but creative design
    case 'coding':
      return 0.1; // Very focused for precise code generation
    case 'modification':
      return 0.2; // Focused for accurate modifications
    default:
      return 0.3; // Default balanced setting
  }
}

/**
 * Test LLM configuration and connectivity
 * 
 * @param modelType - Model type to test
 * @returns Promise that resolves if connection is successful
 */
export async function testLLMConnection(modelType: ModelType = 'gpt-4.1'): Promise<void> {
  try {
    const llm = createLLM(modelType, { streaming: false });
    
    // Simple test call
    const response = await llm.invoke("Say 'Hello' if you can hear me.");
    
    if (!response.content) {
      throw new Error('No response received from LLM');
    }
    
    console.log(`✅ ${modelType.toUpperCase()} LLM connection successful`);
  } catch (error) {
    console.error(`❌ ${modelType.toUpperCase()} LLM connection failed:`, error);
    throw error;
  }
}

/**
 * Get available model types
 * 
 * @returns Array of supported model types
 */
export function getAvailableModelTypes(): ModelType[] {
  return ['gpt-4.1', 'o3'];
}

/**
 * Check if a model type is available (environment variables are set)
 * 
 * @param modelType - Model type to check
 * @returns True if the model is properly configured
 */
export function isModelAvailable(modelType: ModelType): boolean {
  try {
    validateEnvironmentVariables(modelType);
    return true;
  } catch {
    return false;
  }
}
