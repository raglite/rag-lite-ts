/**
 * TEXT IMPLEMENTATION — Sentence Transformer Embedder Implementation
 * Implements UniversalEmbedder interface for sentence-transformer models
 * Adapts existing text embedding logic to the universal interface
 */
// Ensure DOM polyfills are set up before any other imports
import '../dom-polyfills.js';
import { BaseUniversalEmbedder } from '../core/abstract-embedder.js';
import { EmbeddingEngine } from './embedder.js';
import { getResourceManager } from '../core/resource-manager.js';
// =============================================================================
// SENTENCE TRANSFORMER EMBEDDER IMPLEMENTATION
// =============================================================================
/**
 * Sentence transformer embedder implementation
 * Supports sentence-transformers/all-MiniLM-L6-v2 and Xenova/all-mpnet-base-v2
 * Ensures consistent EmbeddingResult format with contentType='text'
 * Adapts existing EmbeddingEngine to UniversalEmbedder interface
 */
export class SentenceTransformerEmbedder extends BaseUniversalEmbedder {
    embeddingEngine = null;
    resourceManager = getResourceManager();
    embedderResourceId;
    engineResourceId;
    constructor(modelName, options = {}) {
        super(modelName, options);
        // Register this embedder with the resource manager
        this.embedderResourceId = this.resourceManager.registerEmbedder(this);
    }
    // =============================================================================
    // MODEL LIFECYCLE METHODS
    // =============================================================================
    /**
     * Load the sentence transformer model using existing EmbeddingEngine
     */
    async loadModel() {
        // Check if already loaded and engine is ready
        if (this._isLoaded && this.embeddingEngine?.isLoaded()) {
            return;
        }
        try {
            this.logModelLoading('Loading sentence transformer model');
            // Create EmbeddingEngine if not exists
            if (!this.embeddingEngine) {
                this.embeddingEngine = new EmbeddingEngine(this.modelName, this.options.maxBatchSize || this._modelInfo.capabilities.maxBatchSize || 8);
            }
            // Load the model using the existing engine (only if not already loaded)
            if (!this.embeddingEngine.isLoaded()) {
                await this.embeddingEngine.loadModel();
            }
            // Register the embedding engine with resource manager if not already registered
            if (!this.engineResourceId) {
                this.engineResourceId = this.resourceManager.registerModel(this.embeddingEngine, this.modelName, 'sentence-transformer');
            }
            // Synchronize loading state
            this._isLoaded = this.embeddingEngine.isLoaded();
            if (this._isLoaded) {
                this.logModelLoading('Model loaded successfully');
            }
            else {
                throw new Error('Model loading failed - engine reports not loaded');
            }
        }
        catch (error) {
            // Reset state on failure
            this._isLoaded = false;
            const enhancedError = this.handleLoadingError(error);
            throw enhancedError;
        }
    }
    /**
     * Clean up model resources with comprehensive disposal
     */
    async cleanup() {
        let cleanupErrors = [];
        try {
            // Clean up embedding engine resources
            if (this.embeddingEngine) {
                try {
                    // Use resource manager for proper cleanup
                    if (this.engineResourceId) {
                        await this.resourceManager.cleanupResource(this.engineResourceId);
                        this.engineResourceId = undefined;
                    }
                    // Clear the reference (EmbeddingEngine doesn't have cleanup methods)
                    this.embeddingEngine = null;
                    this.logModelLoading('Sentence transformer embedding engine disposed');
                }
                catch (error) {
                    const errorMsg = `Failed to dispose embedding engine: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    cleanupErrors.push(errorMsg);
                    console.warn(errorMsg);
                    // Force clear reference even if disposal failed
                    this.embeddingEngine = null;
                }
            }
            // Clear embedder resource registration (don't call resource manager to avoid circular cleanup)
            if (this.embedderResourceId) {
                this.embedderResourceId = undefined;
            }
        }
        finally {
            // Always clear loaded state regardless of cleanup success
            this._isLoaded = false;
            // Remove from lazy loading cache to ensure fresh instances
            try {
                const { LazyEmbedderLoader } = await import('../core/lazy-dependency-loader.js');
                LazyEmbedderLoader.removeEmbedderFromCache(this.modelName, 'sentence-transformer');
            }
            catch (error) {
                console.warn('Failed to remove embedder from cache:', error);
            }
            // Force garbage collection for sentence transformer models
            if (global.gc) {
                global.gc();
                this.logModelLoading('Forced garbage collection after sentence transformer cleanup');
            }
            // Log cleanup completion
            if (cleanupErrors.length === 0) {
                this.logModelLoading('Sentence transformer resources cleaned up successfully');
            }
            else {
                this.logModelLoading(`Sentence transformer cleanup completed with ${cleanupErrors.length} errors`);
                // Don't throw errors during cleanup - just log them
            }
        }
    }
    // =============================================================================
    // EMBEDDING METHODS
    // =============================================================================
    /**
     * Embed text using the existing EmbeddingEngine
     */
    async embedText(text) {
        // Validate input first, before checking if model is loaded
        if (!text || text.trim().length === 0) {
            throw new Error('Text input cannot be empty');
        }
        this.ensureLoaded();
        // Update resource usage tracking
        if (this.embedderResourceId) {
            this.resourceManager.updateResourceUsage(this.embedderResourceId);
        }
        if (this.engineResourceId) {
            this.resourceManager.updateResourceUsage(this.engineResourceId);
        }
        if (!this.embeddingEngine) {
            throw new Error('Embedding engine not initialized');
        }
        try {
            // Validate and truncate text if necessary
            this.validateTextLength(text);
            const processedText = this.truncateText(text.trim());
            // Use the existing EmbeddingEngine to generate embeddings
            const result = await this.embeddingEngine.embedSingle(processedText);
            // Validate embedding dimensions
            if (result.vector.length !== this.dimensions) {
                throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, got ${result.vector.length}`);
            }
            // Ensure contentType is always present for UniversalEmbedder interface
            return {
                ...result,
                contentType: 'text'
            };
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to embed text: ${error.message}`);
            }
            throw new Error('Failed to embed text: Unknown error');
        }
    }
    // =============================================================================
    // BATCH PROCESSING OPTIMIZATION
    // =============================================================================
    /**
     * Optimized batch processing using existing EmbeddingEngine and BatchProcessingOptimizer
     * Overrides the base implementation for better performance with progress reporting
     */
    async processBatch(batch) {
        this.ensureLoaded();
        if (!this.embeddingEngine) {
            throw new Error('Embedding engine not initialized');
        }
        // Filter for text content only (sentence transformers don't support other types)
        const textItems = batch.filter(item => item.contentType === 'text');
        if (textItems.length === 0) {
            return [];
        }
        // For small batches, use the existing EmbeddingEngine directly
        if (textItems.length <= 10) {
            try {
                // Prepare texts for batch processing
                const texts = textItems.map(item => this.truncateText(item.content.trim()));
                // Use the existing EmbeddingEngine's batch processing
                const results = await this.embeddingEngine.embedBatch(texts);
                // Validate dimensions for all results
                for (let i = 0; i < results.length; i++) {
                    if (results[i].vector.length !== this.dimensions) {
                        throw new Error(`Embedding dimension mismatch for item ${i}: expected ${this.dimensions}, got ${results[i].vector.length}`);
                    }
                }
                return results;
            }
            catch (error) {
                // Fall back to individual processing if batch fails
                console.warn(`Batch processing failed, falling back to individual processing: ${error}`);
                return super.processBatch(batch);
            }
        }
        // For larger batches, use the BatchProcessingOptimizer
        try {
            const { createTextBatchProcessor } = await import('../core/batch-processing-optimizer.js');
            const batchProcessor = createTextBatchProcessor();
            // Convert to EmbeddingBatchItem format
            const batchItems = textItems.map(item => ({
                content: this.truncateText(item.content.trim()),
                contentType: item.contentType,
                metadata: item.metadata
            }));
            // Create embed function that uses this embedder
            const embedFunction = async (item) => {
                const result = await this.embeddingEngine.embedSingle(item.content);
                // Validate dimensions
                if (result.vector.length !== this.dimensions) {
                    throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, got ${result.vector.length}`);
                }
                return result;
            };
            // Process with optimization and progress reporting
            const batchResult = await batchProcessor.processBatch(batchItems, embedFunction, (stats) => {
                if (stats.totalItems > 50) { // Only log for larger batches
                    console.log(`Text embedding progress: ${stats.processedItems}/${stats.totalItems} (${Math.round((stats.processedItems / stats.totalItems) * 100)}%)`);
                }
            });
            // Log final statistics for large batches
            if (batchResult.stats.totalItems > 50) {
                console.log(`✓ Text embedding complete: ${batchResult.stats.processedItems} processed, ${batchResult.stats.failedItems} failed`);
                console.log(`  Processing time: ${Math.round(batchResult.stats.processingTimeMs / 1000)}s, Rate: ${Math.round(batchResult.stats.itemsPerSecond)} items/sec`);
                if (batchResult.stats.peakMemoryUsageMB > 100) {
                    console.log(`  Peak memory usage: ${batchResult.stats.peakMemoryUsageMB}MB`);
                }
            }
            return batchResult.results;
        }
        catch (error) {
            // Fall back to existing implementation if optimizer fails
            console.warn(`Batch processing optimizer failed, using fallback: ${error}`);
            try {
                const texts = textItems.map(item => this.truncateText(item.content.trim()));
                const results = await this.embeddingEngine.embedBatch(texts);
                for (let i = 0; i < results.length; i++) {
                    if (results[i].vector.length !== this.dimensions) {
                        throw new Error(`Embedding dimension mismatch for item ${i}: expected ${this.dimensions}, got ${results[i].vector.length}`);
                    }
                }
                return results;
            }
            catch (fallbackError) {
                console.warn(`Fallback batch processing failed, using individual processing: ${fallbackError}`);
                return super.processBatch(batch);
            }
        }
    }
    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    /**
     * Get model-specific information
     */
    getModelInfo() {
        const baseInfo = super.getModelInfo();
        return {
            ...baseInfo,
            capabilities: {
                ...baseInfo.capabilities,
                // Sentence transformers are optimized for text similarity
                supportsSemanticSimilarity: true,
                supportsTextClassification: true,
                supportsTextClustering: true,
                recommendedUseCase: 'text similarity and semantic search'
            }
        };
    }
    /**
     * Check if the model is suitable for a specific task
     */
    isSuitableForTask(task) {
        // Sentence transformers are suitable for all text-based tasks
        const supportedTasks = ['similarity', 'classification', 'clustering', 'retrieval'];
        return supportedTasks.includes(task);
    }
    // =============================================================================
    // ADDITIONAL METHODS FOR COMPATIBILITY WITH EXISTING SYSTEM
    // =============================================================================
    /**
     * Embed document batch using existing EmbeddingEngine's optimized method
     * This method provides compatibility with the existing document ingestion pipeline
     */
    async embedDocumentBatch(chunks) {
        this.ensureLoaded();
        if (!this.embeddingEngine) {
            throw new Error('Embedding engine not initialized');
        }
        // Use the existing EmbeddingEngine's document batch processing
        // which includes progress logging and error handling
        return await this.embeddingEngine.embedDocumentBatch(chunks);
    }
    /**
     * Get the model version from the underlying EmbeddingEngine
     */
    getModelVersion() {
        if (!this.embeddingEngine) {
            throw new Error('Embedding engine not initialized');
        }
        return this.embeddingEngine.getModelVersion();
    }
    /**
     * Get the batch size from the underlying EmbeddingEngine
     */
    getBatchSize() {
        if (!this.embeddingEngine) {
            return this.options.maxBatchSize || this._modelInfo.capabilities.maxBatchSize || 8;
        }
        return this.embeddingEngine.getBatchSize();
    }
    /**
     * Check if the underlying EmbeddingEngine is loaded
     */
    isEngineLoaded() {
        return this.embeddingEngine ? this.embeddingEngine.isLoaded() : false;
    }
    /**
     * Override isLoaded to check both internal state and engine state
     */
    isLoaded() {
        return this._isLoaded && this.isEngineLoaded();
    }
}
