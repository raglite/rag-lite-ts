/**
 * CORE MODULE — Abstract Base Generator
 * 
 * Provides model-agnostic base functionality for all generator implementations.
 * This is an abstract base class, not a concrete implementation.
 * 
 * ARCHITECTURAL NOTE:
 * Similar to BaseUniversalEmbedder, this class provides shared infrastructure:
 * - Model lifecycle management (loading, cleanup, disposal)
 * - Token budget management
 * - Error handling with helpful messages
 * - Common utility methods
 * 
 * IMPLEMENTATION LAYERS:
 * - Text: InstructGenerator extends this class (SmolLM2-Instruct)
 * - Text: CausalLMGenerator extends this class (DistilGPT2)
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import type {
  ResponseGenerator,
  GeneratorModelInfo,
  GeneratorModelType,
  GenerationRequest,
  GenerationResult,
  GeneratorCreationOptions
} from './response-generator.js';
import { GenerationError } from './response-generator.js';
import { GeneratorRegistry } from './generator-registry.js';
import {
  buildPrompt,
  estimateTokenCount,
  getDefaultStopSequences
} from './prompt-templates.js';

// =============================================================================
// BASE GENERATOR ABSTRACT CLASS
// =============================================================================

/**
 * Abstract base class for response generators
 * Provides common functionality and lifecycle management
 */
export abstract class BaseResponseGenerator implements ResponseGenerator {
  protected _isLoaded: boolean = false;
  protected _modelInfo: GeneratorModelInfo;
  protected _options: GeneratorCreationOptions;

  constructor(
    public readonly modelName: string,
    options: GeneratorCreationOptions = {}
  ) {
    const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
    if (!modelInfo) {
      throw new Error(
        `Generator model '${modelName}' is not supported. ` +
        `Supported models: ${GeneratorRegistry.getSupportedGenerators().join(', ')}`
      );
    }
    this._modelInfo = modelInfo;
    this._options = options;
  }

  // =============================================================================
  // PUBLIC INTERFACE IMPLEMENTATION
  // =============================================================================

  get modelType(): GeneratorModelType {
    return this._modelInfo.type;
  }

  get maxContextLength(): number {
    return this._modelInfo.capabilities.maxContextLength;
  }

  get maxOutputLength(): number {
    return this._modelInfo.capabilities.defaultMaxOutputTokens;
  }

  isLoaded(): boolean {
    return this._isLoaded;
  }

  getModelInfo(): GeneratorModelInfo {
    return { ...this._modelInfo };  // Return a copy to prevent mutation
  }

  // =============================================================================
  // ABSTRACT METHODS (TO BE IMPLEMENTED BY SUBCLASSES)
  // =============================================================================

  /**
   * Load the model - must be implemented by subclasses
   */
  abstract loadModel(): Promise<void>;

