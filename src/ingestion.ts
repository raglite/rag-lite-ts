import { discoverAndProcessFiles, type FileProcessorOptions } from './file-processor.js';
import { chunkDocument, type ChunkConfig } from './chunker.js';
import { initializeEmbeddingEngine, type EmbeddingEngine } from './embedder.js';
import { IndexManager } from './index-manager.js';
import { openDatabase, initializeSchema, insertDocument, insertChunk, upsertDocument, type DatabaseConnection } from './db.js';
import { config, validateConfig, Config, getModelDefaults } from './config.js';
import { DocumentPathManager } from './path-manager.js';
import type { Document, EmbeddingResult } from './types.js';
import type { Chunk } from './chunker.js';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * User-friendly error class with actionable suggestions
 */
export class IngestionError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions: string[]
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

/**
 * Options for the ingestion pipeline
 */
export interface IngestionOptions {
  /** File processing options */
  fileOptions?: FileProcessorOptions;
  /** Chunking configuration */
  chunkConfig?: ChunkConfig;
  /** Whether to force rebuild the index */
  forceRebuild?: boolean;
}

/**
 * Result of the ingestion process
 */
export interface IngestionResult {
  /** Total documents processed */
  documentsProcessed: number;
  /** Total chunks created */
  chunksCreated: number;
  /** Total embeddings generated */
  embeddingsGenerated: number;
  /** Number of documents that failed processing */
  documentErrors: number;
  /** Number of chunks that failed embedding */
  embeddingErrors: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Path configuration for ingestion pipeline
 */
interface PathConfig {
  basePath: string;
  dbPath: string;
  indexPath: string;
}

/**
 * Resolves paths for the ingestion pipeline based on basePath
 * @param basePath - Base directory path (defaults to current directory)
 * @returns Resolved paths for database and index files
 */
function resolveIngestionPaths(basePath?: string): PathConfig {
  const resolvedBasePath = basePath ? resolve(basePath) : process.cwd();

  return {
    basePath: resolvedBasePath,
    dbPath: join(resolvedBasePath, 'db.sqlite'),
    indexPath: join(resolvedBasePath, 'vector-index.bin')
  };
}



/**
 * Main ingestion pipeline class
 * Coordinates the entire process from file discovery to vector storage
 */
export class IngestionPipeline {
  // Static properties for automatic resource management (Requirement 5.4, 5.5)
  private static instances = new Set<IngestionPipeline>();
  private static cleanupHandlersSet = false;

  private db: DatabaseConnection | null = null;
  private indexManager: IndexManager | null = null;
  private embeddingEngine: EmbeddingEngine | null = null;
  private pathManager: DocumentPathManager | null = null;
  private isInitialized = false;
  private dbPath: string;
  private indexPath: string;
  private basePath: string;
  private configOverrides: Partial<Config> = {};

  /**
   * Creates a new IngestionPipeline with simplified constructor
   * Pipeline is ready to use immediately without requiring initialization calls (Requirement 1.5)
   * @param basePath - Base directory path for database and index files (defaults to current directory)
   * @param embedder - Pre-initialized embedding engine (optional, will use default if not provided)
   */
  constructor(basePath?: string, embedder?: EmbeddingEngine) {
    // Validate parameters
    if (basePath !== undefined && (typeof basePath !== 'string' || basePath.trim() === '')) {
      throw new Error('basePath must be a non-empty string when provided');
    }

    if (embedder !== undefined && (typeof embedder !== 'object' || embedder === null)) {
      throw new Error('embedder must be a valid EmbeddingEngine instance when provided');
    }

    // Resolve paths automatically
    const pathConfig = resolveIngestionPaths(basePath);
    this.basePath = pathConfig.basePath;
    this.dbPath = pathConfig.dbPath;
    this.indexPath = pathConfig.indexPath;

    // Store the provided embedder for later use
    if (embedder) {
      this.embeddingEngine = embedder;
    }

    // Initialize path manager with default configuration
    const effectiveConfig = this.getEffectiveConfig();
    this.pathManager = new DocumentPathManager(
      effectiveConfig.path_storage_strategy,
      this.basePath
    );

    // Set up automatic cleanup on process exit (Requirement 5.5)
    this.setupAutomaticCleanup();
  }

