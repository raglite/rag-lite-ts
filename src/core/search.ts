/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

import { IndexManager } from '../index-manager.js';
import { DatabaseConnection, getChunksByEmbeddingIds } from './db.js';
import type { SearchResult, SearchOptions } from './types.js';
import type { EmbedFunction, RerankFunction } from './interfaces.js';
import { config } from './config.js';
import { createMissingDependencyError } from './actionable-error-messages.js';

/**
 * Search engine that provides semantic search capabilities
 * Implements the core search pipeline: query embedding → vector search → metadata retrieval → optional reranking
 * Uses explicit dependency injection for clean architecture
 */
export class SearchEngine {
  private contentResolver?: import('./content-resolver.js').ContentResolver;

  /**
   * Creates a new SearchEngine with explicit dependency injection
   * 
   * DEPENDENCY INJECTION PATTERN:
   * This constructor requires all dependencies to be explicitly provided, enabling:
   * - Clean separation between core logic and implementation-specific components
   * - Support for different embedding models (text-only, multimodal, custom)
   * - Testability through mock injection
   * - Future extensibility without core changes
   * 
   * @param embedFn - Function to embed queries into vectors
   *   - Signature: (query: string, contentType?: string) => Promise<EmbeddingResult>
   *   - Examples:
   *     - Text: const embedFn = (query) => textEmbedder.embedSingle(query)
   *     - Multimodal: const embedFn = (query, type) => type === 'image' ? clipEmbedder.embedImage(query) : clipEmbedder.embedText(query)
   *     - Custom: const embedFn = (query) => customModel.embed(query)
   * 
   * @param indexManager - Vector index manager for similarity search
   *   - Handles vector storage and retrieval operations
   *   - Works with any embedding dimensions (384, 512, 768, etc.)
   *   - Example: new IndexManager('./index.bin')
   * 
   * @param db - Database connection for metadata retrieval
   *   - Provides access to document and chunk metadata
   *   - Supports different content types through metadata fields
   *   - Example: await openDatabase('./db.sqlite')
   * 
   * @param rerankFn - Optional function to rerank search results
   *   - Signature: (query: string, results: SearchResult[], contentType?: string) => Promise<SearchResult[]>
   *   - Examples:
   *     - Text: const rerankFn = (query, results) => textReranker.rerank(query, results)
   *     - Custom: const rerankFn = (query, results) => customReranker.rerank(query, results)
   *     - Disabled: undefined (no reranking)
   * 
   * USAGE EXAMPLES:
   * ```typescript
   * // Text-only search engine
   * const textEmbedFn = createTextEmbedFunction();
   * const textRerankFn = createTextRerankFunction();
   * const indexManager = new IndexManager('./index.bin');
   * const db = await openDatabase('./db.sqlite');
   * const search = new SearchEngine(textEmbedFn, indexManager, db, textRerankFn);
   * 
   * // Search engine without reranking
   * const search = new SearchEngine(textEmbedFn, indexManager, db);
   * 
   * // Custom embedding implementation
   * const customEmbedFn = async (query) => ({ 
   *   embedding_id: generateId(), 
   *   vector: await myCustomModel.embed(query) 
   * });
   * const search = new SearchEngine(customEmbedFn, indexManager, db);
   * ```
   */
  constructor(
    private embedFn: EmbedFunction,
    private indexManager: IndexManager,
    private db: DatabaseConnection,
    private rerankFn?: RerankFunction,
    contentResolver?: import('./content-resolver.js').ContentResolver
  ) {
    // Validate required dependencies
    if (!embedFn || typeof embedFn !== 'function') {
      throw createMissingDependencyError('embedFn', 'function', {
        operationContext: 'SearchEngine constructor'
      });
    }
    if (!indexManager) {
      throw createMissingDependencyError('indexManager', 'object', {
        operationContext: 'SearchEngine constructor'
      });
    }
    if (!db) {
      throw createMissingDependencyError('db', 'object', {
        operationContext: 'SearchEngine constructor'
      });
    }
    
    // Initialize ContentResolver if provided, or create lazily when needed
    this.contentResolver = contentResolver;
  }

