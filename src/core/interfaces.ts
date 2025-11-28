/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 * 
 * This module defines the core interfaces for dependency injection in the search engine.
 * These interfaces enable:
 * 1. Different embedding implementations (text-only, multimodal, etc.)
 * 2. Different reranking strategies (cross-encoder, neural, etc.)
 * 3. Support for multiple content types (text, image, etc.)
 * 4. Different embedding dimensions (384, 512, 768, etc.)
 * 
 * DEPENDENCY INJECTION PATTERNS:
 * 
 * 1. Direct Function Injection (Advanced Users):
 * ```typescript
 * // Text-only implementation
 * const textEmbedFn: EmbedFunction = async (query) => textEmbedder.embedSingle(query);
 * const textRerankFn: RerankFunction = async (query, results) => textReranker.rerank(query, results);
 * const search = new SearchEngine(textEmbedFn, indexManager, db, textRerankFn);
 * 
 * // Custom implementation
 * const customEmbedFn: EmbedFunction = async (query) => ({
 *   embedding_id: generateId(),
 *   vector: await myCustomModel.embed(query)
 * });
 * const search = new SearchEngine(customEmbedFn, indexManager, db);
 * ```
 * 
 * 2. Factory Pattern (Recommended for Common Use Cases):
 * ```typescript
 * // Using factory for convenience
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   enableReranking: true
 * });
 * 
 * // Factory with custom configuration
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
 *   chunkSize: 300,
 *   chunkOverlap: 50
 * });
 * ```
 * 
 * 3. Interface-Based Implementation (Plugin Architecture):
 * ```typescript
 * // Implement interfaces for custom behavior
 * class CustomEmbeddingInterface implements EmbeddingQueryInterface {
 *   async embedQuery(query: string): Promise<EmbeddingResult> {
 *     return { embedding_id: generateId(), vector: await this.model.embed(query) };
 *   }
 *   supportedContentTypes = ['text', 'code'];
 *   embeddingDimensions = 384;
 *   modelIdentifier = 'custom-model-v1';
 * }
 * 
 * const customInterface = new CustomEmbeddingInterface();
 * const embedFn = customInterface.embedQuery.bind(customInterface);
 * const search = new SearchEngine(embedFn, indexManager, db);
 * ```
 * 
 * 4. Multimodal Implementation (Future):
 * ```typescript
 * // Multimodal embedding function
 * const multimodalEmbedFn: EmbedFunction = async (query, contentType) => {
 *   if (contentType === 'image') return clipEmbedder.embedImage(query);
 *   return clipEmbedder.embedText(query);
 * };
 * 
 * // Multimodal reranking function
 * const multimodalRerankFn: RerankFunction = async (query, results, contentType) => {
 *   return multimodalReranker.rerank(query, results, contentType);
 * };
 * 
 * const search = new SearchEngine(multimodalEmbedFn, indexManager, db, multimodalRerankFn);
 * ```
 */

import type { SearchResult, EmbeddingResult } from './types.js';

/**
 * Core embedding function interface for dependency injection
 * Supports different content types and embedding dimensions (384, 512, 768, etc.)
 */
export type EmbedFunction = (query: string, contentType?: string) => Promise<EmbeddingResult>;

/**
 * Core reranking function interface for dependency injection
 * Supports different content types and query-result pairs
 */
export type RerankFunction = (
  query: string, 
  results: SearchResult[], 
  contentType?: string
) => Promise<SearchResult[]>;

/**
 * Interface for embedding query operations
 * Enables dependency injection of different embedding implementations
 * 
 * This interface provides a standardized way to interact with different
 * embedding models while maintaining compatibility checking and metadata.
 * Implementations can be text-only, multimodal, or custom models.
 * 
 * @example
 * ```typescript
 * // Text embedding implementation
 * class TextEmbeddingInterface implements EmbeddingQueryInterface {
 *   embedQuery = async (query: string) => textEmbedder.embedSingle(query);
 *   supportedContentTypes = ['text', 'code'];
 *   embeddingDimensions = 384;
 *   modelIdentifier = 'all-MiniLM-L6-v2';
 * }
 * 
 * // Use with SearchEngine
 * const embeddingInterface = new TextEmbeddingInterface();
 * const embedFn = embeddingInterface.embedQuery.bind(embeddingInterface);
 * const search = new SearchEngine(embedFn, indexManager, db);
 * ```
 */
export interface EmbeddingQueryInterface {
  /**
   * Function to embed a query string into a vector
   * Should handle the specific content types listed in supportedContentTypes
   */
  embedQuery: EmbedFunction;
  
  /**
   * Content types this embedder supports (e.g., ['text'], ['text', 'image'])
   * Used for validation and routing of different content types
   */
  supportedContentTypes: string[];
  
