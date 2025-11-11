/**
 * Factory functions for creating text-specific search and ingestion instances
 * Handles complex initialization logic while providing clean API for common use cases
 * 
 * FACTORY PATTERN BENEFITS:
 * - Abstracts complex initialization (model loading, database setup, index initialization)
 * - Provides simple API for common use cases while preserving access to dependency injection
 * - Clear validation and error handling without fallback mechanisms
 * - Supports different embedding models and configurations
 * - Enables clean separation between simple usage and advanced customization
 * 
 * MODE SELECTION GUIDE:
 * - Text Mode (default): Optimized for text-only content
 *   - Uses sentence-transformer models (fast, accurate for text)
 *   - Images converted to text descriptions
 *   - Best for: document search, text clustering, semantic similarity
 * 
 * - Multimodal Mode: Optimized for mixed text/image content
 *   - Uses CLIP models (unified embedding space)
 *   - True cross-modal search (text finds images, images find text)
 *   - Best for: image search, visual QA, multimodal retrieval
 * 
 * USAGE PATTERNS:
 * 
 * 1. Simple Search Setup:
 * ```typescript
 * // Create search engine with defaults
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite');
 * const results = await search.search('query');
 * ```
 * 
 * 2. Custom Configuration:
 * ```typescript
 * // Create with custom options
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   enableReranking: true,
 *   topK: 20
 * });
 * ```
 * 
 * 3. Complete RAG System:
 * ```typescript
 * // Create both ingestion and search
 * const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
 *   './index.bin', 
 *   './db.sqlite'
 * );
 * 
 * // Ingest documents
 * await ingestionPipeline.ingestDirectory('./docs');
 * 
 * // Search documents
 * const results = await searchEngine.search('query');
 * ```
 * 
 * 4. Clear Error Handling:
 * ```typescript
 * // Create with clear validation and error reporting
 * const search = await TextFactoryHelpers.createSearchWithValidation(
 *   './index.bin', 
 *   './db.sqlite',
 *   { enableReranking: true } // Clear errors if issues occur
 * );
 * ```
 * 
 * 5. Mode Selection:
 * ```typescript
 * // Text mode (default) - optimized for text-only content
 * const textIngestion = await TextIngestionFactory.create('./db.sqlite', './index.bin', {
 *   mode: 'text',
 *   embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
 * });
 * 
 * // Multimodal mode - enables cross-modal search
 * const multimodalIngestion = await TextIngestionFactory.create('./db.sqlite', './index.bin', {
 *   mode: 'multimodal',
 *   embeddingModel: 'Xenova/clip-vit-base-patch32',
 *   rerankingStrategy: 'text-derived'
 * });
 * ```
 */

import { SearchEngine } from '../core/search.js';
import { IngestionPipeline } from '../core/ingestion.js';
import { type ChunkConfig } from '../core/chunker.js';
import { IndexManager } from '../index-manager.js';
import { openDatabase } from '../core/db.js';
import { createTextEmbedFunction } from '../text/embedder.js';
import { createTextRerankFunction } from '../text/reranker.js';
import { config, getModelDefaults } from '../core/config.js';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { ContentManager } from '../core/content-manager.js';
import { validateModeModelCompatibilityOrThrow } from '../core/mode-model-validator.js';
import {
  createMissingFileError,
  createInvalidPathError,
  createFactoryCreationError,
  createModeMismatchError
} from '../core/actionable-error-messages.js';

/**
 * Options for text search factory
 */
export interface TextSearchOptions {
  /** Embedding model name override */
  embeddingModel?: string;
  /** Embedding batch size override */
  batchSize?: number;
  /** Reranking model name override */
  rerankingModel?: string;
  /** Whether to enable reranking (default: true) */
  enableReranking?: boolean;
  /** Top-k results to return (default: from config) */
  topK?: number;
}

/**
 * Content system configuration options
 */
export interface ContentSystemConfig {
  /** Content directory path (default: '.raglite/content') */
  contentDir?: string;
  /** Maximum file size in bytes (default: 50MB) */
  maxFileSize?: number;
  /** Maximum content directory size in bytes (default: 2GB) */
  maxContentDirSize?: number;
  /** Enable content deduplication (default: true) */
  enableDeduplication?: boolean;
  /** Enable storage tracking (default: true) */
  enableStorageTracking?: boolean;
}

/**
 * Options for text ingestion factory
 */
export interface TextIngestionOptions {
  /** Embedding model name override */
  embeddingModel?: string;
  /** Embedding batch size override */
  batchSize?: number;
  /** Chunk size override */
  chunkSize?: number;
  /** Chunk overlap override */
  chunkOverlap?: number;
  /** Whether to force rebuild the index */
  forceRebuild?: boolean;
  /** Mode for the ingestion pipeline (text or multimodal) */
  mode?: 'text' | 'multimodal';
  /** Reranking strategy for multimodal mode */
  rerankingStrategy?: 'cross-encoder' | 'text-derived' | 'metadata' | 'hybrid' | 'disabled';
  /** Content system configuration */
  contentSystemConfig?: ContentSystemConfig;
}

