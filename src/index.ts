// Main entry point for rag-lite-ts

// Core API classes (simple interface matching README)
export { SearchEngine } from './search.js';
export { IngestionPipeline } from './ingestion.js';

// Embedding operations (required for README examples)
export { 
  EmbeddingEngine, 
  getEmbeddingEngine, 
  initializeEmbeddingEngine 
} from './embedder.js';

// Configuration (documented in README API reference)
export { config, validateConfig, getModelDefaults, type Config } from './config.js';

// Database operations (documented in README API reference)
export {
  openDatabase,
  initializeSchema,
  insertDocument,
  insertChunk,
  getChunksByEmbeddingIds,
  getModelVersion,
  setModelVersion,
  type DatabaseConnection,
  type ChunkResult
} from './db.js';

// File processing operations (documented in README API reference)
export {
  discoverFiles,
  processFiles,
  discoverAndProcessFiles,
  DEFAULT_FILE_PROCESSOR_OPTIONS,
  type FileProcessorOptions,
  type FileDiscoveryResult,
  type DocumentProcessingResult
} from './file-processor.js';

// Tokenization (documented in README API reference)
export { countTokens } from './tokenizer.js';

// Advanced/Internal operations (for backward compatibility and advanced use cases)
export { VectorIndex } from './vector-index.js';
export { IndexManager } from './index-manager.js';
export { ResourceManager } from './resource-manager.js';

// Error handling
export {
  APIError,
  IngestionError,
  SearchError,
  ResourceError,
  ModelCompatibilityError,
  ErrorFactory,
  CommonErrors,
  handleAPIError
} from './api-errors.js';

// Type definitions (documented in README API reference)
export type { 
  SearchResult, 
  SearchOptions, 
  Chunk, 
  Document, 
  EmbeddingResult,
  Preprocessor,
  PreprocessorOptions,
  PreprocessingConfig
} from './types.js';