import { EmbeddingEngine, initializeEmbeddingEngine } from './embedder.js';
import { IndexManager } from './index-manager.js';
import { DatabaseConnection, getChunksByEmbeddingIds, openDatabase, getStoredModelInfo } from './db.js';
import { CrossEncoderReranker } from './reranker.js';
import type { SearchResult, SearchOptions } from './types.js';
import { config, getModelDefaults } from './config.js';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * User-friendly error class with actionable suggestions
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions: string[]
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/**
 * Path configuration for search engine
 */
interface SearchPathConfig {
  indexPath: string;
  dbPath: string;
}

/**
 * Resolves paths for the search engine based on provided paths or defaults
 * @param indexPath - Path to vector index file (optional)
 * @param dbPath - Path to database file (optional)
 * @returns Resolved paths for index and database files
 */
function resolveSearchPaths(indexPath?: string, dbPath?: string): SearchPathConfig {
  const currentDir = process.cwd();
  
  return {
    indexPath: indexPath ? resolve(indexPath) : join(currentDir, 'vector-index.bin'),
    dbPath: dbPath ? resolve(dbPath) : join(currentDir, 'db.sqlite')
  };
}

/**
 * Search engine that provides semantic search capabilities
 * Implements the core search pipeline: query embedding → vector search → metadata retrieval → optional reranking
 * Supports concurrent read operations for multiple simultaneous queries
 */
export class SearchEngine {
  // Static properties for automatic resource management (Requirement 5.1, 5.2)
  private static instances = new Set<SearchEngine>();
  private static cleanupHandlersSet = false;

  private embedder: EmbeddingEngine | null = null;
  private indexManager: IndexManager | null = null;
  private dbConnection: DatabaseConnection | null = null;
  private reranker: CrossEncoderReranker | null = null;
  private isInitialized: boolean = false;
  private indexPath: string;
  private dbPath: string;
  private enableReranking: boolean = false;

  /**
   * Creates a new SearchEngine with simplified constructor
   * Search engine is ready to use immediately without requiring initialization calls (Requirement 3.5)
   * @param indexPath - Path to vector index file (defaults to './vector-index.bin')
   * @param dbPath - Path to database file (defaults to './db.sqlite')
   */
  constructor(indexPath?: string, dbPath?: string) {
    // Validate parameters
    if (indexPath !== undefined && (typeof indexPath !== 'string' || indexPath.trim() === '')) {
      throw new Error('indexPath must be a non-empty string when provided');
    }

    if (dbPath !== undefined && (typeof dbPath !== 'string' || dbPath.trim() === '')) {
      throw new Error('dbPath must be a non-empty string when provided');
    }

    // Resolve paths automatically
    const pathConfig = resolveSearchPaths(indexPath, dbPath);
    this.indexPath = pathConfig.indexPath;
    this.dbPath = pathConfig.dbPath;

    // Set up automatic cleanup on process exit (Requirement 5.5)
    this.setupAutomaticCleanup();
  }

  /**
   * Legacy constructor for backward compatibility
   * @deprecated Use the simple constructor new SearchEngine(indexPath?, dbPath?) instead
   */
  static createWithComponents(
    embedder: EmbeddingEngine,
    indexManager: IndexManager,
    dbConnection: DatabaseConnection,
    enableReranking: boolean = false
  ): SearchEngine {
    const engine = new SearchEngine();
    engine.embedder = embedder;
    engine.indexManager = indexManager;
    engine.dbConnection = dbConnection;
    engine.enableReranking = enableReranking;
    
    // Initialize reranker if enabled
    if (enableReranking) {
      engine.reranker = new CrossEncoderReranker();
    }
    
    engine.isInitialized = true;
    return engine;
  }

