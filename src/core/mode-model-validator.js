/**
 * CORE MODULE — Mode-Model Compatibility Validator
 * Validates compatibility between processing modes and embedding models
 * Provides clear error messages for incompatible configurations
 */
import { ModelRegistry } from './model-registry.js';
import { createError } from './error-handler.js';
// =============================================================================
// MODE-MODEL COMPATIBILITY RULES
// =============================================================================
/**
 * Compatibility matrix defining which model types work with which modes
 */
const MODE_MODEL_COMPATIBILITY = {
    'text': ['sentence-transformer', 'clip'], // Text mode can use both (CLIP converts images to text)
    'multimodal': ['clip'] // Multimodal mode requires CLIP for unified embedding space
};
/**
 * Recommended models for each mode
 */
const RECOMMENDED_MODELS = {
    'text': [
        'sentence-transformers/all-MiniLM-L6-v2', // Fast, efficient
        'Xenova/all-mpnet-base-v2' // Higher quality
    ],
    'multimodal': [
        'Xenova/clip-vit-base-patch32', // Standard CLIP model
        'Xenova/clip-vit-base-patch16' // Higher resolution CLIP
    ]
};
/**
 * Validate compatibility between a mode and model
 *
 * @param mode - Processing mode (text or multimodal)
 * @param modelName - Name of the embedding model
 * @returns Validation result with errors and suggestions
 *
 * @example
 * ```typescript
 * const result = validateModeModelCompatibility('multimodal', 'sentence-transformers/all-MiniLM-L6-v2');
 * if (!result.isValid) {
 *   console.error('Incompatible configuration:', result.errors);
 *   console.log('Suggestions:', result.suggestions);
 * }
 * ```
 */
export function validateModeModelCompatibility(mode, modelName) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    // Step 1: Validate that the model exists in the registry
    const modelInfo = ModelRegistry.getModelInfo(modelName);
    if (!modelInfo) {
        errors.push(`Model '${modelName}' is not supported`);
        suggestions.push(`Available models: ${ModelRegistry.getSupportedModels().join(', ')}`);
        return {
            isValid: false,
            errors,
            warnings,
            suggestions,
            recommendedModels: RECOMMENDED_MODELS[mode]
        };
    }
    // Step 2: Validate mode-model type compatibility
    const compatibleModelTypes = MODE_MODEL_COMPATIBILITY[mode];
    if (!compatibleModelTypes.includes(modelInfo.type)) {
        errors.push(`Model '${modelName}' (type: ${modelInfo.type}) is not compatible with ${mode} mode`);
        // Provide specific guidance based on the incompatibility
        if (mode === 'multimodal' && modelInfo.type === 'sentence-transformer') {
            suggestions.push(`Multimodal mode requires CLIP models for unified text-image embedding space. ` +
                `Sentence-transformer models only support text.`);
            suggestions.push(`Recommended CLIP models: ${RECOMMENDED_MODELS.multimodal.join(', ')}`);
        }
        else if (mode === 'text' && modelInfo.type === 'clip') {
            // This is actually valid, but provide guidance
            warnings.push(`Using CLIP model '${modelName}' in text mode. Images will be converted to text descriptions. ` +
                `For text-only content, sentence-transformer models may be more efficient.`);
            suggestions.push(`For text-only: ${RECOMMENDED_MODELS.text.join(', ')}`);
        }
    }
    // Step 3: Check content type support
    const requiredContentTypes = mode === 'multimodal' ? ['text', 'image'] : ['text'];
    const unsupportedTypes = requiredContentTypes.filter(type => !modelInfo.supportedContentTypes.includes(type));
    if (unsupportedTypes.length > 0) {
        errors.push(`Model '${modelName}' does not support required content types for ${mode} mode: ${unsupportedTypes.join(', ')}`);
        suggestions.push(`Required content types: ${requiredContentTypes.join(', ')}`);
    }
    // Step 4: Provide recommendations if everything is valid
    if (errors.length === 0) {
        const recommendedModels = RECOMMENDED_MODELS[mode];
        if (!recommendedModels.includes(modelName)) {
            suggestions.push(`Consider using recommended models for optimal performance: ${recommendedModels.join(', ')}`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        recommendedModels: RECOMMENDED_MODELS[mode]
    };
}
/**
 * Validate mode-model compatibility and throw clear error if invalid
 *
 * @param mode - Processing mode
 * @param modelName - Name of the embedding model
 * @throws {Error} If the combination is invalid, with actionable error message
 *
 * @example
 * ```typescript
 * try {
 *   validateModeModelCompatibilityOrThrow('multimodal', 'sentence-transformers/all-MiniLM-L6-v2');
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 * }
 * ```
 */
export function validateModeModelCompatibilityOrThrow(mode, modelName) {
    const result = validateModeModelCompatibility(mode, modelName);
    if (!result.isValid) {
        const errorMessage = [
            `Invalid configuration: ${mode} mode with model '${modelName}'`,
            '',
            'Errors:',
            ...result.errors.map(error => `  • ${error}`),
            ''
        ];
        if (result.suggestions.length > 0) {
            errorMessage.push('Suggestions:');
            errorMessage.push(...result.suggestions.map(suggestion => `  • ${suggestion}`));
            errorMessage.push('');
        }
        if (result.recommendedModels && result.recommendedModels.length > 0) {
            errorMessage.push(`Recommended models for ${mode} mode:`);
            errorMessage.push(...result.recommendedModels.map(model => `  • ${model}`));
        }
        throw createError.validation(errorMessage.join('\n'));
    }
    // Log warnings if any
    if (result.warnings.length > 0) {
        console.warn(`⚠️  Configuration warnings for ${mode} mode with '${modelName}':`);
        result.warnings.forEach(warning => console.warn(`  • ${warning}`));
    }
    // Log suggestions if any
    if (result.suggestions.length > 0) {
        console.info(`💡 Suggestions for ${mode} mode with '${modelName}':`);
        result.suggestions.forEach(suggestion => console.info(`  • ${suggestion}`));
    }
}
/**
 * Get recommended models for a specific mode
 *
 * @param mode - Processing mode
 * @returns Array of recommended model names
 *
 * @example
 * ```typescript
 * const textModels = getRecommendedModelsForMode('text');
 * const multimodalModels = getRecommendedModelsForMode('multimodal');
 * ```
 */
export function getRecommendedModelsForMode(mode) {
    return [...RECOMMENDED_MODELS[mode]];
}
/**
 * Check if a model is compatible with a mode (without detailed validation)
 *
 * @param mode - Processing mode
 * @param modelName - Name of the embedding model
 * @returns True if compatible, false otherwise
 *
 * @example
 * ```typescript
 * if (isModeModelCompatible('multimodal', 'Xenova/clip-vit-base-patch32')) {
 *   // Proceed with configuration
 * }
 * ```
 */
export function isModeModelCompatible(mode, modelName) {
    const result = validateModeModelCompatibility(mode, modelName);
    return result.isValid;
}
/**
 * Get all compatible models for a specific mode
 *
 * @param mode - Processing mode
 * @returns Array of compatible model names
 *
 * @example
 * ```typescript
 * const compatibleModels = getCompatibleModelsForMode('multimodal');
 * console.log('Compatible models:', compatibleModels);
 * ```
 */
export function getCompatibleModelsForMode(mode) {
    const compatibleModelTypes = MODE_MODEL_COMPATIBILITY[mode];
    return ModelRegistry.getSupportedModels().filter(modelName => {
        const modelInfo = ModelRegistry.getModelInfo(modelName);
        return modelInfo && compatibleModelTypes.includes(modelInfo.type);
    });
}
