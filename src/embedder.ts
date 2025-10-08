import { pipeline } from '@huggingface/transformers';
import { createHash } from 'crypto';
import { config } from './config.js';
import { handleError, ErrorCategory, ErrorSeverity, createError, safeExecute } from './error-handler.js';
import type { EmbeddingResult } from './types.js';

/**
 * List of supported embedding models
 */
const SUPPORTED_MODELS = [
  'sentence-transformers/all-MiniLM-L6-v2',
  'Xenova/all-mpnet-base-v2'
];

/**
 * Embedding engine using transformers.js for generating embeddings
 */
export class EmbeddingEngine {
  private model: any | null = null;
  private modelVersion: string | null = null;
  private readonly modelName: string;
  private readonly batchSize: number;

  constructor(modelName?: string, batchSize?: number) {
    this.modelName = modelName || config.embedding_model;
    this.batchSize = batchSize || config.batch_size;
    
    // Validate that the model is supported
    if (!SUPPORTED_MODELS.includes(this.modelName)) {
      throw new Error(
        `Unsupported model: ${this.modelName}\n` +
        `Supported models: ${SUPPORTED_MODELS.join(', ')}`
      );
    }
    
    console.log(`🤖 EmbeddingEngine initialized with model: ${this.modelName}, batchSize: ${this.batchSize}`);
  }

  /**
   * Load the embedding model
   * @throws {Error} If model loading fails
   */
  async loadModel(): Promise<void> {
    await safeExecute(
      async () => {
        console.log(`Loading embedding model: ${this.modelName}`);

        // Initialize the feature extraction pipeline
        // Let transformers.js handle model caching automatically
        try {
          this.model = await pipeline('feature-extraction', this.modelName, {
            cache_dir: config.model_cache_path,
            local_files_only: false,
            dtype: 'fp32' // Explicitly specify dtype to suppress warning
          });
        } catch (error) {
          // Enhanced error handling for model download failures
          if (error instanceof Error && (
            error.message.includes('network') || 
            error.message.includes('download') || 
            error.message.includes('fetch') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          )) {
            throw new Error(
              `Failed to download model '${this.modelName}'. ` +
              `Check your internet connection or see models/README.md for offline setup instructions.`
            );
          }
          throw error;
        }

        // Generate model version hash
        this.modelVersion = this.generateModelVersion();

        console.log(`Model loaded successfully. Version: ${this.modelVersion}`);
      },
      'Model Loading',
      {
        category: ErrorCategory.MODEL,
        severity: ErrorSeverity.FATAL,
        exitCode: 6
      }
    );
  }

  /**
   * Generate embeddings for a batch of texts
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to array of embedding results
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (texts.length === 0) {
      return [];
    }

    // Split into smaller batches based on configured batch size
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchResults = await this.processBatchWithErrorHandling(batch, i);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single batch with error handling for individual chunks
   * @param batch - Array of text strings in this batch
   * @param startIndex - Starting index for this batch in the original array
   * @returns Promise resolving to array of embedding results
   */
  private async processBatchWithErrorHandling(batch: string[], startIndex: number): Promise<EmbeddingResult[]> {
    return await safeExecute(
      async () => {
        // Try to process the entire batch first
        const embeddings = await this.model!(batch, {
          pooling: 'mean',
          normalize: true
        });

        // Convert to EmbeddingResult format
        const results: EmbeddingResult[] = [];
        const embeddingData = embeddings.tolist();

        for (let i = 0; i < batch.length; i++) {
          const embedding_id = this.generateEmbeddingId(batch[i], startIndex + i);
          const vector = new Float32Array(embeddingData[i]);

          results.push({
            embedding_id,
            vector
          });
        }

        return results;
      },
      `Batch Embedding (${batch.length} chunks)`,
      {
        category: ErrorCategory.EMBEDDING,
        severity: ErrorSeverity.ERROR,
        skipError: true,
        fallbackValue: []
      }
    ) || await this.fallbackToIndividualProcessing(batch, startIndex);
  }

  /**
   * Fallback to individual chunk processing when batch fails
   */
  private async fallbackToIndividualProcessing(batch: string[], startIndex: number): Promise<EmbeddingResult[]> {
    handleError(
      `Batch processing failed for ${batch.length} chunks, falling back to individual processing`,
      'Embedding Batch Processing',
      {
        category: ErrorCategory.EMBEDDING,
        severity: ErrorSeverity.WARNING,
        skipError: true
      }
    );

    const results: EmbeddingResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      const singleResult = await safeExecute(
        () => this.processSingleChunk(batch[i], startIndex + i),
        `Individual Chunk Embedding (${startIndex + i})`,
        {
          category: ErrorCategory.EMBEDDING,
          severity: ErrorSeverity.WARNING,
          skipError: true
        }
      );

      if (singleResult) {
        results.push(singleResult);
      }
    }