  /**
   * Dimensions of the embedding vectors this embedder produces
   * Must match the vector index dimensions for compatibility
   */
  embeddingDimensions: number;
  
  /**
   * Model name or identifier for compatibility checking
   * Used to ensure consistent model usage across sessions
   */
  modelIdentifier: string;
}

/**
 * Interface for reranking operations
 * Enables dependency injection of different reranking implementations
 * 
 * This interface provides a standardized way to interact with different
 * reranking models. Reranking improves search quality by re-scoring
 * initial search results using more sophisticated models.
 * 
 * @example
 * ```typescript
 * // Text reranking implementation
 * class TextRerankingInterface implements RerankingInterface {
 *   rerankResults = async (query: string, results: SearchResult[]) => 
 *     textReranker.rerank(query, results);
 *   supportedContentTypes = ['text'];
 *   isEnabled = true;
 *   modelIdentifier = 'cross-encoder/ms-marco-MiniLM-L-6-v2';
 * }
 * 
 * // Use with SearchEngine
 * const rerankingInterface = new TextRerankingInterface();
 * const rerankFn = rerankingInterface.rerankResults.bind(rerankingInterface);
 * const search = new SearchEngine(embedFn, indexManager, db, rerankFn);
 * ```
 */
export interface RerankingInterface {
  /**
   * Function to rerank search results
   * Takes a query and initial results, returns reordered results with updated scores
   */
  rerankResults: RerankFunction;
  
  /**
   * Content types this reranker supports
   * Should match or be a subset of the embedding interface content types
   */
  supportedContentTypes: string[];
  
  /**
   * Whether reranking is currently enabled and available
   * Can be used to gracefully disable reranking if models fail to load
   */
  isEnabled: boolean;
  
  /**
   * Model name or identifier for the reranking model
   * Used for logging and compatibility tracking
   */
  modelIdentifier: string;
}

/**
 * Configuration interface for search engine dependency injection
 * Allows different implementations to be plugged in with optional settings
 * 
 * This interface provides a way to configure SearchEngine instances with
 * different embedding and reranking implementations, along with default
 * behaviors for content type handling and initialization.
 * 
 * @example
 * ```typescript
 * // Configuration with custom interfaces
 * const config: SearchEngineConfig = {
 *   embeddingInterface: new CustomEmbeddingInterface(),
 *   rerankingInterface: new CustomRerankingInterface(),
 *   defaultContentType: 'text',
 *   autoInitialize: true
 * };
 * 
 * // Use configuration (implementation-specific)
 * const search = new ConfigurableSearchEngine(config);
 * ```
 */
export interface SearchEngineConfig {
  /**
   * Optional embedding interface for dependency injection
   * If provided, will be used instead of direct function injection
   */
  embeddingInterface?: EmbeddingQueryInterface;
  
  /**
   * Optional reranking interface for dependency injection
   * If provided, will be used for result reranking
   */
  rerankingInterface?: RerankingInterface;
  
  /**
   * Default content type for queries when not specified
   * Used when content type cannot be inferred from context
   */
  defaultContentType?: string;
  
  /**
   * Whether to enable automatic initialization
   * When true, models and resources are loaded lazily on first use
   */
  autoInitialize?: boolean;
}

/**
 * Interface for content type strategies
 * Enables different handling for different content types
 */
export interface ContentTypeStrategy {
  /**
   * Content type this strategy handles
   */
  contentType: string;
  
  /**
   * Whether this strategy can handle the given content type
   */
  canHandle(contentType: string): boolean;
  
  /**
   * Process query for this content type before embedding
   */
  preprocessQuery?(query: string): string;
  
  /**
   * Post-process search results for this content type
   */
  postprocessResults?(results: SearchResult[]): SearchResult[];
}

/**
 * Generic interface for model-agnostic operations
 * Base interface that all model-specific implementations should extend
 */
export interface ModelAgnosticInterface {
  /**
   * Initialize the interface (load models, set up resources, etc.)
   */
  initialize(): Promise<void>;
  
  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
  
  /**
   * Check if the interface is ready for use
   */
  isReady(): boolean;
  
  /**
   * Get interface metadata
   */
  getMetadata(): {
    name: string;
    version: string;
    supportedContentTypes: string[];
  };
}

/**
 * Extended embedding interface that includes model-agnostic operations
 */
export interface ExtendedEmbeddingInterface extends EmbeddingQueryInterface, ModelAgnosticInterface {
  /**
   * Batch embed multiple queries for efficiency
   */
  embedBatch?(queries: string[], contentType?: string): Promise<EmbeddingResult[]>;
}

/**
 * Extended reranking interface that includes model-agnostic operations
 */