  /**
   * Perform semantic search on the indexed documents
   * Implements the core search pipeline: query embedding → vector search → metadata retrieval → optional reranking
   * @param query - Search query string
   * @param options - Search options including top_k and rerank settings
   * @returns Promise resolving to array of search results
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const startTime = performance.now();

    try {
      // Step 1: Build query embedding using injected embed function
      const embeddingStartTime = performance.now();
      const queryEmbedding = await this.embedFn(query);
      const embeddingTime = performance.now() - embeddingStartTime;

      // Step 2: Search with the vector
      const results = await this.searchWithVector(queryEmbedding.vector, options, query, embeddingTime);

      return results;

    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform semantic search using a pre-computed embedding vector
   * Useful for image-based search or when embedding is computed externally
   * @param queryVector - Pre-computed query embedding vector
   * @param options - Search options including top_k and rerank settings
   * @param originalQuery - Optional original query for reranking (text or image path)
   * @param embeddingTime - Optional embedding time for logging
   * @returns Promise resolving to array of search results
   */
  async searchWithVector(
    queryVector: Float32Array, 
    options: SearchOptions = {},
    originalQuery?: string,
    embeddingTime?: number
  ): Promise<SearchResult[]> {
    const startTime = performance.now();
    const topK = options.top_k || config.top_k || 10;
    // Phase 1: Disable reranking by default for better performance
    // Users must explicitly opt-in with --rerank flag
    const shouldRerank = options.rerank === true;

    try {
      // Step 1: Search using IndexManager (which handles hash mapping properly)
      const searchStartTime = performance.now();
      let searchResult;
      try {
        const contentType = options.contentType as 'text' | 'image' | 'combined' | undefined;
        searchResult = await this.indexManager.search(queryVector, topK, contentType);
      } catch (error) {
        if (error instanceof Error && error.message.includes('No embedding ID found for hash')) {
          console.warn(`Hash mapping issue detected: ${error.message}`);
          console.warn('This may indicate index/database synchronization issues. Consider running: raglite rebuild');
          return [];
        }
        throw error;
      }
      const vectorSearchTime = performance.now() - searchStartTime;

      if (searchResult.embeddingIds.length === 0) {
        const totalTime = performance.now() - startTime;
        console.log(`No similar documents found (${totalTime.toFixed(2)}ms total)`);
        return [];
      }

      // Step 2: Retrieve chunks from database using embedding IDs
      const retrievalStartTime = performance.now();
      const chunks = await getChunksByEmbeddingIds(this.db, searchResult.embeddingIds);
      const retrievalTime = performance.now() - retrievalStartTime;

      // Step 3: Format results as JSON with text, score, and document metadata
      let results = this.formatSearchResults(chunks, searchResult.distances, searchResult.embeddingIds);

      // Step 4: Optional reranking with injected rerank function
      let rerankTime = 0;
      if (shouldRerank && this.rerankFn && results.length > 1 && originalQuery) {
        try {
          const rerankStartTime = performance.now();
          results = await this.rerankFn(originalQuery, results);
          rerankTime = performance.now() - rerankStartTime;
        } catch (error) {
          // Fallback to vector search results and log the error
          console.warn(`Reranking failed, using vector search results: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const totalTime = performance.now() - startTime;
      
      // Measure latency without premature optimization - just log for monitoring
      const embedTimeStr = embeddingTime !== undefined ? `embed: ${embeddingTime.toFixed(2)}ms, ` : '';
      console.log(`Search completed: ${results.length} results in ${totalTime.toFixed(2)}ms ` +
        `(${embedTimeStr}vector: ${vectorSearchTime.toFixed(2)}ms, ` +
        `retrieval: ${retrievalTime.toFixed(2)}ms${rerankTime > 0 ? `, rerank: ${rerankTime.toFixed(2)}ms` : ''})`);

      return results;

    } catch (error) {
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format search results with proper structure
   * @param chunks - Database chunks with metadata
   * @param distances - Similarity distances from vector search
   * @param embeddingIds - Embedding IDs in search result order
   * @returns Formatted search results
   */
  private formatSearchResults(
    chunks: any[],
    distances: number[],
    embeddingIds: string[]
  ): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Create a map for quick chunk lookup by embedding_id
    const chunkMap = new Map();
    chunks.forEach(chunk => {
      chunkMap.set(chunk.embedding_id, chunk);
    });

    // Build results in the order of search results
    for (let i = 0; i < embeddingIds.length; i++) {
      const embeddingId = embeddingIds[i];
      const chunk = chunkMap.get(embeddingId);
      
      if (chunk) {
        // Convert cosine distance to similarity score (1 - distance)
        // hnswlib-wasm returns cosine distance, we want similarity
        const score = Math.max(0, 1 - distances[i]);
        
        results.push({
          content: chunk.content,
          score: score,
          contentType: chunk.content_type || 'text',
          document: {
            id: chunk.document_id,
            source: chunk.document_source,
            title: chunk.document_title,
            contentType: chunk.document_content_type || 'text',
            contentId: chunk.document_content_id || undefined
          }
        });
      }
    }

    return results;
  }

  /**
   * Get search engine statistics
   * @returns Object with current search engine stats
   */
  async getStats(): Promise<{ 
    totalChunks: number; 
    indexSize: number; 
    rerankingEnabled: boolean;
  }> {
    const indexStats = await this.indexManager.getStats();
    return {
      totalChunks: indexStats.totalVectors,
      indexSize: indexStats.totalVectors,
      rerankingEnabled: this.rerankFn !== undefined
    };
  }

  /**
   * Retrieve content by ID in the specified format
   * @param contentId - Content ID to retrieve
   * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
   * @returns Promise that resolves to content in requested format
   */
  async getContent(contentId: string, format: 'file' | 'base64' = 'file'): Promise<string> {
    // Lazy initialization of ContentResolver
    if (!this.contentResolver) {
      const { ContentResolver } = await import('./content-resolver.js');
      this.contentResolver = new ContentResolver(this.db);
    }
    
    return this.contentResolver.getContent(contentId, format);
  }

  /**
   * Retrieve multiple content items efficiently in batch
   * @param contentIds - Array of content IDs to retrieve
   * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
   * @returns Promise that resolves to array of content in requested format
   */
  async getContentBatch(contentIds: string[], format: 'file' | 'base64' = 'file'): Promise<string[]> {
    // Lazy initialization of ContentResolver
    if (!this.contentResolver) {
      const { ContentResolver } = await import('./content-resolver.js');
      this.contentResolver = new ContentResolver(this.db);
    }
    
    // Convert contentIds array to ContentRequest array
    const requests = contentIds.map(contentId => ({ contentId, format }));
    const results = await this.contentResolver.getContentBatch(requests);
    
    // Extract content from results, maintaining order and handling errors
    return results.map(result => {
      if (!result.success) {
        throw new Error(`Failed to retrieve content ${result.contentId}: ${result.error}`);
      }
      return result.content!;
    });
  }

  /**
   * Retrieve content metadata for result enhancement
   * @param contentId - Content ID to get metadata for
   * @returns Promise that resolves to content metadata
   */
  async getContentMetadata(contentId: string): Promise<import('./content-resolver.js').ContentMetadata> {
    // Lazy initialization of ContentResolver
    if (!this.contentResolver) {
      const { ContentResolver } = await import('./content-resolver.js');
      this.contentResolver = new ContentResolver(this.db);
    }
    
    return this.contentResolver.getContentMetadata(contentId);
  }

  /**
   * Verify that content exists and is accessible
   * @param contentId - Content ID to verify
   * @returns Promise that resolves to true if content exists, false otherwise
   */
  async verifyContentExists(contentId: string): Promise<boolean> {
    // Lazy initialization of ContentResolver
    if (!this.contentResolver) {
      const { ContentResolver } = await import('./content-resolver.js');
      this.contentResolver = new ContentResolver(this.db);
    }
    
    return this.contentResolver.verifyContentExists(contentId);
  }

  /**
   * Clean up resources - explicit cleanup method
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up ContentResolver to prevent resource leaks
      if (this.contentResolver && typeof this.contentResolver.cleanup === 'function') {
        this.contentResolver.cleanup();
      }
      
      await this.db.close();
      await this.indexManager.close();
    } catch (error) {
      console.error('Error during SearchEngine cleanup:', error instanceof Error ? error.message : String(error));
    }
  }
}