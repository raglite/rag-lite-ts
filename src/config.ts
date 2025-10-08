import { PreprocessingConfig } from './types.js';
import { homedir } from 'os';
import { join } from 'path';

export interface Config {
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  batch_size: number;
  top_k: number;
  db_file: string;
  index_file: string;
  rerank_enabled: boolean;
  preprocessing: PreprocessingConfig;
  model_cache_path?: string;
  path_storage_strategy: 'absolute' | 'relative';
}

export interface ModelDefaults {
  dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  batch_size: number;
}

/**
 * Default preprocessing configuration - "balanced" mode
 */
export const defaultPreprocessingConfig: PreprocessingConfig = {
  mode: 'balanced'
};

/**
 * Get the default model cache path as specified in the requirements
 * @returns Default cache path (~/.raglite/models/)
 */
function getDefaultModelCachePath(): string {
  return join(homedir(), '.raglite', 'models');
}

/**
 * Returns model-specific default configuration values
 * @param modelName - The embedding model name
 * @returns Model-specific defaults for dimensions, chunk_size, chunk_overlap, and batch_size
 */
export function getModelDefaults(modelName: string): ModelDefaults {
  if (modelName === 'Xenova/all-mpnet-base-v2') {
    return {
      dimensions: 768,
      chunk_size: 400,
      chunk_overlap: 80,
      batch_size: 8
    };
  }
  
  // Default to sentence-transformers/all-MiniLM-L6-v2 settings (current defaults)
  return {
    dimensions: 384,
    chunk_size: 250,
    chunk_overlap: 50,
    batch_size: 16
  };
}

// Create config with model-specific defaults
const embeddingModel = process.env.RAG_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const modelDefaults = getModelDefaults(embeddingModel);

export const config: Config = {
  embedding_model: embeddingModel,
  chunk_size: parseInt(process.env.RAG_CHUNK_SIZE || modelDefaults.chunk_size.toString(), 10),
  chunk_overlap: parseInt(process.env.RAG_CHUNK_OVERLAP || modelDefaults.chunk_overlap.toString(), 10),
  batch_size: parseInt(process.env.RAG_BATCH_SIZE || modelDefaults.batch_size.toString(), 10),
  top_k: parseInt(process.env.RAG_TOP_K || '10', 10),
  db_file: process.env.RAG_DB_FILE || 'db.sqlite',
  index_file: process.env.RAG_INDEX_FILE || 'vector-index.bin',
  rerank_enabled: process.env.RAG_RERANK_ENABLED === 'true',
  preprocessing: defaultPreprocessingConfig,
  model_cache_path: process.env.RAG_MODEL_CACHE_PATH || getDefaultModelCachePath(),
  path_storage_strategy: (process.env.RAG_PATH_STORAGE_STRATEGY as 'absolute' | 'relative') || 'relative'
};

/**
 * Standard exit codes for different error conditions
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENTS: 2,
  CONFIGURATION_ERROR: 3,
  FILE_NOT_FOUND: 4,
  DATABASE_ERROR: 5,
  MODEL_ERROR: 6,
  INDEX_ERROR: 7,
  PERMISSION_ERROR: 8
} as const;

/**
 * Configuration validation error with specific exit code
 */
