/**
 * CORE MODULE — Universal Embedder Interface for Chameleon Architecture
 *
 * Model-agnostic interfaces supporting both text and multimodal models.
 * Designed for runtime polymorphism and extensibility.
 *
 * ARCHITECTURAL ROLE:
 * This file contains ONLY interfaces, types, and utility functions - no implementation logic.
 * It defines the contract that all embedder implementations must follow.
 *
 * CONTENTS:
 * - UniversalEmbedder interface: Core contract for all embedders
 * - Type definitions: ModelType, ContentType, etc.
 * - Error classes: ModelValidationError, ContentTypeError, etc.
 * - Utility functions: Type guards and validation helpers
 * - Constants: Default capabilities and content types
 *
 * USAGE:
 * - Implementation layers (text, multimodal) implement these interfaces
 * - Core layer uses these types for dependency injection
 * - Public API exports these types for external use
 */
// =============================================================================
// ERROR TYPES
// =============================================================================
/**
 * Model validation error for unsupported or incompatible models
 */
export class ModelValidationError extends Error {
    modelName;
    availableModels;
    constructor(modelName, availableModels, message) {
        super(message);
        this.modelName = modelName;
        this.availableModels = availableModels;
        this.name = 'ModelValidationError';
    }
}
/**
 * Transformers.js compatibility error for version mismatches
 */
export class TransformersCompatibilityError extends Error {
    modelName;
    requiredVersion;
    currentVersion;
    constructor(modelName, requiredVersion, currentVersion, message) {
        super(message);
        this.modelName = modelName;
        this.requiredVersion = requiredVersion;
        this.currentVersion = currentVersion;
        this.name = 'TransformersCompatibilityError';
    }
}
/**
 * Content type error for unsupported content types
 */
export class ContentTypeError extends Error {
    contentType;
    supportedTypes;
    constructor(contentType, supportedTypes, message) {
        super(message);
        this.contentType = contentType;
        this.supportedTypes = supportedTypes;
        this.name = 'ContentTypeError';
    }
}
// =============================================================================
// UTILITY TYPES
// =============================================================================
/**
 * Type guard for checking if an embedder supports images
 */
export function supportsImages(embedder) {
    return embedder.supportedContentTypes.includes('image') &&
        typeof embedder.embedImage === 'function';
}
/**
 * Type guard for checking if an embedder supports a specific content type
 */
export function supportsContentType(embedder, contentType) {
    return embedder.supportedContentTypes.includes(contentType);
}
/**
 * Utility function to create enhanced embedding results
 */
export function createEnhancedEmbeddingResult(embeddingId, vector, contentType, metadata) {
    return {
        embedding_id: embeddingId,
        vector,
        contentType,
        metadata
    };
}
/**
 * Utility function to validate content type against supported types
 */
export function validateContentType(contentType, supportedTypes) {
    if (!supportedTypes.includes(contentType)) {
        throw new ContentTypeError(contentType, supportedTypes, `Content type '${contentType}' is not supported. Supported types: ${supportedTypes.join(', ')}`);
    }
}
// =============================================================================
// CONSTANTS
// =============================================================================
/**
 * Default supported content types for different model types
 */
export const DEFAULT_CONTENT_TYPES = {
    'sentence-transformer': ['text'],
    'clip': ['text', 'image']
};
/**
 * Default model capabilities for different model types
 */
export const DEFAULT_CAPABILITIES = {
    'sentence-transformer': {
        supportsText: true,
        supportsImages: false,
        supportsBatchProcessing: true,
        supportsMetadata: true,
        maxBatchSize: 32,
        maxTextLength: 512
    },
    'clip': {
        supportsText: true,
        supportsImages: true,
        supportsBatchProcessing: true,
        supportsMetadata: true,
        maxBatchSize: 16,
        maxTextLength: 77,
        supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        // Enhanced capabilities for fixed CLIP implementation
        supportsMultimodal: true,
        supportsCrossModalSearch: true,
        unifiedEmbeddingSpace: true,
        reliableImplementation: true
    }
};
