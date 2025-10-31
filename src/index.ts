/**
 * rag-lite-ts - Clean Architecture with Factory Pattern
 * 
 * Quick Start (Recommended):
 * ```typescript
 * import { SearchFactory, IngestionFactory } from 'rag-lite-ts';
 * 
 * // Simple search - just works!
 * const search = await SearchFactory.create('./index.bin', './db.sqlite');
 * const results = await search.search('your query');
 * 
 * // Simple ingestion - just works!
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin');
 * await ingestion.ingestDirectory('./documents');
 * ```
 * 
 * With Configuration:
 * ```typescript
 * const search = await SearchFactory.create('./index.bin', './db.sqlite', {
 *   embeddingModel: 'Xenova/all-mpnet-base-v2',
 *   enableReranking: true
 * });
 * ```
 * 
 * Complete RAG System:
 * ```typescript
 * import { RAGFactory } from 'rag-lite-ts';
 * 
 * const { searchEngine, ingestionPipeline } = await RAGFactory.createBoth(
 *   './index.bin', 
 *   './db.sqlite'
 * );
 * ```
 * 
 * Advanced Usage (Direct Dependency Injection):
 * ```typescript
 * import { CoreSearchEngine, createTextEmbedFunction } from 'rag-lite-ts';
 * 
 * const embedFn = await createTextEmbedFunction();
 * const search = new CoreSearchEngine(embedFn, indexManager, db);
 * ```
 */

// =============================================================================
// PRIMARY API (FACTORY PATTERN)
// =============================================================================

// Main factory classes for simple usage
export {
  TextSearchFactory,
  TextIngestionFactory,
  TextRAGFactory,
  TextFactoryHelpers
} from './factories/index.js';

// Convenience aliases for common usage
export {
  TextSearchFactory as SearchFactory,
  TextIngestionFactory as IngestionFactory,
  TextRAGFactory as RAGFactory
} from './factories/index.js';

// Factory option types
export type {
  TextSearchOptions,
  TextIngestionOptions
} from './factories/index.js';

// Backward compatibility type aliases
export type {
  TextSearchOptions as SearchEngineOptions,
  TextIngestionOptions as IngestionPipelineOptions
} from './factories/index.js';

// =============================================================================
// CORE ARCHITECTURE (FOR LIBRARY AUTHORS)
// =============================================================================

// Core classes for direct dependency injection (advanced)
export { SearchEngine as CoreSearchEngine } from './core/search.js';
export { IngestionPipeline as CoreIngestionPipeline } from './core/ingestion.js';

// Public API classes
export { SearchEngine } from './search.js';
export { IngestionPipeline } from './ingestion.js';

// Lazy loading system for performance optimization
export {
  LazyEmbedderLoader,
  LazyRerankerLoader,
  LazyMultimodalLoader,
  LazyDependencyManager
} from './core/lazy-dependency-loader.js';

// Core interfaces for dependency injection
export type {
  EmbedFunction,
  RerankFunction,
  EmbeddingQueryInterface,
  RerankingInterface,
  SearchEngineConfig,
  ContentTypeStrategy,
  ModelAgnosticInterface,
  ExtendedEmbeddingInterface,
  ExtendedRerankingInterface,
  SearchPipelineInterface,
  SearchDependencyFactory
} from './core/interfaces.js';

// Interface validation utilities
export { InterfaceValidator } from './core/interfaces.js';

// =============================================================================
// TEXT IMPLEMENTATIONS (FOR CUSTOM DEPENDENCY INJECTION)
// =============================================================================

// Text-specific embedding implementations
export {
  EmbeddingEngine,
  getEmbeddingEngine,
  initializeEmbeddingEngine,
  createTextEmbedFunction,
  createTextEmbedder
} from './text/embedder.js';

// Text-specific reranking implementations
export {
  CrossEncoderReranker,
  createTextRerankFunction,
  createTextReranker
} from './text/reranker.js';

// Text tokenization utilities
export { countTokens } from './text/tokenizer.js';

// Reranking configuration system
export type {
  RerankingStrategyType,
  RerankingConfig
} from './core/reranking-config.js';

export {
  validateRerankingStrategy,
  validateRerankingConfig,
  getDefaultRerankingConfig,
  isStrategySupported,
  getSupportedStrategies,
  RerankingConfigBuilder,
  DEFAULT_TEXT_RERANKING_CONFIG,
  DEFAULT_MULTIMODAL_RERANKING_CONFIG
} from './core/reranking-config.js';

// =============================================================================
// CORE INFRASTRUCTURE (FOR ADVANCED USERS)
// =============================================================================

// Database operations
export {
  openDatabase,
  initializeSchema,
  insertDocument,
  insertChunk,
  upsertDocument,
  getChunksByEmbeddingIds,
  getModelVersion,
  setModelVersion,
  getStoredModelInfo,
  setStoredModelInfo,
  type DatabaseConnection
} from './core/db.js';

// Vector index management
export { IndexManager } from './index-manager.js';
export { VectorIndex } from './core/vector-index.js';

// Configuration and utilities
export { 
  config,
  getModelDefaults,
  type CoreConfig,
  type ExtensibleConfig,
  type ModelDefaults,
  EXIT_CODES,
  ConfigurationError,
  getDefaultModelCachePath,
  handleUnrecoverableError,
  logError
} from './core/config.js';

// =============================================================================
// FILE PROCESSING AND UTILITIES
// =============================================================================

// File processing operations
export {
  discoverFiles,
  processFiles,
  discoverAndProcessFiles,
  DEFAULT_FILE_PROCESSOR_OPTIONS,
  type FileProcessorOptions,
  type FileDiscoveryResult,
  type DocumentProcessingResult
} from './file-processor.js';

// Document chunking
export { chunkDocument, type ChunkConfig } from './core/chunker.js';

// Path management
export { DocumentPathManager } from './core/path-manager.js';

// RAG-lite directory structure management
export {
  resolveRagLitePaths,
  ensureRagLiteStructure,
  migrateToRagLiteStructure,
  getStandardRagLitePaths,
  type RagLiteConfig,
  type RagLitePaths
} from './core/raglite-paths.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Core types
export type {
  SearchResult,
  SearchOptions,
  Document,
  EmbeddingResult,
  ContentDocument,
  ContentChunk
} from './core/types.js';

// Core types
export type {
  Chunk,
  Preprocessor,
  PreprocessorOptions,
  PreprocessingConfig
} from './types.js';

// Ingestion types
export type {
  IngestionOptions,
  IngestionResult
} from './core/ingestion.js';

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Core error handling
export {
  handleError,
  safeExecute,
  ErrorCategory,
  ErrorSeverity,
  createError,
  type ErrorContext
} from './core/error-handler.js';

// API-specific errors
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