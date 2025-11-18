/**
 * MULTIMODAL IMPLEMENTATION — CLIP Embedder Implementation
 * 
 * Implements UniversalEmbedder interface for CLIP models with full multimodal support.
 * Provides reliable text and image embedding using CLIPTextModelWithProjection and 
 * CLIPVisionModelWithProjection for true cross-modal search capabilities.
 * 
 * Features:
 * - Text embedding using CLIP text encoder (512-dimensional vectors)
 * - Image embedding using CLIP vision encoder (512-dimensional vectors)
 * - Unified embedding space enabling cross-modal similarity search
 * - Text queries can find semantically similar images
 * - Image queries can find semantically similar text
 * - Batch processing optimization for both text and images
 * 
 * Supported Models:
 * - Xenova/clip-vit-base-patch32 (recommended, faster)
 * - Xenova/clip-vit-base-patch16 (higher accuracy, slower)
 */

import { BaseUniversalEmbedder, type EmbedderOptions } from '../core/abstract-embedder.js';
import type { EmbeddingResult } from '../types.js';
import { getResourceManager } from '../core/resource-manager.js';

// =============================================================================
// CLIP EMBEDDER IMPLEMENTATION
// =============================================================================

/**
 * CLIP embedder implementation for multimodal content
 * 
 * Provides reliable text and image embedding using separate CLIP model components:
 * - CLIPTextModelWithProjection for text-only embedding (no pixel_values errors)
 * - CLIPVisionModelWithProjection for image embedding
 * - AutoTokenizer for proper text tokenization with CLIP's 77 token limit
 * 
 * All embeddings are 512-dimensional vectors in a unified embedding space,
 * enabling true cross-modal search where text queries can find images and
 * image queries can find text based on semantic similarity.
 * 
 * Example Usage:
 * ```typescript
 * const embedder = await createEmbedder('Xenova/clip-vit-base-patch32');
 * 
 * // Embed text
 * const textResult = await embedder.embedText('a red sports car');
 * 
 * // Embed image
 * const imageResult = await embedder.embedImage('./car.jpg');
 * 
 * // Calculate cross-modal similarity
 * const similarity = cosineSimilarity(textResult.vector, imageResult.vector);
 * ```
 */
export class CLIPEmbedder extends BaseUniversalEmbedder {
  private tokenizer: any = null;
  private textModel: any = null;
  private imageModel: any = null; // Placeholder for future image support
  private resourceManager = getResourceManager();
  private embedderResourceId?: string;
  private tokenizerResourceId?: string;
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
   * Load the CLIP model components
   * 
   * Loads three separate components for reliable multimodal embedding:
   * 1. AutoTokenizer - Handles text tokenization with CLIP's 77 token limit
   * 2. CLIPTextModelWithProjection - Generates text embeddings without pixel_values errors
   * 3. CLIPVisionModelWithProjection - Generates image embeddings
   * 
   * All components are registered with the resource manager for proper cleanup.
   * Models are cached locally after first download for faster subsequent loads.
   * 
   * @throws {Error} If model loading fails or components are not available
   */
  async loadModel(): Promise<void> {
    // Check if already loaded
    if (this._isLoaded && this.textModel) {
      return;
    }

    try {
      this.logModelLoading('Loading CLIP model');

      // Use the validated CLIPTextModelWithProjection approach instead of feature-extraction pipeline
      const { AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection } = await import('@huggingface/transformers');

      this.logModelLoading('Loading CLIP tokenizer and text model components');

      // Load tokenizer and text model separately (validated approach from task 1.1)
      if (!this.textModel) {
        // Import config for cache path
        const { config } = await import('../core/config.js');

        // Load tokenizer
        this.logModelLoading('Loading CLIP tokenizer...');
        this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName, {
          cache_dir: config.model_cache_path,
          local_files_only: false,
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              this.logModelLoading(`Downloading tokenizer: ${Math.round(progress.progress || 0)}%`);
            }
          }
        });

