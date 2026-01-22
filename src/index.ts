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
  IngestionFactory,
  SearchFactory
} from './factories/index.js';

// Factory option types
export type {
  IngestionFactoryOptions
} from './factories/index.js';

// =============================================================================
// REMOVED IN v3.0.0: Type aliases
// =============================================================================
// IngestionPipelineOptions has been removed. Use IngestionFactoryOptions directly.
// Migration: Replace IngestionPipelineOptions with IngestionFactoryOptions

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

// Mode-model compatibility validation
export {
  validateModeModelCompatibility,
  validateModeModelCompatibilityOrThrow,
  getRecommendedModelsForMode,
  isModeModelCompatible,
  getCompatibleModelsForMode,
  type ModeModelValidationResult
} from './core/mode-model-validator.js';

// Actionable error messages
export {
  createMissingFileError,
  createInvalidPathError,
  createModelLoadingError,
  createDimensionMismatchError,
  createModeMismatchError,
  createInvalidContentError,
  createMissingDependencyError,
  createFactoryCreationError,
  enhanceError,
  createContextualError,
  type ActionableErrorConfig
} from './core/actionable-error-messages.js';

// =============================================================================
// TEXT IMPLEMENTATIONS (FOR CUSTOM DEPENDENCY INJECTION)
// =============================================================================

// Text-specific embedding implementations
export {
  EmbeddingEngine,
  getEmbeddingEngine,
  initializeEmbeddingEngine,
  createTextEmbedFunction
} from './text/embedder.js';

// =============================================================================
// MULTIMODAL IMPLEMENTATIONS (FOR CLIP AND CROSS-MODAL SEARCH)
// =============================================================================

// Universal embedder interface and implementations
// Note: The actual CLIP embedder implementation is in src/multimodal/clip-embedder.ts
// and is accessed through the embedder factory (createEmbedder function)
export type { UniversalEmbedder } from './core/universal-embedder.js';
export { CLIPEmbedder } from './multimodal/clip-embedder.js';
export { createEmbedder } from './core/embedder-factory.js';

// Text-specific reranking implementations
export {
  CrossEncoderReranker,
  createTextRerankFunction
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
  resetDatabase,
  hasDatabaseData,
  type DatabaseConnection,
  type DatabaseResetOptions,
  type DatabaseResetResult
} from './core/db.js';

// Knowledge Base Manager (for reset operations)
export {
  KnowledgeBaseManager,
  type KnowledgeBaseResetOptions,
  type KnowledgeBaseResetResult
} from './core/knowledge-base-manager.js';

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