  /**
   * Automatically initialize resources on first use with user-friendly error handling
   * Implements lazy initialization as required by Requirements 3.5, 4.3, 5.1, 5.2
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Check if required files exist first (before any initialization attempts)
    if (!existsSync(this.dbPath)) {
      throw this.createUserFriendlyError(
        new Error(`Database file not found: ${this.dbPath}`),
        'missing_database'
      );
    }

    if (!existsSync(this.indexPath)) {
      throw this.createUserFriendlyError(
        new Error(`Vector index file not found: ${this.indexPath}`),
        'missing_index'
      );
    }

    try {
      console.log('Initializing search engine...');

      // Initialize database connection
      console.log('Opening database connection...');
      this.dbConnection = await openDatabase(this.dbPath);

      // Read stored model info from database (Requirement 4.3)
      console.log('Reading stored model information...');
      const storedModelInfo = await getStoredModelInfo(this.dbConnection);
      
      if (!storedModelInfo) {
        throw this.createUserFriendlyError(
          new Error('No model information found in database'),
          'missing_model_info'
        );
      }

      // Initialize embedder with stored model info (Requirement 3.5)
      console.log(`Loading embedding model: ${storedModelInfo.modelName}...`);
      try {
        this.embedder = await initializeEmbeddingEngine(storedModelInfo.modelName);
      } catch (error) {
        throw this.createUserFriendlyError(
          error,
          'model_loading'
        );
      }

      // Initialize index manager with model compatibility validation
      console.log('Initializing index manager...');
      try {
        this.indexManager = new IndexManager(
          this.indexPath, 
          this.dbPath, 
          storedModelInfo.dimensions, 
          storedModelInfo.modelName
        );
        await this.indexManager.initialize();
      } catch (error) {
        // Check if this is a model compatibility issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('mismatch') || errorMessage.includes('version') || errorMessage.includes('model')) {
          throw this.createUserFriendlyError(error, 'model_compatibility');
        }
        throw error;
      }

      // Load reranker model if enabled
      if (this.enableReranking) {
        this.reranker = new CrossEncoderReranker();
        console.log('Loading reranker model...');
        try {
          await this.reranker.loadModel();
        } catch (error) {
          console.warn(`Reranker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.warn('Continuing with vector search only (reranking disabled)');
          this.reranker = null; // Disable reranker for this session
        }
      }

      this.isInitialized = true;
      const stats = await this.indexManager.getStats();
      console.log(`Search engine initialized with ${stats.totalVectors} chunks${this.reranker && this.reranker.isLoaded() ? ' and reranking enabled' : ''}`);

    } catch (error) {
      await this.cleanup();
      if (error instanceof SearchError) {
        throw error;
      } else {
        throw this.createUserFriendlyError(error, 'initialization');
      }
    }
  }

  /**
   * Create user-friendly error messages with actionable suggestions
   * Implements requirement 5.3: Clear, actionable error messages with specific next steps
   */
  private createUserFriendlyError(error: unknown, context: string): SearchError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle common error scenarios with specific guidance
    if (context === 'missing_database') {
      return new SearchError(
        `Database file not found: ${this.dbPath}`,
        'DATABASE_NOT_FOUND',
        [
          'Run ingestion first to create the database: pipeline.ingestDirectory("./docs/")',
          'Check that the database path is correct',
          'Ensure the ingestion process completed successfully'
        ]
      );
    }

    if (context === 'missing_index') {
      return new SearchError(
        `Vector index file not found: ${this.indexPath}`,
        'INDEX_NOT_FOUND',
        [
          'Run ingestion first to create the index: pipeline.ingestDirectory("./docs/")',
          'Check that the index path is correct',
          'Ensure the ingestion process completed successfully'
        ]
      );
    }

    if (context === 'missing_model_info') {
      return new SearchError(
        'No embedding model information found in database. The database may be from an older version or corrupted.',
        'MODEL_INFO_NOT_FOUND',
        [
          'Run ingestion again to store model information: pipeline.ingestDirectory("./docs/")',
          'If the problem persists, delete the database and index files and run ingestion from scratch',
          'Check that the database was created with a compatible version of the library'
        ]
      );
    }

    if (context === 'model_loading') {
      return new SearchError(
        `Failed to load embedding model: ${errorMessage}`,
        'MODEL_LOADING_FAILED',
        [
          'Check that the model name is correct and supported',
          'Ensure you have internet connection for model download',
          'Try running ingestion again with a supported model',
          'Check the model configuration in your setup'
        ]
      );
    }