export class ConfigurationError extends Error {
  constructor(message: string, public exitCode: number = EXIT_CODES.CONFIGURATION_ERROR) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates preprocessing configuration
 * @param config - Preprocessing configuration to validate
 * @throws {ConfigurationError} If preprocessing configuration is invalid
 */
export function validatePreprocessingConfig(config: any): asserts config is PreprocessingConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigurationError('Preprocessing configuration must be an object');
  }

  // Validate mode
  const validModes = ['strict', 'balanced', 'rich'];
  if (!config.mode || !validModes.includes(config.mode)) {
    throw new ConfigurationError(
      `Configuration error: preprocessing.mode must be one of: ${validModes.join(', ')}.\n` +
      `Current value: ${JSON.stringify(config.mode)}\n` +
      `Please set it to 'strict', 'balanced', or 'rich'.`
    );
  }

  // Validate overrides if present
  if (config.overrides !== undefined) {
    if (typeof config.overrides !== 'object' || config.overrides === null) {
      throw new ConfigurationError(
        `Configuration error: preprocessing.overrides must be an object.\n` +
        `Current value: ${JSON.stringify(config.overrides)}`
      );
    }

    // Validate MDX override
    if (config.overrides.mdx !== undefined) {
      const validMdxOptions = ['strip', 'keep', 'placeholder'];
      if (!validMdxOptions.includes(config.overrides.mdx)) {
        throw new ConfigurationError(
          `Configuration error: preprocessing.overrides.mdx must be one of: ${validMdxOptions.join(', ')}.\n` +
          `Current value: ${JSON.stringify(config.overrides.mdx)}`
        );
      }
    }

    // Validate Mermaid override
    if (config.overrides.mermaid !== undefined) {
      const validMermaidOptions = ['strip', 'extract', 'placeholder'];
      if (!validMermaidOptions.includes(config.overrides.mermaid)) {
        throw new ConfigurationError(
          `Configuration error: preprocessing.overrides.mermaid must be one of: ${validMermaidOptions.join(', ')}.\n` +
          `Current value: ${JSON.stringify(config.overrides.mermaid)}`
        );
      }
    }

    // Validate code override
    if (config.overrides.code !== undefined) {
      const validCodeOptions = ['strip', 'keep', 'placeholder'];
      if (!validCodeOptions.includes(config.overrides.code)) {
        throw new ConfigurationError(
          `Configuration error: preprocessing.overrides.code must be one of: ${validCodeOptions.join(', ')}.\n` +
          `Current value: ${JSON.stringify(config.overrides.code)}`
        );
      }
    }
  }
}

/**
 * Merges preprocessing mode with overrides to create final configuration
 * @param config - Base preprocessing configuration
 * @returns Resolved preprocessing options for each content type
 */
export function mergePreprocessingConfig(config: PreprocessingConfig): {
  mdx: 'strip' | 'keep' | 'placeholder';
  mermaid: 'strip' | 'extract' | 'placeholder';
  code: 'strip' | 'keep' | 'placeholder';
} {
  // Define mode defaults
  const modeDefaults: {
    [K in PreprocessingConfig['mode']]: {
      mdx: 'strip' | 'keep' | 'placeholder';
      mermaid: 'strip' | 'extract' | 'placeholder';
      code: 'strip' | 'keep' | 'placeholder';
    }
  } = {
    strict: {
      mdx: 'strip',
      mermaid: 'strip',
      code: 'strip'
    },
    balanced: {
      mdx: 'placeholder',
      mermaid: 'placeholder',
      code: 'keep'
    },
    rich: {
      mdx: 'keep',
      mermaid: 'extract',
      code: 'keep'
    }
  };

  // Start with mode defaults
  const result = { ...modeDefaults[config.mode] };

  // Apply overrides (shallow override only)
  if (config.overrides) {
    if (config.overrides.mdx !== undefined) {
      result.mdx = config.overrides.mdx;
    }
    if (config.overrides.mermaid !== undefined) {
      result.mermaid = config.overrides.mermaid;
    }
    if (config.overrides.code !== undefined) {
      result.code = config.overrides.code;
    }
  }

  return result;
}

/**
 * Validates the configuration object
 * @param config - Configuration object to validate
 * @throws {ConfigurationError} If configuration is invalid
 */
