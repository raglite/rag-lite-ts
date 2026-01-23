/**
 * FACTORY MODULE — Generator Factory for RAG Response Generation
 * 
 * Factory functions for creating response generator instances.
 * Handles model validation, lazy loading, and proper initialization.
 * 
 * SUPPORTED MODELS:
 * - HuggingFaceTB/SmolLM2-135M-Instruct (instruct, balanced, DEFAULT, uses top 3 chunks)
 * - HuggingFaceTB/SmolLM2-360M-Instruct (instruct, higher quality, uses top 5 chunks)
 * 
 * PREREQUISITES:
 * - Reranking must be enabled for response generation
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import type {
  ResponseGenerator,
  GeneratorCreationOptions,
  GenerateFunction
} from '../core/response-generator.js';
import { createGenerateFunction, GeneratorValidationError } from '../core/response-generator.js';
import {
  GeneratorRegistry,
  DEFAULT_GENERATOR_MODEL,
  getGeneratorType
} from '../core/generator-registry.js';
import { LazyGeneratorLoader } from '../core/lazy-dependency-loader.js';

// =============================================================================
// GENERATOR FACTORY
// =============================================================================

/**
 * Create a response generator for the specified model
 * 
 * Uses lazy loading to defer model initialization until first use.
 * Validates model compatibility before creation.
 * 
 * @param modelName - Name of the generator model (default: SmolLM2-135M-Instruct)
 * @param options - Optional configuration options
 * @returns Promise resolving to a ResponseGenerator instance
 * @throws {GeneratorValidationError} If model is not supported
 * 
 * @example
 * ```typescript
 * // Create default generator (recommended)
 * const generator = await createResponseGenerator();
 * 
 * // Create higher quality generator
 * const generator = await createResponseGenerator('HuggingFaceTB/SmolLM2-360M-Instruct');
 * 
 * // Create with options
 * const generator = await createResponseGenerator('HuggingFaceTB/SmolLM2-360M-Instruct', {
 *   cachePath: './models'
 * });
 * ```
 * 
 * @experimental This feature is experimental and may change in future versions.
 */
export async function createResponseGenerator(
  modelName: string = DEFAULT_GENERATOR_MODEL,
  options: GeneratorCreationOptions = {}
): Promise<ResponseGenerator> {
  console.log(`🏭 [EXPERIMENTAL] Creating response generator: ${modelName}`);

  // Step 1: Validate model
  const validation = GeneratorRegistry.validateGenerator(modelName);
  if (!validation.isValid) {
    throw new GeneratorValidationError(
      modelName,
      GeneratorRegistry.getSupportedGenerators(),
      validation.errors.join('; ')
    );
  }

  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn(`⚠️  Warnings for generator '${modelName}':`);
    validation.warnings.forEach(w => console.warn(`  • ${w}`));
  }

  // Log suggestions
  if (validation.suggestions.length > 0) {
    console.info(`💡 Suggestions for generator '${modelName}':`);
    validation.suggestions.forEach(s => console.info(`  • ${s}`));
  }

  // Step 2: Get model type and create appropriate generator
  const modelType = getGeneratorType(modelName);
  if (!modelType) {
    throw new GeneratorValidationError(
      modelName,
      GeneratorRegistry.getSupportedGenerators(),
      `Could not determine model type for '${modelName}'`
    );
  }

  // Step 3: Use lazy loading to create the generator
  let generator: ResponseGenerator;
  
  switch (modelType) {
    case 'instruct':
      generator = await LazyGeneratorLoader.loadInstructGenerator(modelName, options);
      break;
    
    case 'causal-lm':
      generator = await LazyGeneratorLoader.loadCausalLMGenerator(modelName, options);
      break;
    
    default:
      throw new GeneratorValidationError(
        modelName,
        GeneratorRegistry.getSupportedGenerators(),
        `Unsupported generator type: ${modelType}`
      );
  }

  console.log(`✅ [EXPERIMENTAL] Response generator created: ${modelName}`);
  return generator;
}

/**
 * Create a GenerateFunction from a model name
 * 
 * This is a convenience function that creates a generator and wraps it
 * in a function suitable for dependency injection into SearchEngine.
 * 
 * @param modelName - Name of the generator model
 * @param options - Optional configuration options
 * @returns Promise resolving to a GenerateFunction
 * 
 * @example
 * ```typescript
 * const generateFn = await createGenerateFunctionFromModel();
 * const result = await generateFn(query, chunks);
 * ```
 * 
 * @experimental This feature is experimental and may change in future versions.
 */
export async function createGenerateFunctionFromModel(
  modelName: string = DEFAULT_GENERATOR_MODEL,
  options: GeneratorCreationOptions = {}
): Promise<GenerateFunction> {
  const generator = await createResponseGenerator(modelName, options);
  return createGenerateFunction(generator);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the default generator model name
 */
export function getDefaultGeneratorModel(): string {
  return DEFAULT_GENERATOR_MODEL;
}

/**
 * List available generator models
 */
export function listGeneratorModels(): string[] {
  return GeneratorRegistry.getSupportedGenerators();
}

/**
 * Check if a model name is a valid generator
 */
export function isValidGeneratorModel(modelName: string): boolean {
  return GeneratorRegistry.getGeneratorInfo(modelName) !== null;
}

/**
 * Get recommended generator for specific use case
 * 
 * @param preferSpeed - Prefer faster generation over quality
 * @param preferQuality - Prefer higher quality over speed
 * @returns Recommended model name
 */
export function getRecommendedGenerator(options: {
  preferSpeed?: boolean;
  preferQuality?: boolean;
} = {}): string {
  const { preferSpeed, preferQuality } = options;

  if (preferSpeed) {
    return 'Xenova/distilgpt2';
  }

  if (preferQuality) {
    return 'HuggingFaceTB/SmolLM2-360M-Instruct';
  }

  // Default: balanced option
  return DEFAULT_GENERATOR_MODEL;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  GeneratorRegistry,
  DEFAULT_GENERATOR_MODEL
} from '../core/generator-registry.js';
