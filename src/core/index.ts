/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 * 
 * This module provides the clean re-export surface for the core layer, enabling
 * dependency injection patterns for different implementations (text-only, multimodal, etc.).
 * 
 * DEPENDENCY INJECTION ARCHITECTURE:
 * 
 * The core layer uses explicit dependency injection to maintain clean separation between
 * model-agnostic logic and implementation-specific components:
 * 
 * 1. Core Classes (SearchEngine, IngestionPipeline):
 *    - Accept injected functions (EmbedFunction, RerankFunction) in constructors
 *    - Coordinate model-agnostic operations (database, vector index, search pipeline)
 *    - No knowledge of specific embedding models or transformers
 * 
 * 2. Dependency Injection Interfaces:
 *    - EmbedFunction: (query: string, contentType?: string) => Promise<EmbeddingResult>
 *    - RerankFunction: (query: string, results: SearchResult[], contentType?: string) => Promise<SearchResult[]>
 *    - Support different content types (text, image, etc.) and embedding dimensions
 * 
 * 3. Usage Patterns:
 * 
 *    // Direct dependency injection (advanced users)
 *    const embedFn = await createTextEmbedder();
 *    const rerankFn = await createTextReranker();
 *    const indexManager = new IndexManager('./index.bin');
 *    const db = await openDatabase('./db.sqlite');
 *    const search = new SearchEngine(embedFn, indexManager, db, rerankFn);
 * 
 *    // Factory pattern (recommended for common use cases)
 *    const search = await TextSearchFactory.create('./index.bin', './db.sqlite');
 * 
 * 4. Extension Points:
 *    - New implementations (multimodal, custom models) implement the same interfaces
 *    - Core classes remain unchanged when adding new modalities
 *    - Plugin architecture enabled through interface-based design
 * 
 * 5. Benefits:
 *    - Clean separation of concerns
 *    - Testability through mock injection
 *    - Future extensibility without core changes
 *    - Support for different embedding dimensions and content types
 */

// Core types and interfaces - foundation for dependency injection
export { 
  type ContentDocument,
  type ContentChunk,
  type Document,
  type Chunk,
  type EmbeddingResult,
  type SearchResult,
  type SearchOptions,

} from './types.js';

// Dependency injection interfaces and utilities
export { 
  type EmbedFunction,
  type RerankFunction,
  type EmbeddingQueryInterface,
  type RerankingInterface,
  type SearchEngineConfig,
  type ContentTypeStrategy,
  type ModelAgnosticInterface,
  type ExtendedEmbeddingInterface,
  type ExtendedRerankingInterface,
  type SearchPipelineInterface,
  type SearchDependencyFactory,
  InterfaceValidator
} from './interfaces.js';

// Adapter utilities for converting implementations to dependency injection
export * from './adapters.js';

// Core configuration management - model-agnostic settings
export * from './config.js';

// Database operations - supports different content types through metadata
export { 
  type DatabaseConnection,
  type ContentMetadata,
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
  insertContentMetadata,
  getContentMetadata,
  getContentMetadataByHash,
  getContentMetadataByStorageType,
  deleteContentMetadata,
  getStorageStats,
  updateStorageStats
} from './db.js';

// Vector index operations - works with any embedding dimensions
export { 
  type VectorIndexOptions,
  VectorIndex
} from './vector-index.js';

// Generic chunking interfaces and strategies - supports text, image metadata, etc.
export { 
  type ChunkConfig,
  type GenericDocument,
  type GenericChunk,
  type ChunkingStrategy,
  ChunkingStrategyRegistry,
  DEFAULT_CHUNK_CONFIG,
  chunkingRegistry,
  chunkGenericDocument,
  registerTextChunkingStrategy
} from './chunker.js';

// Core search engine - uses dependency injection for embedding and reranking
export * from './search.js';

// Core ingestion pipeline - uses dependency injection for embedding
export * from './ingestion.js';

// Path management utilities - content-type agnostic
export * from './path-manager.js';

// Unified content system - handles both filesystem and memory content
export { 
  ContentManager,
  type MemoryContentMetadata,
  type ContentIngestionResult,
  type ContentManagerConfig
} from './content-manager.js';

export {
  ContentResolver,
  type ContentRequest,
  type ContentResult
} from './content-resolver.js';

// Error handling framework - supports implementation-specific error contexts
export * from './error-handler.js';