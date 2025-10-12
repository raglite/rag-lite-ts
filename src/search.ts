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

        // Create core engine with dependency injection
        this.coreEngine = new CoreSearchEngine(embedFn, indexManager, db, this.options.rerankFn);
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.coreEngine) {
      await this.coreEngine.cleanup();
    }
  }
}