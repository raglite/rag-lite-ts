/**
 * CORE MODULE — Model Registry for Chameleon Architecture
 * Centralized registry of supported models with validation and compatibility checking
 * Model-agnostic registry supporting both text and multimodal models
 */
// =============================================================================
// MODEL REGISTRY
// =============================================================================
/**
 * Registry of supported models with their metadata and capabilities
 * This registry defines all models compatible with the Chameleon architecture
 */
export const SUPPORTED_MODELS = {
    // Text-only models (sentence-transformer type)
    'sentence-transformers/all-MiniLM-L6-v2': {
        name: 'sentence-transformers/all-MiniLM-L6-v2',
        type: 'sentence-transformer',
        dimensions: 384,
        version: '1.0.0',
        supportedContentTypes: ['text'],
        capabilities: {
            supportsText: true,
            supportsImages: false,
            supportsBatchProcessing: true,
            supportsMetadata: true,
            maxBatchSize: 32,
            maxTextLength: 512
        },
        requirements: {
            transformersJsVersion: '>=2.6.0',
            minimumMemory: 256, // MB
            requiredFeatures: ['tokenizers'],
            platformSupport: ['node', 'browser']
        }
    },
    'Xenova/all-mpnet-base-v2': {
        name: 'Xenova/all-mpnet-base-v2',
        type: 'sentence-transformer',
        dimensions: 768,
        version: '1.0.0',
        supportedContentTypes: ['text'],
        capabilities: {
            supportsText: true,
            supportsImages: false,
            supportsBatchProcessing: true,
            supportsMetadata: true,
            maxBatchSize: 16,
            maxTextLength: 512
        },
        requirements: {
            transformersJsVersion: '>=2.6.0',
            minimumMemory: 512, // MB
            requiredFeatures: ['tokenizers'],
            platformSupport: ['node', 'browser']
        }
    },
    // Multimodal models (CLIP type)
    // Fixed implementation: Reliable text and image embedding without fallback mechanisms
    'Xenova/clip-vit-base-patch32': {
        name: 'Xenova/clip-vit-base-patch32',
        type: 'clip',
        dimensions: 512,
        version: '1.0.0',
        supportedContentTypes: ['text', 'image'],
        capabilities: {
            supportsText: true, // Fixed: Reliable text embedding using CLIPTextModelWithProjection
            supportsImages: true, // Fixed: Reliable image embedding using CLIPVisionModelWithProjection
            supportsBatchProcessing: true,
            supportsMetadata: true,
            supportsMultimodal: true, // True cross-modal search capabilities
            maxBatchSize: 8,
            maxTextLength: 77, // CLIP's token limit (tokenizer handles truncation)
            supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
        },
        requirements: {
            transformersJsVersion: '>=2.8.0',
            minimumMemory: 1024, // MB
            requiredFeatures: ['vision', 'tokenizers'],
            platformSupport: ['node', 'browser']
        }
    },
    'Xenova/clip-vit-base-patch16': {
        name: 'Xenova/clip-vit-base-patch16',
        type: 'clip',
        dimensions: 512,
        version: '1.0.0',
        supportedContentTypes: ['text', 'image'],
        capabilities: {
            supportsText: true, // Fixed: Reliable text embedding using CLIPTextModelWithProjection
            supportsImages: true, // Fixed: Reliable image embedding using CLIPVisionModelWithProjection
            supportsBatchProcessing: true,
            supportsMetadata: true,
            supportsMultimodal: true, // True cross-modal search capabilities
            maxBatchSize: 4,
            maxTextLength: 77, // CLIP's token limit (tokenizer handles truncation)
            supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
        },
        requirements: {
            transformersJsVersion: '>=2.8.0',
            minimumMemory: 1536, // MB
            requiredFeatures: ['vision', 'tokenizers'],
            platformSupport: ['node', 'browser']
        }
    }
};
// =============================================================================
// MODEL REGISTRY OPERATIONS
// =============================================================================
/**
 * Model registry class providing validation and model information services
 * Enhanced with comprehensive validation and compatibility checking
 */