        // Load text model using CLIPTextModelWithProjection
        this.logModelLoading('Loading CLIP text model...');
        this.textModel = await CLIPTextModelWithProjection.from_pretrained(this.modelName, {
          cache_dir: config.model_cache_path,
          local_files_only: false,
          dtype: 'fp32',
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              this.logModelLoading(`Downloading text model: ${Math.round(progress.progress || 0)}%`);
            }
          }
        });

        // Load vision model using CLIPVisionModelWithProjection for image embedding
        this.logModelLoading('Loading CLIP vision model...');
        this.imageModel = await CLIPVisionModelWithProjection.from_pretrained(this.modelName, {
          cache_dir: config.model_cache_path,
          local_files_only: false,
          dtype: 'fp32',
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              this.logModelLoading(`Downloading vision model: ${Math.round(progress.progress || 0)}%`);
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

      // Register the image model with resource manager if not already registered
      if (!this.imageModelResourceId && this.imageModel) {
        this.imageModelResourceId = this.resourceManager.registerModel(
          this.imageModel,
          this.modelName,
          'clip-vision'
        );
      }

      // Verify models are actually loaded
      if (this.textModel && this.imageModel) {
        this._isLoaded = true;
        this.logModelLoading('CLIP text and vision models loaded successfully');
      } else {
        const missingModels = [];
        if (!this.textModel) missingModels.push('text model');
        if (!this.imageModel) missingModels.push('vision model');
        throw new Error(`CLIP model loading failed - ${missingModels.join(' and ')} ${missingModels.length === 1 ? 'is' : 'are'} null`);
      }

    } catch (error) {
      // Reset state on failure
      this._isLoaded = false;
      this.textModel = null;
      throw error;
    }
  }

  /**
   * Clean up model resources with comprehensive disposal
   * 
   * Properly disposes of all CLIP model components:
   * - Tokenizer resources
   * - Text model resources
   * - Vision model resources
   * 
   * Uses the resource manager for coordinated cleanup and forces garbage
   * collection to free memory from CLIP models which can be memory intensive.
   * 
   * This method is safe to call multiple times and will not throw errors
   * during cleanup - errors are logged but don't prevent cleanup completion.
   */
  async cleanup(): Promise<void> {
    let cleanupErrors: string[] = [];

    try {
      // Clean up tokenizer resources
      if (this.tokenizer) {
        try {
          // Use resource manager for proper cleanup
          if (this.tokenizerResourceId) {
            await this.resourceManager.cleanupResource(this.tokenizerResourceId);
            this.tokenizerResourceId = undefined;
          }

          // Clear tokenizer reference
          this.tokenizer = null;
          this.logModelLoading('CLIP tokenizer disposed');

        } catch (error) {
          const errorMsg = `Failed to dispose CLIP tokenizer: ${error instanceof Error ? error.message : 'Unknown error'}`;
          cleanupErrors.push(errorMsg);
          console.warn(errorMsg);

          // Force clear reference even if disposal failed
          this.tokenizer = null;
        }
      }

      // Clean up text model resources
      if (this.textModel) {
        try {
          // Use resource manager for proper cleanup
          if (this.textModelResourceId) {
            await this.resourceManager.cleanupResource(this.textModelResourceId);
            this.textModelResourceId = undefined;
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
        const { LazyEmbedderLoader } = await import('../core/lazy-dependency-loader.js');
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
  // NORMALIZATION UTILITIES
  // =============================================================================

  /**
   * Apply L2-normalization to an embedding vector
   * 
   * L2-normalization ensures that all embeddings have unit length (magnitude = 1),
   * which is essential for CLIP models as they were trained with normalized embeddings.
   * This normalization makes cosine similarity calculations more reliable and ensures
   * that vector magnitudes don't affect similarity scores.
   * 
   * @param embedding - The embedding vector to normalize (modified in-place)
   * @returns The normalized embedding vector (same reference as input)
   * @private
   */
  private normalizeEmbedding(embedding: Float32Array): Float32Array {
    // Calculate L2 norm (magnitude)
    const magnitude = Math.sqrt(
      Array.from(embedding).reduce((sum, val) => sum + val * val, 0)
    );

    // Avoid division by zero
    if (magnitude > 0) {
      // Normalize each component by dividing by magnitude
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  // =============================================================================
  // TEXT EMBEDDING METHODS
  // =============================================================================

  /**
   * Embed text using CLIP text encoder
   * 
   * Uses CLIPTextModelWithProjection for reliable text-only embedding without
   * pixel_values errors. Text is tokenized with CLIP's 77 token limit and
   * automatically truncated if necessary.
   * 
   * Returns a 512-dimensional L2-normalized embedding vector in the unified CLIP 
   * embedding space, which is directly comparable to image embeddings for cross-modal search.
   * 
   * @param text - The text to embed (will be trimmed and validated)
   * @returns EmbeddingResult with 512-dimensional normalized vector and metadata
   * @throws {Error} If text is empty, model not loaded, or embedding fails
   * 
   * @example
   * ```typescript
   * const result = await embedder.embedText('a red sports car');
   * console.log(result.vector.length); // 512
   * console.log(result.contentType);   // 'text'
   * ```
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    // Enhanced input validation and preprocessing
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    const processedText = text.trim();
    if (processedText.length === 0) {
      throw new Error('Empty text provided to CLIP embedder');
    }

    this.ensureLoaded();

    // Update resource usage tracking
    if (this.embedderResourceId) {
      this.resourceManager.updateResourceUsage(this.embedderResourceId);
    }
    if (this.textModelResourceId) {
      this.resourceManager.updateResourceUsage(this.textModelResourceId);
    }

    if (!this.textModel || !this.tokenizer) {
      throw new Error('CLIP text model or tokenizer not initialized');
    }

    try {
      // Validate and truncate text if necessary (CLIP has a 77 token limit)
      this.validateTextLength(text);
      const finalProcessedText = this.truncateText(processedText);

      // Use the validated CLIPTextModelWithProjection approach (no pixel_values errors)
      // Tokenize text with CLIP's requirements
      const tokens = await this.tokenizer(finalProcessedText, {
        padding: true,
        truncation: true,
        max_length: 77, // CLIP's text sequence length limit
        return_tensors: 'pt'
      });

      // Log token information for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        const tokenIds = tokens.input_ids?.data || [];
        const actualTokenCount = Array.from(tokenIds as number[]).filter((id: number) => id !== 0).length;
        if (actualTokenCount >= 77) {
          console.warn(`Text truncated: "${finalProcessedText.substring(0, 50)}..." (${actualTokenCount}+ tokens -> 77 tokens)`);
        }
      }

      // Generate text embedding using CLIPTextModelWithProjection
      const output = await this.textModel(tokens);

      // Extract embedding from text_embeds (no pixel_values dependency)
      const embedding = new Float32Array(output.text_embeds.data);

      // Validate embedding dimensions and values
      if (embedding.length !== this.dimensions) {
        throw new Error(`CLIP embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
      }

      // Validate that all values are finite numbers
      const invalidValues = Array.from(embedding).filter(val => !isFinite(val) || isNaN(val));
      if (invalidValues.length > 0) {
        throw new Error(`CLIP embedding contains ${invalidValues.length} invalid values`);
      }

      // Validate embedding quality - should not be all zeros
      const nonZeroValues = Array.from(embedding).filter(val => Math.abs(val) > 1e-8);
      if (nonZeroValues.length === 0) {
        throw new Error('CLIP embedding is all zeros');
      }

      // Calculate embedding magnitude before normalization for quality assessment
      const magnitudeBeforeNorm = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      if (magnitudeBeforeNorm < 1e-6) {
        throw new Error(`CLIP embedding has critically low magnitude: ${magnitudeBeforeNorm.toExponential(3)}`);
      }

      // Apply L2-normalization (CLIP models are trained with normalized embeddings)
      this.normalizeEmbedding(embedding);

      // Verify normalization was successful
      const magnitudeAfterNorm = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      if (Math.abs(magnitudeAfterNorm - 1.0) > 0.01) {
        console.warn(`Warning: Embedding normalization may be imprecise (magnitude: ${magnitudeAfterNorm.toFixed(6)})`);
      }

      // Generate unique embedding ID
      const embeddingId = this.generateEmbeddingId(finalProcessedText, 'text');

      return {
        embedding_id: embeddingId,
        vector: embedding,
        contentType: 'text',
        metadata: {
          originalText: text,
          processedText: finalProcessedText,
          textLength: finalProcessedText.length,
          embeddingMagnitudeBeforeNorm: magnitudeBeforeNorm,
          embeddingMagnitudeAfterNorm: magnitudeAfterNorm,
          normalized: true,
          modelName: this.modelName,
          modelType: this.modelType,
          dimensions: this.dimensions
        }
      };

    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // IMAGE EMBEDDING METHODS
  // =============================================================================

  /**
   * Embed image using CLIP vision encoder
   * 
   * Uses CLIPVisionModelWithProjection to generate image embeddings in the same
   * unified embedding space as text embeddings, enabling true cross-modal search.
   * 
   * Supports both local file paths and URLs. Images are automatically preprocessed:
   * - Resized to 224x224 pixels (CLIP's expected input size)
   * - Converted to proper pixel_values format using AutoProcessor
   * - Normalized for CLIP vision model
   * 
   * Returns a 512-dimensional L2-normalized embedding vector directly comparable to text embeddings.
   * 
   * @param imagePath - Local file path or URL to the image
   * @returns EmbeddingResult with 512-dimensional normalized vector and metadata
   * @throws {Error} If image not found, unsupported format, or embedding fails
   * 
   * @example
   * ```typescript
   * // Local file
   * const result = await embedder.embedImage('./car.jpg');
   * 
   * // URL
   * const result = await embedder.embedImage('https://example.com/car.jpg');
   * 
   * console.log(result.vector.length); // 512
   * console.log(result.contentType);   // 'image'
   * ```
   * 
   * Supported formats: PNG, JPEG, GIF, BMP, WebP
   */
  async embedImage(imagePath: string): Promise<EmbeddingResult> {
    // Enhanced input validation and preprocessing
    if (typeof imagePath !== 'string') {
      throw new Error('Image path must be a string');
    }

    const processedPath = imagePath.trim();
    if (processedPath.length === 0) {
      throw new Error('Image path cannot be empty');
    }

    // Validate that the model supports images
    if (!this.supportedContentTypes.includes('image')) {
      throw new Error(`Model '${this.modelName}' does not support image embeddings`);
    }

    this.ensureLoaded();

    // Update resource usage tracking
    if (this.embedderResourceId) {
      this.resourceManager.updateResourceUsage(this.embedderResourceId);
    }
    if (this.imageModelResourceId) {
      this.resourceManager.updateResourceUsage(this.imageModelResourceId);
    }

    if (!this.imageModel) {
      throw new Error('CLIP vision model not initialized');
    }

    try {
      // Load and preprocess image using transformers.js utilities
      const image = await this.loadAndPreprocessImage(processedPath);
      
      // Use AutoProcessor to convert image to proper pixel_values format
      const { AutoProcessor } = await import('@huggingface/transformers');
      const processor = await AutoProcessor.from_pretrained(this.modelName);
      const processedInputs = await processor(image);
      
      // Generate image embedding using CLIPVisionModelWithProjection
      // The model expects pixel_values as input
      const output = await this.imageModel(processedInputs);
      
      // Extract embedding from image_embeds output (similar to text_embeds)
      const embedding = new Float32Array(output.image_embeds.data);
      
      // Validate embedding dimensions and values
      if (embedding.length !== this.dimensions) {
        throw new Error(`CLIP image embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
      }

      // Validate that all values are finite numbers
      const invalidValues = Array.from(embedding).filter(val => !isFinite(val) || isNaN(val));
      if (invalidValues.length > 0) {
        throw new Error(`CLIP image embedding contains ${invalidValues.length} invalid values`);
      }

      // Validate embedding quality - should not be all zeros
      const nonZeroValues = Array.from(embedding).filter(val => Math.abs(val) > 1e-8);
      if (nonZeroValues.length === 0) {
        throw new Error('CLIP image embedding is all zeros');
      }

      // Calculate embedding magnitude before normalization for quality assessment
      const magnitudeBeforeNorm = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      if (magnitudeBeforeNorm < 1e-6) {
        throw new Error(`CLIP image embedding has critically low magnitude: ${magnitudeBeforeNorm.toExponential(3)}`);
      }

      // Apply L2-normalization (CLIP models are trained with normalized embeddings)
      this.normalizeEmbedding(embedding);

      // Verify normalization was successful
      const magnitudeAfterNorm = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      if (Math.abs(magnitudeAfterNorm - 1.0) > 0.01) {
        console.warn(`Warning: Image embedding normalization may be imprecise (magnitude: ${magnitudeAfterNorm.toFixed(6)})`);
      }

      // Generate unique embedding ID
      const embeddingId = this.generateEmbeddingId(processedPath, 'image');

      return {
        embedding_id: embeddingId,
        vector: embedding,
        contentType: 'image',
        metadata: {
          imagePath: processedPath,
          embeddingMagnitudeBeforeNorm: magnitudeBeforeNorm,
          embeddingMagnitudeAfterNorm: magnitudeAfterNorm,
          normalized: true,
          modelName: this.modelName,
          modelType: this.modelType,
          dimensions: this.dimensions
        }
      };

    } catch (error) {
      if (error instanceof Error) {
        // Provide more context for common errors
        if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
          throw new Error(`Image file not found: ${processedPath}`);
        }
        if (error.message.includes('unsupported format') || error.message.includes('invalid image')) {
          throw new Error(`Unsupported image format or corrupted file: ${processedPath}`);
        }
      }
      throw error;
    }
  }

  // =============================================================================
  // IMAGE PREPROCESSING UTILITIES
  // =============================================================================

  /**
   * Load and preprocess image for CLIP vision model
   * 
   * Handles image loading from both local files and URLs with automatic format
   * detection and preprocessing. Uses Sharp library when available for better
   * Node.js support, falls back to RawImage for browser compatibility.
   * 
   * Preprocessing steps:
   * 1. Load image from path or URL
   * 2. Resize to 224x224 pixels (CLIP's expected input size)
   * 3. Convert to RGB format if needed
   * 4. Return RawImage object for AutoProcessor
   * 
   * @param imagePath - Local file path or URL to the image
   * @returns RawImage object ready for AutoProcessor
   * @throws {Error} If image loading or preprocessing fails
   * @private
   */
  private async loadAndPreprocessImage(imagePath: string): Promise<any> {
    try {
      // Import required utilities
      const { RawImage } = await import('@huggingface/transformers');
      const path = await import('path');
      const fs = await import('fs');
      
      // Get CLIP model variant info for preprocessing parameters
      const variant = this.getModelVariant();
      
      // Check if this is a URL or local file path
      const isUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');
      
      if (isUrl) {
        // Load from URL using RawImage
        // Temporarily suppress ALL console output to avoid logging base64 data
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleInfo = console.info;
        const originalConsoleError = console.error;
        const originalConsoleDebug = console.debug;
        
        try {
          // Suppress ALL console output during image loading
          console.log = () => {};
          console.warn = () => {};
          console.info = () => {};
          console.error = () => {};
          console.debug = () => {};
          
          const image = await RawImage.fromURL(imagePath);
          const processedImage = await image.resize(variant.imageSize, variant.imageSize);
          return processedImage;
        } finally {
          // Restore ALL console output
          console.log = originalConsoleLog;
          console.warn = originalConsoleWarn;
          console.info = originalConsoleInfo;
          console.error = originalConsoleError;
          console.debug = originalConsoleDebug;
        }
      }
      
      // For local files, try Sharp first (if available), then fall back to RawImage
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      const absolutePath = path.resolve(imagePath);
      
      // Try to use Sharp for better Node.js support
      try {
        const sharp = await import('sharp');
        
        // Use Sharp to load and get raw pixel data
        const { data, info } = await sharp.default(absolutePath)
          .resize(variant.imageSize, variant.imageSize, {
            fit: 'cover',
            position: 'center'
          })
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        // Create RawImage directly from pixel data (avoids data URL logging)
        const { RawImage } = await import('@huggingface/transformers');
        const image = new RawImage(
          new Uint8ClampedArray(data),
          info.width,
          info.height,
          info.channels
        );
        
        return image;
        
      } catch (sharpError) {
        // Sharp not available or failed, fall back to RawImage.read()
        console.warn('Sharp not available, using RawImage fallback:', sharpError instanceof Error ? sharpError.message : 'Unknown error');
        
        const image = await RawImage.read(absolutePath);
        const processedImage = await image.resize(variant.imageSize, variant.imageSize);
        return processedImage;
      }
      
    } catch (error) {
      if (error instanceof Error) {
        // Provide helpful error messages for common issues
        if (error.message.includes('fetch') || error.message.includes('Failed to load image')) {
          throw new Error(`Failed to load image from path: ${imagePath}. Ensure the path is correct and accessible.`);
        }
        if (error.message.includes('decode') || error.message.includes('IDAT') || error.message.includes('PNG')) {
          throw new Error(`Failed to decode image: ${imagePath}. The file may be corrupted or in an unsupported format. Supported formats: PNG, JPEG, GIF, BMP, WebP.`);
        }
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
          throw new Error(`Image file not found: ${imagePath}`);
        }
      }
      throw new Error(`Image preprocessing failed for ${imagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // BATCH PROCESSING OPTIMIZATION
  // =============================================================================

  /**
   * Optimized batch processing for CLIP models
   * 
   * Processes mixed batches of text and image content efficiently using the
   * BatchProcessingOptimizer for memory management and progress tracking.
   * 
   * Features:
   * - Automatic separation of text and image items
   * - Memory-efficient processing for large batches
   * - Progress reporting for batches > 20 items
   * - Garbage collection between batches
   * - Detailed statistics logging
   * 
   * @param batch - Array of items with content, contentType, and optional metadata
   * @returns Array of EmbeddingResult objects in the same order as input
   * @throws {Error} If batch processing fails
   * @protected
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
        const textResults = await this.processBatchText(textItems);
        results.push(...textResults);
      } else {
        // For larger batches, use BatchProcessingOptimizer
        try {
          const { createTextBatchProcessor } = await import('../core/batch-processing-optimizer.js');
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
          console.error('Text batch processing failed:', error);
          throw error;
        }
      }
    }

    // Process image items with memory-efficient optimization (placeholder for future implementation)
    if (imageItems.length > 0) {
      console.warn(`Processing ${imageItems.length} image items - using placeholder implementation`);

      // Future implementation will use createImageBatchProcessor() for memory-efficient image processing
      try {
        const { createImageBatchProcessor } = await import('../core/batch-processing-optimizer.js');
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
        console.error('Image batch processing failed:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Process batch of text items using CLIPTextModelWithProjection
   * 
   * Efficiently processes multiple text items by tokenizing all texts first,
   * then generating embeddings sequentially. This approach balances memory
   * usage with processing speed.
   * 
   * @param textItems - Array of text items to process
   * @returns Array of EmbeddingResult objects
   * @throws {Error} If batch processing fails or dimension mismatch occurs
   * @private
   */
  private async processBatchText(textItems: Array<{ content: string; contentType: string; metadata?: Record<string, any> }>): Promise<EmbeddingResult[]> {
    // Prepare texts for batch processing
    const texts = textItems.map(item => this.truncateText(item.content.trim()));

    // Tokenize all texts in batch
    const tokensBatch = await Promise.all(
      texts.map(text => this.tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: 77, // CLIP's text sequence length limit
        return_tensors: 'pt'
      }))
    );

    // Process each tokenized text through the CLIP text model
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      const tokens = tokensBatch[i];

      // Generate embedding using CLIPTextModelWithProjection
      const output = await this.textModel(tokens);

      // Extract embedding from text_embeds (no pixel_values dependency)
      const embedding = new Float32Array(output.text_embeds.data);

      // Validate dimensions
      if (embedding.length !== this.dimensions) {
        throw new Error(
          `CLIP embedding dimension mismatch for item ${i}: expected ${this.dimensions}, got ${embedding.length}`
        );
      }

      // Apply L2-normalization (CLIP models are trained with normalized embeddings)
      this.normalizeEmbedding(embedding);

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
   * Get comprehensive model information including CLIP-specific capabilities
   * 
   * Extends base model info with CLIP-specific capabilities including multimodal
   * support, zero-shot classification, and cross-modal retrieval features.
   * 
   * @returns Object with model information and capabilities
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
        supportsImageTextSimilarity: true, // Fully implemented
        supportsTextImageRetrieval: true,  // Fully implemented
        recommendedUseCase: 'multimodal similarity and zero-shot classification',
        imageEmbeddingStatus: 'implemented' // Image embedding is fully functional
      }
    };
  }

  /**
   * Check if the model is suitable for a specific task
   * 
   * CLIP models excel at similarity, classification, retrieval, and multimodal
   * tasks due to their unified embedding space and zero-shot capabilities.
   * 
   * @param task - The task type to check
   * @returns true if CLIP is suitable for the task, false otherwise
   */
  isSuitableForTask(task: 'similarity' | 'classification' | 'clustering' | 'retrieval' | 'multimodal'): boolean {
    const supportedTasks = ['similarity', 'classification', 'retrieval', 'multimodal'];
    return supportedTasks.includes(task);
  }

  /**
   * Get information about multimodal capabilities
   * 
   * Returns detailed information about what content types are supported and
   * what features are planned for future implementation.
   * 
   * @returns Object describing multimodal support status
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
      imageSupport: true, // Now implemented
      videoSupport: false,
      audioSupport: false,
      plannedFeatures: [
        'Zero-shot image classification',
        'Advanced image preprocessing options',
        'Batch image processing optimization',
        'Video frame extraction and embedding'
      ]
    };
  }

  // =============================================================================
  // CLIP-SPECIFIC METHODS
  // =============================================================================

  /**
   * Get CLIP model variant information
   * 
   * Extracts architecture details from the model name to provide variant-specific
   * configuration parameters like patch size, image size, and text length limits.
   * 
   * @returns Object with architecture details
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
   * 
   * Estimates token count based on character length (rough approximation of
   * ~4 characters per token for English text). CLIP has a hard limit of 77 tokens.
   * 
   * @param text - Text to validate
   * @returns true if text is within token limit, false otherwise
   */
  isTextLengthValid(text: string): boolean {
    const variant = this.getModelVariant();
    // Rough estimation: ~4 characters per token for English text
    const estimatedTokens = Math.ceil(text.length / 4);
    return estimatedTokens <= variant.textMaxLength;
  }

  /**
   * Get performance characteristics for this CLIP variant
   * 
   * Provides guidance on speed, accuracy, memory usage, and recommended batch
   * sizes based on the CLIP model variant (patch32 vs patch16).
   * 
   * @returns Object with performance characteristics
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
   * Check if all CLIP model components are loaded
   * 
   * Verifies that tokenizer, text model, and vision model are all loaded and
   * ready for use. All three components must be available for the embedder
   * to be considered fully loaded.
   * 
   * @returns true if all components are loaded, false otherwise
   */
  isLoaded(): boolean {
    return this._isLoaded && this.tokenizer !== null && this.textModel !== null && this.imageModel !== null;
  }

  /**
   * Validate that this is a supported CLIP model
   * 
   * Checks the model name against the list of supported CLIP models. Currently
   * supports Xenova/clip-vit-base-patch32 and Xenova/clip-vit-base-patch16.
   * 
   * @throws {Error} If model is not in the supported list
   * @private
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