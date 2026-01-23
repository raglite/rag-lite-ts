/**
 * CORE MODULE — Generator Registry for RAG Response Generation
 * 
 * Centralized registry of supported generator models with validation and
 * compatibility checking. Follows the same patterns as model-registry.ts.
 * 
 * SUPPORTED MODELS:
 * - HuggingFaceTB/SmolLM2-135M-Instruct: Balanced instruct model (DEFAULT, 3 chunks)
 * - HuggingFaceTB/SmolLM2-360M-Instruct: Higher quality instruct model (5 chunks)
 * 
 * PREREQUISITES:
 * - Reranking must be enabled for response generation to ensure quality context
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import type {
  GeneratorModelInfo,
  GeneratorModelType,
  GeneratorValidationResult,
  GeneratorCapabilities,
  GeneratorRequirements
} from './response-generator.js';

// =============================================================================
// GENERATOR REGISTRY
// =============================================================================

/**
 * Registry of supported generator models with their metadata and capabilities
 */
export const SUPPORTED_GENERATORS: Record<string, GeneratorModelInfo> = {
  // SmolLM2-135M-Instruct - Balanced instruction-tuned model (RECOMMENDED DEFAULT)
  'HuggingFaceTB/SmolLM2-135M-Instruct': {
    name: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    type: 'instruct',
    version: '1.0.0',
    description: 'Balanced instruction-tuned model with good quality and speed (uses top 3 chunks)',
    capabilities: {
      supportsStreaming: true,
      supportsSystemPrompt: true,  // Instruct models support system prompts
      instructionTuned: true,
      maxContextLength: 2048,
      defaultMaxOutputTokens: 512,
      recommendedTemperature: 0.1,
      defaultMaxChunksForContext: 3  // Use top 3 reranked chunks for context
    },
    requirements: {
      transformersJsVersion: '>=3.0.0',
      minimumMemory: 768,
      requiredFeatures: ['text-generation'],
      platformSupport: ['node', 'browser']
    },
    isDefault: true  // Recommended default model
  },

  // SmolLM2-360M-Instruct - Higher quality instruction-tuned model
  'HuggingFaceTB/SmolLM2-360M-Instruct': {
    name: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    type: 'instruct',
    version: '1.0.0',
    description: 'Higher quality instruction-tuned model, slower but more accurate (uses top 5 chunks)',
    capabilities: {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      instructionTuned: true,
      maxContextLength: 2048,
      defaultMaxOutputTokens: 512,
      recommendedTemperature: 0.1,
      defaultMaxChunksForContext: 5  // Use top 5 reranked chunks for context
    },
    requirements: {
      transformersJsVersion: '>=3.0.0',
      minimumMemory: 1024,
      requiredFeatures: ['text-generation'],
      platformSupport: ['node', 'browser']
    },
    isDefault: false
  }
} as const;

// =============================================================================
// DEFAULT MODEL
// =============================================================================

/** Default generator model name */
export const DEFAULT_GENERATOR_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';

// =============================================================================
// GENERATOR REGISTRY CLASS
// =============================================================================

/**
 * Generator registry class providing validation and model information services
 */
export class GeneratorRegistry {
  /**
   * Gets generator model information for a given model name
   * @param modelName - Name of the generator model
   * @returns Generator model information or null if not supported
   */
  static getGeneratorInfo(modelName: string): GeneratorModelInfo | null {
    return SUPPORTED_GENERATORS[modelName] || null;
  }

  /**
   * Validates a generator model name and returns compatibility information
   * @param modelName - Name of the model to validate
   * @returns Validation result with errors, warnings, and suggestions
   */
  static validateGenerator(modelName: string): GeneratorValidationResult {
    const modelInfo = this.getGeneratorInfo(modelName);

    if (!modelInfo) {
      const suggestions = this.getSimilarGenerators(modelName);
      return {
        isValid: false,
        errors: [`Generator model '${modelName}' is not supported`],
        warnings: [],
        suggestions: suggestions.length > 0
          ? [`Did you mean: ${suggestions.join(', ')}?`]
          : [`Available generators: ${this.getSupportedGenerators().join(', ')}`]
      };
    }

    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Memory warnings
    if (modelInfo.requirements.minimumMemory > 768) {
      warnings.push(`Model requires ${modelInfo.requirements.minimumMemory}MB memory`);
    }

    return {
      isValid: true,
      errors: [],
      warnings,
      suggestions
    };
  }

  /**
   * Lists all supported generator models
   * @param modelType - Optional filter by model type
   * @returns Array of supported generator model names
   */
  static getSupportedGenerators(modelType?: GeneratorModelType): string[] {
    const allModels = Object.keys(SUPPORTED_GENERATORS);

    if (!modelType) {
      return allModels;
    }

    return allModels.filter(modelName =>
      SUPPORTED_GENERATORS[modelName].type === modelType
    );
  }

  /**
   * Gets the default generator model name
   * @returns Default generator model name
   */
  static getDefaultGenerator(): string {
    return DEFAULT_GENERATOR_MODEL;
  }

