/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */
import { homedir } from 'os';
import { join } from 'path';
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
};
/**
 * Configuration validation error with specific exit code
 */
export class ConfigurationError extends Error {
    exitCode;
    constructor(message, exitCode = EXIT_CODES.CONFIGURATION_ERROR) {
        super(message);
        this.exitCode = exitCode;
        this.name = 'ConfigurationError';
    }
}
/**
 * Get the default model cache path as specified in the requirements
 * @returns Default cache path (~/.raglite/models/)
 */
export function getDefaultModelCachePath() {
    return join(homedir(), '.raglite', 'models');
}
/**
 * Validates core configuration fields
 * @param config - Configuration object to validate
 * @throws {ConfigurationError} If configuration is invalid
 */
export function validateCoreConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new ConfigurationError('Configuration must be an object');
    }
    // Check required string fields
    const requiredStrings = ['db_file', 'index_file'];
    for (const field of requiredStrings) {
        if (!config[field] || typeof config[field] !== 'string') {
            throw new ConfigurationError(`Configuration error: '${field}' must be a non-empty string.\n` +
                `Current value: ${JSON.stringify(config[field])}\n` +
                `Please check your configuration file.`);
        }
    }
    // Validate path_storage_strategy
    if (!['absolute', 'relative'].includes(config.path_storage_strategy)) {
        throw new ConfigurationError(`Configuration error: 'path_storage_strategy' must be either 'absolute' or 'relative'.\n` +
            `Current value: ${JSON.stringify(config.path_storage_strategy)}\n` +
            `Please set it to 'absolute' or 'relative'.`);
    }
    // Check required numeric fields are positive
    const requiredNumbers = ['chunk_size', 'chunk_overlap', 'batch_size', 'top_k'];
    for (const field of requiredNumbers) {
        if (typeof config[field] !== 'number' || config[field] <= 0) {
            throw new ConfigurationError(`Configuration error: '${field}' must be a positive number.\n` +
                `Current value: ${JSON.stringify(config[field])}\n` +
                `Please ensure all numeric values are greater than 0.`);
        }
    }
    // Validate optional model_cache_path field
    if (config.model_cache_path !== undefined && (typeof config.model_cache_path !== 'string' || config.model_cache_path.trim() === '')) {
        throw new ConfigurationError(`Configuration error: 'model_cache_path' must be a non-empty string when provided.\n` +
            `Current value: ${JSON.stringify(config.model_cache_path)}\n` +
            `Please provide a valid directory path or remove the field to use default caching.`);
    }
    // Validate chunk_overlap is less than chunk_size
    if (config.chunk_overlap >= config.chunk_size) {
        throw new ConfigurationError(`Configuration error: chunk_overlap (${config.chunk_overlap}) must be less than chunk_size (${config.chunk_size}).\n` +
            `Recommended: Set chunk_overlap to about 20% of chunk_size (e.g., chunk_size: 250, chunk_overlap: 50).`);
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
 * Get default configuration for different embedding models
 * @param modelName - Name of the embedding model
 * @returns Model-specific defaults
 */
export function getModelDefaults(modelName) {
    // Default configuration for most models
    const defaults = {
        dimensions: 384, // Most common dimension for sentence transformers
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16
    };
    // Model-specific overrides based on model name heuristics
    if (modelName) {
        const normalizedName = modelName.toLowerCase();
        // CLIP models - 512 dimensions
        if (normalizedName.includes('clip')) {
            defaults.dimensions = 512;
            defaults.batch_size = 8;
        }
        // MPNet models - 768 dimensions
        else if (normalizedName.includes('all-mpnet-base-v2')) {
            defaults.dimensions = 768;
            defaults.chunk_size = 400;
            defaults.chunk_overlap = 80;
            defaults.batch_size = 8;
        }
        else if (normalizedName.includes('mpnet') || normalizedName.includes('768')) {
            defaults.dimensions = 768;
        }
        // Models with 512 in the name
        else if (normalizedName.includes('512')) {
            defaults.dimensions = 512;
        }
        // MiniLM and other 384-dimensional models (default)
        else if (normalizedName.includes('384') || normalizedName.includes('minilm')) {
            defaults.dimensions = 384;
        }
    }
    return defaults;
}
/**
 * Default core configuration object
 * Model-agnostic settings that can be used by core modules
 */
export const config = {
    chunk_size: parseInt(process.env.RAG_CHUNK_SIZE || '250', 10),
    chunk_overlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '50', 10),
    batch_size: parseInt(process.env.RAG_BATCH_SIZE || '16', 10),
    top_k: parseInt(process.env.RAG_TOP_K || '10', 10),
    db_file: process.env.RAG_DB_FILE || 'db.sqlite',
    index_file: process.env.RAG_INDEX_FILE || 'vector-index.bin',
    model_cache_path: process.env.RAG_MODEL_CACHE_PATH || getDefaultModelCachePath(),
    path_storage_strategy: process.env.RAG_PATH_STORAGE_STRATEGY || 'relative',
    embedding_model: process.env.RAG_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    rerank_enabled: process.env.RAG_RERANK_ENABLED === 'true',
    preprocessing: { mode: 'balanced' }
};
/**
 * Validate preprocessing configuration
 */
export function validatePreprocessingConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new ConfigurationError('Preprocessing configuration must be an object');
    }
    if (!config.mode || !['strict', 'balanced', 'rich'].includes(config.mode)) {
        throw new ConfigurationError('preprocessing.mode must be one of: strict, balanced, rich');
    }
    // Validate overrides if present
    if (config.overrides !== undefined) {
        if (!config.overrides || typeof config.overrides !== 'object') {
            throw new ConfigurationError('preprocessing.overrides must be an object when provided');
        }
        const validValues = ['strip', 'keep', 'placeholder', 'extract'];
        // Validate MDX override
        if (config.overrides.mdx !== undefined && !validValues.includes(config.overrides.mdx)) {
            throw new ConfigurationError('preprocessing.overrides.mdx must be one of: strip, keep, placeholder');
        }
        // Validate Mermaid override
        if (config.overrides.mermaid !== undefined && !validValues.includes(config.overrides.mermaid)) {
            throw new ConfigurationError('preprocessing.overrides.mermaid must be one of: strip, keep, placeholder, extract');
        }
        // Validate code override
        if (config.overrides.code !== undefined && !validValues.includes(config.overrides.code)) {
            throw new ConfigurationError('preprocessing.overrides.code must be one of: strip, keep, placeholder');
        }
    }
}
/**
 * Merge preprocessing configurations with mode defaults
 */
export function mergePreprocessingConfig(config) {
    const modeDefaults = {
        strict: { mdx: 'strip', mermaid: 'strip', code: 'strip' },
        balanced: { mdx: 'placeholder', mermaid: 'placeholder', code: 'keep' },
        rich: { mdx: 'keep', mermaid: 'extract', code: 'keep' }
    };
    const defaults = modeDefaults[config.mode] || modeDefaults.balanced;
    return {
        ...defaults,
        ...config.overrides
    };
}
/**
 * Utility function to handle unrecoverable errors with descriptive messages
 * Logs error and exits immediately with appropriate exit code
 * @param error - Error object or message
 * @param context - Context where the error occurred
 * @param exitCode - Exit code to use (defaults to GENERAL_ERROR)
 */
export function handleUnrecoverableError(error, context, exitCode = EXIT_CODES.GENERAL_ERROR) {
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
export function logError(error, context, skipError = false) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (skipError) {
        console.error(`Warning in ${context}: ${errorMessage} (skipping and continuing)`);
    }
    else {
        console.error(`Error in ${context}: ${errorMessage}`);
    }
}