  /**
   * Set configuration overrides (for internal use)
   * @param overrides - Configuration overrides to apply
   */
  setConfigOverrides(overrides: Partial<Config>): void {
    this.configOverrides = overrides;
  }

  /**
   * Set path storage strategy
   * @param strategy - Path storage strategy ('absolute' or 'relative')
   * @param basePath - Base path for relative paths (optional, defaults to current base path)
   */
  setPathStorageStrategy(strategy: 'absolute' | 'relative', basePath?: string): void {
    const effectiveBasePath = basePath || this.basePath;
    this.pathManager = new DocumentPathManager(strategy, effectiveBasePath);
  }

  /**
   * Get effective configuration with overrides applied
   */
  private getEffectiveConfig(): Config {
    const baseConfig = { ...config, ...this.configOverrides };

    // If model is overridden, apply model-specific defaults for chunk_size, chunk_overlap, and batch_size
    // unless they are explicitly overridden
    if (this.configOverrides.embedding_model && this.configOverrides.embedding_model !== config.embedding_model) {
      const modelDefaults = getModelDefaults(this.configOverrides.embedding_model);

      // Apply model-specific defaults only if not explicitly overridden
      if (!this.configOverrides.chunk_size) {
        baseConfig.chunk_size = modelDefaults.chunk_size;
      }
      if (!this.configOverrides.chunk_overlap) {
        baseConfig.chunk_overlap = modelDefaults.chunk_overlap;
      }
      if (!this.configOverrides.batch_size) {
        baseConfig.batch_size = modelDefaults.batch_size;
      }
    }

    return baseConfig;
  }

  /**
   * Automatically initialize resources on first use with user-friendly error handling
   * Implements lazy initialization as required by 5.2
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing ingestion pipeline...');

      const effectiveConfig = this.getEffectiveConfig();

      // Validate configuration
      validateConfig(effectiveConfig);

      // Initialize database
      console.log('Opening database connection...');
      this.db = await openDatabase(this.dbPath);
      await initializeSchema(this.db);

      // Initialize index manager
      console.log('Initializing index manager...');
      const { getModelDefaults } = await import('./config.js');
      const modelDefaults = getModelDefaults(effectiveConfig.embedding_model);
      this.indexManager = new IndexManager(this.indexPath, this.dbPath, modelDefaults.dimensions, effectiveConfig.embedding_model);
      await this.indexManager.initialize();

      // Initialize embedding engine (use provided one or create new)
      if (!this.embeddingEngine) {
        console.log('Loading embedding model...');
        const { initializeEmbeddingEngine } = await import('./embedder.js');
        this.embeddingEngine = await initializeEmbeddingEngine(effectiveConfig.embedding_model, effectiveConfig.batch_size);
      } else {
        console.log('Using provided embedding engine...');
      }

      // Check model version compatibility
      const currentModelVersion = this.embeddingEngine.getModelVersion();
      await this.indexManager.validateModelVersionOrExit(currentModelVersion);

      this.isInitialized = true;
      console.log('Ingestion pipeline initialized successfully');

    } catch (error) {
      await this.cleanup();
      throw this.createUserFriendlyError(error, 'initialization');
    }
  }

  /**
   * Create user-friendly error messages with actionable suggestions
   * Implements requirement 5.3: Clear, actionable error messages with specific next steps
   */
  private createUserFriendlyError(error: unknown, context: string): IngestionError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle common error scenarios with specific guidance
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      if (context === 'path_validation') {
        return new IngestionError(
          `Directory or file path does not exist: ${errorMessage}`,
          'PATH_NOT_FOUND',
          [
            'Check that the path exists and is accessible',
            'Ensure you have read permissions for the directory',
            'Use an absolute path if the relative path is not working'
          ]
        );
      } else {
        return new IngestionError(
          `Required files not found during ${context}`,
          'FILES_NOT_FOUND',
          [
            'Ensure the base directory exists and is writable',
            'Check file permissions in the target directory',
            'Try using an absolute path instead of a relative path'
          ]
        );
      }
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new IngestionError(
        `Permission denied during ${context}`,
        'PERMISSION_DENIED',
        [
          'Check that you have write permissions to the directory',
          'Try running with appropriate permissions',
          'Ensure the directory is not read-only'
        ]
      );
    }

