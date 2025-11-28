/**
 * CORE MODULE — Simple Embedder Creation Function
 * 
 * Provides direct model instantiation with clear validation and error handling.
 * No fallback mechanisms - models work reliably or fail clearly with actionable guidance.
 * 
 * Supported Models:
 * - Text Mode: sentence-transformers/all-MiniLM-L6-v2, Xenova/all-mpnet-base-v2
 * - Multimodal Mode: Xenova/clip-vit-base-patch32, Xenova/clip-vit-base-patch16
 * 
 * Mode Selection Guide:
 * - Use text mode for text-only content (faster, optimized for text similarity)
 * - Use multimodal mode for mixed text/image content (enables cross-modal search)
 */

// Ensure DOM polyfills are set up before any transformers.js usage
import '../dom-polyfills.js';

import type { 
  UniversalEmbedder,
  ModelType,
  EmbedderCreationOptions
} from './universal-embedder.js';
import { ModelRegistry } from './model-registry.js';
import { ModelValidator } from './model-validator.js';
import { 
  createModelValidationError,
  createTransformersCompatibilityError 
} from './model-validator.js';
import {
  createValidationErrorMessage
} from './validation-messages.js';

// =============================================================================
// SIMPLE EMBEDDER CREATION FUNCTION
// =============================================================================

/**
 * Create a universal embedder for the specified model
 * 
 * Simple function-based approach that validates model compatibility and creates
 * the appropriate embedder. Models work reliably without fallback mechanisms -
 * if there's an issue, you'll get clear error messages with actionable guidance.
 * 
 * Mode Selection:
 * - Text Mode: Use sentence-transformer models for text-only content
 *   - Fast, optimized for text similarity
 *   - Best for: document search, semantic similarity, text clustering
 * 
 * - Multimodal Mode: Use CLIP models for mixed text/image content
 *   - Unified embedding space for text and images
 *   - Enables cross-modal search (text queries find images, image queries find text)
 *   - Best for: image search, visual question answering, multimodal retrieval
 * 
 * @param modelName - Name of the model to create
 * @param options - Optional configuration options
 * @returns Promise resolving to a UniversalEmbedder instance
 * @throws {Error} If model is not supported or validation fails
 * 
 * @example
 * ```typescript
 * // Text mode - optimized for text-only content
 * const textEmbedder = await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
 * const textResult = await textEmbedder.embedText('machine learning');
 * 
 * // Multimodal mode - enables cross-modal search
 * const clipEmbedder = await createEmbedder('Xenova/clip-vit-base-patch32');
 * const textResult = await clipEmbedder.embedText('red sports car');
 * const imageResult = await clipEmbedder.embedImage('./car.jpg');
 * 
 * // Create with custom options
 * const embedder = await createEmbedder('sentence-transformers/all-MiniLM-L6-v2', {
 *   maxBatchSize: 16,
 *   cachePath: './models'
 * });
 * ```
 */
