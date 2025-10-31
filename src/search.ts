/**
 * Public API SearchEngine - Simple constructor interface with internal factory usage
 * 
 * This class provides a clean, simple API while using the new core architecture 
 * internally. It handles dependency injection automatically.
 * 
 * @example
 * ```typescript
 * // Simple usage
 * const search = new SearchEngine('./index.bin', './db.sqlite');
 * const results = await search.search('query');
 * 
 * // With options
 * const search = new SearchEngine('./index.bin', './db.sqlite', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   enableReranking: true
 * });
 * ```
 */

import { SearchEngine as CoreSearchEngine } from './core/search.js';
import { TextSearchFactory, type TextSearchOptions } from './factories/index.js';
import type { SearchResult, SearchOptions, EmbedFunction, RerankFunction } from './core/types.js';

export interface SearchEngineOptions extends TextSearchOptions {
  /** Custom embedding function (advanced usage) */
  embedFn?: EmbedFunction;
  /** Custom reranking function (advanced usage) */
  rerankFn?: RerankFunction;
}

export class SearchEngine {
  private coreEngine: CoreSearchEngine | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private indexPath: string,
    private dbPath: string,
    private options: SearchEngineOptions = {}
  ) {
    // Validate required parameters
    if (!indexPath || typeof indexPath !== 'string' || indexPath.trim() === '') {
      throw new Error(
        'Both indexPath and dbPath are required.\n' +
        'Example: const search = new SearchEngine("./index.bin", "./db.sqlite");\n' +
        'Or use: const search = await SearchFactory.create("./index.bin", "./db.sqlite");'
      );
    }
    if (!dbPath || typeof dbPath !== 'string' || dbPath.trim() === '') {
      throw new Error(
        'Both indexPath and dbPath are required.\n' +
        'Example: const search = new SearchEngine("./index.bin", "./db.sqlite");\n' +
        'Or use: const search = await SearchFactory.create("./index.bin", "./db.sqlite");'
      );
    }
  }

  /**
   * Initialize the search engine using the factory or direct injection
   */
  private async initialize(): Promise<void> {
    if (this.coreEngine) {
      return; // Already initialized
    }

    if (this.initPromise) {
      return this.initPromise; // Initialization in progress
    }

    this.initPromise = (async () => {
      // If custom functions are provided, use direct dependency injection
      if (this.options.embedFn || this.options.rerankFn) {
        const { IndexManager } = await import('./index-manager.js');
        const { openDatabase } = await import('./core/db.js');
        const { createTextEmbedFunction } = await import('./text/embedder.js');
        const { existsSync } = await import('fs');

        // Validate files exist
        if (!existsSync(this.indexPath)) {
          throw new Error(`Vector index not found at: ${this.indexPath}`);
        }
        if (!existsSync(this.dbPath)) {
          throw new Error(`Database not found at: ${this.dbPath}`);
        }

        // Use custom embedFn or create default
        const embedFn = this.options.embedFn || createTextEmbedFunction(this.options.embeddingModel);
        
        // Get model defaults for dimensions
        const { getModelDefaults, config } = await import('./core/config.js');
        const modelDefaults = getModelDefaults(this.options.embeddingModel || config.embedding_model);
        
        // Initialize dependencies
        const db = await openDatabase(this.dbPath);
        const indexManager = new IndexManager(this.indexPath, this.dbPath, modelDefaults.dimensions, this.options.embeddingModel);
        await indexManager.initialize();

        // Create ContentResolver for unified content system
        const { ContentResolver } = await import('./core/content-resolver.js');
        const contentResolver = new ContentResolver(db);

        // Create core engine with dependency injection
        this.coreEngine = new CoreSearchEngine(embedFn, indexManager, db, this.options.rerankFn, contentResolver);
      } else {
        // Use factory for standard initialization
        this.coreEngine = await TextSearchFactory.create(
          this.indexPath,
          this.dbPath,
          this.options
        );
      }
    })();

    return this.initPromise;
  }

  /**
   * Perform semantic search
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    await this.initialize();
    if (!this.coreEngine) {
      throw new Error('SearchEngine failed to initialize');
    }
    return this.coreEngine.search(query, options);
  }

  /**
   * Retrieve content by ID in the specified format
   * @param contentId - Content ID to retrieve
   * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
   * @returns Promise that resolves to content in requested format
   */
  async getContent(contentId: string, format: 'file' | 'base64' = 'file'): Promise<string> {
    await this.initialize();
    if (!this.coreEngine) {
      throw new Error('SearchEngine failed to initialize');
    }
    return this.coreEngine.getContent(contentId, format);
  }

  /**
   * Retrieve multiple content items efficiently in batch
   * @param contentIds - Array of content IDs to retrieve
   * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
   * @returns Promise that resolves to array of content in requested format
   */
  async getContentBatch(contentIds: string[], format: 'file' | 'base64' = 'file'): Promise<string[]> {
    await this.initialize();
    if (!this.coreEngine) {
      throw new Error('SearchEngine failed to initialize');
    }
    return this.coreEngine.getContentBatch(contentIds, format);
  }

  /**
   * Retrieve content metadata for result enhancement
   * @param contentId - Content ID to get metadata for
   * @returns Promise that resolves to content metadata
   */
  async getContentMetadata(contentId: string): Promise<import('./core/content-resolver.js').ContentMetadata> {
    await this.initialize();
    if (!this.coreEngine) {
      throw new Error('SearchEngine failed to initialize');
    }
    return this.coreEngine.getContentMetadata(contentId);
  }

  /**
   * Verify that content exists and is accessible
   * @param contentId - Content ID to verify
   * @returns Promise that resolves to true if content exists, false otherwise
   */
  async verifyContentExists(contentId: string): Promise<boolean> {
    await this.initialize();
    if (!this.coreEngine) {
      throw new Error('SearchEngine failed to initialize');
    }
    return this.coreEngine.verifyContentExists(contentId);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.coreEngine) {
      await this.coreEngine.cleanup();
    }
  }
}