export class ModelRegistry {
    /**
     * Gets model information for a given model name
     * @param modelName - Name of the model
     * @returns Model information or null if not supported
     */
    static getModelInfo(modelName) {
        return SUPPORTED_MODELS[modelName] || null;
    }
    /**
     * Validates a model name and returns compatibility information
     * @param modelName - Name of the model to validate
     * @returns Model validation result with errors, warnings, and suggestions
     */
    static validateModel(modelName) {
        const modelInfo = this.getModelInfo(modelName);
        if (!modelInfo) {
            const suggestions = this.getSimilarModels(modelName);
            return {
                isValid: false,
                errors: [`Model '${modelName}' is not supported`],
                warnings: [],
                suggestions: suggestions.length > 0
                    ? [`Did you mean: ${suggestions.join(', ')}?`]
                    : [`Available models: ${this.getSupportedModels().join(', ')}`]
            };
        }
        const warnings = [];
        const suggestions = [];
        // Enhanced validation with detailed checks
        this.validateModelRequirements(modelInfo, warnings, suggestions);
        this.validateModelCapabilities(modelInfo, warnings, suggestions);
        return {
            isValid: true,
            errors: [],
            warnings,
            suggestions
        };
    }
    /**
     * Validate model requirements and add warnings/suggestions
     * @private
     */
    static validateModelRequirements(modelInfo, warnings, suggestions) {
        // Memory requirements
        if (modelInfo.requirements.minimumMemory) {
            if (modelInfo.requirements.minimumMemory > 1024) {
                warnings.push(`Model requires ${modelInfo.requirements.minimumMemory}MB memory`);
            }
            if (modelInfo.requirements.minimumMemory > 2048) {
                suggestions.push('Consider using a smaller model variant for better performance');
            }
        }
        // Platform support
        if (modelInfo.requirements.platformSupport) {
            const supportedPlatforms = modelInfo.requirements.platformSupport;
            if (!supportedPlatforms.includes('browser')) {
                warnings.push('Model may not work in browser environments');
            }
            if (!supportedPlatforms.includes('node')) {
                warnings.push('Model may not work in Node.js environments');
            }
        }
        // Feature requirements
        if (modelInfo.requirements.requiredFeatures) {
            const advancedFeatures = ['vision', 'zero-shot-image-classification', 'image-to-text'];
            const hasAdvancedFeatures = modelInfo.requirements.requiredFeatures.some(feature => advancedFeatures.includes(feature));
            if (hasAdvancedFeatures) {
                warnings.push('Model requires advanced transformers.js features');
                suggestions.push('Ensure you have the latest transformers.js version');
            }
        }
    }
    /**
     * Validate model capabilities and add warnings/suggestions
     * @private
     */
    static validateModelCapabilities(modelInfo, warnings, suggestions) {
        // Batch size limitations
        if (modelInfo.capabilities.maxBatchSize && modelInfo.capabilities.maxBatchSize < 8) {
            warnings.push(`Model has limited batch size: ${modelInfo.capabilities.maxBatchSize}`);
            suggestions.push('Use smaller batch sizes for optimal performance');
        }
        // Text length limitations
        if (modelInfo.capabilities.maxTextLength && modelInfo.capabilities.maxTextLength < 256) {
            warnings.push(`Model has limited text length: ${modelInfo.capabilities.maxTextLength} characters`);
            suggestions.push('Long texts will be truncated by the tokenizer');
        }
        // Image format support
        if (modelInfo.capabilities.supportsImages && modelInfo.capabilities.supportedImageFormats) {
            const commonFormats = ['jpg', 'jpeg', 'png'];
            const supportedCommon = commonFormats.filter(format => modelInfo.capabilities.supportedImageFormats.includes(format));
            if (supportedCommon.length < commonFormats.length) {
                const unsupported = commonFormats.filter(format => !supportedCommon.includes(format));
                warnings.push(`Model may not support all common image formats. Unsupported: ${unsupported.join(', ')}`);
            }
        }
        // Performance suggestions for specific model types
        if (modelInfo.type === 'clip') {
            // Highlight fixed CLIP implementation capabilities
            if (modelInfo.capabilities.supportsMultimodal) {
                suggestions.push('CLIP models now support reliable cross-modal search between text and images');
            }
            if (modelInfo.dimensions > 512) {
                suggestions.push('Consider using clip-vit-base-patch32 for better performance');
            }
            if (modelInfo.name.includes('patch16')) {
                suggestions.push('patch16 models are more accurate but slower than patch32');
            }
        }
        if (modelInfo.type === 'sentence-transformer') {
            if (modelInfo.dimensions > 768) {
                suggestions.push('Consider using all-MiniLM-L6-v2 for faster processing');
            }
        }
    }
    /**
     * Lists all supported models, optionally filtered by type
     * @param modelType - Optional model type filter
     * @returns Array of supported model names
     */
    static getSupportedModels(modelType) {
        const allModels = Object.keys(SUPPORTED_MODELS);
        if (!modelType) {
            return allModels;
        }
        return allModels.filter(modelName => SUPPORTED_MODELS[modelName].type === modelType);
    }
    /**
     * Gets models that support a specific content type
     * @param contentType - Content type to filter by
     * @returns Array of model names that support the content type
     */
    static getModelsByContentType(contentType) {
        return Object.keys(SUPPORTED_MODELS).filter(modelName => SUPPORTED_MODELS[modelName].supportedContentTypes.includes(contentType));
    }
    /**
     * Gets the default model for a given model type
     * @param modelType - Model type to get default for
     * @returns Default model name or null if no default available
     */
    static getDefaultModel(modelType) {
        const models = this.getSupportedModels(modelType);
        switch (modelType) {
            case 'sentence-transformer':
                return 'sentence-transformers/all-MiniLM-L6-v2';
            case 'clip':
                return 'Xenova/clip-vit-base-patch32';
            default:
                return models.length > 0 ? models[0] : null;
        }
    }
    /**
     * Checks if a model supports a specific content type
     * @param modelName - Name of the model
     * @param contentType - Content type to check
     * @returns True if the model supports the content type
     */
    static supportsContentType(modelName, contentType) {
        const modelInfo = this.getModelInfo(modelName);
        return modelInfo ? modelInfo.supportedContentTypes.includes(contentType) : false;
    }
    /**
     * Gets models similar to the given model name (for suggestions)
     * @param modelName - Model name to find similar models for
     * @returns Array of similar model names
     */
    static getSimilarModels(modelName) {
        const allModels = Object.keys(SUPPORTED_MODELS);
        const lowerModelName = modelName.toLowerCase();
        // Simple similarity check based on common substrings
        return allModels.filter(supportedModel => {
            const lowerSupported = supportedModel.toLowerCase();
            // Check for common keywords
            const keywords = ['clip', 'mpnet', 'minilm', 'sentence', 'transformer'];
            const modelKeywords = keywords.filter(keyword => lowerModelName.includes(keyword));
            const supportedKeywords = keywords.filter(keyword => lowerSupported.includes(keyword));
            // Return models that share at least one keyword
            return modelKeywords.some(keyword => supportedKeywords.includes(keyword));
        }).slice(0, 3); // Limit to 3 suggestions
    }
    /**
     * Validates model compatibility with system requirements
     * @param modelName - Name of the model to validate
     * @param systemCapabilities - System capabilities to check against
     * @returns Validation result with compatibility information
     */
    static validateSystemCompatibility(modelName, systemCapabilities) {
        const modelInfo = this.getModelInfo(modelName);
        if (!modelInfo) {
            return {
                isValid: false,
                errors: [`Model '${modelName}' is not supported`],
                warnings: [],
                suggestions: []
            };
        }
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Check memory requirements
        if (systemCapabilities.availableMemory && modelInfo.requirements.minimumMemory) {
            if (systemCapabilities.availableMemory < modelInfo.requirements.minimumMemory) {
                errors.push(`Insufficient memory: ${systemCapabilities.availableMemory}MB available, ` +
                    `${modelInfo.requirements.minimumMemory}MB required`);
                // Suggest lighter models
                const lighterModels = this.getSupportedModels(modelInfo.type).filter(name => {
                    const info = this.getModelInfo(name);
                    return info &&
                        info.requirements.minimumMemory &&
                        info.requirements.minimumMemory <= systemCapabilities.availableMemory;
                });
                if (lighterModels.length > 0) {
                    suggestions.push(`Consider lighter models: ${lighterModels.join(', ')}`);
                }
            }
        }
        // Check platform compatibility
        if (systemCapabilities.platform && modelInfo.requirements.platformSupport) {
            if (!modelInfo.requirements.platformSupport.includes(systemCapabilities.platform)) {
                errors.push(`Platform '${systemCapabilities.platform}' not supported. ` +
                    `Supported platforms: ${modelInfo.requirements.platformSupport.join(', ')}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            suggestions
        };
    }
}
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
/**
 * Gets the model type for a given model name
 * @param modelName - Name of the model
 * @returns Model type or null if model not supported
 */
export function getModelType(modelName) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    return modelInfo ? modelInfo.type : null;
}
/**
 * Gets the dimensions for a given model name
 * @param modelName - Name of the model
 * @returns Number of dimensions or null if model not supported
 */
export function getModelDimensions(modelName) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    return modelInfo ? modelInfo.dimensions : null;
}
/**
 * Checks if a model is a text-only model
 * @param modelName - Name of the model
 * @returns True if the model only supports text
 */
export function isTextOnlyModel(modelName) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    return modelInfo ?
        modelInfo.supportedContentTypes.length === 1 &&
            modelInfo.supportedContentTypes[0] === 'text' :
        false;
}
/**
 * Checks if a model is a multimodal model
 * @param modelName - Name of the model
 * @returns True if the model supports multiple content types
 */
export function isMultimodalModel(modelName) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    return modelInfo ? modelInfo.supportedContentTypes.length > 1 : false;
}
/**
 * Gets recommended batch size for a model
 * @param modelName - Name of the model
 * @returns Recommended batch size or default value
 */
export function getRecommendedBatchSize(modelName) {
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    return modelInfo?.capabilities.maxBatchSize || 8;
}
// =============================================================================
// CONSTANTS
// =============================================================================
/**
 * Default model names for different types
 */
export const DEFAULT_MODELS = {
    'sentence-transformer': 'sentence-transformers/all-MiniLM-L6-v2',
    'clip': 'Xenova/clip-vit-base-patch32'
};
// =============================================================================
// REMOVED IN v3.0.0: MODEL_TYPE_ALIASES
// =============================================================================
// Model type aliases have been removed as they were not used anywhere in the codebase.
// Use ModelType directly: 'sentence-transformer' or 'clip'
