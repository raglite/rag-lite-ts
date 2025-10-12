/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 * 
 * This module provides adapter utilities to convert existing implementations to the new
 * dependency injection interfaces. These adapters enable:
 * 
 * 1. Integration with existing embedding and reranking implementations
 * 2. Support for dependency injection patterns
 * 3. Wrapping of third-party libraries to match core interfaces
 * 4. Testing with mock implementations
 * 
 * ADAPTER PATTERN USAGE:
 * ```typescript
 * // Convert embedder to dependency injection
 * const embedder = new TextEmbeddingEngine();
 * const embedFn = EmbeddingAdapter.fromEmbedder(embedder);
 * const search = new SearchEngine(embedFn, indexManager, db);
 * 
 * // Convert reranker to dependency injection
 * const reranker = new CrossEncoderReranker();
 * const rerankFn = RerankingAdapter.fromReranker(reranker);
 * const search = new SearchEngine(embedFn, indexManager, db, rerankFn);
 * 
 * // Create full interfaces for advanced usage
 * const embeddingInterface = EmbeddingAdapter.createInterface(
 *   embedder, 
 *   ['text'], 
 *   384, 
 *   'all-MiniLM-L6-v2'
 * );
 * ```
 */

import type { 
  EmbedFunction, 
  RerankFunction, 
  EmbeddingQueryInterface, 
  RerankingInterface,
  SearchDependencyFactory 
} from './interfaces.js';
import type { SearchResult, EmbeddingResult } from './types.js';

/**
 * Adapter to convert embedding engines to core EmbedFunction
 * Enables integration while supporting dependency injection
 * 
 * USAGE EXAMPLES:
 * ```typescript
 * // Basic adapter usage
 * const embedder = new TextEmbeddingEngine();
 * const embedFn = EmbeddingAdapter.fromEmbedder(embedder);
 * 
 * // Use in SearchEngine
 * const search = new SearchEngine(embedFn, indexManager, db);
 * 
 * // Create full interface for advanced features
 * const embeddingInterface = EmbeddingAdapter.createInterface(
 *   embedder,
 *   ['text', 'code'],  // Supported content types
 *   384,               // Embedding dimensions
 *   'all-MiniLM-L6-v2' // Model identifier
 * );
 * 
 * // Use interface for validation and metadata
 * if (embeddingInterface.supportedContentTypes.includes('text')) {
 *   const result = await embeddingInterface.embedQuery('test query');
 * }
 * ```
 */
export class EmbeddingAdapter {
  /**
   * Convert an embedding engine to an EmbedFunction
   * @param embedder - Embedder with embedSingle method
   * @returns EmbedFunction compatible with core dependency injection
   */
  static fromEmbedder(embedder: any): EmbedFunction {
    return async (query: string, contentType?: string): Promise<EmbeddingResult> => {
      // Call the embedSingle method
      return await embedder.embedSingle(query);
    };
  }
  
  /**
   * Create an EmbeddingQueryInterface from an embedder
   * @param embedder - Embedder with embedSingle method
   * @param supportedContentTypes - Content types this embedder supports
   * @param embeddingDimensions - Dimensions of embedding vectors
   * @param modelIdentifier - Model name or identifier
   * @returns Full EmbeddingQueryInterface with metadata
   */
  static createInterface(
    embedder: any, 
    supportedContentTypes: string[] = ['text'],
    embeddingDimensions: number = 384,
    modelIdentifier: string = 'unknown'
  ): EmbeddingQueryInterface {
    return {
      embedQuery: this.fromEmbedder(embedder),
      supportedContentTypes,
      embeddingDimensions,
      modelIdentifier
    };
  }
}

/**
 * Adapter to convert rerankers to core RerankFunction
 * Enables integration while supporting dependency injection
 */
export class RerankingAdapter {
  /**
   * Convert a reranker to a RerankFunction
   */
  static fromReranker(reranker: any): RerankFunction {
    return async (
      query: string, 
      results: SearchResult[], 
      contentType?: string
    ): Promise<SearchResult[]> => {
      // Convert core SearchResult format to reranker format
      const rerankResults = results.map(result => ({
        text: result.content,
        score: result.score,
        document: {
          id: result.document.id,
          source: result.document.source,
          title: result.document.title
        }
      }));
      
      // Call rerank method
      const reranked = await reranker.rerank(query, rerankResults);
      
      // Convert back to core SearchResult format
      return reranked.map((result: any, index: number) => ({
        content: result.text,
        score: result.score,
        contentType: results[index]?.contentType || 'text',
        document: {
          id: result.document.id,
          source: result.document.source,
          title: result.document.title,
          contentType: results[index]?.document.contentType || 'text'
        },
        metadata: results[index]?.metadata
      }));
    };
  }
  
  /**
   * Create a RerankingInterface from a reranker
   */
  static createInterface(
    reranker: any,
    supportedContentTypes: string[] = ['text'],
    modelIdentifier: string = 'unknown'
  ): RerankingInterface {
    return {
      rerankResults: this.fromReranker(reranker),
      supportedContentTypes,
      isEnabled: reranker && reranker.isLoaded && reranker.isLoaded(),
      modelIdentifier
    };
  }
}



