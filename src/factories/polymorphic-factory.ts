/**
 * Polymorphic factory for creating mode-aware search engines
 * Automatically detects mode from database and uses appropriate embedder
 * 
 * This factory implements the Chameleon Architecture principle:
 * - Detects mode (text/multimodal) from database configuration
 * - Uses appropriate embedder based on detected mode
 * - Provides seamless polymorphic behavior without user intervention
 * 
 * @example
 * ```typescript
 * // Automatically detects mode and creates appropriate search engine
 * const search = await PolymorphicSearchFactory.create('./index.bin', './db.sqlite');
 * 
 * // Works for both text and multimodal modes
 * const results = await search.search('query');
 * ```
 */

import { SearchEngine } from '../core/search.js';
import { IndexManager } from '../index-manager.js';
import { openDatabase, getSystemInfo } from '../core/db.js';
import { createTextEmbedFunction } from '../text/embedder.js';
import { createTextRerankFunction } from '../text/reranker.js';
import { config, getModelDefaults } from '../core/config.js';
import { existsSync } from 'fs';
import {
  createMissingFileError,
  createInvalidPathError,
  createFactoryCreationError
} from '../core/actionable-error-messages.js';

export interface PolymorphicSearchOptions {
  /** Whether to enable reranking (default: true) */
  enableReranking?: boolean;
  /** Top-k results to return (default: from config) */
  topK?: number;
}

/**
 * Factory for creating mode-aware search engines
 * Automatically detects mode from database and uses appropriate embedder
 */
export class PolymorphicSearchFactory {
  /**
   * Create a SearchEngine that automatically adapts to the mode stored in the database
   * 
   * This method:
   * 1. Validates that required files exist
   * 2. Opens database and reads system configuration
   * 3. Detects mode (text/multimodal) from database
   * 4. Creates appropriate embedder based on mode
   * 5. Optionally creates reranker based on configuration
   * 6. Returns fully configured SearchEngine
   * 
   * @param indexPath - Path to the vector index file (must exist)
   * @param dbPath - Path to the SQLite database file (must exist)
   * @param options - Optional configuration overrides
   * @returns Promise resolving to configured SearchEngine
   * @throws {Error} If required files don't exist or initialization fails
   */
  static async create(
    indexPath: string,
    dbPath: string,
    options: PolymorphicSearchOptions = {}
  ): Promise<SearchEngine> {
    try {
      console.log('🏭 PolymorphicSearchFactory: Initializing mode-aware search engine...');

      // Validate input paths
      if (!indexPath || !dbPath) {
        throw createInvalidPathError([
          { name: 'indexPath', value: indexPath },
          { name: 'dbPath', value: dbPath }
        ], { operationContext: 'PolymorphicSearchFactory.create' });
      }

      // Check if required files exist
      if (!existsSync(indexPath)) {
        throw createMissingFileError(indexPath, 'index', {
          operationContext: 'PolymorphicSearchFactory.create'
        });
      }

      if (!existsSync(dbPath)) {
        throw createMissingFileError(dbPath, 'database', {
          operationContext: 'PolymorphicSearchFactory.create'
        });
      }

      // Step 1: Open database and detect mode
      console.log('💾 Opening database and detecting mode...');
      const db = await openDatabase(dbPath);
      
      let mode: 'text' | 'multimodal' = 'text';
      let embeddingModel: string;
      let modelDimensions: number;

      try {
        const systemInfo = await getSystemInfo(db);
        
        if (systemInfo) {
          mode = systemInfo.mode;
          embeddingModel = systemInfo.modelName;
          modelDimensions = systemInfo.modelDimensions;
          console.log(`📊 Detected mode: ${mode}`);
          console.log(`📊 Detected model: ${embeddingModel} (${modelDimensions} dimensions)`);
        } else {
          // Fallback to default if no system info
          embeddingModel = config.embedding_model;
          const modelDefaults = getModelDefaults(embeddingModel);
          modelDimensions = modelDefaults.dimensions;
          console.log(`📊 No system info found, using default: ${embeddingModel} (${modelDimensions} dimensions)`);
        }
      } catch (error) {
        // If getSystemInfo fails, use defaults
        embeddingModel = config.embedding_model;
        const modelDefaults = getModelDefaults(embeddingModel);
        modelDimensions = modelDefaults.dimensions;
        console.log(`📊 Using default configuration: ${embeddingModel} (${modelDimensions} dimensions)`);
      }

      // Step 2: Create appropriate embedder based on mode
      let embedFn: (query: string, contentType?: string) => Promise<any>;

      if (mode === 'multimodal') {
        console.log('📊 Loading CLIP embedder for multimodal mode...');
        const { createEmbedder } = await import('../core/embedder-factory.js');
        const clipEmbedder = await createEmbedder(embeddingModel);
        
        // Wrap CLIP embedder to match EmbedFunction signature
        embedFn = async (content: string, contentType?: string) => {
          if (contentType === 'image') {
            return await clipEmbedder.embedImage!(content);
          }
          return await clipEmbedder.embedText(content);
        };
        
        console.log('✓ CLIP embedder loaded for multimodal mode');
      } else {
        console.log('📊 Loading text embedder for text mode...');
        embedFn = createTextEmbedFunction(embeddingModel);
        console.log('✓ Text embedder loaded');
      }

      // Step 3: Initialize reranking function (optional)
      let rerankFn;
      if (options.enableReranking === true) {
        console.log('🔄 Loading reranking model...');
        rerankFn = createTextRerankFunction();
        await rerankFn('test query', []);
        console.log('✓ Reranking model loaded successfully');
      } else {
        console.log('🔄 Reranking disabled (local-first, fast mode)');
      }

      // Step 4: Initialize database schema
      const { initializeSchema } = await import('../core/db.js');
      await initializeSchema(db);
      console.log('✓ Database connection established');

      // Step 5: Initialize index manager
      console.log('📇 Loading vector index...');
      const indexManager = new IndexManager(indexPath, dbPath, modelDimensions, embeddingModel);
      await indexManager.initialize();
      console.log('✓ Vector index loaded successfully');

      // Step 6: Create ContentResolver
      console.log('📁 Initializing content resolver...');
      const { ContentResolver } = await import('../core/content-resolver.js');
      const contentResolver = new ContentResolver(db);
      console.log('✓ Content resolver ready');

      // Step 7: Create SearchEngine with dependency injection
      const searchEngine = new SearchEngine(embedFn, indexManager, db, rerankFn, contentResolver);

      // Step 8: Validate the setup
      const stats = await searchEngine.getStats();
      console.log(`✓ Search engine ready: ${stats.totalChunks} chunks indexed, mode: ${mode}, reranking ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);

      console.log('🎉 PolymorphicSearchFactory: Mode-aware search engine initialized successfully');
      return searchEngine;

    } catch (error) {
      console.error('❌ PolymorphicSearchFactory: Failed to create search engine');
      throw createFactoryCreationError(
        'PolymorphicSearchFactory',
        error instanceof Error ? error.message : 'Unknown error',
        { operationContext: 'polymorphic search engine creation' }
      );
    }
  }
}
