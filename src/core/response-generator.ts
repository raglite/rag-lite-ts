/**
 * CORE MODULE — Response Generator Interface for RAG Response Generation
 * 
 * Model-agnostic interfaces supporting text generation from retrieved context.
 * Designed for runtime polymorphism and extensibility, following the same
 * patterns established by the UniversalEmbedder interface.
 * 
 * SUPPORTED MODELS:
 * - HuggingFaceTB/SmolLM2-135M-Instruct (instruct, balanced, recommended, 3 chunks default)
 * - HuggingFaceTB/SmolLM2-360M-Instruct (instruct, higher quality, 5 chunks default)
 * 
 * PREREQUISITES:
 * - Reranking must be enabled for response generation
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import type { SearchResult } from './types.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Supported generator model types */
export type GeneratorModelType = 'causal-lm' | 'instruct';

/** Generation request containing query and retrieved context */
export interface GenerationRequest {
  query: string;
  chunks: SearchResult[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
  includeSourceAttribution?: boolean;
  /** Maximum number of chunks to include in context (overrides model default) */
  maxChunksForContext?: number;
}

/** Result of text generation */
export interface GenerationResult {
  response: string;
  tokensUsed: number;
  truncated: boolean;
  modelName: string;
  generationTimeMs: number;
  metadata: {
    promptTokens: number;
    completionTokens: number;
    chunksIncluded: number;
    totalChunks: number;
    finishReason: 'complete' | 'length' | 'stop_sequence' | 'error';
  };
}

/** Generator model capabilities */
export interface GeneratorCapabilities {
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  instructionTuned: boolean;
  maxContextLength: number;
  defaultMaxOutputTokens: number;
  recommendedTemperature: number;
  /** Maximum number of chunks to use for context (default varies by model) */
  defaultMaxChunksForContext: number;
}

/** Generator model requirements */
export interface GeneratorRequirements {
  transformersJsVersion: string;
  minimumMemory: number;
  requiredFeatures: readonly string[];
  platformSupport: readonly string[];
}

/** Complete generator model information */
export interface GeneratorModelInfo {
  name: string;
  type: GeneratorModelType;
  version: string;
  capabilities: GeneratorCapabilities;
  requirements: GeneratorRequirements;
  isDefault?: boolean;
  description?: string;
}

/** Generator validation result */
export interface GeneratorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/** Options for creating generator instances */
export interface GeneratorCreationOptions {
  cachePath?: string;
  timeout?: number;
  enableGPU?: boolean;
  defaultGenerationOptions?: Partial<GenerationRequest>;
  customConfig?: Record<string, any>;
}

// =============================================================================
// CORE INTERFACE
// =============================================================================

/**
 * Universal response generator interface
 * @experimental This feature is experimental and may change in future versions.
 */
export interface ResponseGenerator {
  readonly modelName: string;
  readonly modelType: GeneratorModelType;
  readonly maxContextLength: number;
  readonly maxOutputLength: number;
  
  generate(request: GenerationRequest): Promise<GenerationResult>;
  generateStream?(request: GenerationRequest): AsyncIterable<string>;
  loadModel(): Promise<void>;
  isLoaded(): boolean;
  getModelInfo(): GeneratorModelInfo;
  cleanup(): Promise<void>;
}

// =============================================================================
// FUNCTION TYPES FOR DEPENDENCY INJECTION
// =============================================================================

export type GenerateFunction = (
  query: string,
  chunks: SearchResult[],
  options?: Partial<GenerationRequest>
) => Promise<GenerationResult>;

export type CreateGeneratorFunction = (
  modelName: string,
  options?: GeneratorCreationOptions
) => Promise<ResponseGenerator>;

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class GeneratorValidationError extends Error {
  constructor(
    public readonly modelName: string,
    public readonly availableModels: readonly string[],
    message: string
  ) {
    super(message);
    this.name = 'GeneratorValidationError';
  }
}

export class GenerationError extends Error {
  constructor(
    public readonly modelName: string,
    public readonly stage: 'loading' | 'tokenization' | 'generation' | 'decoding',
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class ContextWindowError extends Error {
  constructor(
    public readonly requiredTokens: number,
    public readonly availableTokens: number,
    message: string
  ) {
    super(message);
    this.name = 'ContextWindowError';
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function supportsStreaming(
  generator: ResponseGenerator
): generator is ResponseGenerator & {
  generateStream(request: GenerationRequest): AsyncIterable<string>;
} {
  return typeof generator.generateStream === 'function';
}

export function isInstructModel(generator: ResponseGenerator): boolean {
  return generator.modelType === 'instruct';
}

export function createGenerateFunction(generator: ResponseGenerator): GenerateFunction {
  return async (query, chunks, options) => {
    if (!generator.isLoaded()) {
      await generator.loadModel();
    }
    return generator.generate({ query, chunks, ...options });
  };
}
