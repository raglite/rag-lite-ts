/**
 * TEXT IMPLEMENTATION — Causal LM Generator for DistilGPT2
 * 
 * Implements ResponseGenerator interface for causal language models.
 * Supports Xenova/distilgpt2 for fast, basic text generation.
 * 
 * Features:
 * - Simple prompt formatting (no chat template)
 * - Fast generation with smaller model
 * - Streaming generation support
 * - Resource management via ResourceManager
 * 
 * Note: Causal LM models don't support system prompts, so responses
 * may be less focused than instruction-tuned models.
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import '../../dom-polyfills.js';

import {
  BaseResponseGenerator,
  type GeneratorOptions
} from '../../core/abstract-generator.js';
import { GenerationError } from '../../core/response-generator.js';
import { getResourceManager } from '../../core/resource-manager.js';
import { config } from '../../core/config.js';

// =============================================================================
// CAUSAL LM GENERATOR IMPLEMENTATION
// =============================================================================

/**
 * Causal LM generator implementation for DistilGPT2
 * 
 * Uses causal language models that generate text based on simple prompts.
 * Faster but may produce less focused responses than instruct models.
 */
export class CausalLMGenerator extends BaseResponseGenerator {
  private pipeline: any = null;
  private tokenizer: any = null;
  private resourceManager = getResourceManager();
  private resourceId?: string;

  constructor(modelName: string, options: GeneratorOptions = {}) {
    super(modelName, options);

    // Validate model is a causal-lm model
    if (this.modelType !== 'causal-lm') {
      throw new Error(
        `CausalLMGenerator requires a causal-lm model, but '${modelName}' is type '${this.modelType}'`
      );
    }
  }

  // =============================================================================
  // MODEL LIFECYCLE
  // =============================================================================

  /**
   * Load the causal LM model using transformers.js
   */
  async loadModel(): Promise<void> {
    if (this._isLoaded && this.pipeline) {
      return;
    }

    try {
      this.logModelLoading('Loading causal LM generator model');

      // Ensure DOM polyfills
      if (typeof (globalThis as any).self === 'undefined') {
        (globalThis as any).self = globalThis;
      }

      // Dynamic import transformers.js
      const { pipeline, AutoTokenizer } = await import('@huggingface/transformers');

      // Load tokenizer first for token counting
      this.logModelLoading('Loading tokenizer');
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName, {
        cache_dir: this._options.cachePath || config.model_cache_path
      });

      // Load text generation pipeline
      this.logModelLoading('Loading text generation pipeline');
      this.pipeline = await pipeline('text-generation', this.modelName, {
        cache_dir: this._options.cachePath || config.model_cache_path,
        dtype: 'fp32'
      });

      // Register with resource manager
      this.resourceId = this.resourceManager.registerModel(
        this.pipeline,
        this.modelName,
        'generator'
      );

      this._isLoaded = true;
      this.logModelLoading('Model loaded successfully');

    } catch (error) {
      this._isLoaded = false;
      throw this.handleLoadingError(error as Error);
    }
  }

  /**
   * Clean up model resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.resourceId) {
        await this.resourceManager.cleanupResource(this.resourceId);
        this.resourceId = undefined;
      }

      // Clear references
      this.pipeline = null;
      this.tokenizer = null;
      this._isLoaded = false;

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      this.logModelLoading('Resources cleaned up');

    } catch (error) {
      console.warn(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`);
      this.pipeline = null;
      this.tokenizer = null;
      this._isLoaded = false;
    }
  }

  // =============================================================================
  // GENERATION IMPLEMENTATION
  // =============================================================================

  /**
   * Generate text using the causal LM model
   */
  protected async generateText(
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
  }> {
    this.ensureLoaded();

    try {
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);

      // Generate - GPT2 uses return_full_text differently
      const result = await this.pipeline(prompt, {
        max_new_tokens: options.maxTokens,
        temperature: Math.max(0.1, options.temperature),  // GPT2 needs temp > 0
        top_p: options.topP,
        top_k: options.topK,
        repetition_penalty: options.repetitionPenalty,
        do_sample: true,
        return_full_text: true,  // GPT2 needs full text
        pad_token_id: this.tokenizer?.eos_token_id  // GPT2 uses eos as pad
      });

      // Extract generated text (remove prompt)
      let generatedText = result[0]?.generated_text || '';
      if (generatedText.startsWith(prompt)) {
        generatedText = generatedText.substring(prompt.length);
      }

      // Process stop sequences
      let finalText = generatedText;
      let finishReason: 'complete' | 'length' | 'stop_sequence' | 'error' = 'complete';

      for (const stopSeq of options.stopSequences) {
        const stopIndex = finalText.indexOf(stopSeq);
        if (stopIndex !== -1) {
          finalText = finalText.substring(0, stopIndex);
          finishReason = 'stop_sequence';
          break;
        }
      }

      // Count completion tokens
      const completionTokens = await this.countTokens(finalText);

      // Check if we hit max tokens
      if (completionTokens >= options.maxTokens - 5) {
        finishReason = 'length';
      }

      return {
        text: finalText,
        promptTokens,
        completionTokens,
        finishReason
      };

    } catch (error) {
      throw new GenerationError(
        this.modelName,
        'generation',
        `Text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate text with streaming output
   */
  async *generateStream(request: import('../../core/response-generator.js').GenerationRequest): AsyncIterable<string> {
    // For now, fall back to non-streaming and yield the full response
    // TODO: Implement true streaming when transformers.js supports it better
    const result = await this.generate(request);
    yield result.response;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Count tokens in a text string
   */
  private async countTokens(text: string): Promise<number> {
    if (!this.tokenizer) {
      // Fallback to estimation
      return Math.ceil(text.length / 4);
    }

    try {
      const encoded = await this.tokenizer(text, {
        return_tensors: false,
        padding: false,
        truncation: false
      });
      return encoded.input_ids?.length || Math.ceil(text.length / 4);
    } catch {
      return Math.ceil(text.length / 4);
    }
  }
}
