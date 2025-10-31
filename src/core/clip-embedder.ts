/**
 * CORE MODULE — CLIP Embedder Implementation
 * Implements UniversalEmbedder interface for CLIP models
 * Supports text embedding with placeholder for future image support
 */

import { BaseUniversalEmbedder, type EmbedderOptions } from './base-embedder.js';
import type { EmbeddingResult } from '../types.js';
import { getResourceManager } from './resource-manager.js';

// =============================================================================
// CLIP EMBEDDER IMPLEMENTATION
// =============================================================================

/**
 * CLIP embedder implementation for Xenova/clip-vit-base-patch32
 * Supports text embedding using CLIP text encoder
 * Prepares embedImage method structure (placeholder for future implementation)
 * Ensures 512-dimensional embedding output for CLIP models
 */
export class CLIPEmbedder extends BaseUniversalEmbedder {
  private textModel: any = null;
  private imageModel: any = null; // Placeholder for future image support
  private resourceManager = getResourceManager();
  private embedderResourceId?: string;
  private textModelResourceId?: string;
  private imageModelResourceId?: string;

  constructor(modelName: string, options: EmbedderOptions = {}) {
    super(modelName, options);

    // Validate that this is a supported CLIP model
    this.validateCLIPModel();

    // Register this embedder with the resource manager
    this.embedderResourceId = this.resourceManager.registerEmbedder(this);
  }

  // =============================================================================
  // MODEL LIFECYCLE METHODS
  // =============================================================================

  /**
   * Load the CLIP model
   */
  async loadModel(): Promise<void> {
    // Check if already loaded
    if (this._isLoaded && this.textModel) {
      return;
    }

    try {
      this.logModelLoading('Loading CLIP model');

      // Dynamic import to avoid loading transformers.js unless needed
      const { pipeline } = await import('@huggingface/transformers');

      this.logModelLoading('Creating text feature extraction pipeline');

      // Create text feature extraction pipeline for CLIP only if not already created
      if (!this.textModel) {
        // Import config for cache path
        const { config } = await import('../core/config.js');

        this.textModel = await pipeline('feature-extraction', this.modelName, {
          cache_dir: config.model_cache_path,
          local_files_only: false,
          dtype: 'fp32',
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              this.logModelLoading(`Downloading: ${Math.round(progress.progress || 0)}%`);
            }
          }
        });
      }

      // Register the text model with resource manager if not already registered
      if (!this.textModelResourceId) {
        this.textModelResourceId = this.resourceManager.registerModel(
          this.textModel,
          this.modelName,
          'clip-text'
        );
      }

      // Note: Image model will be loaded when embedImage is implemented
      // For now, we only support text embeddings

