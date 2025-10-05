/**
 * Multi-provider LLM Client Configuration
 * Supports: Uber GenAI Gateway, OpenAI, Google AI, Azure OpenAI
 */

import OpenAI from 'openai';

export type LLMProvider = 'uber-genai' | 'openai' | 'azure' | 'google' | 'custom';

interface LLMClientConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  defaultHeaders?: Record<string, string>;
  modelName?: string;
}

/**
 * Creates an OpenAI-compatible client for various LLM providers
 */
export function createLLMClient(config?: Partial<LLMClientConfig>): OpenAI {
  const provider = config?.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai';
  
  switch (provider) {
    case 'uber-genai':
      return createUberGenAIClient(config);
    
    case 'openai':
      return createOpenAIClient(config);
    
    case 'azure':
      return createAzureClient(config);
    
    case 'google':
      // Google AI uses OpenAI-compatible API via their proxy
      return createGoogleAIClient(config);
    
    case 'custom':
      return createCustomClient(config);
    
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Uber GenAI Gateway Configuration
 * Requires: cerberus tunnel running on localhost:5436
 */
function createUberGenAIClient(config?: Partial<LLMClientConfig>): OpenAI {
  const baseURL = config?.baseURL || 
                  process.env.GENAI_GATEWAY_URL || 
                  'http://127.0.0.1:5436/v1';
  
  const organization = config?.organization || 
                       process.env.MA_STUDIO_PROJECT_UUID;
  
  if (!organization) {
    throw new Error('MA_STUDIO_PROJECT_UUID is required for Uber GenAI Gateway');
  }

  return new OpenAI({
    baseURL,
    apiKey: 'dummy', // Not used by gateway, but required by SDK
    organization,
    defaultHeaders: {
      'Rpc-Service': 'genai-api',
      'Rpc-Caller': process.env.SERVICE_NAME || 'photo-selector',
      ...config?.defaultHeaders,
    },
  });
}

/**
 * OpenAI Configuration
 * Requires: OPENAI_API_KEY
 */
function createOpenAIClient(config?: Partial<LLMClientConfig>): OpenAI {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for OpenAI provider');
  }

  return new OpenAI({
    apiKey,
    ...(config?.baseURL && { baseURL: config.baseURL }),
    ...(config?.organization && { organization: config.organization }),
    ...(config?.defaultHeaders && { defaultHeaders: config.defaultHeaders }),
  });
}

/**
 * Azure OpenAI Configuration
 * Requires: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT
 */
function createAzureClient(config?: Partial<LLMClientConfig>): OpenAI {
  const apiKey = config?.apiKey || process.env.AZURE_OPENAI_API_KEY;
  const baseURL = config?.baseURL || process.env.AZURE_OPENAI_ENDPOINT;
  
  if (!apiKey || !baseURL) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required for Azure provider');
  }

  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'api-key': apiKey,
      ...config?.defaultHeaders,
    },
  });
}

/**
 * Google AI Configuration (via OpenAI-compatible proxy)
 * Requires: GOOGLE_API_KEY
 */
function createGoogleAIClient(config?: Partial<LLMClientConfig>): OpenAI {
  const apiKey = config?.apiKey || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required for Google AI provider');
  }

  // Google AI's OpenAI-compatible endpoint
  const baseURL = config?.baseURL || 
                  process.env.GOOGLE_AI_ENDPOINT ||
                  'https://generativelanguage.googleapis.com/v1beta/openai';

  return new OpenAI({
    apiKey,
    baseURL,
    ...(config?.defaultHeaders && { defaultHeaders: config.defaultHeaders }),
  });
}

/**
 * Custom Provider Configuration
 * For any OpenAI-compatible API
 */
function createCustomClient(config?: Partial<LLMClientConfig>): OpenAI {
  const apiKey = config?.apiKey || process.env.CUSTOM_API_KEY;
  const baseURL = config?.baseURL || process.env.CUSTOM_BASE_URL;
  
  if (!apiKey || !baseURL) {
    throw new Error('CUSTOM_API_KEY and CUSTOM_BASE_URL are required for custom provider');
  }

  return new OpenAI({
    apiKey,
    baseURL,
    ...(config?.organization && { organization: config.organization }),
    ...(config?.defaultHeaders && { defaultHeaders: config.defaultHeaders }),
  });
}

/**
 * Get the appropriate model name based on provider
 */
export function getModelName(provider?: LLMProvider): string {
  const customModel = process.env.MODEL_NAME;
  if (customModel) return customModel;

  const activeProvider = provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai';
  
  switch (activeProvider) {
    case 'uber-genai':
      return 'gpt-4o'; // Default for Uber GenAI Gateway
    
    case 'openai':
      return 'gpt-4o'; // Latest GPT-4 with vision
    
    case 'azure':
      return process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4o';
    
    case 'google':
      return 'gemini-2.0-flash-exp'; // Latest Gemini with vision
    
    case 'custom':
      return process.env.CUSTOM_MODEL_NAME || 'gpt-4o';
    
    default:
      return 'gpt-4o';
  }
}

/**
 * Validate that the LLM client is properly configured
 */
export function validateLLMConfig(): { valid: boolean; error?: string; provider: LLMProvider } {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'openai';
  
  try {
    createLLMClient({ provider });
    return { valid: true, provider };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}