export async function createEmbedder(
  modelName: string,
  options: EmbedderCreationOptions = {}
): Promise<UniversalEmbedder> {
  // Step 0: Ensure polyfills are set up before any transformers.js usage
  if (typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
  }
  if (typeof (global as any).self === 'undefined') {
    (global as any).self = global;
  }
  
  // Step 1: Initialize model validator if not already done
  if (!ModelValidator.getTransformersVersion()) {
    await ModelValidator.detectTransformersVersion();
  }
  
  // Step 1: Validate the model
  const modelInfo = ModelRegistry.getModelInfo(modelName);
  if (!modelInfo) {
    const errorMessage = createValidationErrorMessage(modelName, 'not_found', {
      suggestions: ModelRegistry.getSupportedModels()
    });
    console.error(errorMessage);
    throw createModelValidationError(modelName, 'Model not found in supported models registry');
  }
  
  // Step 2: Perform detailed validation
  try {
    const detailedValidation = await ModelValidator.validateModelDetailed(modelName);
    if (!detailedValidation.isValid) {
      const firstError = detailedValidation.errors[0] || 'Validation failed';
      const errorMessage = createValidationErrorMessage(modelName, 'version_incompatible', {
        required: modelInfo.requirements.transformersJsVersion,
        current: ModelValidator.getTransformersVersion() || 'unknown'
      });
      console.error(errorMessage);
      throw createModelValidationError(modelName, firstError);
    }
    
    // Log warnings if any
    if (detailedValidation.warnings.length > 0) {
      console.warn(`⚠️  Warnings for model '${modelName}':`);
      detailedValidation.warnings.forEach(warning => console.warn(`  • ${warning}`));
    }
    
    // Log suggestions if any
    if (detailedValidation.suggestions.length > 0) {
      console.info(`💡 Suggestions for model '${modelName}':`);
      detailedValidation.suggestions.forEach(suggestion => console.info(`  • ${suggestion}`));
    }
    
  } catch (error) {
    // Re-throw validation errors
    if (error instanceof Error && error.name === 'ModelValidationError') {
      throw error;
    }
    
    // Handle unexpected validation errors
    console.warn(`Warning: Could not perform detailed validation for '${modelName}': ${error}`);
    console.info('Proceeding with basic validation only...');
  }
  
  // Step 3: Create the appropriate embedder based on model type
  const modelType = modelInfo.type;
  
  switch (modelType) {
    case 'sentence-transformer':
      return await createSentenceTransformerEmbedder(modelName, options);
    
    case 'clip':
      return await createCLIPEmbedder(modelName, options);
    
    default:
      const errorMessage = createValidationErrorMessage(modelName, 'not_found', {
        suggestions: [`Unsupported model type: ${modelType}`]
      });
      console.error(errorMessage);
      throw createModelValidationError(
        modelName, 
        `Unsupported model type: ${modelType}. Supported types: sentence-transformer, clip`
      );
  }
}

// =============================================================================
// MODEL-SPECIFIC CREATION FUNCTIONS
// =============================================================================

/**
 * Create a sentence transformer embedder using lazy loading
 * @private
 */
async function createSentenceTransformerEmbedder(
  modelName: string,
  options: EmbedderCreationOptions
): Promise<UniversalEmbedder> {
  // Use lazy loading to avoid loading text dependencies unless needed
  const { LazyEmbedderLoader } = await import('./lazy-dependency-loader.js');
  return LazyEmbedderLoader.loadSentenceTransformerEmbedder(modelName, options);
}

/**
 * Create a CLIP embedder using lazy loading
 * @private
 */
