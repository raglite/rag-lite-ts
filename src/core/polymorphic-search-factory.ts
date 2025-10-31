/**
 * CORE MODULE — Polymorphic Search Factory for Chameleon Architecture
 * Simple conditional logic for creating search engines based on detected mode
 * Uses direct embedder creation instead of complex factory patterns
 */

// Ensure DOM polyfills are set up before any transformers.js usage
import '../dom-polyfills.js';

import { SearchEngine } from './search.js';
import { ModeDetectionService } from './mode-detection-service.js';
import { IndexManager } from '../index-manager.js';
import { openDatabase } from './db.js';
import { DatabaseConnectionManager } from './database-connection-manager.js';
import { createEmbedder } from './embedder-factory.js';
import { ContentResolver } from './content-resolver.js';

import type { SystemInfo, ModeType } from '../types.js';
import type { RerankFunction } from './interfaces.js';
import { handleError, ErrorCategory, ErrorSeverity, createError } from './error-handler.js';
import { existsSync } from 'fs';

// =============================================================================
// POLYMORPHIC SEARCH FACTORY
// =============================================================================

/**
 * Factory for creating search engines with automatic mode detection
 * Uses simple conditional logic based on stored mode configuration
 * Supports both text and multimodal modes with appropriate implementations
 */
export class PolymorphicSearchFactory {
  /**
   * Create a SearchEngine with automatic mode detection and configuration
   * 
   * This method:
   * 1. Detects the current mode from the database
   * 2. Creates appropriate embedder based on detected model
   * 3. Creates appropriate reranker based on mode and strategy
   * 4. Creates ContentResolver for unified content system
   * 5. Initializes SearchEngine with proper dependency injection
   * 
   * @param indexPath - Path to the vector index file (must exist)
   * @param dbPath - Path to the SQLite database file (must exist)
   * @returns Promise resolving to configured SearchEngine
   * @throws {Error} If files don't exist or initialization fails
   * 
   * @example
   * ```typescript
   * // Automatic mode detection and engine creation
   * const search = await PolymorphicSearchFactory.create('./index.bin', './db.sqlite');
   * const results = await search.search('query');
   * 
   * // Mode is automatically detected from database:
   * // - Text mode: uses sentence transformer + cross-encoder reranking
   * // - Multimodal mode: uses CLIP + text-derived reranking
   * ```
   */
  static async create(indexPath: string, dbPath: string): Promise<SearchEngine> {
    try {
      console.log('🎭 PolymorphicSearchFactory: Initializing search engine with mode detection...');

      // Step 1: Validate input paths
      if (!indexPath || !dbPath) {
        throw createError.validation('Both indexPath and dbPath are required');
      }

      // Step 2: Validate that required files exist
      this.validateRequiredFiles(indexPath, dbPath);

      // Step 3: Get shared database connection
      const db = await DatabaseConnectionManager.getConnection(dbPath);

      // Step 4: Detect mode from database using shared connection
      const modeService = new ModeDetectionService(dbPath);
      const systemInfo = await modeService.detectMode(db);
      
      console.log(`🎯 Detected mode: ${systemInfo.mode} (model: ${systemInfo.modelName})`);

      // Step 5: Create search engine based on detected mode
      switch (systemInfo.mode) {
        case 'text':
          return await this.createTextSearchEngine(indexPath, dbPath, systemInfo, db);
        
        case 'multimodal':
          return await this.createMultimodalSearchEngine(indexPath, dbPath, systemInfo, db);
        
        default:
          throw createError.validation(`Unsupported mode: ${systemInfo.mode}`);
      }

    } catch (error) {
      const enhancedError = this.enhanceCreationError(error, indexPath, dbPath);
      handleError(enhancedError, 'Polymorphic Search Factory', {
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.GENERAL
      });
      throw enhancedError;
    }
  }

  // =============================================================================
  // MODE-SPECIFIC ENGINE CREATION
  // =============================================================================