export function validateConfig(config: any): asserts config is Config {
  if (!config || typeof config !== 'object') {
    throw new ConfigurationError('Configuration must be an object');
  }

  // Check required string fields
  const requiredStrings: (keyof Config)[] = ['embedding_model', 'db_file', 'index_file'];
  for (const field of requiredStrings) {
    if (!config[field] || typeof config[field] !== 'string') {
      throw new ConfigurationError(
        `Configuration error: '${field}' must be a non-empty string.\n` +
        `Current value: ${JSON.stringify(config[field])}\n` +
        `Please check your configuration file.`
      );
    }
  }

  // Validate path_storage_strategy
  if (!['absolute', 'relative'].includes(config.path_storage_strategy)) {
    throw new ConfigurationError(
      `Configuration error: 'path_storage_strategy' must be either 'absolute' or 'relative'.\n` +
      `Current value: ${JSON.stringify(config.path_storage_strategy)}\n` +
      `Please set it to 'absolute' or 'relative'.`
    );
  }

  // Check required numeric fields are positive
  const requiredNumbers: (keyof Config)[] = ['chunk_size', 'chunk_overlap', 'batch_size', 'top_k'];
  for (const field of requiredNumbers) {
    if (typeof config[field] !== 'number' || config[field] <= 0) {
      throw new ConfigurationError(
        `Configuration error: '${field}' must be a positive number.\n` +
        `Current value: ${JSON.stringify(config[field])}\n` +
        `Please ensure all numeric values are greater than 0.`
      );
    }
  }

  // Check boolean fields
  if (typeof config.rerank_enabled !== 'boolean') {
    throw new ConfigurationError(
      `Configuration error: 'rerank_enabled' must be a boolean (true or false).\n` +
      `Current value: ${JSON.stringify(config.rerank_enabled)}\n` +
      `Please set it to either true or false.`
    );
  }

  // Validate preprocessing configuration
  validatePreprocessingConfig(config.preprocessing);

  // Validate optional model_cache_path field
  if (config.model_cache_path !== undefined && (typeof config.model_cache_path !== 'string' || config.model_cache_path.trim() === '')) {
    throw new ConfigurationError(
      `Configuration error: 'model_cache_path' must be a non-empty string when provided.\n` +
      `Current value: ${JSON.stringify(config.model_cache_path)}\n` +
      `Please provide a valid directory path or remove the field to use default caching.`
    );
  }

  // Validate chunk_overlap is less than chunk_size
  if (config.chunk_overlap >= config.chunk_size) {
    throw new ConfigurationError(
      `Configuration error: chunk_overlap (${config.chunk_overlap}) must be less than chunk_size (${config.chunk_size}).\n` +
      `Recommended: Set chunk_overlap to about 20% of chunk_size (e.g., chunk_size: 250, chunk_overlap: 50).`
    );
  }

  // Validate reasonable ranges for performance
  if (config.chunk_size > 1000) {
    console.warn(`Warning: Large chunk_size (${config.chunk_size}) may impact performance. Recommended range: 200-400 tokens.`);
  }

  if (config.batch_size > 64) {
    console.warn(`Warning: Large batch_size (${config.batch_size}) may cause memory issues. Recommended range: 8-32.`);
  }


}

/**
 * Utility function to handle unrecoverable errors with descriptive messages
 * Logs error and exits immediately with appropriate exit code
 * @param error - Error object or message
 * @param context - Context where the error occurred
 * @param exitCode - Exit code to use (defaults to GENERAL_ERROR)
 */
export function handleUnrecoverableError(
  error: Error | string,
  context: string,
  exitCode: number = EXIT_CODES.GENERAL_ERROR
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error(`\nFatal Error in ${context}:`);
  console.error(errorMessage);
  console.error('\nThe system cannot continue and will exit immediately.');

  // Provide context-specific guidance
  switch (exitCode) {
    case EXIT_CODES.CONFIGURATION_ERROR:
      console.error('\nPlease check your configuration and try again.');
      break;
    case EXIT_CODES.DATABASE_ERROR:
      console.error('\nTry running "raglite rebuild" to fix database issues.');
      break;
    case EXIT_CODES.MODEL_ERROR:
      console.error('\nEnsure you have internet connection for model download and sufficient disk space.');
      break;
    case EXIT_CODES.INDEX_ERROR:
      console.error('\nTry running "raglite rebuild" to recreate the vector index.');
      break;
    case EXIT_CODES.FILE_NOT_FOUND:
      console.error('\nPlease check that the specified files or directories exist and are accessible.');
      break;
    case EXIT_CODES.PERMISSION_ERROR:
      console.error('\nPlease check file and directory permissions.');
      break;
    default:
      console.error('\nIf this problem persists, please report it as a bug.');
  }

  process.exit(exitCode);
}

/**
 * Utility function for safe error logging with context
 * @param error - Error to log
 * @param context - Context where error occurred
 * @param skipError - Whether to skip this error and continue (default: false)
 */
export function logError(error: Error | string, context: string, skipError: boolean = false): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (skipError) {
    console.error(`Warning in ${context}: ${errorMessage} (skipping and continuing)`);
  } else {
    console.error(`Error in ${context}: ${errorMessage}`);
  }
}

// Validate the default config on module load
validateConfig(config);