/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

import type { 
  SearchResult, 
  SearchOptions, 
  EmbeddingResult 
} from './types.js';
import type { 
  EmbedFunction, 
  RerankFunction,
  SearchPipelineInterface 
} from './interfaces.js';

/**
 * Core search pipeline coordinator
 * Orchestrates the search pipeline: query processing → vector search → metadata retrieval → optional reranking
 * Remains completely independent of specific embedding models or transformer libraries
 */
export class SearchPipelineCoordinator implements SearchPipelineInterface {
  private embedQueryFn: EmbedFunction | null = null;
  private rerankResultsFn: RerankFunction | null = null;
  private indexManager: any | null = null;
  private dbConnection: any | null = null;
  private defaultContentType: string = 'text';

  /**
   * Set the embedding function for query processing
   */
  setEmbedFunction(embedFn: EmbedFunction): void {
    this.embedQueryFn = embedFn;
  }

  /**
   * Set the reranking function for result reranking
   */
  setRerankFunction(rerankFn: RerankFunction): void {
    this.rerankResultsFn = rerankFn;
  }

  /**
   * Set the index manager for vector search
   */
  setIndexManager(indexManager: any): void {
    this.indexManager = indexManager;
  }

  /**
   * Set the database connection for metadata retrieval
   */
  setDatabaseConnection(dbConnection: any): void {
    this.dbConnection = dbConnection;
  }

  /**
   * Set the default content type
   */
  setDefaultContentType(contentType: string): void {
    this.defaultContentType = contentType;
  }