/**
 * Factory for creating text-based SearchEngine instances
 * Handles model loading, database initialization, and index setup
 * 
 * This factory abstracts the complex initialization process required for text search:
 * 1. Auto-detects embedding model from database configuration
 * 2. Validates mode-model compatibility (no fallback mechanisms)
 * 3. Loads embedding models with clear error reporting
 * 4. Optionally loads reranking models based on configuration
 * 5. Establishes database connections and initializes schema
 * 6. Loads vector indexes with proper model compatibility checking
 * 7. Creates SearchEngine with proper dependency injection
 * 
 * Mode Support:
 * - Automatically detects mode from database (text or multimodal)
 * - Each mode uses its optimal implementation without fallbacks
 * - Clear validation ensures mode-model compatibility
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite');
 * const results = await search.search('What is machine learning?');
 * 
 * // With custom configuration
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   enableReranking: true,
 *   topK: 15
 * });
 * 
 * // With defaults (uses config file paths)
 * const search = await TextSearchFactory.createWithDefaults({
 *   enableReranking: false // Faster search
 * });
 * ```
 */
export class TextSearchFactory {
  /**
   * Create a SearchEngine configured for text search
   * 
   * This method handles the complete initialization process:
   * - Validates that required files exist
   * - Loads text embedding model (with lazy initialization)
   * - Optionally loads reranking model (with clear error reporting)
   * - Opens database connection and initializes schema
   * - Loads vector index with compatibility validation
   * - Creates SearchEngine with dependency injection
   * - Validates the complete setup
   * 
   * @param indexPath - Path to the vector index file (must exist)
   * @param dbPath - Path to the SQLite database file (must exist)
   * @param options - Optional configuration overrides
   * @param options.embeddingModel - Override embedding model (default: from config)
   * @param options.batchSize - Override embedding batch size (default: from config)
   * @param options.rerankingModel - Override reranking model (default: from config)
   * @param options.enableReranking - Enable/disable reranking (default: true)
   * @param options.topK - Number of results to return (default: from config)
   * @returns Promise resolving to configured SearchEngine
   * @throws {Error} If required files don't exist or initialization fails
   * 
   * @example
   * ```typescript
   * // Create search engine for existing index
   * const search = await TextSearchFactory.create('./my-index.bin', './my-db.sqlite');
   * 
   * // Search with the created engine
   * const results = await search.search('artificial intelligence');
   * console.log(`Found ${results.length} results`);
   * 
   * // Clean up when done
   * await search.cleanup();
   * ```
   */
  static async create(
    indexPath: string,
    dbPath: string,
    options: TextSearchOptions = {}
  ): Promise<SearchEngine> {
    try {
      console.log('🏭 TextSearchFactory: Initializing text search engine...');

      // Validate input paths
      if (!indexPath || !dbPath) {
        throw createInvalidPathError([
          { name: 'indexPath', value: indexPath },
          { name: 'dbPath', value: dbPath }
        ], { operationContext: 'TextSearchFactory.create' });
      }

      // Check if required files exist
      if (!existsSync(indexPath)) {
        throw createMissingFileError(indexPath, 'index', {
          operationContext: 'TextSearchFactory.create'
        });
      }

      if (!existsSync(dbPath)) {
        throw createMissingFileError(dbPath, 'database', {
          operationContext: 'TextSearchFactory.create'
        });
      }

      // Step 1: Auto-detect embedding model from database
      let embeddingModel = options.embeddingModel;
      let modelDimensions: number;

      if (!embeddingModel) {
        // Auto-detect model from database
        const { openDatabase, getStoredModelInfo } = await import('../core/db.js');
        const db = await openDatabase(dbPath);
        
        try {
          const storedModelInfo = await getStoredModelInfo(db);
          if (storedModelInfo) {
            embeddingModel = storedModelInfo.modelName;
            modelDimensions = storedModelInfo.dimensions;
            console.log(`📊 Auto-detected embedding model: ${embeddingModel} (${modelDimensions} dimensions)`);
          } else {
            // Fallback to config default
            embeddingModel = config.embedding_model;
            const modelDefaults = getModelDefaults(embeddingModel);
            modelDimensions = modelDefaults.dimensions;
            console.log(`📊 Using default embedding model: ${embeddingModel} (${modelDimensions} dimensions)`);
          }
        } finally {
          await db.close();
        }
      } else {
        // Use provided model
        const modelDefaults = getModelDefaults(embeddingModel);
        modelDimensions = modelDefaults.dimensions;
        console.log(`📊 Using specified embedding model: ${embeddingModel} (${modelDimensions} dimensions)`);
      }

      // Step 1.5: Validate mode-model compatibility at creation time
      console.log('🔍 Validating mode-model compatibility...');
      validateModeModelCompatibilityOrThrow('text', embeddingModel);
      console.log('✓ Mode-model compatibility validated');

      // Step 2: Initialize embedding function
      console.log('📊 Loading text embedding model...');
      const embedFn = createTextEmbedFunction(
        embeddingModel,
        options.batchSize
      );

      // Embedding function created successfully (will be tested on first use)
      console.log('✓ Text embedding function created successfully');

      // Step 3: Initialize reranking function (optional)
      let rerankFn;
      if (options.enableReranking === true) { // Default to disabled for local-first, fast RAG-lite
        console.log('🔄 Loading text reranking model...');
        rerankFn = createTextRerankFunction(options.rerankingModel);

        // Test reranking function - fail clearly if there are issues
        await rerankFn('test query', []);
        console.log('✓ Text reranking model loaded successfully');
      } else {
        console.log('🔄 Reranking disabled by default (local-first, fast mode)');
      }

      // Step 5: Initialize database connection
      console.log('💾 Opening database connection...');
      const db = await openDatabase(dbPath);
      
      // Initialize database schema if needed
      const { initializeSchema } = await import('../core/db.js');
      await initializeSchema(db);
      console.log('✓ Database connection established');

      // Step 6: Initialize index manager
      console.log('📇 Loading vector index...');
      const indexManager = new IndexManager(indexPath, dbPath, modelDimensions, embeddingModel);
      await indexManager.initialize();
      console.log('✓ Vector index loaded successfully');

      // Step 7: Create ContentResolver for unified content system
      console.log('📁 Initializing content resolver...');
      const { ContentResolver } = await import('../core/content-resolver.js');
      const contentResolver = new ContentResolver(db);
      console.log('✓ Content resolver ready');

      // Step 8: Create SearchEngine with dependency injection
      const searchEngine = new SearchEngine(embedFn, indexManager, db, rerankFn, contentResolver);

      // Step 9: Validate the setup
      const stats = await searchEngine.getStats();
      console.log(`✓ Search engine ready: ${stats.totalChunks} chunks indexed, reranking ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);

      console.log('🎉 TextSearchFactory: Search engine initialized successfully');
      return searchEngine;

    } catch (error) {
      console.error('❌ TextSearchFactory: Failed to create search engine');
      throw createFactoryCreationError(
        'TextSearchFactory',
        error instanceof Error ? error.message : 'Unknown error',
        { operationContext: 'search engine creation' }
      );
    }
  }

  /**
   * Create a SearchEngine with automatic path resolution
   * Uses default paths from configuration (config.index_file, config.db_file)
   * 
   * This is a convenience method that uses the default file paths from the configuration,
   * making it easy to create a search engine without specifying paths explicitly.
   * 
   * @param options - Optional configuration overrides
   * @param options.embeddingModel - Override embedding model
   * @param options.enableReranking - Enable/disable reranking
   * @param options.topK - Number of results to return
   * @returns Promise resolving to configured SearchEngine
   * @throws {Error} If default files don't exist or initialization fails
   * 
   * @example
   * ```typescript
   * // Use default paths from config
   * const search = await TextSearchFactory.createWithDefaults();
   * 
   * // Use defaults with custom options
   * const search = await TextSearchFactory.createWithDefaults({
   *   enableReranking: false,
   *   topK: 5
   * });
   * ```
   */
  static async createWithDefaults(options: TextSearchOptions = {}): Promise<SearchEngine> {
    const indexPath = config.index_file || './index.bin';
    const dbPath = config.db_file || './database.sqlite';

    return this.create(indexPath, dbPath, options);
  }
}

/**
 * Factory for creating text-based IngestionPipeline instances
 * Handles model loading, database initialization, and index setup
 * 
 * This factory abstracts the complex initialization process required for text ingestion:
 * 1. Creates necessary directories if they don't exist
 * 2. Validates mode-model compatibility (no fallback mechanisms)
 * 3. Loads and validates embedding models with clear error reporting
 * 4. Establishes database connections and initializes schema
 * 5. Stores mode configuration in database for automatic detection
 * 6. Creates or loads vector indexes with proper configuration
 * 7. Creates IngestionPipeline with proper dependency injection
 * 
 * Mode Configuration:
 * - Text Mode (default): Uses sentence-transformer models for text-only content
 * - Multimodal Mode: Uses CLIP models for mixed text/image content
 * - Mode is stored in database and auto-detected during search
 * - Clear validation prevents mode-model mismatches
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const ingestion = await TextIngestionFactory.create('./db.sqlite', './index.bin');
 * await ingestion.ingestDirectory('./documents');
 * 
 * // With custom configuration
 * const ingestion = await TextIngestionFactory.create('./db.sqlite', './index.bin', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   chunkSize: 512,
 *   chunkOverlap: 50,
 *   forceRebuild: true
 * });
 * 
 * // With defaults
 * const ingestion = await TextIngestionFactory.createWithDefaults({
 *   batchSize: 32 // Faster processing
 * });
 * ```
 */
export class TextIngestionFactory {
  /**
   * Create an IngestionPipeline configured for text ingestion
   * 
   * This method handles the complete initialization process:
   * - Creates necessary directories if they don't exist
   * - Loads text embedding model (with lazy initialization)
   * - Opens database connection and initializes schema
   * - Creates or loads vector index (with force rebuild option)
   * - Creates IngestionPipeline with dependency injection
   * - Validates the complete setup
   * 
   * @param dbPath - Path to the SQLite database file (will be created if doesn't exist)
   * @param indexPath - Path to the vector index file (will be created if doesn't exist)
   * @param options - Optional configuration overrides
   * @param options.embeddingModel - Override embedding model (default: from config)
   * @param options.batchSize - Override embedding batch size (default: from config)
   * @param options.chunkSize - Override chunk size (default: from config)
   * @param options.chunkOverlap - Override chunk overlap (default: from config)
   * @param options.forceRebuild - Force rebuild of existing index (default: false)
   * @param options.contentSystemConfig - Content system configuration options
   * @param options.contentSystemConfig.contentDir - Content directory path (default: '.raglite/content')
   * @param options.contentSystemConfig.maxFileSize - Maximum file size in bytes (default: 50MB)
   * @param options.contentSystemConfig.maxContentDirSize - Maximum content directory size (default: 2GB)
   * @param options.contentSystemConfig.enableDeduplication - Enable content deduplication (default: true)
   * @param options.contentSystemConfig.enableStorageTracking - Enable storage tracking (default: true)
   * @returns Promise resolving to configured IngestionPipeline
   * @throws {Error} If initialization fails
   * 
   * @example
   * ```typescript
   * // Create ingestion pipeline with default content system
   * const ingestion = await TextIngestionFactory.create('./my-db.sqlite', './my-index.bin');
   * 
   * // Create with custom content system configuration
   * const ingestion = await TextIngestionFactory.create('./my-db.sqlite', './my-index.bin', {
   *   contentSystemConfig: {
   *     contentDir: './custom-content',
   *     maxFileSize: 100 * 1024 * 1024, // 100MB
   *     maxContentDirSize: 5 * 1024 * 1024 * 1024, // 5GB
   *     enableDeduplication: true
   *   }
   * });
   * 
   * // Ingest documents from directory
   * const result = await ingestion.ingestDirectory('./documents');
   * console.log(`Processed ${result.documentsProcessed} documents`);
   * 
   * // Ingest content from memory (MCP integration)
   * const contentId = await ingestion.ingestFromMemory(buffer, {
   *   displayName: 'uploaded-file.pdf',
   *   contentType: 'application/pdf'
   * });
   * 
   * // Clean up when done
   * await ingestion.cleanup();
   * ```
   */
  static async create(
    dbPath: string,
    indexPath: string,
    options: TextIngestionOptions = {}
  ): Promise<IngestionPipeline> {
    try {
      console.log('🏭 TextIngestionFactory: Initializing text ingestion pipeline...');

      // Validate input paths
      if (!dbPath || !indexPath) {
        throw createInvalidPathError([
          { name: 'dbPath', value: dbPath },
          { name: 'indexPath', value: indexPath }
        ], { operationContext: 'TextIngestionFactory.create' });
      }

      // Ensure directories exist
      const dbDir = dirname(dbPath);
      const indexDir = dirname(indexPath);

      if (!existsSync(dbDir)) {
        console.log(`📁 Creating database directory: ${dbDir}`);
        mkdirSync(dbDir, { recursive: true });
      }

      if (!existsSync(indexDir)) {
        console.log(`📁 Creating index directory: ${indexDir}`);
        mkdirSync(indexDir, { recursive: true });
      }

      // Step 1: Get model-specific defaults and merge with options
      const modelDefaults = getModelDefaults(options.embeddingModel || config.embedding_model);
      const effectiveBatchSize = options.batchSize ?? modelDefaults.batch_size;
      const effectiveChunkSize = options.chunkSize ?? modelDefaults.chunk_size;
      const effectiveChunkOverlap = options.chunkOverlap ?? modelDefaults.chunk_overlap;

      // Step 1.5: Validate mode-model compatibility at creation time
      const effectiveMode = options.mode || 'text';
      const effectiveModel = options.embeddingModel || config.embedding_model;
      console.log('🔍 Validating mode-model compatibility...');
      validateModeModelCompatibilityOrThrow(effectiveMode, effectiveModel);
      console.log('✓ Mode-model compatibility validated');

      // Step 2: Initialize embedding function based on mode
      let embedFn: (query: string, contentType?: string) => Promise<any>;

      if (effectiveMode === 'multimodal') {
        console.log('📊 Loading CLIP embedding model for multimodal mode...');
        const { createEmbedder } = await import('../core/embedder-factory.js');
        const clipEmbedder = await createEmbedder(effectiveModel);
        
        // Wrap CLIP embedder to match EmbedFunction signature
        embedFn = async (content: string, contentType?: string) => {
          if (contentType === 'image') {
            // Use CLIP image embedding for image content
            return await clipEmbedder.embedImage!(content);
          }
          // Use CLIP text embedding for text content
          return await clipEmbedder.embedText(content);
        };
        
        console.log('✓ CLIP embedder created for multimodal mode');
      } else {
        // Text mode: use sentence-transformer embedder (existing behavior)
        console.log('📊 Loading text embedding model...');
        embedFn = createTextEmbedFunction(
          options.embeddingModel,
          effectiveBatchSize
        );
        console.log('✓ Text embedding function created successfully');
      }

      // Step 3: Initialize database connection
      console.log('💾 Opening database connection...');
      const db = await openDatabase(dbPath);
      
      // Initialize database schema if needed
      const { initializeSchema } = await import('../core/db.js');
      await initializeSchema(db);
      console.log('✓ Database connection established');

      // Step 3.1: Handle mode storage during ingestion
      await this.handleModeStorage(db, options, modelDefaults);

      // Step 4: Initialize index manager
      console.log('📇 Initializing vector index...');
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions, options.embeddingModel || config.embedding_model);

      // Check if we need to force recreation due to model change
      let forceRecreate = false;
      if (options.forceRebuild && existsSync(indexPath) && existsSync(dbPath)) {
        // When forceRebuild is true, always force recreation to handle any model/dimension mismatches
        forceRecreate = true;
        
        // Check if model has changed during rebuild for logging purposes
        const { getStoredModelInfo } = await import('../core/db.js');
        const tempDb = await openDatabase(dbPath);
        try {
          const storedModel = await getStoredModelInfo(tempDb);
          const currentModel = options.embeddingModel || config.embedding_model;
          
          if (storedModel && storedModel.modelName !== currentModel) {
            console.log(`🔄 Model change detected: ${storedModel.modelName} → ${currentModel}`);
            console.log(`🔄 Dimensions change: ${storedModel.dimensions} → ${modelDefaults.dimensions}`);
          } else if (storedModel && storedModel.dimensions !== modelDefaults.dimensions) {
            console.log(`🔄 Dimension mismatch detected: ${storedModel.dimensions} → ${modelDefaults.dimensions}`);
          }
        } finally {
          await tempDb.close();
        }
      }

      // Handle force rebuild or create new index
      if (options.forceRebuild || !existsSync(indexPath)) {
        if (options.forceRebuild && existsSync(indexPath)) {
          console.log('🔄 Force rebuild requested, recreating index...');
        } else {
          console.log('📇 Creating new vector index...');
        }

        // Initialize with skipModelCheck and forceRecreate for rebuilds
        await indexManager.initialize(options.forceRebuild, forceRecreate);
        
        // Update stored model info when rebuilding or creating new index
        if (options.forceRebuild || forceRecreate) {
          const { setStoredModelInfo } = await import('../core/db.js');
          const currentModel = options.embeddingModel || config.embedding_model;
          await setStoredModelInfo(db, currentModel, modelDefaults.dimensions);
          console.log(`✓ Updated stored model info: ${currentModel} (${modelDefaults.dimensions} dimensions)`);
        }
      } else {
        // Load existing index
        await indexManager.initialize();
      }
      console.log('✓ Vector index ready');

      // Step 5: Create ContentManager for unified content system
      console.log('📁 Initializing content management system...');
      const contentSystemConfig = await this.validateAndPrepareContentSystemConfig(options.contentSystemConfig);
      const contentManager = new ContentManager(db, contentSystemConfig);
      console.log('✓ Content management system ready');

      // Step 6: Create IngestionPipeline with dependency injection and chunk configuration
      const chunkConfig = {
        chunkSize: effectiveChunkSize,
        chunkOverlap: effectiveChunkOverlap
      };
      const ingestionPipeline = new IngestionPipeline(embedFn, indexManager, db, chunkConfig, contentManager);

      console.log('🎉 TextIngestionFactory: Ingestion pipeline initialized successfully');
      return ingestionPipeline;

    } catch (error) {
      console.error('❌ TextIngestionFactory: Failed to create ingestion pipeline');
      
      // Preserve custom error messages for model mismatch and mode mismatch
      if (error instanceof Error && (
        error.message.includes('Model mismatch') || 
        error.message.includes('Mode mismatch') ||
        error.message.includes('--force-rebuild') ||
        error.message.includes('--rebuild-if-needed')
      )) {
        throw error; // Re-throw custom validation errors as-is
      }
      
      throw createFactoryCreationError(
        'TextIngestionFactory',
        error instanceof Error ? error.message : 'Unknown error',
        { operationContext: 'ingestion pipeline creation' }
      );
    }
  }

  /**
   * Create an IngestionPipeline with automatic path resolution
   * Uses default paths based on current working directory
   * @param options - Optional configuration overrides
   * @returns Promise resolving to configured IngestionPipeline
   */
  static async createWithDefaults(options: TextIngestionOptions = {}): Promise<IngestionPipeline> {
    const dbPath = config.db_file || './database.sqlite';
    const indexPath = config.index_file || './index.bin';

    return this.create(dbPath, indexPath, options);
  }

  /**
   * Handles mode storage during ingestion
   * Creates or validates system info based on the provided mode and options
   * @private
   */
  private static async handleModeStorage(
    db: any, 
    options: TextIngestionOptions, 
    modelDefaults: any
  ): Promise<void> {
    const { getSystemInfo, setSystemInfo } = await import('../core/db.js');
    
    // Determine the effective mode and model
    const effectiveMode = options.mode || 'text';
    const effectiveModel = options.embeddingModel || config.embedding_model;
    const effectiveRerankingStrategy = options.rerankingStrategy || 'cross-encoder';
    
    // Determine model type based on model name
    let modelType: 'sentence-transformer' | 'clip';
    if (effectiveModel.includes('clip')) {
      modelType = 'clip';
    } else {
      modelType = 'sentence-transformer';
    }
    
    // Determine supported content types based on mode
    const supportedContentTypes = effectiveMode === 'multimodal' ? ['text', 'image'] : ['text'];
    
    try {
      // Check if system info already exists
      const existingSystemInfo = await getSystemInfo(db);
      
      if (existingSystemInfo) {
        // Validate mode consistency for subsequent ingestions
        if (existingSystemInfo.mode !== effectiveMode) {
          console.warn(`⚠️  Mode mismatch detected!`);
          console.warn(`   Database mode: ${existingSystemInfo.mode}`);
          console.warn(`   Requested mode: ${effectiveMode}`);
          
          if (options.forceRebuild) {
            console.log('🔄 Force rebuild enabled, updating mode configuration...');
            await this.updateSystemInfo(db, effectiveMode, effectiveModel, modelType, modelDefaults, effectiveRerankingStrategy, supportedContentTypes);
          } else {
            throw createModeMismatchError(
              existingSystemInfo.mode,
              effectiveMode,
              { operationContext: 'TextIngestionFactory.create' }
            );
          }
        } else if (existingSystemInfo.modelName !== effectiveModel) {
          // Model change within the same mode
          console.log(`🔄 Model change detected: ${existingSystemInfo.modelName} → ${effectiveModel}`);
          
          if (options.forceRebuild) {
            console.log('🔄 Force rebuild enabled, updating model configuration...');
            await this.updateSystemInfo(db, effectiveMode, effectiveModel, modelType, modelDefaults, effectiveRerankingStrategy, supportedContentTypes);
          } else {
            // Create a specific error message for model mismatch with rebuild suggestions
            const errorMessage = [
              `❌ Model mismatch: Database is configured for '${existingSystemInfo.modelName}', but '${effectiveModel}' was requested.`,
              '',
              '🛠️  How to fix this:',
              '   1. Use --force-rebuild to change models:',
              '      raglite ingest <path> --model ' + effectiveModel + ' --force-rebuild',
              '',
              '   2. Or use --rebuild-if-needed for automatic handling:',
              '      raglite ingest <path> --model ' + effectiveModel + ' --rebuild-if-needed',
              '',
              '   3. Or continue using the existing model:',
              '      raglite ingest <path>  # Uses ' + existingSystemInfo.modelName,
              '',
              '🔍 Model switching requires rebuilding the vector index because different models',
              '   produce embeddings with different dimensions and characteristics.'
            ].join('\n');
            
            throw new Error(errorMessage);
          }
        } else {
          console.log(`✅ Mode consistency validated: ${effectiveMode} mode with ${effectiveModel}`);
        }
      } else {
        // First ingestion - create system info
        console.log(`🔧 First ingestion detected, storing system configuration...`);
        console.log(`   Mode: ${effectiveMode}`);
        console.log(`   Model: ${effectiveModel} (${modelType})`);
        console.log(`   Dimensions: ${modelDefaults.dimensions}`);
        console.log(`   Reranking: ${effectiveRerankingStrategy}`);
        console.log(`   Content types: ${supportedContentTypes.join(', ')}`);
        
        await this.updateSystemInfo(db, effectiveMode, effectiveModel, modelType, modelDefaults, effectiveRerankingStrategy, supportedContentTypes);
        console.log('✅ System configuration stored successfully');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Mode mismatch') || error.message.includes('Model mismatch'))) {
        throw error; // Re-throw validation errors with custom messages
      }
      console.error('❌ Failed to handle mode storage:', error);
      throw new Error(`Mode storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates system info in the database
   * @private
   */
  private static async updateSystemInfo(
    db: any,
    mode: 'text' | 'multimodal',
    modelName: string,
    modelType: 'sentence-transformer' | 'clip',
    modelDefaults: any,
    rerankingStrategy: string,
    supportedContentTypes: string[]
  ): Promise<void> {
    const { setSystemInfo } = await import('../core/db.js');
    
    await setSystemInfo(db, {
      mode,
      modelName,
      modelType,
      modelDimensions: modelDefaults.dimensions,
      modelVersion: '1.0.0', // TODO: Get actual version from model
      supportedContentTypes,
      rerankingStrategy: rerankingStrategy as any,
      rerankingModel: undefined,
      rerankingConfig: undefined
    });
  }

  /**
   * Validates and prepares content system configuration
   * @private
   */
  private static async validateAndPrepareContentSystemConfig(
    userConfig?: ContentSystemConfig
  ): Promise<ContentSystemConfig> {
    // Default configuration
    const defaultConfig: ContentSystemConfig = {
      contentDir: '.raglite/content',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxContentDirSize: 2 * 1024 * 1024 * 1024, // 2GB
      enableDeduplication: true,
      enableStorageTracking: true
    };

    // Merge with user configuration
    const config = { ...defaultConfig, ...userConfig };

    // Validate content directory path
    if (!config.contentDir || typeof config.contentDir !== 'string') {
      throw new Error('Content directory path must be a non-empty string');
    }

    // Validate file size limits
    if (config.maxFileSize && (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0)) {
      throw new Error('Maximum file size must be a positive number');
    }

    if (config.maxContentDirSize && (typeof config.maxContentDirSize !== 'number' || config.maxContentDirSize <= 0)) {
      throw new Error('Maximum content directory size must be a positive number');
    }

    // Validate that maxFileSize is not larger than maxContentDirSize
    if (config.maxFileSize && config.maxContentDirSize && config.maxFileSize > config.maxContentDirSize) {
      throw new Error('Maximum file size cannot be larger than maximum content directory size');
    }

    // Validate boolean options
    if (config.enableDeduplication !== undefined && typeof config.enableDeduplication !== 'boolean') {
      throw new Error('enableDeduplication must be a boolean value');
    }

    if (config.enableStorageTracking !== undefined && typeof config.enableStorageTracking !== 'boolean') {
      throw new Error('enableStorageTracking must be a boolean value');
    }

    // Create content directory if it doesn't exist
    try {
      const { promises: fs } = await import('fs');
      await fs.mkdir(config.contentDir, { recursive: true });
      
      // Verify directory is writable
      await fs.access(config.contentDir, (await import('fs')).constants.W_OK);
      
      console.log(`✓ Content directory validated: ${config.contentDir}`);
    } catch (error) {
      throw new Error(
        `Failed to create or access content directory '${config.contentDir}': ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Please check permissions and path validity.`
      );
    }

    return config;
  }
}

/**
 * Convenience factory to create both search and ingestion instances
 * Useful for applications that need both capabilities with shared configuration
 * 
 * This factory creates a complete RAG (Retrieval-Augmented Generation) system
 * by initializing both ingestion and search capabilities with shared resources.
 * The ingestion pipeline is created first to handle directory creation and
 * initial setup, then the search engine is created to use the same resources.
 * 
 * @example
 * ```typescript
 * // Create complete RAG system
 * const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
 *   './index.bin',
 *   './db.sqlite'
 * );
 * 
 * // First, ingest some documents
 * await ingestionPipeline.ingestDirectory('./knowledge-base');
 * 
 * // Then search the ingested content
 * const results = await searchEngine.search('What is the main topic?');
 * 
 * // Clean up both instances
 * await Promise.all([
 *   searchEngine.cleanup(),
 *   ingestionPipeline.cleanup()
 * ]);
 * ```
 */
export class TextRAGFactory {
  /**
   * Create both SearchEngine and IngestionPipeline instances
   * 
   * This method creates a complete RAG system by:
   * 1. Creating an ingestion pipeline (handles directory creation)
   * 2. Creating a search engine (uses the same database and index)
   * 3. Ensuring both instances use compatible configurations
   * 
   * The ingestion pipeline is created first because it handles directory
   * creation and initial setup, while the search engine requires existing
   * files to validate the setup.
   * 
   * @param indexPath - Path to the vector index file
   * @param dbPath - Path to the SQLite database file
   * @param searchOptions - Optional search configuration
   * @param searchOptions.enableReranking - Enable reranking for better results
   * @param searchOptions.topK - Number of search results to return
   * @param ingestionOptions - Optional ingestion configuration
   * @param ingestionOptions.chunkSize - Size of text chunks for processing
   * @param ingestionOptions.forceRebuild - Force rebuild of existing index
   * @returns Promise resolving to both configured instances
   * @throws {Error} If initialization of either component fails
   * 
   * @example
   * ```typescript
   * // Create with custom options for both components
   * const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
   *   './index.bin',
   *   './db.sqlite',
   *   { enableReranking: true, topK: 15 }, // Search options
   *   { chunkSize: 512, forceRebuild: true } // Ingestion options
   * );
   * 
   * // Use the complete system
   * await ingestionPipeline.ingestDirectory('./docs');
   * const results = await searchEngine.search('machine learning');
   * ```
   */
  static async createBoth(
    indexPath: string,
    dbPath: string,
    searchOptions: TextSearchOptions = {},
    ingestionOptions: TextIngestionOptions = {}
  ): Promise<{
    searchEngine: SearchEngine;
    ingestionPipeline: IngestionPipeline;
  }> {
    console.log('🏭 TextRAGFactory: Creating complete RAG system...');

    // Create ingestion pipeline first (handles directory creation)
    const ingestionPipeline = await TextIngestionFactory.create(dbPath, indexPath, ingestionOptions);

    // Create search engine (requires existing files)
    const searchEngine = await TextSearchFactory.create(indexPath, dbPath, searchOptions);

    console.log('🎉 TextRAGFactory: Complete RAG system ready');
    return { searchEngine, ingestionPipeline };
  }

  /**
   * Create both instances with default paths
   * @param searchOptions - Optional search configuration
   * @param ingestionOptions - Optional ingestion configuration
   * @returns Promise resolving to both instances
   */
  static async createBothWithDefaults(
    searchOptions: TextSearchOptions = {},
    ingestionOptions: TextIngestionOptions = {}
  ): Promise<{
    searchEngine: SearchEngine;
    ingestionPipeline: IngestionPipeline;
  }> {
    const indexPath = config.index_file || './index.bin';
    const dbPath = config.db_file || './database.sqlite';

    return this.createBoth(indexPath, dbPath, searchOptions, ingestionOptions);
  }
}

/**
 * Helper functions for common factory patterns and error recovery
 * 
 * This class provides utility functions that support the main factory classes
 * with validation, configuration recommendations, and error recovery patterns.
 * These helpers enable more robust factory usage and better error handling.
 * 
 * @example
 * ```typescript
 * // Validate files before creating search engine
 * try {
 *   TextFactoryHelpers.validateSearchFiles('./index.bin', './db.sqlite');
 *   const search = await TextSearchFactory.create('./index.bin', './db.sqlite');
 * } catch (error) {
 *   console.error('Files not ready for search:', error.message);
 * }
 * 
 * // Get recommended configuration for different use cases
 * const { searchOptions, ingestionOptions } = TextFactoryHelpers.getRecommendedConfig('quality');
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', searchOptions);
 * 
 * // Create with clear validation and error reporting
 * const search = await TextFactoryHelpers.createSearchWithValidation('./index.bin', './db.sqlite', {
 *   enableReranking: true // Will fail clearly if reranking has issues
 * });
 * ```
 */
export class TextFactoryHelpers {
  /**
   * Validate that required files exist for search operations
   * 
   * This method checks that both the vector index and database files exist
   * and provides helpful error messages with suggestions for resolution.
   * Use this before attempting to create a search engine to get better
   * error messages than the generic file not found errors.
   * 
   * @param indexPath - Path to vector index file
   * @param dbPath - Path to database file
   * @throws {Error} If either file doesn't exist, with helpful resolution steps
   * 
   * @example
   * ```typescript
   * // Validate before creating search engine
   * try {
   *   TextFactoryHelpers.validateSearchFiles('./index.bin', './db.sqlite');
   *   console.log('Files are ready for search');
   * } catch (error) {
   *   console.error('Search files not ready:', error.message);
   *   // Error message includes suggestions like "Run ingestion first"
   * }
   * ```
   */
  static validateSearchFiles(indexPath: string, dbPath: string): void {
    if (!existsSync(indexPath)) {
      throw createMissingFileError(indexPath, 'index', {
        operationContext: 'search file validation'
      });
    }

    if (!existsSync(dbPath)) {
      throw createMissingFileError(dbPath, 'database', {
        operationContext: 'search file validation'
      });
    }
  }

  /**
   * Get recommended configuration for different use cases
   * 
   * This method provides pre-configured options optimized for different
   * performance vs quality trade-offs. Use these as starting points
   * and adjust based on your specific requirements.
   * 
   * @param useCase - The intended use case scenario
   * @param useCase.fast - Optimized for speed (no reranking, smaller chunks)
   * @param useCase.balanced - Good balance of speed and quality (default)
   * @param useCase.quality - Optimized for best results (reranking enabled, larger chunks)
   * @returns Recommended configuration for both search and ingestion
   * 
   * @example
   * ```typescript
   * // Get configuration for quality-focused use case
   * const { searchOptions, ingestionOptions } = TextFactoryHelpers.getRecommendedConfig('quality');
   * 
   * // Create instances with recommended settings
   * const ingestion = await TextIngestionFactory.create('./db.sqlite', './index.bin', ingestionOptions);
   * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', searchOptions);
   * 
   * // Or use with RAG factory
   * const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
   *   './index.bin',
   *   './db.sqlite',
   *   searchOptions,
   *   ingestionOptions
   * );
   * ```
   */
  static getRecommendedConfig(useCase: 'fast' | 'balanced' | 'quality'): {
    searchOptions: TextSearchOptions;
    ingestionOptions: TextIngestionOptions;
  } {
    switch (useCase) {
      case 'fast':
        return {
          searchOptions: {
            enableReranking: false,
            topK: 5
          },
          ingestionOptions: {
            batchSize: 32,
            chunkSize: 512
          }
        };

      case 'balanced':
        return {
          searchOptions: {
            enableReranking: true,
            topK: 10
          },
          ingestionOptions: {
            batchSize: 16,
            chunkSize: 1024
          }
        };

      case 'quality':
        return {
          searchOptions: {
            enableReranking: true,
            topK: 20
          },
          ingestionOptions: {
            batchSize: 8,
            chunkSize: 2048
          }
        };

      default:
        return this.getRecommendedConfig('balanced');
    }
  }

  /**
   * Create a search engine with clear error reporting
   * 
   * This method creates a search engine with the provided options and fails
   * clearly if there are any issues, providing actionable error messages.
   * 
   * @param indexPath - Path to vector index file
   * @param dbPath - Path to database file
   * @param options - Configuration options
   * @returns Promise resolving to SearchEngine
   * @throws {Error} If creation fails with clear error message
   * 
   * @example
   * ```typescript
   * // Create search engine with clear error handling
   * const search = await TextFactoryHelpers.createSearchWithValidation(
   *   './index.bin',
   *   './db.sqlite',
   *   { enableReranking: true, topK: 20 }
   * );
   * 
   * const results = await search.search('query');
   * console.log(`Search created successfully with ${results.length} results`);
   * ```
   */
  static async createSearchWithValidation(
    indexPath: string,
    dbPath: string,
    options: TextSearchOptions = {}
  ): Promise<SearchEngine> {
    // Validate files first
    this.validateSearchFiles(indexPath, dbPath);
    
    // Create with clear error reporting
    return await TextSearchFactory.create(indexPath, dbPath, options);
  }
}