export interface ExtendedRerankingInterface extends RerankingInterface, ModelAgnosticInterface {
  /**
   * Batch rerank multiple query-result pairs for efficiency
   */
  rerankBatch?(
    queries: string[], 
    resultSets: SearchResult[][], 
    contentType?: string
  ): Promise<SearchResult[][]>;
}

/**
 * Interface for search pipeline coordination
 * Defines the core search pipeline steps that are model-agnostic
 */
export interface SearchPipelineInterface {
  /**
   * Step 1: Process and embed the query
   */
  embedQuery(query: string, contentType?: string): Promise<EmbeddingResult>;
  
  /**
   * Step 2: Perform vector search
   */
  vectorSearch(queryVector: Float32Array, topK: number): Promise<{
    embeddingIds: string[];
    distances: number[];
  }>;
  
  /**
   * Step 3: Retrieve metadata from database
   */
  retrieveMetadata(embeddingIds: string[]): Promise<any[]>;
  
  /**
   * Step 4: Format initial results
   */
  formatResults(chunks: any[], distances: number[], embeddingIds: string[]): SearchResult[];
  
  /**
   * Step 5: Optional reranking
   */
  rerankResults?(query: string, results: SearchResult[], contentType?: string): Promise<SearchResult[]>;
}

/**
 * Factory interface for creating embedding and reranking functions
 * Enables clean dependency injection patterns and simplifies common use cases
 * 
 * FACTORY PATTERN BENEFITS:
 * - Handles complex initialization logic (model loading, configuration)
 * - Provides simple API for common use cases
 * - Maintains access to underlying dependency injection architecture
 * - Supports different content types and embedding models
 * 
 * USAGE EXAMPLES:
 * ```typescript
 * // Text factory implementation
 * class TextSearchDependencyFactory implements SearchDependencyFactory {
 *   createEmbedFunction(contentType = 'text'): EmbedFunction {
 *     const embedder = new TextEmbeddingEngine();
 *     return async (query) => embedder.embedSingle(query);
 *   }
 * 
 *   createRerankFunction(contentType = 'text'): RerankFunction {
 *     const reranker = new CrossEncoderReranker();
 *     return async (query, results) => reranker.rerank(query, results);
 *   }
 * }
 * 
 * // Factory usage in practice
 * const factory = new TextSearchDependencyFactory();
 * const embedFn = factory.createEmbedFunction();
 * const rerankFn = factory.createRerankFunction();
 * const search = new SearchEngine(embedFn, indexManager, db, rerankFn);
 * 
 * // Multimodal factory (future)
 * class MultimodalSearchDependencyFactory implements SearchDependencyFactory {
 *   createEmbedFunction(contentType = 'text'): EmbedFunction {
 *     const clipModel = new CLIPEmbeddingEngine();
 *     return async (query, type) => {
 *       if (type === 'image') return clipModel.embedImage(query);
 *       return clipModel.embedText(query);
 *     };
 *   }
 * }
 * ```
 */
export interface SearchDependencyFactory {
  /**
   * Create an embedding function for the specified content type
   * @param contentType - Content type to create embedder for ('text', 'image', etc.)
   * @returns EmbedFunction that can handle the specified content type
   */
  createEmbedFunction(contentType?: string): EmbedFunction;
  
  /**
   * Create a reranking function for the specified content type
   * @param contentType - Content type to create reranker for ('text', 'image', etc.)
   * @returns RerankFunction for the content type, or undefined if not supported
   */
  createRerankFunction(contentType?: string): RerankFunction | undefined;
  
  /**
   * Get supported content types for this factory
   * @returns Array of supported content type strings
   */
  getSupportedContentTypes(): string[];
  
  /**
   * Get embedding dimensions for compatibility checking
   * @returns Number of dimensions in embedding vectors produced by this factory
   */
  getEmbeddingDimensions(): number;
}

/**
 * Validation utilities for interface compatibility
 */
export class InterfaceValidator {
  /**
   * Validate that an EmbedFunction is compatible with expected interface
   */
  static validateEmbedFunction(embedFn: EmbedFunction): boolean {
    return typeof embedFn === 'function';
  }
  
  /**
   * Validate that a RerankFunction is compatible with expected interface
   */
  static validateRerankFunction(rerankFn: RerankFunction): boolean {
    return typeof rerankFn === 'function';
  }
  
  /**
   * Validate embedding dimensions compatibility
   */
  static validateEmbeddingDimensions(
    expected: number, 
    actual: number
  ): boolean {
    return expected === actual;
  }
  
  /**
   * Validate content type support
   */
  static validateContentTypeSupport(
    supportedTypes: string[], 
    requestedType: string
  ): boolean {
    return supportedTypes.includes(requestedType);
  }
}