    if (context === 'model_compatibility' || (errorMessage.includes('model') && errorMessage.includes('mismatch'))) {
      return new SearchError(
        `Model compatibility issue detected: ${errorMessage}`,
        'MODEL_COMPATIBILITY',
        [
          'The stored model information doesn\'t match the current configuration',
          'Run pipeline.rebuildIndex() to rebuild with the current model',
          'Or ensure you\'re using the same model that was used during ingestion',
          'Check that the index and database files are from the same ingestion run'
        ]
      );
    }

    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return new SearchError(
        `Required files not found: ${errorMessage}`,
        'FILES_NOT_FOUND',
        [
          'Run ingestion first to create the required files',
          'Check that the file paths are correct',
          'Ensure you have read permissions for the files'
        ]
      );
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new SearchError(
        `Permission denied: ${errorMessage}`,
        'PERMISSION_DENIED',
        [
          'Check that you have read permissions for the database and index files',
          'Ensure the files are not locked by another process',
          'Try running with appropriate permissions'
        ]
      );
    }

    if (errorMessage.includes('database') || errorMessage.includes('sqlite')) {
      return new SearchError(
        `Database error: ${errorMessage}`,
        'DATABASE_ERROR',
        [
          'Check that the database file is not corrupted',
          'Ensure no other processes are using the database',
          'Try recreating the database by running ingestion again'
        ]
      );
    }

    // Generic error with basic suggestions
    return new SearchError(
      `Search engine ${context} failed: ${errorMessage}`,
      'GENERAL_ERROR',
      [
        'Check the error message above for specific details',
        'Ensure all required files exist and are accessible',
        'Try running ingestion first if you haven\'t already',
        'Contact support if the issue persists'
      ]
    );
  }

  /**
   * Initialize the search engine (public method for backward compatibility)
   * Sets up database, index manager, and embedding engine
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Perform semantic search on the indexed documents (matches README API)
   * Automatically initializes resources on first use (Requirements 4.1, 4.2, 4.4, 4.5)
   * Supports concurrent read operations for multiple simultaneous queries
   * @param query - Search query string
   * @param options - Search options including top_k and rerank settings
   * @returns Promise resolving to array of search results
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Automatic initialization on first use (Requirement 4.1, 4.2)
    await this.ensureInitialized();

    if (!query || query.trim().length === 0) {
      return [];
    }

    const startTime = performance.now();
    const topK = options.top_k || config.top_k || 10;
    const shouldRerank = options.rerank !== undefined ? options.rerank : config.rerank_enabled;

    try {
      // Ensure all components are initialized
      if (!this.embedder || !this.indexManager || !this.dbConnection) {
        throw new Error('Search engine components not properly initialized');
      }

      // Step 1: Build query embedding using same model as document chunks
      const embeddingStartTime = performance.now();
      const queryEmbedding = await this.embedder.embedSingle(query);
      const embeddingTime = performance.now() - embeddingStartTime;

      // Step 2: Search using IndexManager (which handles hash mapping properly)
      const searchStartTime = performance.now();
      let searchResult;
      try {
        searchResult = this.indexManager.search(queryEmbedding.vector, topK);
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

      // Step 3: Retrieve chunks from database using embedding IDs
      const retrievalStartTime = performance.now();
      const chunks = await getChunksByEmbeddingIds(this.dbConnection, searchResult.embeddingIds);
      const retrievalTime = performance.now() - retrievalStartTime;

      // Step 4: Format results as JSON with text, score, and document metadata
      let results = this.formatSearchResults(chunks, searchResult.distances, searchResult.embeddingIds);

      // Step 5: Optional reranking with cross-encoder when enabled
      let rerankTime = 0;
      if (shouldRerank && this.reranker && this.reranker.isLoaded() && results.length > 1) {
        try {
          const rerankStartTime = performance.now();
          results = await this.reranker.rerank(query, results);
          rerankTime = performance.now() - rerankStartTime;
        } catch (error) {
          // Fallback to vector search results and log the error
          console.warn(`Reranking failed, using vector search results: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const totalTime = performance.now() - startTime;
      
      // Measure latency without premature optimization - just log for monitoring
      console.log(`Search completed: ${results.length} results in ${totalTime.toFixed(2)}ms ` +
        `(embed: ${embeddingTime.toFixed(2)}ms, vector: ${vectorSearchTime.toFixed(2)}ms, ` +
        `retrieval: ${retrievalTime.toFixed(2)}ms${rerankTime > 0 ? `, rerank: ${rerankTime.toFixed(2)}ms` : ''})`);

      return results;

    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          text: chunk.text,
          score: score,
          document: {
            id: chunk.document_id,
            source: chunk.document_source,
            title: chunk.document_title
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
    isInitialized: boolean;
  }> {
    if (!this.isInitialized) {
      return {
        totalChunks: 0,
        indexSize: 0,
        rerankingEnabled: false,
        isInitialized: false
      };
    }

    const indexStats = await this.indexManager!.getStats();
    return {
      totalChunks: indexStats.totalVectors,
      indexSize: indexStats.totalVectors,
      rerankingEnabled: this.reranker !== null && this.reranker.isLoaded(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Set up automatic cleanup on process exit (Requirement 5.5)
   */
  private setupAutomaticCleanup(): void {
    // Track this instance for cleanup
    SearchEngine.instances.add(this);

    // Set up process exit handlers only once
    if (!SearchEngine.cleanupHandlersSet) {
      SearchEngine.cleanupHandlersSet = true;

      const cleanupAll = async () => {
        const instances = Array.from(SearchEngine.instances);
        await Promise.all(instances.map(instance => instance.cleanup()));
      };

      // Handle various exit scenarios
      process.on('exit', () => {
        // Synchronous cleanup for exit event
        for (const instance of SearchEngine.instances) {
          try {
            if (instance.dbConnection) {
              // Synchronous close for exit handler
              instance.dbConnection = null;
            }
            if (instance.indexManager) {
              instance.indexManager = null;
            }
            instance.embedder = null;
            instance.reranker = null;
            instance.isInitialized = false;
          } catch (error) {
            // Silent cleanup on exit
          }
        }
      });

      process.on('SIGINT', async () => {
        await cleanupAll();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await cleanupAll();
        process.exit(0);
      });

      process.on('uncaughtException', async (error) => {
        console.error('Uncaught exception:', error);
        await cleanupAll();
        process.exit(1);
      });

      process.on('unhandledRejection', async (reason) => {
        console.error('Unhandled rejection:', reason);
        await cleanupAll();
        process.exit(1);
      });
    }
  }

  /**
   * Clean up resources (Requirement 5.5)
   */
  async cleanup(): Promise<void> {
    try {
      if (this.dbConnection) {
        await this.dbConnection.close();
        this.dbConnection = null;
      }

      if (this.indexManager) {
        await this.indexManager.close();
        this.indexManager = null;
      }

      this.embedder = null;
      this.reranker = null;
      this.isInitialized = false;

      // Remove from instances set
      SearchEngine.instances.delete(this);
    } catch (error) {
      console.error('Error during SearchEngine cleanup:', error instanceof Error ? error.message : String(error));
    }
  }
}