async function createCLIPEmbedder(
  modelName: string,
  options: EmbedderCreationOptions
): Promise<UniversalEmbedder> {
  // Use lazy loading to avoid loading multimodal dependencies unless needed
  const { LazyEmbedderLoader } = await import('./lazy-dependency-loader.js');
  return LazyEmbedderLoader.loadCLIPEmbedder(modelName, options);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get supported models for a specific content type
 * Convenience function for filtering models by capability
 * 
 * @param contentType - Content type to filter by ('text', 'image', etc.)
 * @returns Array of model names that support the content type
 * 
 * @example
 * ```typescript
 * const textModels = getSupportedModelsForContentType('text');
 * const imageModels = getSupportedModelsForContentType('image');
 * ```
 */
export function getSupportedModelsForContentType(contentType: string): string[] {
  return ModelRegistry.getModelsByContentType(contentType);
}

/**
 * Get recommended model for a specific use case
 * 
 * Provides intelligent model selection based on content types and constraints.
 * Returns models that work reliably for the specified requirements.
 * 
 * Mode Selection Guide:
 * - Text only (['text']): Returns sentence-transformer models
 *   - Fast, optimized for text similarity
 *   - Best for document search and text clustering
 * 
 * - Text + Images (['text', 'image']): Returns CLIP models
 *   - Unified embedding space for cross-modal search
 *   - Text queries can find images, image queries can find text
 *   - Best for visual search and multimodal retrieval
 * 
 * @param contentTypes - Required content types
 * @param constraints - Optional constraints (memory, performance, etc.)
 * @param constraints.maxMemory - Maximum memory in MB
 * @param constraints.preferPerformance - Prefer faster models
 * @param constraints.preferAccuracy - Prefer more accurate models
 * @returns Recommended model name or null if no suitable model found
 * 
 * @example
 * ```typescript
 * // Get best text model (fast, optimized for text)
 * const textModel = getRecommendedModel(['text']);
 * // Returns: 'sentence-transformers/all-MiniLM-L6-v2'
 * 
 * // Get best multimodal model (enables cross-modal search)
 * const multimodalModel = getRecommendedModel(['text', 'image']);
 * // Returns: 'Xenova/clip-vit-base-patch32'
 * 
 * // Get performance-optimized model
 * const fastModel = getRecommendedModel(['text'], { preferPerformance: true });
 * 
 * // Get accuracy-optimized model
 * const accurateModel = getRecommendedModel(['text'], { preferAccuracy: true });
 * ```
 */
export function getRecommendedModel(
  contentTypes: string[],
  constraints: {
    maxMemory?: number;
    preferPerformance?: boolean;
    preferAccuracy?: boolean;
  } = {}
): string | null {
  const transformersVersion = ModelValidator.getTransformersVersion();
  const compatibleModels = ModelValidator.getRecommendedModels(
    contentTypes,
    constraints.maxMemory,
    transformersVersion || undefined
  );
  
  if (compatibleModels.length === 0) {
    return null;
  }
  
  // Apply preference-based sorting
  if (constraints.preferPerformance) {
    // Prefer smaller, faster models
    const performanceOrder = [
      'sentence-transformers/all-MiniLM-L6-v2',
      'Xenova/clip-vit-base-patch32',
      'Xenova/all-mpnet-base-v2',
      'Xenova/clip-vit-base-patch16'
    ];
    
    for (const preferred of performanceOrder) {
      if (compatibleModels.includes(preferred)) {
        return preferred;
      }
    }
  }
  
  if (constraints.preferAccuracy) {
    // Prefer larger, more accurate models
    const accuracyOrder = [
      'Xenova/all-mpnet-base-v2',
      'Xenova/clip-vit-base-patch16',
      'sentence-transformers/all-MiniLM-L6-v2',
      'Xenova/clip-vit-base-patch32'
    ];
    
    for (const preferred of accuracyOrder) {
      if (compatibleModels.includes(preferred)) {
        return preferred;
      }
    }
  }
  
  // Default: return first compatible model
  return compatibleModels[0];
}

/**
 * Validate model compatibility before creation
 * Useful for checking compatibility without creating the embedder
 * 
 * @param modelName - Name of the model to validate
 * @returns Promise resolving to validation result
 * 
 * @example
 * ```typescript
 * const isValid = await validateModelCompatibility('sentence-transformers/all-MiniLM-L6-v2');
 * if (isValid) {
 *   const embedder = await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
 * }
 * ```
 */
export async function validateModelCompatibility(modelName: string): Promise<boolean> {
  try {
    const validation = await ModelValidator.validateModelDetailed(modelName);
    return validation.isValid;
  } catch (error) {
    console.warn(`Validation failed for '${modelName}': ${error}`);
    return false;
  }
}

/**
 * List all available models with their capabilities
 * Useful for displaying model options to users
 * 
 * @returns Array of model information objects
 * 
 * @example
 * ```typescript
 * const models = listAvailableModels();
 * models.forEach(model => {
 *   console.log(`${model.name}: ${model.supportedContentTypes.join(', ')}`);
 * });
 * ```
 */
export function listAvailableModels(): Array<{
  name: string;
  type: ModelType;
  dimensions: number;
  supportedContentTypes: readonly string[];
  memoryRequirement: number | undefined;
}> {
  return ModelRegistry.getSupportedModels().map(modelName => {
    const info = ModelRegistry.getModelInfo(modelName)!;
    return {
      name: info.name,
      type: info.type,
      dimensions: info.dimensions,
      supportedContentTypes: info.supportedContentTypes,
      memoryRequirement: info.requirements.minimumMemory
    };
  });
}

// =============================================================================
// BACKWARD COMPATIBILITY - REMOVED
// =============================================================================
// The UniversalEmbedderFactory object has been removed as it was only a thin
// wrapper around the new API with deprecation warnings. Use the following instead:
//
// - UniversalEmbedderFactory.create() → createEmbedder()
// - UniversalEmbedderFactory.validateModel() → ModelRegistry.validateModel()
// - UniversalEmbedderFactory.getModelInfo() → ModelRegistry.getModelInfo()
// - UniversalEmbedderFactory.getSupportedModels() → ModelRegistry.getSupportedModels()