  /**
   * Execute the complete search pipeline
   * Coordinates all steps without knowledge of specific embedding models
   */
  async executeSearchPipeline(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const startTime = performance.now();
    const topK = options.top_k || 10;
    const shouldRerank = options.rerank !== undefined ? options.rerank : (this.rerankResultsFn !== null);
    const contentType = options.contentType || this.defaultContentType;

    // Validate dependencies
    this.validateDependencies();

    try {
      // Step 1: Query processing and embedding
      const embeddingStartTime = performance.now();
      const queryEmbedding = await this.embedQuery(query, contentType);
      const embeddingTime = performance.now() - embeddingStartTime;

      // Step 2: Vector search
      const searchStartTime = performance.now();
      const searchResult = await this.vectorSearch(queryEmbedding.vector, topK);
      const vectorSearchTime = performance.now() - searchStartTime;

      if (searchResult.embeddingIds.length === 0) {
        const totalTime = performance.now() - startTime;
        console.log(`No similar documents found (${totalTime.toFixed(2)}ms total)`);
        return [];
      }

      // Step 3: Metadata retrieval
      const retrievalStartTime = performance.now();
      const chunks = await this.retrieveMetadata(searchResult.embeddingIds);
      const retrievalTime = performance.now() - retrievalStartTime;

      // Step 4: Format initial results
      let results = this.formatResults(chunks, searchResult.distances, searchResult.embeddingIds);

      // Step 5: Optional reranking
      let rerankTime = 0;
      if (shouldRerank && this.rerankResultsFn && results.length > 1) {
        try {
          const rerankStartTime = performance.now();
          results = await this.rerankResults(query, results, contentType);
          rerankTime = performance.now() - rerankStartTime;
        } catch (error) {
          console.warn(`Reranking failed, using vector search results: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`Search pipeline completed: ${results.length} results in ${totalTime.toFixed(2)}ms ` +
        `(embed: ${embeddingTime.toFixed(2)}ms, vector: ${vectorSearchTime.toFixed(2)}ms, ` +
        `retrieval: ${retrievalTime.toFixed(2)}ms${rerankTime > 0 ? `, rerank: ${rerankTime.toFixed(2)}ms` : ''})`);

      return results;

    } catch (error) {
      throw new Error(`Search pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 1: Process and embed the query
   * Uses injected embedding function without knowledge of specific models
   */
  async embedQuery(query: string, contentType?: string): Promise<EmbeddingResult> {
    if (!this.embedQueryFn) {
      throw new Error('No embedding function provided. Set embedding function before executing pipeline.');
    }

    try {
      return await this.embedQueryFn(query, contentType);
    } catch (error) {
      throw new Error(`Query embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2: Perform vector search
   * Uses index manager without knowledge of specific embedding models
   */
  async vectorSearch(queryVector: Float32Array, topK: number): Promise<{
    embeddingIds: string[];
    distances: number[];
  }> {
    if (!this.indexManager) {
      throw new Error('Index manager not set. Set index manager before executing pipeline.');
    }

    try {
      return await this.indexManager.search(queryVector, topK);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No embedding ID found for hash')) {
        console.warn(`Hash mapping issue detected: ${error.message}`);
        console.warn('This may indicate index/database synchronization issues. Consider running: raglite rebuild');
        return { embeddingIds: [], distances: [] };
      }
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 3: Retrieve metadata from database
   * Uses database connection without knowledge of specific data formats
   */
  async retrieveMetadata(embeddingIds: string[]): Promise<any[]> {
    if (!this.dbConnection) {
      throw new Error('Database connection not set. Set database connection before executing pipeline.');
    }

    try {
      const { getChunksByEmbeddingIds } = await import('./db.js');
      return await getChunksByEmbeddingIds(this.dbConnection, embeddingIds);
    } catch (error) {
      throw new Error(`Metadata retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 4: Format initial results
   * Formats results in core format without knowledge of specific content types
   */
  formatResults(chunks: any[], distances: number[], embeddingIds: string[]): SearchResult[] {
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
        const score = Math.max(0, 1 - distances[i]);
        
        results.push({
          content: chunk.text,
          score: score,
          contentType: chunk.content_type || this.defaultContentType,
          document: {
            id: chunk.document_id,
            source: chunk.document_source,
            title: chunk.document_title,
            contentType: chunk.document_content_type || this.defaultContentType
          },
          metadata: chunk.metadata ? this.parseMetadata(chunk.metadata) : undefined
        });
      }
    }

    return results;
  }

  /**
   * Step 5: Optional reranking
   * Uses injected reranking function without knowledge of specific models
   */
  async rerankResults(query: string, results: SearchResult[], contentType?: string): Promise<SearchResult[]> {
    if (!this.rerankResultsFn) {
      return results; // No reranking function available
    }

    try {
      return await this.rerankResultsFn(query, results, contentType);
    } catch (error) {
      console.warn(`Reranking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results; // Return original results on reranking failure
    }
  }

  /**
   * Validate that all required dependencies are set
   */
  private validateDependencies(): void {
    const missing: string[] = [];

    if (!this.embedQueryFn) {
      missing.push('embedding function');
    }
    if (!this.indexManager) {
      missing.push('index manager');
    }
    if (!this.dbConnection) {
      missing.push('database connection');
    }

    if (missing.length > 0) {
      throw new Error(`Missing required dependencies: ${missing.join(', ')}. Set all dependencies before executing search pipeline.`);
    }
  }

  /**
   * Parse metadata safely
   */
  private parseMetadata(metadata: string): Record<string, any> | undefined {
    try {
      return JSON.parse(metadata);
    } catch (error) {
      console.warn(`Failed to parse metadata: ${metadata}`);
      return undefined;
    }
  }

  /**
   * Check if the pipeline is ready to execute
   */
  isReady(): boolean {
    return !!(this.embedQueryFn && this.indexManager && this.dbConnection);
  }

  /**
   * Get pipeline status information
   */
  getStatus(): {
    hasEmbedFunction: boolean;
    hasRerankFunction: boolean;
    hasIndexManager: boolean;
    hasDatabaseConnection: boolean;
    isReady: boolean;
  } {
    return {
      hasEmbedFunction: this.embedQueryFn !== null,
      hasRerankFunction: this.rerankResultsFn !== null,
      hasIndexManager: this.indexManager !== null,
      hasDatabaseConnection: this.dbConnection !== null,
      isReady: this.isReady()
    };
  }

  /**
   * Reset all dependencies (useful for testing or reconfiguration)
   */
  reset(): void {
    this.embedQueryFn = null;
    this.rerankResultsFn = null;
    this.indexManager = null;
    this.dbConnection = null;
    this.defaultContentType = 'text';
  }
}

/**
 * Factory for creating search pipeline coordinators
 */
export class SearchPipelineFactory {
  /**
   * Create a search pipeline coordinator with all dependencies
   */
  static create(
    embedFn: EmbedFunction,
    indexManager: any,
    dbConnection: any,
    rerankFn?: RerankFunction,
    defaultContentType: string = 'text'
  ): SearchPipelineCoordinator {
    const coordinator = new SearchPipelineCoordinator();
    coordinator.setEmbedFunction(embedFn);
    coordinator.setIndexManager(indexManager);
    coordinator.setDatabaseConnection(dbConnection);
    coordinator.setDefaultContentType(defaultContentType);
    
    if (rerankFn) {
      coordinator.setRerankFunction(rerankFn);
    }
    
    return coordinator;
  }

  /**
   * Create an empty coordinator for manual configuration
   */
  static createEmpty(): SearchPipelineCoordinator {
    return new SearchPipelineCoordinator();
  }
}