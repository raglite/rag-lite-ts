/**
 * CORE MODULE — Abstract Base Embedder
 *
 * Provides model-agnostic base functionality for all embedder implementations.
 * This is an abstract base class, not a concrete implementation.
 *
 * ARCHITECTURAL NOTE:
 * While this contains implementation logic, it remains in the core layer because:
 * 1. It's model-agnostic (no knowledge of specific models or transformers.js)
 * 2. It's shared by multiple implementation layers (text, multimodal)
 * 3. It provides common infrastructure (lifecycle, validation, batch processing)
 * 4. Moving it would create awkward cross-layer dependencies
 *
 * This follows the "shared base class" pattern common in framework design,
 * similar to React.Component, Django Model, or other framework base classes.
 *
 * RESPONSIBILITIES:
 * - Model lifecycle management (loading, cleanup, disposal)
 * - Batch processing coordination
 * - Input validation and text truncation
 * - Error handling with helpful messages
 * - Embedding ID generation
 * - Common utility methods
 *
 * IMPLEMENTATION LAYERS:
 * - Text: SentenceTransformerEmbedder extends this class
 * - Multimodal: CLIPEmbedder extends this class
 */
import { ModelRegistry } from './model-registry.js';
import { validateContentType, createEnhancedEmbeddingResult } from './universal-embedder.js';
// =============================================================================
// BASE EMBEDDER ABSTRACT CLASS
// =============================================================================
/**
 * Abstract base class for universal embedders
 * Provides common functionality and lifecycle management
 */
export class BaseUniversalEmbedder {
    modelName;
    options;
    _isLoaded = false;
    _modelInfo;
    constructor(modelName, options = {}) {
        this.modelName = modelName;
        this.options = options;
        const modelInfo = ModelRegistry.getModelInfo(modelName);
        if (!modelInfo) {
            throw new Error(`Model '${modelName}' is not supported. ` +
                `Supported models: ${ModelRegistry.getSupportedModels().join(', ')}`);
        }
        this._modelInfo = modelInfo;
    }
    // =============================================================================
    // PUBLIC INTERFACE IMPLEMENTATION
    // =============================================================================
    get modelType() {
        return this._modelInfo.type;
    }
    get dimensions() {
        return this._modelInfo.dimensions;
    }
    get supportedContentTypes() {
        return this._modelInfo.supportedContentTypes;
    }
    isLoaded() {
        return this._isLoaded;
    }
    getModelInfo() {
        return { ...this._modelInfo }; // Return a copy to prevent mutation
    }
    /**
     * Dispose of all resources and prepare for garbage collection
     * This method should be called when the embedder is no longer needed
     */
    async dispose() {
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
        }
        catch (error) {
            console.warn(`Error during resource disposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // DEFAULT IMPLEMENTATIONS
    // =============================================================================
    /**
     * Batch embedding with default implementation
     * Subclasses can override for more efficient batch processing
     */
    async embedBatch(items) {
        if (!this._isLoaded) {
            await this.loadModel();
        }
        const results = [];
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
    async processBatch(batch) {
        const results = [];
        for (const item of batch) {
            try {
                validateContentType(item.contentType, this.supportedContentTypes);
                let result;
                if (item.contentType === 'text') {
                    result = await this.embedText(item.content);
                }
                else if (item.contentType === 'image' && this.embedImage) {
                    result = await this.embedImage(item.content);
                }
                else {
                    throw new Error(`Content type '${item.contentType}' not supported by model '${this.modelName}'`);
                }
                // Enhance the result with content type and metadata
                const enhancedResult = createEnhancedEmbeddingResult(result.embedding_id, result.vector, item.contentType, item.metadata);
                results.push(enhancedResult);
            }
            catch (error) {
                // Log error but continue processing other items
                console.warn(`Failed to embed item: ${error instanceof Error ? error.message : 'Unknown error'}`);
                // Create a placeholder result with zero vector for failed items
                const zeroVector = new Float32Array(this.dimensions).fill(0);
                const failedResult = createEnhancedEmbeddingResult(`failed_${Date.now()}_${Math.random()}`, zeroVector, item.contentType, { ...item.metadata, error: error instanceof Error ? error.message : 'Unknown error' });
                results.push(failedResult);
            }
        }
        return results;
    }
    /**
     * Validate that the model is loaded before operations
     */
    ensureLoaded() {
        if (!this._isLoaded) {
            throw new Error(`Model '${this.modelName}' is not loaded. Call loadModel() first.`);
        }
    }
    /**
     * Generate a unique embedding ID
     */
    generateEmbeddingId(content, contentType = 'text') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        const contentHash = this.simpleHash(content);
        return `${contentType}_${contentHash}_${timestamp}_${random}`;
    }
    /**
     * Simple hash function for content identification
     */
    simpleHash(str) {
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
    validateTextLength(text) {
        const maxLength = this._modelInfo.capabilities.maxTextLength;
        if (maxLength && text.length > maxLength) {
            console.warn(`Text length (${text.length}) exceeds model maximum (${maxLength}). ` +
                `Text will be truncated.`);
        }
    }
    /**
     * Truncate text to model's maximum length
     */
    truncateText(text) {
        const maxLength = this._modelInfo.capabilities.maxTextLength;
        if (maxLength && text.length > maxLength) {
            return text.substring(0, maxLength);
        }
        return text;
    }
    /**
     * Log model loading progress
     */
    logModelLoading(stage, details) {
        const message = `[${this.modelName}] ${stage}`;
        if (details) {
            console.log(`${message}: ${details}`);
        }
        else {
            console.log(message);
        }
    }
    /**
     * Handle model loading errors with helpful messages
     */
    handleLoadingError(error) {
        const baseMessage = `Failed to load model '${this.modelName}': ${error.message}`;
        // Provide specific guidance based on error type
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return new Error(`${baseMessage}\n` +
                `This appears to be a network error. Please check your internet connection ` +
                `and ensure the model repository is accessible.`);
        }
        if (error.message.includes('memory') || error.message.includes('OOM')) {
            return new Error(`${baseMessage}\n` +
                `This appears to be a memory error. Try using a smaller model or ` +
                `increase available memory. Required: ${this._modelInfo.requirements.minimumMemory}MB`);
        }
        if (error.message.includes('unsupported') || error.message.includes('not found')) {
            const suggestions = ModelRegistry.getSupportedModels(this.modelType);
            return new Error(`${baseMessage}\n` +
                `Model may not be available. Supported ${this.modelType} models: ${suggestions.join(', ')}`);
        }
        return new Error(baseMessage);
    }
}
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
/**
 * Create embedder options with defaults
 */
export function createEmbedderOptions(options = {}) {
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
export function validateEmbedderOptions(options) {
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
