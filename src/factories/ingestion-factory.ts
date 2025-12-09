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
 * 1. Mode Selection:
 * ```typescript
 * // Text mode (default) - optimized for text-only content
 * const textIngestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
 *   mode: 'text',
 *   embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
 * });
 * 
 * // Multimodal mode - enables cross-modal search
 * const multimodalIngestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
 *   mode: 'multimodal',
 *   embeddingModel: 'Xenova/clip-vit-base-patch32',
 *   rerankingStrategy: 'text-derived'
 * });
 * ```
 */

import { IngestionPipeline } from '../core/ingestion.js';
import { IndexManager } from '../index-manager.js';
import { openDatabase } from '../core/db.js';
import { createTextEmbedFunction } from '../text/embedder.js';
import { config, getModelDefaults } from '../core/config.js';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { ContentManager } from '../core/content-manager.js';
import { validateModeModelCompatibilityOrThrow } from '../core/mode-model-validator.js';
import {
  createInvalidPathError,
  createFactoryCreationError,
  createModeMismatchError
} from '../core/actionable-error-messages.js';

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
export interface IngestionFactoryOptions {
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
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin');
 * await ingestion.ingestDirectory('./documents');
 * 
 * // With custom configuration
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   chunkSize: 512,
 *   chunkOverlap: 50,
 *   forceRebuild: true
 * });
 * 
 * // With defaults
 * const ingestion = await IngestionFactory.createWithDefaults({
 *   batchSize: 32 // Faster processing
 * });
 * ```
 */
export class IngestionFactory {
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
   * const ingestion = await IngestionFactory.create('./my-db.sqlite', './my-index.bin');
   * 
   * // Create with custom content system configuration
   * const ingestion = await IngestionFactory.create('./my-db.sqlite', './my-index.bin', {
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
    options: IngestionFactoryOptions = {}
  ): Promise<IngestionPipeline> {
    try {
      console.log('🏭 IngestionFactory: Initializing text ingestion pipeline...');

      // Validate input paths
      if (!dbPath || !indexPath) {
        throw createInvalidPathError([
          { name: 'dbPath', value: dbPath },
          { name: 'indexPath', value: indexPath }
        ], { operationContext: 'IngestionFactory.create' });
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

      // Step 1: Determine effective mode and select appropriate default model
      const effectiveMode = options.mode || 'text';
      
      // Step 1.5: Select model based on mode if not explicitly provided
      let effectiveModel: string;
      if (options.embeddingModel) {
        // Use explicitly provided model
        effectiveModel = options.embeddingModel;
      } else {
        // Select default model based on mode
        if (effectiveMode === 'multimodal') {
          const { DEFAULT_MODELS } = await import('../core/model-registry.js');
          effectiveModel = DEFAULT_MODELS['clip'];
          console.log(`📊 No model specified for multimodal mode, using default: ${effectiveModel}`);
        } else {
          effectiveModel = config.embedding_model;
        }
      }
      
      // Step 2: Get model-specific defaults and merge with options
      const modelDefaults = getModelDefaults(effectiveModel);
      const effectiveBatchSize = options.batchSize ?? modelDefaults.batch_size;
      const effectiveChunkSize = options.chunkSize ?? modelDefaults.chunk_size;
      const effectiveChunkOverlap = options.chunkOverlap ?? modelDefaults.chunk_overlap;

      // Step 3: Validate mode-model compatibility at creation time
      console.log('🔍 Validating mode-model compatibility...');
      validateModeModelCompatibilityOrThrow(effectiveMode, effectiveModel);
      console.log('✓ Mode-model compatibility validated');

      // Step 4: Initialize embedding function based on mode
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
      await this.handleModeStorage(db, options, modelDefaults, effectiveModel);

      // Step 5: Initialize index manager
      console.log('📇 Initializing vector index...');
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions, effectiveModel);

      // Check if we need to force recreation due to model change
      let forceRecreate = false;
      if (options.forceRebuild && existsSync(indexPath) && existsSync(dbPath)) {
        // When forceRebuild is true, always force recreation to handle any model/dimension mismatches
        forceRecreate = true;
        
        // Check if model has changed during rebuild for logging purposes
        const { getSystemInfo } = await import('../core/db.js');
        const tempDb = await openDatabase(dbPath);
        try {
          const systemInfo = await getSystemInfo(tempDb);
          
          if (systemInfo && systemInfo.modelName && systemInfo.modelName !== effectiveModel) {
            console.log(`🔄 Model change detected: ${systemInfo.modelName} → ${effectiveModel}`);
            console.log(`🔄 Dimensions change: ${systemInfo.modelDimensions} → ${modelDefaults.dimensions}`);
          } else if (systemInfo && systemInfo.modelDimensions && systemInfo.modelDimensions !== modelDefaults.dimensions) {
            console.log(`🔄 Dimension mismatch detected: ${systemInfo.modelDimensions} → ${modelDefaults.dimensions}`);
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
          const { setSystemInfo } = await import('../core/db.js');
          await setSystemInfo(db, {
            modelName: effectiveModel,
            modelDimensions: modelDefaults.dimensions
          });
          console.log(`✓ Updated stored model info: ${effectiveModel} (${modelDefaults.dimensions} dimensions)`);
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

      console.log('🎉 IngestionFactory: Ingestion pipeline initialized successfully');
      return ingestionPipeline;

    } catch (error) {
      console.error('❌ IngestionFactory: Failed to create ingestion pipeline');
      
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
        'IngestionFactory',
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
  static async createWithDefaults(options: IngestionFactoryOptions = {}): Promise<IngestionPipeline> {
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
    options: IngestionFactoryOptions, 
    modelDefaults: any,
    effectiveModel: string
  ): Promise<void> {
    const { getSystemInfo, setSystemInfo } = await import('../core/db.js');
    
    // Determine the effective mode and reranking strategy
    const effectiveMode = options.mode || 'text';
    // Phase 1: Fix mode-specific reranking strategy defaults
    const effectiveRerankingStrategy = options.rerankingStrategy ||
      (effectiveMode === 'multimodal' ? 'text-derived' : 'cross-encoder');
    
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
              { operationContext: 'IngestionFactory.create' }
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
