/**
 * CORE MODULE — Base Universal Embedder Implementation
 * Abstract base class providing common functionality for all embedder implementations
 * Model-agnostic base class supporting lifecycle management and validation
 */

import type { 
  UniversalEmbedder,
  ModelInfo,
  ModelType,
  EmbeddingBatchItem,
  EnhancedEmbeddingResult
} from './universal-embedder.js';
import type { EmbeddingResult } from '../types.js';
import { ModelRegistry } from './model-registry.js';
import { validateContentType, createEnhancedEmbeddingResult } from './universal-embedder.js';

// =============================================================================
// BASE EMBEDDER ABSTRACT CLASS
// =============================================================================

/**
 * Abstract base class for universal embedders
 * Provides common functionality and lifecycle management
 */
export abstract class BaseUniversalEmbedder implements UniversalEmbedder {
  protected _isLoaded: boolean = false;
  protected _modelInfo: ModelInfo;
  
  constructor(
    public readonly modelName: string,
    protected readonly options: EmbedderOptions = {}
  ) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    if (!modelInfo) {
      throw new Error(
        `Model '${modelName}' is not supported. ` +
        `Supported models: ${ModelRegistry.getSupportedModels().join(', ')}`
      );
    }
    this._modelInfo = modelInfo;
  }
  
  // =============================================================================
  // PUBLIC INTERFACE IMPLEMENTATION
  // =============================================================================
  
  get modelType(): ModelType {
    return this._modelInfo.type;
  }
  
  get dimensions(): number {
    return this._modelInfo.dimensions;
  }
  
  get supportedContentTypes(): readonly string[] {
    return this._modelInfo.supportedContentTypes;
  }
  
  isLoaded(): boolean {
    return this._isLoaded;
  }
  
  getModelInfo(): ModelInfo {
    return { ...this._modelInfo }; // Return a copy to prevent mutation
  }
  
  // =============================================================================
  // ABSTRACT METHODS (TO BE IMPLEMENTED BY SUBCLASSES)
  // =============================================================================
  
  /**
   * Load the model - must be implemented by subclasses
   */
  abstract loadModel(): Promise<void>;
  
  /**
   * Embed text content - must be implemented by subclasses
   */
  abstract embedText(text: string): Promise<EmbeddingResult>;
  
  /**
   * Clean up resources - must be implemented by subclasses
   */
  abstract cleanup(): Promise<void>;
  
  /**
   * Dispose of all resources and prepare for garbage collection
   * This method should be called when the embedder is no longer needed
   */
  async dispose(): Promise<void> {
    try {
      // Call the specific cleanup implementation
      await this.cleanup();
      
      // Clear internal state
      this._isLoaded = false;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      this.logModelLoading('Resources disposed and garbage collection triggered');
    } catch (error) {
      console.warn(`Error during resource disposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // =============================================================================
  // OPTIONAL METHODS (CAN BE OVERRIDDEN BY SUBCLASSES)
  // =============================================================================
  
  /**
   * Embed image content - optional, only implemented by multimodal embedders
   */
  embedImage?(imagePath: string): Promise<EmbeddingResult>;
  
  // =============================================================================
  // DEFAULT IMPLEMENTATIONS
  // =============================================================================
  
  /**
   * Batch embedding with default implementation
   * Subclasses can override for more efficient batch processing
   */
  async embedBatch(items: EmbeddingBatchItem[]): Promise<EmbeddingResult[]> {
    if (!this._isLoaded) {
      await this.loadModel();
    }
    
    const results: EmbeddingResult[] = [];
    const batchSize = this.options.maxBatchSize || this._modelInfo.capabilities.maxBatchSize || 8;
    
    // Process in batches to avoid memory issues
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // =============================================================================
  // PROTECTED HELPER METHODS
  // =============================================================================
  
  /**
   * Process a single batch of items
   * Can be overridden by subclasses for more efficient batch processing
   */
  protected async processBatch(batch: EmbeddingBatchItem[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const item of batch) {
      try {
        validateContentType(item.contentType, this.supportedContentTypes);
        
        let result: EmbeddingResult;
        
        if (item.contentType === 'text') {
          result = await this.embedText(item.content);
        } else if (item.contentType === 'image' && this.embedImage) {
          result = await this.embedImage(item.content);
        } else {
          throw new Error(
            `Content type '${item.contentType}' not supported by model '${this.modelName}'`
          );
        }
        
        // Enhance the result with content type and metadata
        const enhancedResult = createEnhancedEmbeddingResult(
          result.embedding_id,
          result.vector,
          item.contentType,
          item.metadata
        );
        
        results.push(enhancedResult);
      } catch (error) {
        // Log error but continue processing other items
        console.warn(`Failed to embed item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Create a placeholder result with zero vector for failed items
        const zeroVector = new Float32Array(this.dimensions).fill(0);
        const failedResult = createEnhancedEmbeddingResult(
          `failed_${Date.now()}_${Math.random()}`,
          zeroVector,
          item.contentType,
          { ...item.metadata, error: error instanceof Error ? error.message : 'Unknown error' }
        );
        
        results.push(failedResult);
      }
    }
    
    return results;
  }
  
  /**
   * Validate that the model is loaded before operations
   */
  protected ensureLoaded(): void {
    if (!this._isLoaded) {
      throw new Error(`Model '${this.modelName}' is not loaded. Call loadModel() first.`);
    }
  }
  
  /**
   * Generate a unique embedding ID
   */
  protected generateEmbeddingId(content: string, contentType: string = 'text'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const contentHash = this.simpleHash(content);
    return `${contentType}_${contentHash}_${timestamp}_${random}`;
  }
  
  /**
   * Simple hash function for content identification
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Validate text length against model constraints
   */
  protected validateTextLength(text: string): void {
    const maxLength = this._modelInfo.capabilities.maxTextLength;
    if (maxLength && text.length > maxLength) {
      console.warn(
        `Text length (${text.length}) exceeds model maximum (${maxLength}). ` +
        `Text will be truncated.`
      );
    }
  }
  
  /**
   * Truncate text to model's maximum length
   */
  protected truncateText(text: string): string {
    const maxLength = this._modelInfo.capabilities.maxTextLength;
    if (maxLength && text.length > maxLength) {
      return text.substring(0, maxLength);
    }
    return text;
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
  protected handleLoadingError(error: Error): Error {
    const baseMessage = `Failed to load model '${this.modelName}': ${error.message}`;
    
    // Provide specific guidance based on error type
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return new Error(
        `${baseMessage}\n` +
        `This appears to be a network error. Please check your internet connection ` +
        `and ensure the model repository is accessible.`
      );
    }
    
    if (error.message.includes('memory') || error.message.includes('OOM')) {
      return new Error(
        `${baseMessage}\n` +
        `This appears to be a memory error. Try using a smaller model or ` +
        `increase available memory. Required: ${this._modelInfo.requirements.minimumMemory}MB`
      );
    }
    
    if (error.message.includes('unsupported') || error.message.includes('not found')) {
      const suggestions = ModelRegistry.getSupportedModels(this.modelType);
      return new Error(
        `${baseMessage}\n` +
        `Model may not be available. Supported ${this.modelType} models: ${suggestions.join(', ')}`
      );
    }
    
    return new Error(baseMessage);
  }
}

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Options for configuring embedder instances
 */
export interface EmbedderOptions {
  cachePath?: string;
  maxBatchSize?: number;
  timeout?: number;
  enableGPU?: boolean;
  customConfig?: Record<string, any>;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create embedder options with defaults
 */
export function createEmbedderOptions(options: Partial<EmbedderOptions> = {}): EmbedderOptions {
  return {
    maxBatchSize: 8,
    timeout: 30000, // 30 seconds
    enableGPU: false,
    logLevel: 'info',
    ...options
  };
}

/**
 * Validate embedder options
 */
export function validateEmbedderOptions(options: EmbedderOptions): void {
  if (options.maxBatchSize && (options.maxBatchSize < 1 || options.maxBatchSize > 128)) {
    throw new Error('maxBatchSize must be between 1 and 128');
  }
  
  if (options.timeout && options.timeout < 1000) {
    throw new Error('timeout must be at least 1000ms');
  }
  
  const validLogLevels = ['debug', 'info', 'warn', 'error', 'silent'];
  if (options.logLevel && !validLogLevels.includes(options.logLevel)) {
    throw new Error(`logLevel must be one of: ${validLogLevels.join(', ')}`);
  }
}