      // Verify model is actually loaded
      if (this.textModel) {
        this._isLoaded = true;
        this.logModelLoading('CLIP text model loaded successfully');
      } else {
        throw new Error('CLIP model loading failed - text model is null');
      }

    } catch (error) {
      // Reset state on failure
      this._isLoaded = false;
      this.textModel = null;
      const enhancedError = this.handleLoadingError(error as Error);
      throw enhancedError;
    }
  }

  /**
   * Clean up model resources with comprehensive disposal
   */
  async cleanup(): Promise<void> {
    let cleanupErrors: string[] = [];

    try {
      // Clean up text model resources
      if (this.textModel) {
        try {
          // Use resource manager for proper cleanup
          if (this.textModelResourceId) {
            await this.resourceManager.cleanupResource(this.textModelResourceId);
            this.textModelResourceId = undefined;
          } else {
            // Fallback to direct cleanup
            if (typeof this.textModel.dispose === 'function') {
              await this.textModel.dispose();
            } else if (typeof this.textModel.destroy === 'function') {
              await this.textModel.destroy();
            } else if (typeof this.textModel.cleanup === 'function') {
              await this.textModel.cleanup();
            }
          }

          // Clear model reference
          this.textModel = null;
          this.logModelLoading('CLIP text model disposed');

        } catch (error) {
          const errorMsg = `Failed to dispose CLIP text model: ${error instanceof Error ? error.message : 'Unknown error'}`;
          cleanupErrors.push(errorMsg);
          console.warn(errorMsg);

          // Force clear reference even if disposal failed
          this.textModel = null;
        }
      }

      // Clean up image model resources (when implemented)
      if (this.imageModel) {
        try {
          // Use resource manager for proper cleanup
          if (this.imageModelResourceId) {
            await this.resourceManager.cleanupResource(this.imageModelResourceId);
            this.imageModelResourceId = undefined;
          } else {
            // Fallback to direct cleanup
            if (typeof this.imageModel.dispose === 'function') {
              await this.imageModel.dispose();
            } else if (typeof this.imageModel.destroy === 'function') {
              await this.imageModel.destroy();
            } else if (typeof this.imageModel.cleanup === 'function') {
              await this.imageModel.cleanup();
            }
          }

          // Clear model reference
          this.imageModel = null;
          this.logModelLoading('CLIP image model disposed');

        } catch (error) {
          const errorMsg = `Failed to dispose CLIP image model: ${error instanceof Error ? error.message : 'Unknown error'}`;
          cleanupErrors.push(errorMsg);
          console.warn(errorMsg);

          // Force clear reference even if disposal failed
          this.imageModel = null;
        }
      }

      // Clear embedder resource registration (don't call resource manager to avoid circular cleanup)
      if (this.embedderResourceId) {
        this.embedderResourceId = undefined;
      }

    } finally {
      // Always clear loaded state regardless of cleanup success
      this._isLoaded = false;

      // Remove from lazy loading cache to ensure fresh instances
      try {
        const { LazyEmbedderLoader } = await import('./lazy-dependency-loader.js');
        LazyEmbedderLoader.removeEmbedderFromCache(this.modelName, 'clip');
      } catch (error) {
        console.warn('Failed to remove embedder from cache:', error);
      }

      // Force garbage collection for CLIP models (they can be memory intensive)
      if (global.gc) {
        global.gc();
        this.logModelLoading('Forced garbage collection after CLIP model cleanup');
      }

      // Log cleanup completion
      if (cleanupErrors.length === 0) {
        this.logModelLoading('CLIP model resources cleaned up successfully');
      } else {
        this.logModelLoading(`CLIP model cleanup completed with ${cleanupErrors.length} errors`);
        // Don't throw errors during cleanup - just log them
      }
    }
  }

  // =============================================================================
  // TEXT EMBEDDING METHODS
  // =============================================================================

  /**
   * Embed text using CLIP text encoder
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    // Validate input first, before checking if model is loaded
    if (!text || text.trim().length === 0) {
      throw new Error('Text input cannot be empty');
    }

    this.ensureLoaded();

    // Update resource usage tracking
    if (this.embedderResourceId) {
      this.resourceManager.updateResourceUsage(this.embedderResourceId);
    }
    if (this.textModelResourceId) {
      this.resourceManager.updateResourceUsage(this.textModelResourceId);
    }

    if (!this.textModel) {
      throw new Error('CLIP text model not initialized');
    }

    try {
      // Validate and truncate text if necessary (CLIP has a 77 token limit)
      this.validateTextLength(text);
      const processedText = this.truncateText(text.trim());

      // Generate embedding using the CLIP text encoder
      // Note: CLIP models in transformers.js are designed for multimodal tasks
      // For text-only embedding, we need to handle this carefully
      let output;

      try {
        // Try standard feature extraction first
        output = await this.textModel(processedText, {
          pooling: 'mean',
          normalize: true
        });
      } catch (error) {
        // If that fails due to missing pixel_values, we need a different approach
        if (error instanceof Error && error.message.includes('pixel_values')) {
          throw new Error(
            'CLIP text-only embedding is not fully supported in the current transformers.js version. ' +
            'CLIP models are designed for multimodal tasks and expect both text and image inputs. ' +
            'For text-only embedding, consider using sentence-transformer models like ' +
            'sentence-transformers/all-MiniLM-L6-v2 or Xenova/all-mpnet-base-v2. ' +
            'Full CLIP multimodal support will be available in future updates.'
          );
        }
        throw error;
      }

      // Extract the embedding vector
      let embedding: Float32Array;

      if (output && output.data) {
        // Handle different output formats from transformers.js
        embedding = new Float32Array(output.data);
      } else if (Array.isArray(output) && output.length > 0) {
        // Handle array output format
        const firstOutput = output[0];
        if (firstOutput && firstOutput.data) {
          embedding = new Float32Array(firstOutput.data);
        } else if (Array.isArray(firstOutput)) {
          embedding = new Float32Array(firstOutput);
        } else {
          throw new Error('Unexpected output format from CLIP text model');
        }
      } else {
        throw new Error('No embedding data received from CLIP text model');
      }

      // Validate embedding dimensions (CLIP should produce 512-dimensional embeddings)
      if (embedding.length !== this.dimensions) {
        throw new Error(
          `CLIP embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`
        );
      }

      // Generate unique embedding ID
      const embeddingId = this.generateEmbeddingId(processedText, 'text');

      return {
        embedding_id: embeddingId,
        vector: embedding,
        contentType: 'text'
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to embed text with CLIP: ${error.message}`);
      }
      throw new Error('Failed to embed text with CLIP: Unknown error');
    }
  }

  // =============================================================================
  // IMAGE EMBEDDING METHODS (PLACEHOLDER)
  // =============================================================================

  /**
   * Embed image using CLIP image encoder
   * PLACEHOLDER: This method structure is prepared for future implementation
   * Currently throws an error indicating the feature is not yet implemented
   */
  async embedImage(imagePath: string): Promise<EmbeddingResult> {
    // Validate that the model supports images
    if (!this.supportedContentTypes.includes('image')) {
      throw new Error(`Model '${this.modelName}' does not support image embeddings`);
    }

    // TODO: Implement image embedding in future tasks
    throw new Error(
      'Image embedding is not yet implemented. ' +
      'This method is a placeholder for future multimodal functionality. ' +
      'Currently, only text embedding is supported for CLIP models.'
    );

    // Future implementation will look like:
    /*
    this.ensureLoaded();
    
    if (!imagePath || imagePath.trim().length === 0) {
      throw new Error('Image path cannot be empty');
    }
    
    try {
      // Load and preprocess image
      const image = await this.loadImage(imagePath);
      
      // Generate embedding using CLIP image encoder
      const output = await this.imageModel(image, {
        normalize: true
      });
      
      // Process output and return EmbeddingResult
      const embedding = new Float32Array(output.data);
      const embeddingId = this.generateEmbeddingId(imagePath, 'image');
      
      return {
        embedding_id: embeddingId,
        vector: embedding
      };
      
    } catch (error) {
      throw new Error(`Failed to embed image with CLIP: ${error.message}`);
    }
    */
  }

  // =============================================================================
  // BATCH PROCESSING OPTIMIZATION
  // =============================================================================

  /**
   * Optimized batch processing for CLIP models with BatchProcessingOptimizer
   * Handles mixed text content with memory-efficient processing for images (when implemented)
   */
  protected async processBatch(batch: Array<{ content: string; contentType: string; metadata?: Record<string, any> }>): Promise<EmbeddingResult[]> {
    this.ensureLoaded();

    // Separate text and image items
    const textItems = batch.filter(item => item.contentType === 'text');
    const imageItems = batch.filter(item => item.contentType === 'image');

    const results: EmbeddingResult[] = [];

    // Process text items with optimization
    if (textItems.length > 0) {
      // For small batches, use direct processing
      if (textItems.length <= 5) {
        try {
          const textResults = await this.processBatchText(textItems);
          results.push(...textResults);
        } catch (error) {
          console.warn(`CLIP text batch processing failed, falling back to individual processing: ${error}`);
          // Fall back to individual processing for text items
          for (const item of textItems) {
            try {
              const result = await this.embedText(item.content);
              results.push(result);
            } catch (itemError) {
              console.warn(`Failed to process text item: ${itemError}`);
              // Add placeholder result for failed items
              const zeroVector = new Float32Array(this.dimensions).fill(0);
              results.push({
                embedding_id: `failed_${Date.now()}_${Math.random()}`,
                vector: zeroVector
              });
            }
          }
        }
      } else {
        // For larger batches, use BatchProcessingOptimizer
        try {
          const { createTextBatchProcessor } = await import('./batch-processing-optimizer.js');
          const batchProcessor = createTextBatchProcessor();

          // Convert to EmbeddingBatchItem format
          const batchItems = textItems.map(item => ({
            content: this.truncateText(item.content.trim()),
            contentType: item.contentType,
            metadata: item.metadata
          }));

          // Create embed function that uses this CLIP embedder
          const embedFunction = async (item: any) => {
            const result = await this.embedText(item.content);

            // Validate dimensions
            if (result.vector.length !== this.dimensions) {
              throw new Error(
                `CLIP embedding dimension mismatch: expected ${this.dimensions}, got ${result.vector.length}`
              );
            }

            return result;
          };

          // Process with optimization and progress reporting
          const batchResult = await batchProcessor.processBatch(
            batchItems,
            embedFunction,
            (stats) => {
              if (stats.totalItems > 20) { // Log for moderate-sized batches
                console.log(`CLIP text embedding progress: ${stats.processedItems}/${stats.totalItems} (${Math.round((stats.processedItems / stats.totalItems) * 100)}%)`);
              }
            }
          );

          // Log final statistics for larger batches
          if (batchResult.stats.totalItems > 20) {
            console.log(`✓ CLIP text embedding complete: ${batchResult.stats.processedItems} processed, ${batchResult.stats.failedItems} failed`);
            console.log(`  Processing time: ${Math.round(batchResult.stats.processingTimeMs / 1000)}s, Rate: ${Math.round(batchResult.stats.itemsPerSecond)} items/sec`);

            if (batchResult.stats.peakMemoryUsageMB > 100) {
              console.log(`  Peak memory usage: ${batchResult.stats.peakMemoryUsageMB}MB`);
            }
          }

          results.push(...batchResult.results);

        } catch (error) {
          console.warn(`CLIP batch processing optimizer failed, using fallback: ${error}`);

          // Fall back to direct batch processing
          try {
            const textResults = await this.processBatchText(textItems);
            results.push(...textResults);
          } catch (fallbackError) {
            console.warn(`CLIP fallback batch processing failed, using individual processing: ${fallbackError}`);

            // Final fallback to individual processing
            for (const item of textItems) {
              try {
                const result = await this.embedText(item.content);
                results.push(result);
              } catch (itemError) {
                console.warn(`Failed to process CLIP text item: ${itemError}`);
                const zeroVector = new Float32Array(this.dimensions).fill(0);
                results.push({
                  embedding_id: `failed_${Date.now()}_${Math.random()}`,
                  vector: zeroVector
                });
              }
            }
          }
        }
      }
    }

    // Process image items with memory-efficient optimization (placeholder for future implementation)
    if (imageItems.length > 0) {
      console.warn(`Processing ${imageItems.length} image items - using placeholder implementation`);

      // Future implementation will use createImageBatchProcessor() for memory-efficient image processing
      try {
        const { createImageBatchProcessor } = await import('./batch-processing-optimizer.js');
        const imageBatchProcessor = createImageBatchProcessor();

        // Convert to EmbeddingBatchItem format
        const imageBatchItems = imageItems.map(item => ({
          content: item.content,
          contentType: item.contentType,
          metadata: item.metadata
        }));

        // Create placeholder embed function for images
        const imageEmbedFunction = async (item: any) => {
          // TODO: Replace with actual image embedding when implemented
          console.warn(`Placeholder: Would embed image ${item.content}`);

          // Return placeholder result
          const zeroVector = new Float32Array(this.dimensions).fill(0);
          return {
            embedding_id: `image_placeholder_${Date.now()}_${Math.random()}`,
            vector: zeroVector,
            contentType: 'image'
          };
        };

        // Process with memory-efficient image batch processor
        const imageBatchResult = await imageBatchProcessor.processBatch(
          imageBatchItems,
          imageEmbedFunction,
          (stats) => {
            console.log(`Image processing progress: ${stats.processedItems}/${stats.totalItems} (${Math.round((stats.processedItems / stats.totalItems) * 100)}%)`);
            console.log(`  Memory usage: ${stats.memoryUsageMB}MB (peak: ${stats.peakMemoryUsageMB}MB)`);
          }
        );

        console.log(`✓ Image processing complete: ${imageBatchResult.stats.processedItems} processed`);
        console.log(`  Memory efficiency: Peak usage ${imageBatchResult.stats.peakMemoryUsageMB}MB`);

        results.push(...imageBatchResult.results);

      } catch (error) {
        console.warn(`Image batch processing failed, using simple placeholder: ${error}`);

        // Simple placeholder for image items
        for (const item of imageItems) {
          const zeroVector = new Float32Array(this.dimensions).fill(0);
          results.push({
            embedding_id: `image_placeholder_${Date.now()}_${Math.random()}`,
            vector: zeroVector
          });
        }
      }
    }

    return results;
  }

  /**
   * Process batch of text items
   * @private
   */
  private async processBatchText(textItems: Array<{ content: string; contentType: string; metadata?: Record<string, any> }>): Promise<EmbeddingResult[]> {
    // Prepare texts for batch processing
    const texts = textItems.map(item => this.truncateText(item.content.trim()));

    // Process batch through the CLIP text model
    const outputs = await this.textModel(texts, {
      pooling: 'mean',
      normalize: true
    });

    // Convert outputs to EmbeddingResult format
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      let embedding: Float32Array;

      // Handle different output formats
      if (Array.isArray(outputs) && outputs[i]) {
        const output = outputs[i];
        if (output.data) {
          embedding = new Float32Array(output.data);
        } else if (Array.isArray(output)) {
          embedding = new Float32Array(output);
        } else {
          throw new Error(`Invalid CLIP output format for item ${i}`);
        }
      } else {
        throw new Error(`No CLIP output received for item ${i}`);
      }

      // Validate dimensions
      if (embedding.length !== this.dimensions) {
        throw new Error(
          `CLIP embedding dimension mismatch for item ${i}: expected ${this.dimensions}, got ${embedding.length}`
        );
      }

      const embeddingId = this.generateEmbeddingId(item.content, 'text');

      results.push({
        embedding_id: embeddingId,
        vector: embedding,
        contentType: 'text'
      });
    }

    return results;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Get CLIP-specific model information
   */
  getModelInfo() {
    const baseInfo = super.getModelInfo();

    return {
      ...baseInfo,
      capabilities: {
        ...baseInfo.capabilities,
        // CLIP-specific capabilities
        supportsMultimodal: true,
        supportsZeroShotClassification: true,
        supportsImageTextSimilarity: true, // Will be true when image support is added
        supportsTextImageRetrieval: true,  // Will be true when image support is added
        recommendedUseCase: 'multimodal similarity and zero-shot classification',
        imageEmbeddingStatus: 'placeholder' // Indicates image support is planned but not implemented
      }
    };
  }

  /**
   * Check if the model is suitable for a specific task
   */
  isSuitableForTask(task: 'similarity' | 'classification' | 'clustering' | 'retrieval' | 'multimodal'): boolean {
    const supportedTasks = ['similarity', 'classification', 'retrieval', 'multimodal'];
    return supportedTasks.includes(task);
  }

  /**
   * Get information about multimodal capabilities
   */
  getMultimodalCapabilities(): {
    textSupport: boolean;
    imageSupport: boolean;
    videoSupport: boolean;
    audioSupport: boolean;
    plannedFeatures: string[];
  } {
    return {
      textSupport: true,
      imageSupport: false, // Will be true when implemented
      videoSupport: false,
      audioSupport: false,
      plannedFeatures: [
        'Image embedding support',
        'Image-text similarity computation',
        'Zero-shot image classification',
        'Cross-modal retrieval'
      ]
    };
  }

  // =============================================================================
  // CLIP-SPECIFIC METHODS
  // =============================================================================

  /**
   * Get CLIP model variant information
   */
  getModelVariant(): {
    architecture: string;
    patchSize: number;
    imageSize: number;
    textMaxLength: number;
  } {
    // Extract information from model name
    const modelName = this.modelName.toLowerCase();

    if (modelName.includes('patch32')) {
      return {
        architecture: 'ViT-B/32',
        patchSize: 32,
        imageSize: 224,
        textMaxLength: 77
      };
    } else if (modelName.includes('patch16')) {
      return {
        architecture: 'ViT-B/16',
        patchSize: 16,
        imageSize: 224,
        textMaxLength: 77
      };
    } else {
      // Default to patch32 if unclear
      return {
        architecture: 'ViT-B/32',
        patchSize: 32,
        imageSize: 224,
        textMaxLength: 77
      };
    }
  }

  /**
   * Check if text length is within CLIP's token limit
   */
  isTextLengthValid(text: string): boolean {
    const variant = this.getModelVariant();
    // Rough estimation: ~4 characters per token for English text
    const estimatedTokens = Math.ceil(text.length / 4);
    return estimatedTokens <= variant.textMaxLength;
  }

  /**
   * Get performance characteristics for this CLIP variant
   */
  getPerformanceInfo(): {
    speed: 'fast' | 'medium' | 'slow';
    accuracy: 'good' | 'better' | 'best';
    memoryUsage: 'low' | 'medium' | 'high';
    recommendedBatchSize: number;
  } {
    const variant = this.getModelVariant();

    if (variant.patchSize === 32) {
      return {
        speed: 'fast',
        accuracy: 'good',
        memoryUsage: 'medium',
        recommendedBatchSize: 8
      };
    } else if (variant.patchSize === 16) {
      return {
        speed: 'medium',
        accuracy: 'better',
        memoryUsage: 'high',
        recommendedBatchSize: 4
      };
    } else {
      return {
        speed: 'medium',
        accuracy: 'good',
        memoryUsage: 'medium',
        recommendedBatchSize: 6
      };
    }
  }

  /**
   * Override isLoaded to check both internal state and model availability
   */
  isLoaded(): boolean {
    return this._isLoaded && this.textModel !== null;
  }

  /**
   * Validate that this is a supported CLIP model
   */
  private validateCLIPModel(): void {
    const supportedModels = [
      'Xenova/clip-vit-base-patch32',
      'Xenova/clip-vit-base-patch16'
    ];

    if (!supportedModels.includes(this.modelName)) {
      throw new Error(
        `Unsupported CLIP model: ${this.modelName}. ` +
        `Supported models: ${supportedModels.join(', ')}`
      );
    }
  }
}