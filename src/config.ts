/**
 * Main configuration file with text-specific settings
 * Extends core configuration with implementation-specific properties
 */

import { CoreConfig, ExtensibleConfig, getDefaultModelCachePath } from './core/config.js';
import { createRequire } from 'module';

// Create require for CommonJS modules in ES module context
const require = createRequire(import.meta.url);

/**
 * Text-specific configuration properties
 */
export interface TextConfig {
  embedding_model: string;
  rerank_enabled: boolean;
  rerank_model: string;
  preprocessing: {
    enabled: boolean;
    mdx: boolean;
    mermaid: boolean;
    code_blocks: boolean;
  };
}

/**
 * Complete configuration interface combining core and text-specific settings
 */
export interface Config extends CoreConfig {
  embedding_model: string;
  rerank_enabled: boolean;
  rerank_model: string;
  preprocessing: {
    enabled: boolean;
    mdx: boolean;
    mermaid: boolean;
    code_blocks: boolean;
  };
}

/**
 * Default configuration object with both core and text-specific settings
 */
export const config: Config = {
  // Core settings
  chunk_size: parseInt(process.env.RAG_CHUNK_SIZE || '250', 10),
  chunk_overlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '50', 10),
  batch_size: parseInt(process.env.RAG_BATCH_SIZE || '16', 10),
  top_k: parseInt(process.env.RAG_TOP_K || '10', 10),
  db_file: process.env.RAG_DB_FILE || 'db.sqlite',
  index_file: process.env.RAG_INDEX_FILE || 'vector-index.bin',
  model_cache_path: process.env.RAG_MODEL_CACHE_PATH || getDefaultModelCachePath(),
  path_storage_strategy: (process.env.RAG_PATH_STORAGE_STRATEGY as 'absolute' | 'relative') || 'relative',
  
  // Text-specific settings
  embedding_model: process.env.RAG_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  rerank_enabled: process.env.RAG_RERANK_ENABLED !== 'false', // Default to true unless explicitly disabled
  rerank_model: process.env.RAG_RERANK_MODEL || 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  
  // Preprocessing settings
  preprocessing: {
    enabled: process.env.RAG_PREPROCESSING_ENABLED !== 'false',
    mdx: process.env.RAG_PREPROCESSING_MDX !== 'false',
    mermaid: process.env.RAG_PREPROCESSING_MERMAID !== 'false',
    code_blocks: process.env.RAG_PREPROCESSING_CODE_BLOCKS !== 'false'
  }
};

// Re-export everything from core config
export * from './core/config.js';

/**
 * Validate complete configuration including text-specific settings
 */
export function validateConfig(config: any): asserts config is Config {
  // First validate core config
  const { validateCoreConfig } = require('./core/config.js');
  validateCoreConfig(config);
  
  // Validate text-specific settings
  if (!config.embedding_model || typeof config.embedding_model !== 'string') {
    throw new Error('embedding_model must be a non-empty string');
  }
  
  if (typeof config.rerank_enabled !== 'boolean') {
    throw new Error('rerank_enabled must be a boolean');
  }
  
  if (!config.rerank_model || typeof config.rerank_model !== 'string') {
    throw new Error('rerank_model must be a non-empty string');
  }
  
  if (!config.preprocessing || typeof config.preprocessing !== 'object') {
    throw new Error('preprocessing must be an object');
  }
}

/**
 * Validate preprocessing configuration
 */
export function validatePreprocessingConfig(config: any): boolean {
  return config && 
         typeof config === 'object' &&
         typeof config.enabled === 'boolean' &&
         typeof config.mdx === 'boolean' &&
         typeof config.mermaid === 'boolean' &&
         typeof config.code_blocks === 'boolean';
}

/**
 * Merge preprocessing configurations
 */
export function mergePreprocessingConfig(base: any, override: any): any {
  return {
    enabled: override.enabled !== undefined ? override.enabled : base.enabled,
    mdx: override.mdx !== undefined ? override.mdx : base.mdx,
    mermaid: override.mermaid !== undefined ? override.mermaid : base.mermaid,
    code_blocks: override.code_blocks !== undefined ? override.code_blocks : base.code_blocks
  };
}