    if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space left')) {
      return new IngestionError(
        `Insufficient disk space during ${context}`,
        'DISK_SPACE_FULL',
        [
          'Free up disk space in the target directory',
          'Choose a different location with more available space',
          'Check disk usage with your system tools'
        ]
      );
    }

    if (errorMessage.includes('model') && errorMessage.includes('version')) {
      return new IngestionError(
        `Embedding model compatibility issue: ${errorMessage}`,
        'MODEL_COMPATIBILITY',
        [
          'Run pipeline.rebuildIndex() to rebuild with the current model',
          'Or specify the same model that was used during original ingestion',
          'Check the model configuration in your setup'
        ]
      );
    }

    if (errorMessage.includes('embedding') || errorMessage.includes('model')) {
      return new IngestionError(
        `Embedding model initialization failed: ${errorMessage}`,
        'MODEL_INIT_FAILED',
        [
          'Check your internet connection for model downloads',
          'Ensure you have sufficient memory available',
          'Try specifying a different embedding model',
          'Check that the model name is correct and supported'
        ]
      );
    }

    if (errorMessage.includes('database') || errorMessage.includes('sqlite')) {
      return new IngestionError(
        `Database initialization failed: ${errorMessage}`,
        'DATABASE_ERROR',
        [
          'Check that the database file is not corrupted',
          'Ensure the directory is writable',
          'Try deleting the database file to start fresh',
          'Check for sufficient disk space'
        ]
      );
    }

    // Generic error with basic suggestions
    return new IngestionError(
      `${context} failed: ${errorMessage}`,
      'GENERAL_ERROR',
      [
        'Check the error message above for specific details',
        'Ensure all file paths are correct and accessible',
        'Verify you have necessary permissions',
        'Try the operation again or contact support if the issue persists'
      ]
    );
  }

  /**
   * Initialize the ingestion pipeline (public method for backward compatibility)
   * Sets up database, index manager, and embedding engine
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Ingest documents from a directory (matches README API)
   * Automatically initializes resources on first use (Requirements 2.1, 2.3, 5.2)
   * @param directoryPath - Path to directory containing documents
   * @param options - Optional ingestion configuration
   * @returns Promise resolving to ingestion results
   */
  async ingestDirectory(directoryPath: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    // Validate path exists before initialization
    if (!existsSync(directoryPath)) {
      throw this.createUserFriendlyError(
        new Error(`Directory not found: ${directoryPath}`),
        'path_validation'
      );
    }

    // Automatic initialization on first use (Requirement 5.2)
    await this.ensureInitialized();

    return this.ingestPath(directoryPath, options);
  }

  /**
   * Ingest a single file (matches README API)
   * Automatically initializes resources on first use (Requirements 2.2, 2.3, 5.2)
   * @param filePath - Path to the file to ingest
   * @param options - Optional ingestion configuration
   * @returns Promise resolving to ingestion results
   */
  async ingestFile(filePath: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    // Validate path exists before initialization
    if (!existsSync(filePath)) {
      throw this.createUserFriendlyError(
        new Error(`File not found: ${filePath}`),
        'path_validation'
      );
    }

    // Automatic initialization on first use (Requirement 5.2)
    await this.ensureInitialized();

    return this.ingestPath(filePath, options);
  }

  /**
   * Ingest documents from a path (file or directory)
   * Implements the complete pipeline: file processing → chunking → embedding → storage
   * 
   * Requirements addressed:
   * - 7.5: Single-threaded write processing to avoid SQLite lock contention
   * - 3.3: Graceful handling of embedding failures without stopping ingestion
   * - 10.1: Progress logging and error reporting during batch ingestion
   * - 2.3: Automatic creation of database and index files in appropriate locations
   */
  async ingestPath(path: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    // Automatic initialization on first use (Requirement 5.2)
    await this.ensureInitialized();

    const startTime = Date.now();
    console.log(`\n=== Starting ingestion from: ${path} ===`);

    try {
      // Phase 1: File Discovery and Processing
      console.log('\n--- Phase 1: File Discovery and Processing ---');
      const fileResult = await discoverAndProcessFiles(path, options.fileOptions, this.pathManager!);

      if (fileResult.documents.length === 0) {
        console.log('No documents found to process');
        return {
          documentsProcessed: 0,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: fileResult.processingResult.errors.length,
          embeddingErrors: 0,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Phase 2: Document Chunking
      console.log('\n--- Phase 2: Document Chunking ---');
      const effectiveConfig = this.getEffectiveConfig();
      const effectiveChunkConfig = options.chunkConfig || {
        chunkSize: effectiveConfig.chunk_size,
        chunkOverlap: effectiveConfig.chunk_overlap
      };
      const chunkingResult = await this.chunkDocuments(fileResult.documents, effectiveChunkConfig);

      if (chunkingResult.totalChunks === 0) {
        console.log('No chunks created from documents');
        return {
          documentsProcessed: fileResult.documents.length,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: fileResult.processingResult.errors.length,
          embeddingErrors: 0,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Phase 3: Embedding Generation
      console.log('\n--- Phase 3: Embedding Generation ---');
      const embeddingResult = await this.generateEmbeddings(chunkingResult.allChunks);

      // Phase 4: Database and Index Storage (Single-threaded writes)
      console.log('\n--- Phase 4: Storage Operations ---');
      await this.storeDocumentsAndChunks(
        chunkingResult.documentChunks,
        embeddingResult.embeddings
      );

      // Phase 5: Vector Index Updates
      console.log('\n--- Phase 5: Vector Index Updates ---');
      await this.updateVectorIndex(embeddingResult.embeddings);

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      const result: IngestionResult = {
        documentsProcessed: fileResult.documents.length,
        chunksCreated: chunkingResult.totalChunks,
        embeddingsGenerated: embeddingResult.embeddings.length,
        documentErrors: fileResult.processingResult.errors.length,
        embeddingErrors: embeddingResult.errors,
        processingTimeMs
      };

      console.log('\n=== Ingestion Complete ===');
      console.log(`Documents processed: ${result.documentsProcessed}`);
      console.log(`Chunks created: ${result.chunksCreated}`);
      console.log(`Embeddings generated: ${result.embeddingsGenerated}`);
      console.log(`Document errors: ${result.documentErrors}`);
      console.log(`Embedding errors: ${result.embeddingErrors}`);
      console.log(`Total time: ${(processingTimeMs / 1000).toFixed(2)}s`);

      return result;

    } catch (error) {
      console.error('\n=== Ingestion Failed ===');
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Convert to user-friendly error if not already one (Requirement 2.4)
      if (error instanceof IngestionError) {
        throw error;
      } else {
        throw this.createUserFriendlyError(error, 'ingestion');
      }
    }
  }

  /**
   * Chunk all documents and organize results
   */
  private async chunkDocuments(
    documents: Document[],
    chunkConfig?: ChunkConfig
  ): Promise<{
    documentChunks: Array<{ document: Document; chunks: Chunk[] }>;
    allChunks: string[];
    totalChunks: number;
  }> {
    const documentChunks: Array<{ document: Document; chunks: Chunk[] }> = [];
    const allChunks: string[] = [];
    let totalChunks = 0;

    console.log(`Processing ${documents.length} document${documents.length === 1 ? '' : 's'} for chunking...`);

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      try {
        const chunks = await chunkDocument(document, chunkConfig);
        documentChunks.push({ document, chunks });

        // Collect all chunk texts for embedding
        const chunkTexts = chunks.map(chunk => chunk.text);
        allChunks.push(...chunkTexts);
        totalChunks += chunks.length;

        // Progress logging - more frequent for better user experience
        if (documents.length <= 10 || (i + 1) % Math.max(1, Math.floor(documents.length / 10)) === 0 || i === documents.length - 1) {
          const percentage = Math.round(((i + 1) / documents.length) * 100);
          console.log(`Processed ${i + 1} of ${documents.length} documents (${percentage}%) - ${totalChunks} chunks created`);
        }

      } catch (error) {
        console.error(`Failed to chunk document ${document.source}:`, error instanceof Error ? error.message : String(error));
        // Continue with other documents
        continue;
      }
    }

    console.log(`✓ Chunking complete: Created ${totalChunks} chunks from ${documentChunks.length} documents`);
    return { documentChunks, allChunks, totalChunks };
  }

  /**
   * Generate embeddings for all chunks with error handling
   * Requirement 3.3: Graceful handling of embedding failures without stopping ingestion
   */
  private async generateEmbeddings(chunkTexts: string[]): Promise<{
    embeddings: EmbeddingResult[];
    errors: number;
  }> {
    if (!this.embeddingEngine) {
      throw new Error('Embedding engine not initialized');
    }

    console.log(`Generating embeddings for ${chunkTexts.length} chunk${chunkTexts.length === 1 ? '' : 's'}...`);
    console.log('This may take a few minutes depending on the number of chunks...');

    try {
      // Use the embedDocumentBatch method which has built-in error handling
      const embeddings = await this.embeddingEngine.embedDocumentBatch(chunkTexts);

      const errors = chunkTexts.length - embeddings.length;

      if (errors > 0) {
        console.warn(`⚠ Warning: ${errors} chunk${errors === 1 ? '' : 's'} failed embedding and ${errors === 1 ? 'was' : 'were'} skipped`);
      }

      console.log(`✓ Generated ${embeddings.length} embeddings successfully`);

      return { embeddings, errors };

    } catch (error) {
      console.error('Critical embedding failure:', error instanceof Error ? error.message : String(error));
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store documents and chunks in database with single-threaded writes
   * Requirement 7.5: Single-threaded write processing to avoid SQLite lock contention
   */
  private async storeDocumentsAndChunks(
    documentChunks: Array<{ document: Document; chunks: Chunk[] }>,
    embeddings: EmbeddingResult[]
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.log(`Storing ${documentChunks.length} document${documentChunks.length === 1 ? '' : 's'} and chunks in database...`);

    // Create a mapping of chunk text to embedding for efficient lookup
    const embeddingMap = new Map<string, EmbeddingResult>();
    let embeddingIndex = 0;

    // Build mapping - this assumes embeddings are in the same order as chunks were processed
    for (const { chunks } of documentChunks) {
      for (const chunk of chunks) {
        if (embeddingIndex < embeddings.length) {
          embeddingMap.set(chunk.text, embeddings[embeddingIndex]);
          embeddingIndex++;
        }
      }
    }

    let totalChunksStored = 0;
    let documentsStored = 0;

    // Process each document sequentially (single-threaded writes)
    for (const { document, chunks } of documentChunks) {
      try {
        // Insert or get existing document
        const documentId = await upsertDocument(this.db, document.source, document.title);
        documentsStored++;

        // Insert all chunks for this document
        let chunksStoredForDoc = 0;
        for (const chunk of chunks) {
          const embedding = embeddingMap.get(chunk.text);

          if (embedding) {
            try {
              await insertChunk(
                this.db,
                embedding.embedding_id,
                documentId,
                chunk.text,
                chunk.chunkIndex
              );
              chunksStoredForDoc++;
              totalChunksStored++;
            } catch (chunkError) {
              console.error(`Failed to store chunk ${chunk.chunkIndex} for document ${document.source}:`,
                chunkError instanceof Error ? chunkError.message : String(chunkError));
              // Continue with other chunks
            }
          } else {
            console.warn(`No embedding found for chunk ${chunk.chunkIndex} in document ${document.source}`);
          }
        }

        // Progress logging for storage
        if (documentChunks.length <= 20 || documentsStored % Math.max(1, Math.floor(documentChunks.length / 10)) === 0 || documentsStored === documentChunks.length) {
          const percentage = Math.round((documentsStored / documentChunks.length) * 100);
          console.log(`Stored ${documentsStored} of ${documentChunks.length} documents (${percentage}%) - ${totalChunksStored} chunks total`);
        }

      } catch (docError) {
        console.error(`Failed to store document ${document.source}:`,
          docError instanceof Error ? docError.message : String(docError));
        // Continue with other documents
      }
    }

    console.log(`✓ Storage complete: ${documentsStored} documents, ${totalChunksStored} chunks saved to database`);
  }

  /**
   * Update vector index with new embeddings
   */
  private async updateVectorIndex(embeddings: EmbeddingResult[]): Promise<void> {
    if (!this.indexManager) {
      throw new Error('Index manager not initialized');
    }

    if (embeddings.length === 0) {
      console.log('No embeddings to add to vector index');
      return;
    }

    console.log(`Adding ${embeddings.length} vector${embeddings.length === 1 ? '' : 's'} to search index...`);

    try {
      await this.indexManager.addVectors(embeddings);
      console.log(`✓ Vector index updated successfully with ${embeddings.length} new vectors`);
    } catch (error) {
      console.error('Failed to update vector index:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Initialize the pipeline for rebuild (skips model compatibility check)
   */
  private async initializeForRebuild(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing ingestion pipeline...');

      const effectiveConfig = this.getEffectiveConfig();

      // Validate configuration
      validateConfig(effectiveConfig);

      // Initialize database
      console.log('Opening database connection...');
      this.db = await openDatabase(this.dbPath);
      await initializeSchema(this.db);

      // Initialize index manager (skip model compatibility check for rebuild)
      console.log('Initializing index manager...');
      const { getModelDefaults } = await import('./config.js');
      const modelDefaults = getModelDefaults(effectiveConfig.embedding_model);
      this.indexManager = new IndexManager(this.indexPath, this.dbPath, modelDefaults.dimensions, effectiveConfig.embedding_model);
      await this.indexManager.initialize(true); // Skip model check

      // Initialize embedding engine (use provided one or create new)
      if (!this.embeddingEngine) {
        console.log('Loading embedding model...');
        const { initializeEmbeddingEngine } = await import('./embedder.js');
        this.embeddingEngine = await initializeEmbeddingEngine(effectiveConfig.embedding_model, effectiveConfig.batch_size);
      } else {
        console.log('Using provided embedding engine...');
      }

      this.isInitialized = true;
      console.log('Ingestion pipeline initialized successfully');

    } catch (error) {
      await this.cleanup();
      throw this.createUserFriendlyError(error, 'initialization');
    }
  }

  /**
   * Rebuild the entire index from scratch
   * Useful when model version changes or for maintenance
   * Automatically initializes resources if needed (Requirement 5.2)
   */
  async rebuildIndex(): Promise<void> {
    // Use special initialization for rebuild that skips model compatibility check
    if (!this.isInitialized) {
      await this.initializeForRebuild();
    }

    if (!this.indexManager || !this.embeddingEngine) {
      throw this.createUserFriendlyError(
        new Error('Pipeline not properly initialized'),
        'rebuild'
      );
    }

    console.log('\n=== Starting Index Rebuild ===');

    try {
      await this.indexManager.rebuildWithEmbeddings(this.embeddingEngine);
      console.log('Index rebuild completed successfully');
    } catch (error) {
      throw this.createUserFriendlyError(error, 'rebuild');
    }
  }

  /**
   * Get pipeline statistics
   */
  async getStats(): Promise<{
    indexStats: any;
    isInitialized: boolean;
  }> {
    const stats = {
      isInitialized: this.isInitialized,
      indexStats: null as any
    };

    if (this.indexManager) {
      try {
        stats.indexStats = await this.indexManager.getStats();
      } catch (error) {
        console.error('Failed to get index stats:', error instanceof Error ? error.message : String(error));
      }
    }

    return stats;
  }

  /**
   * Set up automatic cleanup on process exit (Requirement 5.5)
   */
  private setupAutomaticCleanup(): void {
    // Track this instance for cleanup
    IngestionPipeline.instances.add(this);

    // Set up process exit handlers only once
    if (!IngestionPipeline.cleanupHandlersSet) {
      IngestionPipeline.cleanupHandlersSet = true;

      const cleanupAll = async () => {
        const instances = Array.from(IngestionPipeline.instances);
        await Promise.all(instances.map(instance => instance.cleanup()));
      };

      // Handle various exit scenarios
      process.on('exit', () => {
        // Synchronous cleanup for exit event
        for (const instance of IngestionPipeline.instances) {
          try {
            if (instance.db) {
              // Synchronous close for exit handler
              instance.db = null;
            }
            if (instance.indexManager) {
              instance.indexManager = null;
            }
            instance.embeddingEngine = null;
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.indexManager) {
        await this.indexManager.close();
        this.indexManager = null;
      }

      if (this.db) {
        await this.db.close();
        this.db = null;
      }

      this.embeddingEngine = null;
      this.isInitialized = false;

      // Remove from instances tracking
      IngestionPipeline.instances.delete(this);

      console.log('Pipeline cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Convenience function to ingest documents from a path
 * Creates a pipeline instance, runs ingestion, and cleans up
 */
export async function ingestDocuments(
  path: string,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const pipeline = new IngestionPipeline();

  try {
    await pipeline.initialize();
    const result = await pipeline.ingestPath(path, options);
    return result;
  } finally {
    await pipeline.cleanup();
  }
}

/**
 * Convenience function to rebuild the index
 * Creates a pipeline instance, rebuilds index, and cleans up
 */
export async function rebuildIndex(): Promise<void> {
  // First, try to detect the stored model from the existing database
  let configOverrides: Partial<Config> = {};

  try {
    const { openDatabase, getStoredModelInfo } = await import('./db.js');
    const db = await openDatabase(config.db_file);
    const storedModel = await getStoredModelInfo(db);
    await db.close();

    if (storedModel) {
      console.log(`Detected stored model: ${storedModel.modelName}`);
      const { getModelDefaults } = await import('./config.js');
      const modelDefaults = getModelDefaults(storedModel.modelName);

      configOverrides = {
        embedding_model: storedModel.modelName,
        chunk_size: modelDefaults.chunk_size,
        chunk_overlap: modelDefaults.chunk_overlap,
        batch_size: modelDefaults.batch_size
      };
    }
  } catch (error) {
    console.log('Could not detect stored model, using default configuration');
  }

  const pipeline = new IngestionPipeline();
  pipeline.setConfigOverrides(configOverrides);

  try {
    await pipeline.initialize();
    await pipeline.rebuildIndex();
  } finally {
    await pipeline.cleanup();
  }
}