  /**
   * Generate text using the model - must be implemented by subclasses
   * @param prompt - The formatted prompt string
   * @param options - Generation options
   * @returns Generated text
   */
  protected abstract generateText(
    prompt: string,
    options: {
      maxTokens: number;
      temperature: number;
      topP: number;
      topK: number;
      repetitionPenalty: number;
      stopSequences: string[];
    }
  ): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    finishReason: 'complete' | 'length' | 'stop_sequence' | 'error';
  }>;

  /**
   * Clean up resources - must be implemented by subclasses
   */
  abstract cleanup(): Promise<void>;

  // =============================================================================
  // DEFAULT IMPLEMENTATION
  // =============================================================================

  /**
   * Generate a response based on query and retrieved chunks
   * This method orchestrates the generation pipeline
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!this._isLoaded) {
      await this.loadModel();
    }

    const startTime = Date.now();

    try {
      // Get generation parameters with defaults
      const maxTokens = request.maxTokens ?? this._modelInfo.capabilities.defaultMaxOutputTokens;
      const temperature = request.temperature ?? this._modelInfo.capabilities.recommendedTemperature;
      const topP = request.topP ?? 0.9;
      const topK = request.topK ?? 50;
      const repetitionPenalty = request.repetitionPenalty ?? 1.1;
      const stopSequences = request.stopSequences ?? getDefaultStopSequences(this.modelType);
      
      // Get max chunks for context (configurable, with model-specific default)
      const maxChunksForContext = request.maxChunksForContext ?? 
        this._modelInfo.capabilities.defaultMaxChunksForContext;
      
      // Limit chunks to maxChunksForContext (assumes chunks are already reranked)
      const totalChunks = request.chunks.length;
      const limitedChunks = request.chunks.slice(0, maxChunksForContext);
      
      if (totalChunks > maxChunksForContext) {
        console.log(`📊 Using top ${maxChunksForContext} of ${totalChunks} reranked chunks for generation`);
      }

      // Build the prompt with context
      const builtPrompt = buildPrompt({
        query: request.query,
        chunks: limitedChunks,
        modelType: this.modelType,
        systemPrompt: request.systemPrompt,
        maxContextLength: this.maxContextLength,
        reservedOutputTokens: maxTokens,
        includeSourceAttribution: request.includeSourceAttribution
      });

      // Log context info
      if (builtPrompt.contextInfo.truncated) {
        console.warn(
          `⚠️  Context truncated: Only ${builtPrompt.contextInfo.chunksIncluded} of ` +
          `${builtPrompt.contextInfo.totalChunks} chunks fit in context window`
        );
      }

      // Generate response
      const result = await this.generateText(builtPrompt.prompt, {
        maxTokens,
        temperature,
        topP,
        topK,
        repetitionPenalty,
        stopSequences
      });

      const generationTimeMs = Date.now() - startTime;

      // Clean up the response text
      const cleanedResponse = this.cleanResponseText(result.text);

      return {
        response: cleanedResponse,
        tokensUsed: result.promptTokens + result.completionTokens,
        truncated: builtPrompt.contextInfo.truncated,
        modelName: this.modelName,
        generationTimeMs,
        metadata: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          chunksIncluded: builtPrompt.contextInfo.chunksIncluded,
          totalChunks: totalChunks,  // Report original total, not limited
          finishReason: result.finishReason
        }
      };
    } catch (error) {
      const generationTimeMs = Date.now() - startTime;
      
      if (error instanceof GenerationError) {
        throw error;
      }

      throw new GenerationError(
        this.modelName,
        'generation',
        `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // =============================================================================
  // PROTECTED HELPER METHODS
  // =============================================================================

  /**
   * Validate that the model is loaded before operations
   */
  protected ensureLoaded(): void {
    if (!this._isLoaded) {
      throw new GenerationError(
        this.modelName,
        'generation',
        `Model '${this.modelName}' is not loaded. Call loadModel() first.`
      );
    }
  }

  /**
   * Clean up response text by removing artifacts
   */
  protected cleanResponseText(text: string): string {
    let cleaned = text.trim();

    // Remove common artifacts
    const artifactsToRemove = [
      '<|im_end|>',
      '<|im_start|>',
      '<|endoftext|>',
      '<|assistant|>',
      '<|user|>',
      '<|system|>'
    ];

    for (const artifact of artifactsToRemove) {
      cleaned = cleaned.split(artifact)[0];
    }

    // Remove trailing incomplete sentences (if cut off at max tokens)
    if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
      const lastSentenceEnd = Math.max(
        cleaned.lastIndexOf('.'),
        cleaned.lastIndexOf('!'),
        cleaned.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > cleaned.length * 0.5) {
        cleaned = cleaned.substring(0, lastSentenceEnd + 1);
      }
    }

    return cleaned.trim();
  }

  /**
   * Log model loading progress
   */
  protected logModelLoading(stage: string, details?: string): void {
    const message = `[${this.modelName}] ${stage}`;
    if (details) {
      console.log(`${message}: ${details}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Handle model loading errors with helpful messages
   */
  protected handleLoadingError(error: Error): GenerationError {
    const baseMessage = `Failed to load generator model '${this.modelName}': ${error.message}`;

    // Provide specific guidance based on error type
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return new GenerationError(
        this.modelName,
        'loading',
        `${baseMessage}\n` +
        `This appears to be a network error. Please check your internet connection ` +
        `and ensure the model repository is accessible.`,
        error
      );
    }

    if (error.message.includes('memory') || error.message.includes('OOM')) {
      return new GenerationError(
        this.modelName,
        'loading',
        `${baseMessage}\n` +
        `This appears to be a memory error. The model requires ` +
        `${this._modelInfo.requirements.minimumMemory}MB. Try closing other applications ` +
        `or using a smaller model like 'Xenova/distilgpt2'.`,
        error
      );
    }

    return new GenerationError(
      this.modelName,
      'loading',
      baseMessage,
      error
    );
  }
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Extended options for generator instances
 */
export interface GeneratorOptions extends GeneratorCreationOptions {
  /** Log level for debugging */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/**
 * Create generator options with defaults
 */
export function createGeneratorOptions(
  options: Partial<GeneratorOptions> = {}
): GeneratorOptions {
  return {
    timeout: 60000,  // 60 seconds
    enableGPU: false,
    logLevel: 'info',
    ...options
  };
}