  /**
   * Gets generators by type
   * @param type - Generator type ('causal-lm' or 'instruct')
   * @returns Array of model names matching the type
   */
  static getGeneratorsByType(type: GeneratorModelType): string[] {
    return Object.keys(SUPPORTED_GENERATORS).filter(
      modelName => SUPPORTED_GENERATORS[modelName].type === type
    );
  }

  /**
   * Checks if a generator model supports a specific capability
   * @param modelName - Name of the model
   * @param capability - Capability to check
   * @returns True if the model supports the capability
   */
  static supportsCapability(
    modelName: string,
    capability: keyof GeneratorCapabilities
  ): boolean {
    const modelInfo = this.getGeneratorInfo(modelName);
    if (!modelInfo) return false;
    
    const value = modelInfo.capabilities[capability];
    return typeof value === 'boolean' ? value : value !== undefined;
  }

  /**
   * Gets generators similar to the given model name (for suggestions)
   * @private
   */
  private static getSimilarGenerators(modelName: string): string[] {
    const allModels = Object.keys(SUPPORTED_GENERATORS);
    const lowerModelName = modelName.toLowerCase();

    // Simple similarity check based on common substrings
    const keywords = ['gpt', 'smol', 'lm', 'instruct', 'distil'];
    const modelKeywords = keywords.filter(keyword => lowerModelName.includes(keyword));

    return allModels.filter(supportedModel => {
      const lowerSupported = supportedModel.toLowerCase();
      return modelKeywords.some(keyword => lowerSupported.includes(keyword));
    }).slice(0, 3);
  }

  /**
   * Validates system compatibility for a generator model
   * @param modelName - Name of the model
   * @param systemCapabilities - System capabilities to check against
   * @returns Validation result with compatibility information
   */
  static validateSystemCompatibility(
    modelName: string,
    systemCapabilities: {
      availableMemory?: number;
      platform?: string;
      transformersJsVersion?: string;
    }
  ): GeneratorValidationResult {
    const modelInfo = this.getGeneratorInfo(modelName);

    if (!modelInfo) {
      return {
        isValid: false,
        errors: [`Generator model '${modelName}' is not supported`],
        warnings: [],
        suggestions: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check memory requirements
    if (systemCapabilities.availableMemory !== undefined) {
      if (systemCapabilities.availableMemory < modelInfo.requirements.minimumMemory) {
        errors.push(
          `Insufficient memory: ${systemCapabilities.availableMemory}MB available, ` +
          `${modelInfo.requirements.minimumMemory}MB required`
        );

        // Suggest lighter models
        const lighterModels = this.getSupportedGenerators().filter(name => {
          const info = this.getGeneratorInfo(name);
          return info &&
            info.requirements.minimumMemory <= systemCapabilities.availableMemory!;
        });

        if (lighterModels.length > 0) {
          suggestions.push(`Consider lighter models: ${lighterModels.join(', ')}`);
        }
      }
    }

    // Check platform compatibility
    if (systemCapabilities.platform) {
      if (!modelInfo.requirements.platformSupport.includes(systemCapabilities.platform)) {
        errors.push(
          `Platform '${systemCapabilities.platform}' not supported. ` +
          `Supported platforms: ${modelInfo.requirements.platformSupport.join(', ')}`
        );
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
 * Gets the generator type for a given model name
 * @param modelName - Name of the model
 * @returns Generator type or null if model not supported
 */
export function getGeneratorType(modelName: string): GeneratorModelType | null {
  const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
  return modelInfo ? modelInfo.type : null;
}

/**
 * Checks if a model is an instruction-tuned model
 * @param modelName - Name of the model
 * @returns True if the model is instruction-tuned
 */
export function isInstructionTunedModel(modelName: string): boolean {
  const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
  return modelInfo ? modelInfo.capabilities.instructionTuned : false;
}

/**
 * Gets the maximum context length for a generator model
 * @param modelName - Name of the model
 * @returns Maximum context length or null if model not supported
 */
export function getMaxContextLength(modelName: string): number | null {
  const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
  return modelInfo ? modelInfo.capabilities.maxContextLength : null;
}

/**
 * Gets recommended generation settings for a model
 * @param modelName - Name of the model
 * @returns Recommended settings or null if model not supported
 */
export function getRecommendedSettings(modelName: string): {
  temperature: number;
  maxTokens: number;
  maxChunksForContext: number;
} | null {
  const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
  if (!modelInfo) return null;

  return {
    temperature: modelInfo.capabilities.recommendedTemperature,
    maxTokens: modelInfo.capabilities.defaultMaxOutputTokens,
    maxChunksForContext: modelInfo.capabilities.defaultMaxChunksForContext
  };
}

/**
 * Gets the default maximum chunks for context for a generator model
 * @param modelName - Name of the model
 * @returns Default max chunks for context or null if model not supported
 */
export function getDefaultMaxChunksForContext(modelName: string): number | null {
  const modelInfo = GeneratorRegistry.getGeneratorInfo(modelName);
  return modelInfo ? modelInfo.capabilities.defaultMaxChunksForContext : null;
}