    return results;
  }

  /**
   * Process a single chunk with error handling
   * @param text - Text to embed
   * @param index - Index of this chunk
   * @returns Promise resolving to embedding result or null if failed
   */
  private async processSingleChunk(text: string, index: number): Promise<EmbeddingResult | null> {
    try {
      const embeddings = await this.model!([text], {
        pooling: 'mean',
        normalize: true
      });

      const embeddingData = embeddings.tolist();
      const embedding_id = this.generateEmbeddingId(text, index);
      const vector = new Float32Array(embeddingData[0]);

      return {
        embedding_id,
        vector
      };
    } catch (error) {
      // Return null to indicate failure
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   * @param text - Text string to embed
   * @returns Promise resolving to embedding result
   */
  async embedSingle(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    if (results.length === 0) {
      throw new Error('Failed to generate embedding for single text');
    }
    return results[0];
  }

  /**
   * Generate embeddings for document chunks with progress logging
   * Optimized for large document ingestion with batch processing
   * @param chunks - Array of text chunks from documents
   * @returns Promise resolving to array of embedding results
   */
  async embedDocumentBatch(chunks: string[]): Promise<EmbeddingResult[]> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (chunks.length === 0) {
      return [];
    }

    console.log(`Processing ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} in batches of ${this.batchSize}...`);

    const results: EmbeddingResult[] = [];
    const totalBatches = Math.ceil(chunks.length / this.batchSize);
    let processedChunks = 0;
    let skippedChunks = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * this.batchSize;
      const endIdx = Math.min(startIdx + this.batchSize, chunks.length);
      const batch = chunks.slice(startIdx, endIdx);

      try {
        const batchResults = await this.processBatchWithErrorHandling(batch, startIdx);
        results.push(...batchResults);
        processedChunks += batchResults.length;
        skippedChunks += (batch.length - batchResults.length);

        // Progress logging - more frequent updates for better user experience
        const progressInterval = Math.max(1, Math.floor(totalBatches / 20)); // Show progress every 5%
        if ((batchIndex + 1) % progressInterval === 0 || batchIndex === totalBatches - 1) {
          const percentage = Math.round(((batchIndex + 1) / totalBatches) * 100);
          console.log(`Processed ${processedChunks} of ${chunks.length} chunks (${percentage}%)${skippedChunks > 0 ? ` - ${skippedChunks} skipped` : ''}`);
        }
      } catch (error) {
        console.error(`Failed to process batch ${batchIndex + 1}/${totalBatches}:`, error instanceof Error ? error.message : String(error));
        skippedChunks += batch.length;
      }
    }

    if (skippedChunks > 0) {
      console.log(`✓ Embedding complete: ${processedChunks} successful, ${skippedChunks} skipped due to errors`);
    } else {
      console.log(`✓ Embedding complete: ${processedChunks} chunks processed successfully`);
    }
    return results;
  }

  /**
   * Get the current model version identifier
   * @returns Model version string
   */
  getModelVersion(): string {
    if (!this.modelVersion) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }
    return this.modelVersion;
  }

  /**
   * Check if the model is loaded
   * @returns True if model is loaded
   */
  isLoaded(): boolean {
    return this.model !== null;
  }

  /**
   * Get the model name
   * @returns Model name string
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Get the batch size
   * @returns Batch size number
   */
  getBatchSize(): number {
    return this.batchSize;
  }

  /**
   * Generate a deterministic model version identifier
   * Uses model name and configuration for consistent versioning
   * @returns Model version string
   */
  private generateModelVersion(): string {
    // Create a deterministic hash based on model name and configuration
    // This ensures the same model configuration always produces the same version
    const configData = JSON.stringify({
      model: this.modelName,
      // Add other relevant config that affects embeddings
      quantized: false,
      revision: 'main'
    });
    const hash = createHash('sha256').update(configData).digest('hex').substring(0, 16);
    return `${this.modelName.replace('/', '_')}_${hash}`;
  }

  /**
   * Generate a deterministic embedding ID for a text chunk
   * @param text - The text content
   * @param index - Index in the batch
   * @returns Deterministic embedding ID
   */
  private generateEmbeddingId(text: string, index: number): string {
    // Create deterministic ID based on content hash only
    // This ensures the same text always gets the same ID regardless of processing order
    const contentHash = createHash('sha256').update(text.trim()).digest('hex');
    return contentHash.substring(0, 32);
  }
}

/**
 * Singleton instance for the embedding engine
 * Ensures model is loaded only once across the application
 */
let embeddingEngineInstance: EmbeddingEngine | null = null;

/**
 * Get the singleton embedding engine instance
 * @param modelName - Optional model name override
 * @param batchSize - Optional batch size override
 * @returns EmbeddingEngine instance
 */
export function getEmbeddingEngine(modelName?: string, batchSize?: number): EmbeddingEngine {
  // Always create a new instance if specific parameters are provided
  // This ensures we don't use cached instances with wrong configuration
  if (modelName || batchSize) {
    embeddingEngineInstance = new EmbeddingEngine(modelName, batchSize);
  } else if (!embeddingEngineInstance) {
    embeddingEngineInstance = new EmbeddingEngine();
  }
  return embeddingEngineInstance;
}

/**
 * Initialize the embedding engine and load the model
 * @param modelName - Optional model name override
 * @param batchSize - Optional batch size override
 * @returns Promise resolving to the loaded embedding engine
 */
export async function initializeEmbeddingEngine(modelName?: string, batchSize?: number): Promise<EmbeddingEngine> {
  const engine = getEmbeddingEngine(modelName, batchSize);

  if (!engine.isLoaded()) {
    await engine.loadModel();
  }

  return engine;
}