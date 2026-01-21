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
export { IngestionFactory, SearchFactory } from './factories/index.js';
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
export { LazyEmbedderLoader, LazyRerankerLoader, LazyMultimodalLoader, LazyDependencyManager } from './core/lazy-dependency-loader.js';
// Interface validation utilities
export { InterfaceValidator } from './core/interfaces.js';
// Mode-model compatibility validation
export { validateModeModelCompatibility, validateModeModelCompatibilityOrThrow, getRecommendedModelsForMode, isModeModelCompatible, getCompatibleModelsForMode } from './core/mode-model-validator.js';
// Actionable error messages
export { createMissingFileError, createInvalidPathError, createModelLoadingError, createDimensionMismatchError, createModeMismatchError, createInvalidContentError, createMissingDependencyError, createFactoryCreationError, enhanceError, createContextualError } from './core/actionable-error-messages.js';
// =============================================================================
// TEXT IMPLEMENTATIONS (FOR CUSTOM DEPENDENCY INJECTION)
// =============================================================================
// Text-specific embedding implementations
export { EmbeddingEngine, getEmbeddingEngine, initializeEmbeddingEngine, createTextEmbedFunction } from './text/embedder.js';
export { CLIPEmbedder } from './multimodal/clip-embedder.js';
export { createEmbedder } from './core/embedder-factory.js';
// Text-specific reranking implementations
export { CrossEncoderReranker, createTextRerankFunction } from './text/reranker.js';
// Text tokenization utilities
export { countTokens } from './text/tokenizer.js';
export { validateRerankingStrategy, validateRerankingConfig, getDefaultRerankingConfig, isStrategySupported, getSupportedStrategies, RerankingConfigBuilder, DEFAULT_TEXT_RERANKING_CONFIG, DEFAULT_MULTIMODAL_RERANKING_CONFIG } from './core/reranking-config.js';
// =============================================================================
// CORE INFRASTRUCTURE (FOR ADVANCED USERS)
// =============================================================================
// Database operations
export { openDatabase, initializeSchema, insertDocument, insertChunk, upsertDocument, getChunksByEmbeddingIds } from './core/db.js';
// Vector index management
export { IndexManager } from './index-manager.js';
export { VectorIndex } from './core/vector-index.js';
// Configuration and utilities
export { config, getModelDefaults, EXIT_CODES, ConfigurationError, getDefaultModelCachePath, handleUnrecoverableError, logError } from './core/config.js';
// =============================================================================
// FILE PROCESSING AND UTILITIES
// =============================================================================
// File processing operations
export { discoverFiles, processFiles, discoverAndProcessFiles, DEFAULT_FILE_PROCESSOR_OPTIONS } from './file-processor.js';
// Document chunking
export { chunkDocument } from './core/chunker.js';
// Path management
export { DocumentPathManager } from './core/path-manager.js';
// RAG-lite directory structure management
export { resolveRagLitePaths, ensureRagLiteStructure, migrateToRagLiteStructure, getStandardRagLitePaths } from './core/raglite-paths.js';
// =============================================================================
// ERROR HANDLING
// =============================================================================
// Core error handling
export { handleError, safeExecute, ErrorCategory, ErrorSeverity, createError } from './core/error-handler.js';
// API-specific errors
export { APIError, IngestionError, SearchError, ResourceError, ModelCompatibilityError, ErrorFactory, CommonErrors, handleAPIError } from './api-errors.js';