  /**
   * Create a search engine configured for text mode
   * @private
   */
  private static async createTextSearchEngine(
    indexPath: string,
    dbPath: string,
    systemInfo: SystemInfo,
    db: any
  ): Promise<SearchEngine> {
    console.log('📝 Creating text search engine...');

    try {
      // Step 1: Create text embedder
      const embedder = await createEmbedder(systemInfo.modelName);
      console.log(`✓ Text embedder created: ${systemInfo.modelName} (${systemInfo.modelDimensions}D)`);

      // Step 2: Create reranker based on strategy
      const rerankFn = await this.createTextReranker(systemInfo.rerankingStrategy);
      if (rerankFn) {
        console.log(`✓ Text reranker created: ${systemInfo.rerankingStrategy}`);
      } else {
        console.log('ℹ️  Reranking disabled');
      }

      // Step 3: Initialize core components (using shared connection)
      const indexManager = new IndexManager(indexPath, dbPath, systemInfo.modelDimensions, systemInfo.modelName);
      await indexManager.initialize();

      // Step 4: Create ContentResolver for unified content system
      const contentResolver = new ContentResolver(db);

      // Step 5: Create search engine with dependency injection
      const searchEngine = new SearchEngine(
        embedder.embedText.bind(embedder),
        indexManager,
        db,
        rerankFn,
        contentResolver
      );

      console.log('✅ Text search engine initialized successfully');
      return searchEngine;

    } catch (error) {
      throw createError.model(`Failed to create text search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a search engine configured for multimodal mode
   * @private
   */
  private static async createMultimodalSearchEngine(
    indexPath: string,
    dbPath: string,
    systemInfo: SystemInfo,
    db: any
  ): Promise<SearchEngine> {
    console.log('🖼️  Creating multimodal search engine...');

    try {
      // Step 1: Create multimodal embedder (CLIP)
      const embedder = await createEmbedder(systemInfo.modelName);
      console.log(`✓ Multimodal embedder created: ${systemInfo.modelName} (${systemInfo.modelDimensions}D)`);

      // Step 2: Create multimodal reranker based on strategy
      const rerankFn = await this.createMultimodalReranker(systemInfo.rerankingStrategy);
      if (rerankFn) {
        console.log(`✓ Multimodal reranker created: ${systemInfo.rerankingStrategy}`);
      } else {
        console.log('ℹ️  Reranking disabled');
      }

      // Step 3: Initialize core components (using shared connection)
      const indexManager = new IndexManager(indexPath, dbPath, systemInfo.modelDimensions, systemInfo.modelName);
      await indexManager.initialize();

      // Step 4: Create ContentResolver for unified content system
      const contentResolver = new ContentResolver(db);

      // Step 5: Create search engine with dependency injection
      const searchEngine = new SearchEngine(
        embedder.embedText.bind(embedder),
        indexManager,
        db,
        rerankFn,
        contentResolver
      );

      console.log('✅ Multimodal search engine initialized successfully');
      return searchEngine;

    } catch (error) {
      throw createError.model(`Failed to create multimodal search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // RERANKER CREATION FUNCTIONS
  // =============================================================================

  /**
   * Create reranker for text mode using lazy loading
   * @private
   */
  private static async createTextReranker(strategy: string): Promise<RerankFunction | undefined> {
    try {
      if (strategy === 'disabled') {
        return undefined;
      }

      // Use lazy loading to avoid loading reranking dependencies unless needed
      const { LazyRerankerLoader } = await import('./lazy-dependency-loader.js');

      // For text mode, use cross-encoder reranking
      if (strategy === 'cross-encoder') {
        return LazyRerankerLoader.loadTextReranker();
      }

      // Fallback to cross-encoder for unknown strategies in text mode
      console.warn(`Unknown text reranking strategy '${strategy}', falling back to cross-encoder`);
      return LazyRerankerLoader.loadTextReranker();

    } catch (error) {
      console.warn(`Failed to create text reranker with strategy '${strategy}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('Disabling reranking due to errors');
      return undefined;
    }
  }

  /**
   * Create reranker for multimodal mode using lazy loading
   * @private
   */
  private static async createMultimodalReranker(strategy: string): Promise<RerankFunction | undefined> {
    try {
      if (strategy === 'disabled') {
        return undefined;
      }

      // Use lazy loading to avoid loading multimodal dependencies unless needed
      const { LazyDependencyManager } = await import('./lazy-dependency-loader.js');

      // Load the appropriate reranker based on strategy
      return LazyDependencyManager.loadReranker(strategy);

    } catch (error) {
      console.warn(`Failed to create multimodal reranker with strategy '${strategy}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('Disabling reranking due to errors');
      return undefined;
    }
  }



  // =============================================================================
  // VALIDATION AND ERROR HANDLING
  // =============================================================================

  /**
   * Validate that required files exist
   * @private
   */
  private static validateRequiredFiles(indexPath: string, dbPath: string): void {
    if (!existsSync(indexPath)) {
      throw createError.fileSystem(
        `Vector index not found: ${indexPath}\n` +
        'Run ingestion first to create the index:\n' +
        '  raglite ingest <directory>\n' +
        'Or check if the path is correct.'
      );
    }

    if (!existsSync(dbPath)) {
      throw createError.fileSystem(
        `Database not found: ${dbPath}\n` +
        'Run ingestion first to create the database:\n' +
        '  raglite ingest <directory>\n' +
        'Or check if the path is correct.'
      );
    }
  }

  /**
   * Enhance creation errors with helpful context
   * @private
   */
  private static enhanceCreationError(error: unknown, indexPath: string, dbPath: string): Error {
    if (error instanceof Error) {
      // Add context about the operation that failed
      let enhancedMessage = `PolymorphicSearchFactory.create failed: ${error.message}`;

      // Provide specific guidance based on error type
      if (error.message.includes('ENOENT')) {
        enhancedMessage += '\n\n💡 Make sure both the vector index and database files exist.';
        enhancedMessage += '\n   Run ingestion first: raglite ingest <directory>';
      } else if (error.message.includes('SQLITE_CORRUPT')) {
        enhancedMessage += '\n\n💡 Database appears to be corrupted.';
        enhancedMessage += '\n   Try deleting the database and re-running ingestion.';
      } else if (error.message.includes('Model') && error.message.includes('not found')) {
        enhancedMessage += '\n\n💡 The model specified in the database is not supported.';
        enhancedMessage += '\n   Check the model name or re-run ingestion with a supported model.';
      } else if (error.message.includes('dimensions')) {
        enhancedMessage += '\n\n💡 Vector dimension mismatch detected.';
        enhancedMessage += '\n   The index was created with a different model. Rebuild the index:';
        enhancedMessage += '\n   raglite ingest <directory> --force-rebuild';
      }

      return new Error(enhancedMessage);
    }

    return new Error(`PolymorphicSearchFactory.create failed: Unknown error`);
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick function to create a search engine with automatic mode detection
 * Convenience wrapper around PolymorphicSearchFactory.create
 * 
 * @param indexPath - Path to the vector index file
 * @param dbPath - Path to the database file
 * @returns Promise resolving to configured SearchEngine
 * 
 * @example
 * ```typescript
 * const search = await createPolymorphicSearchEngine('./index.bin', './db.sqlite');
 * const results = await search.search('query');
 * ```
 */
export async function createPolymorphicSearchEngine(
  indexPath: string,
  dbPath: string
): Promise<SearchEngine> {
  return PolymorphicSearchFactory.create(indexPath, dbPath);
}

/**
 * Check what mode a database is configured for
 * Convenience function for inspecting database configuration
 * 
 * @param dbPath - Path to the database file
 * @returns Promise resolving to the detected mode
 * 
 * @example
 * ```typescript
 * const mode = await detectSearchEngineMode('./db.sqlite');
 * console.log(`Database is configured for ${mode} mode`);
 * ```
 */
export async function detectSearchEngineMode(dbPath: string): Promise<ModeType> {
  const modeService = new ModeDetectionService(dbPath);
  const systemInfo = await modeService.detectMode();
  return systemInfo.mode;
}

/**
 * Get system information for a database
 * Convenience function for inspecting complete database configuration
 * 
 * @param dbPath - Path to the database file
 * @returns Promise resolving to complete SystemInfo
 * 
 * @example
 * ```typescript
 * const info = await getSearchEngineInfo('./db.sqlite');
 * console.log(`Mode: ${info.mode}, Model: ${info.modelName}, Dimensions: ${info.modelDimensions}`);
 * ```
 */
export async function getSearchEngineInfo(dbPath: string): Promise<SystemInfo> {
  const modeService = new ModeDetectionService(dbPath);
  return modeService.detectMode();
}