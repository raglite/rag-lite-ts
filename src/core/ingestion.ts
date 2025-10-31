/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

import { discoverAndProcessFiles, type FileProcessorOptions } from '../file-processor.js';
import { chunkDocument, type ChunkConfig } from './chunker.js';
import { IndexManager } from '../index-manager.js';
import { insertChunk, upsertDocument, type DatabaseConnection } from './db.js';
import { config } from './config.js';
import { DocumentPathManager } from './path-manager.js';
import type { Document, EmbeddingResult } from './types.js';
import type { EmbedFunction } from './interfaces.js';
import { existsSync } from 'fs';
import { ContentManager, type MemoryContentMetadata, type ContentIngestionResult } from './content-manager.js';

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
  /** Mode for the ingestion pipeline (text or multimodal) */
  mode?: 'text' | 'multimodal';
  /** Content type for the ingested content */
  contentType?: string;
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
  /** Content IDs of successfully ingested documents */
  contentIds: string[];
}

/**
 * Main ingestion pipeline class
 * Coordinates the entire process from file discovery to vector storage
 * Uses explicit dependency injection for clean architecture
 */
export class IngestionPipeline {
  private pathManager: DocumentPathManager;
  private contentManager: ContentManager;

  /**
   * Creates a new IngestionPipeline with explicit dependency injection
   * Enhanced with ContentManager integration for unified content system
   * 
   * DEPENDENCY INJECTION PATTERN:
   * This constructor requires all dependencies to be explicitly provided, enabling:
   * - Clean separation between core ingestion logic and implementation-specific components
   * - Support for different embedding models and content types
   * - Testability through mock injection
   * - Future extensibility for multimodal content processing
   * - Unified content management for both filesystem and memory-based ingestion
   * 
   * @param embedFn - Function to embed document chunks into vectors
   *   - Signature: (query: string, contentType?: string) => Promise<EmbeddingResult>
   *   - Must handle chunk text and return consistent embedding format
   *   - Examples:
   *     - Text: const embedFn = (text) => textEmbedder.embedSingle(text)
   *     - Multimodal: const embedFn = (content, type) => type === 'image' ? clipEmbedder.embedImage(content) : clipEmbedder.embedText(content)
   *     - Custom: const embedFn = (text) => customModel.embed(text)
   * 
   * @param indexManager - Vector index manager for storing embeddings
   *   - Handles vector storage and indexing operations
   *   - Must support the embedding dimensions produced by embedFn
   *   - Example: new IndexManager('./index.bin')
   * 
   * @param db - Database connection for metadata storage
   *   - Stores document and chunk metadata with content type support
   *   - Supports different content types through metadata fields
   *   - Example: await openDatabase('./db.sqlite')
   * 
   * @param contentManager - Optional ContentManager for unified content system
   *   - Handles content storage routing and deduplication
   *   - If not provided, creates default instance with standard configuration
   *   - Example: new ContentManager(db, { contentDir: '.raglite/content' })
   * 
   * USAGE EXAMPLES:
   * ```typescript
   * // Text-only ingestion pipeline with unified content system
   * const textEmbedFn = await createTextEmbedder();
   * const indexManager = new IndexManager('./index.bin');
   * const db = await openDatabase('./db.sqlite');
   * const contentManager = new ContentManager(db);
   * const ingestion = new IngestionPipeline(textEmbedFn, indexManager, db, undefined, contentManager);
   * 
   * // Simple usage (ContentManager created automatically)
   * const ingestion = new IngestionPipeline(textEmbedFn, indexManager, db);
   * 
   * // Custom embedding implementation with memory ingestion
   * const customEmbedFn = async (text) => ({
   *   embedding_id: generateId(),
   *   vector: await myCustomModel.embed(text)
   * });
   * const ingestion = new IngestionPipeline(customEmbedFn, indexManager, db);
   * await ingestion.ingestFromMemory(buffer, { displayName: 'file.txt' });
   * ```
   */
  constructor(
    private embedFn: EmbedFunction,
    private indexManager: IndexManager,
    private db: DatabaseConnection,
    private defaultChunkConfig?: ChunkConfig,
    contentManager?: ContentManager
  ) {
    // Validate required dependencies
    if (!embedFn || typeof embedFn !== 'function') {
      throw new Error('embedFn must be a valid function');
    }
    if (!indexManager) {
      throw new Error('indexManager is required');
    }
    if (!db) {
      throw new Error('db connection is required');
    }

    // Initialize path manager with default configuration
    this.pathManager = new DocumentPathManager(
      config.path_storage_strategy,
      process.cwd()
    );

    // Initialize ContentManager (create default if not provided)
    this.contentManager = contentManager || new ContentManager(this.db);
  }

  /**
   * Ingest documents from a directory
   * @param directoryPath - Path to directory containing documents
   * @param options - Optional ingestion configuration
   * @returns Promise resolving to ingestion results
   */
  async ingestDirectory(directoryPath: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    if (!existsSync(directoryPath)) {
      throw new Error(`Directory not found: ${directoryPath}`);
    }

    return this.ingestPath(directoryPath, options);
  }

  /**
   * Ingest a single file
   * @param filePath - Path to the file to ingest
   * @param options - Optional ingestion configuration
   * @returns Promise resolving to ingestion results
   */
  async ingestFile(filePath: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return this.ingestPath(filePath, options);
  }

  /**
   * Ingest content from memory buffer
   * Enables MCP integration and real-time content processing
   * @param content - Buffer containing the content to ingest
   * @param metadata - Memory content metadata including display name and content type
   * @param options - Optional ingestion configuration
   * @returns Promise resolving to content ID for the ingested content
   */
  async ingestFromMemory(
    content: Buffer,
    metadata: MemoryContentMetadata,
    options: IngestionOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    console.log(`\n=== Starting memory ingestion: ${metadata.displayName} ===`);

    try {
      // Phase 1: Content Storage via ContentManager
      console.log('\n--- Phase 1: Content Storage ---');
      const contentResult = await this.contentManager.ingestFromMemory(content, metadata);

      if (contentResult.wasDeduped) {
        console.log(`✓ Content deduplicated: ${metadata.displayName} (ID: ${contentResult.contentId})`);
        return contentResult.contentId;
      }

      console.log(`✓ Content stored: ${metadata.displayName} (ID: ${contentResult.contentId})`);

      // Phase 2: Document Processing
      console.log('\n--- Phase 2: Document Processing ---');

      // Determine content type for processing
      const detectedContentType = metadata.contentType || 'text/plain';
      const isImageContent = detectedContentType.startsWith('image/');

      let document: Document;

      if (isImageContent) {
        // Process image content using the existing image processing pipeline
        console.log(`Processing image content: ${metadata.displayName} (${detectedContentType})`);
        document = await this.processImageFromMemory(content, contentResult, metadata, options);
      } else if (detectedContentType === 'application/pdf') {
        // Process PDF content
        console.log(`Processing PDF content: ${metadata.displayName}`);
        document = await this.processPDFFromMemory(content, contentResult, metadata, options);
      } else if (detectedContentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Process DOCX content
        console.log(`Processing DOCX content: ${metadata.displayName}`);
        document = await this.processDOCXFromMemory(content, contentResult, metadata, options);
      } else {
        // Process as text content
        console.log(`Processing text content: ${metadata.displayName} (${detectedContentType})`);
        document = {
          source: metadata.displayName,
          title: metadata.displayName,
          content: content.toString('utf8'), // Convert buffer to string for processing
          metadata: {
            contentType: detectedContentType,
            contentId: contentResult.contentId,
            storageType: contentResult.storageType,
            originalPath: metadata.originalPath
          }
        };
      }

      // Phase 3: Document Chunking
      console.log('\n--- Phase 3: Document Chunking ---');
      const effectiveChunkConfig = options.chunkConfig || this.defaultChunkConfig || {
        chunkSize: config.chunk_size,
        chunkOverlap: config.chunk_overlap
      };

      const chunks = await chunkDocument(document, effectiveChunkConfig);
      console.log(`✓ Created ${chunks.length} chunks from memory content`);

      if (chunks.length === 0) {
        console.log('No chunks created from memory content');
        return contentResult.contentId;
      }

      // Phase 4: Embedding Generation
      console.log('\n--- Phase 4: Embedding Generation ---');
      const embeddings: EmbeddingResult[] = [];
      let embeddingErrors = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          // Convert MIME type to simple content type for embedding function
          const contentTypeForEmbedding = this.getContentTypeForEmbedding(document.metadata?.contentType);
          const embedding = await this.embedFn(chunk.text, contentTypeForEmbedding);

          // Enhance embedding result with content type metadata
          if (!embedding.contentType) {
            embedding.contentType = contentTypeForEmbedding;
          }
          if (!embedding.metadata) {
            embedding.metadata = document.metadata;
          }

          embeddings.push(embedding);
        } catch (error) {
          console.warn(`Failed to embed chunk ${i + 1}:`, error instanceof Error ? error.message : String(error));
          embeddingErrors++;
        }
      }

      console.log(`✓ Generated ${embeddings.length} embeddings for memory content`);

      if (embeddings.length === 0) {
        console.log('No embeddings generated from memory content');
        return contentResult.contentId;
      }

      // Phase 5: Database Storage
      console.log('\n--- Phase 5: Database Storage ---');

      // Insert document with content_id reference
      const documentContentType = this.getContentTypeForEmbedding(document.metadata?.contentType);
      const documentId = await upsertDocument(
        this.db,
        document.source,
        document.title,
        documentContentType,
        document.metadata,
        contentResult.contentId
      );

      // Insert chunks with embeddings
      let chunksStored = 0;
      for (let i = 0; i < chunks.length && i < embeddings.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        try {
          await insertChunk(
            this.db,
            embedding.embedding_id,
            documentId,
            chunk.text,
            chunk.chunkIndex,
            documentContentType,
            document.metadata
          );
          chunksStored++;
        } catch (error) {
          console.error(`Failed to store chunk ${i + 1}:`, error instanceof Error ? error.message : String(error));
        }
      }

      console.log(`✓ Stored document and ${chunksStored} chunks in database`);

      // Phase 6: Vector Index Updates
      console.log('\n--- Phase 6: Vector Index Updates ---');
      await this.updateVectorIndex(embeddings);

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      console.log('\n=== Memory Ingestion Complete ===');
      console.log(`Content ID: ${contentResult.contentId}`);
      console.log(`Chunks created: ${chunks.length}`);
      console.log(`Embeddings generated: ${embeddings.length}`);
      console.log(`Chunks stored: ${chunksStored}`);
      console.log(`Embedding errors: ${embeddingErrors}`);
      console.log(`Total time: ${(processingTimeMs / 1000).toFixed(2)}s`);

      return contentResult.contentId;

    } catch (error) {
      console.error('\n=== Memory Ingestion Failed ===');
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Memory ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ingest documents from a path (file or directory)
   * Implements the complete pipeline: file processing → chunking → embedding → storage
   * Enhanced to handle mixed content types (text and images) in multimodal mode
   */
  async ingestPath(path: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    const startTime = Date.now();
    console.log(`\n=== Starting ingestion from: ${path} ===`);

    try {
      // Phase 1: File Discovery and Processing with Content-Type Detection
      console.log('\n--- Phase 1: File Discovery and Processing ---');
      const fileResult = await discoverAndProcessFiles(path, options.fileOptions, this.pathManager);

      if (fileResult.documents.length === 0) {
        console.log('No documents found to process');
        return {
          documentsProcessed: 0,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: fileResult.processingResult.errors.length,
          embeddingErrors: 0,
          processingTimeMs: Date.now() - startTime,
          contentIds: []
        };
      }

      // Content-type detection and routing
      const contentTypeStats = this.analyzeContentTypes(fileResult.documents);
      console.log(`📊 Content analysis: ${contentTypeStats.text} text, ${contentTypeStats.image} image, ${contentTypeStats.other} other files`);

      // Phase 2: Document Chunking with Content-Type Awareness
      console.log('\n--- Phase 2: Document Chunking ---');
      const effectiveChunkConfig = options.chunkConfig || this.defaultChunkConfig || {
        chunkSize: config.chunk_size,
        chunkOverlap: config.chunk_overlap
      };
      const chunkingResult = await this.chunkDocumentsWithContentTypes(fileResult.documents, effectiveChunkConfig);

      if (chunkingResult.totalChunks === 0) {
        console.log('No chunks created from documents');
        return {
          documentsProcessed: fileResult.documents.length,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: fileResult.processingResult.errors.length,
          embeddingErrors: 0,
          processingTimeMs: Date.now() - startTime,
          contentIds: []
        };
      }

      // Phase 3: Embedding Generation with Content-Type Support
      console.log('\n--- Phase 3: Embedding Generation ---');
      const embeddingResult = await this.generateEmbeddingsWithContentTypes(chunkingResult.allChunks);

      // Phase 4: Database and Index Storage with Content-Type Metadata
      console.log('\n--- Phase 4: Storage Operations ---');
      const contentIds = await this.storeDocumentsAndChunksWithContentTypes(
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
        processingTimeMs,
        contentIds
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
      throw new Error(`Ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze content types in the document collection
   * @private
   */
  private analyzeContentTypes(documents: Document[]): { text: number; image: number; other: number } {
    const stats = { text: 0, image: 0, other: 0 };

    for (const document of documents) {
      const contentType = document.metadata?.contentType || 'text';
      switch (contentType) {
        case 'text':
          stats.text++;
          break;
        case 'image':
          stats.image++;
          break;
        default:
          stats.other++;
          break;
      }
    }

    return stats;
  }

  /**
   * Chunk all documents and organize results with content-type awareness
   * Enhanced to handle different content types appropriately
   */
  private async chunkDocumentsWithContentTypes(
    documents: Document[],
    chunkConfig?: ChunkConfig
  ): Promise<{
    documentChunks: Array<{ document: Document; chunks: any[] }>;
    allChunks: Array<{ text: string; contentType: string; metadata?: Record<string, any> }>;
    totalChunks: number;
  }> {
    const documentChunks: Array<{ document: Document; chunks: any[] }> = [];
    const allChunks: Array<{ text: string; contentType: string; metadata?: Record<string, any> }> = [];
    let totalChunks = 0;

    console.log(`Processing ${documents.length} document${documents.length === 1 ? '' : 's'} for chunking...`);

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      try {
        const contentType = document.metadata?.contentType || 'text';

        // Handle different content types appropriately
        let chunks: any[];
        if (contentType === 'image') {
          // For images, create a single chunk with the full content (description + metadata)
          chunks = [{
            text: document.content,
            chunkIndex: 0,
            contentType: 'image',
            metadata: document.metadata
          }];
        } else {
          // For text documents, use normal chunking
          const textChunks = await chunkDocument(document, chunkConfig);
          chunks = textChunks.map(chunk => ({
            ...chunk,
            contentType: 'text',
            metadata: document.metadata
          }));
        }

        documentChunks.push({ document, chunks });

        // Collect all chunks with their content type information
        for (const chunk of chunks) {
          allChunks.push({
            text: chunk.text,
            contentType: chunk.contentType,
            metadata: chunk.metadata
          });
        }

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
   * Chunk all documents and organize results (legacy method for backward compatibility)
   * @deprecated Use chunkDocumentsWithContentTypes for multimodal support
   */
  private async chunkDocuments(
    documents: Document[],
    chunkConfig?: ChunkConfig
  ): Promise<{
    documentChunks: Array<{ document: Document; chunks: any[] }>;
    allChunks: string[];
    totalChunks: number;
  }> {
    const result = await this.chunkDocumentsWithContentTypes(documents, chunkConfig);

    // Convert to legacy format for backward compatibility
    return {
      documentChunks: result.documentChunks,
      allChunks: result.allChunks.map(chunk => chunk.text),
      totalChunks: result.totalChunks
    };
  }

  /**
   * Generate embeddings for all chunks with content-type support
   * Enhanced to handle different content types and pass metadata to embedding function
   */
  private async generateEmbeddingsWithContentTypes(
    chunks: Array<{ text: string; contentType: string; metadata?: Record<string, any> }>
  ): Promise<{
    embeddings: EmbeddingResult[];
    errors: number;
  }> {
    console.log(`Generating embeddings for ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}...`);
    console.log('This may take a few minutes depending on the number of chunks...');

    try {
      // Generate embeddings using injected embed function with content type support
      const embeddings: EmbeddingResult[] = [];
      let errors = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          // Convert MIME type to simple content type for embedding function
          const contentTypeForEmbedding = this.getContentTypeForEmbedding(chunk.contentType);
          const embedding = await this.embedFn(chunk.text, contentTypeForEmbedding);

          // Enhance embedding result with content type metadata if not already present
          if (!embedding.contentType) {
            embedding.contentType = contentTypeForEmbedding;
          }
          if (!embedding.metadata && chunk.metadata) {
            embedding.metadata = chunk.metadata;
          }

          embeddings.push(embedding);
        } catch (error) {
          console.warn(`Failed to embed ${chunk.contentType} chunk ${i + 1}:`, error instanceof Error ? error.message : String(error));
          errors++;
        }

        // Progress logging
        if (chunks.length > 10 && (i + 1) % Math.max(1, Math.floor(chunks.length / 10)) === 0) {
          const percentage = Math.round(((i + 1) / chunks.length) * 100);
          console.log(`Generated ${i + 1} of ${chunks.length} embeddings (${percentage}%)`);
        }
      }

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
   * Generate embeddings for all chunks with error handling (legacy method for backward compatibility)
   * @deprecated Use generateEmbeddingsWithContentTypes for multimodal support
   */
  private async generateEmbeddings(chunkTexts: string[]): Promise<{
    embeddings: EmbeddingResult[];
    errors: number;
  }> {
    // Convert to new format for backward compatibility
    const chunks = chunkTexts.map(text => ({ text, contentType: 'text' }));
    return this.generateEmbeddingsWithContentTypes(chunks);
  }

  /**
   * Store documents and chunks in database with content-type support
   * Enhanced to handle content type metadata and multimodal content
   * @returns Array of content IDs for successfully stored documents
   */
  private async storeDocumentsAndChunksWithContentTypes(
    documentChunks: Array<{ document: Document; chunks: any[] }>,
    embeddings: EmbeddingResult[]
  ): Promise<string[]> {
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
    const contentIds: string[] = [];

    // Process each document sequentially
    for (const { document, chunks } of documentChunks) {
      try {
        // Generate content ID for filesystem content using ContentManager
        let contentId: string | undefined = document.metadata?.contentId;

        if (!contentId) {
          try {
            // Use ContentManager to create filesystem reference and get content ID
            const contentResult = await this.contentManager.ingestFromFilesystem(document.source);
            contentId = contentResult.contentId;

            // Update document metadata with content ID
            if (!document.metadata) {
              document.metadata = {};
            }
            document.metadata.contentId = contentId;
            document.metadata.storageType = contentResult.storageType;
          } catch (contentError) {
            console.warn(`Failed to create content reference for ${document.source}:`,
              contentError instanceof Error ? contentError.message : String(contentError));
            // Continue without content ID - fallback to legacy behavior
          }
        }

        // Insert or get existing document with content type support and content_id reference
        const documentContentType = document.metadata?.contentType || 'text';
        const documentId = await upsertDocument(
          this.db,
          document.source,
          document.title,
          documentContentType,
          document.metadata,
          contentId
        );
        documentsStored++;

        // Add content ID to results if available
        if (contentId) {
          contentIds.push(contentId);
        }

        // Insert all chunks for this document with content type support
        let chunksStoredForDoc = 0;
        for (const chunk of chunks) {
          const embedding = embeddingMap.get(chunk.text);

          if (embedding) {
            try {
              const chunkContentType = chunk.contentType || documentContentType;
              const chunkMetadata = chunk.metadata || document.metadata;

              await insertChunk(
                this.db,
                embedding.embedding_id,
                documentId,
                chunk.text,
                chunk.chunkIndex,
                chunkContentType,
                chunkMetadata
              );
              chunksStoredForDoc++;
              totalChunksStored++;
            } catch (chunkError) {
              console.error(`Failed to store ${chunk.contentType || 'text'} chunk ${chunk.chunkIndex} for document ${document.source}:`,
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
    return contentIds;
  }

  /**
   * Store documents and chunks in database (legacy method for backward compatibility)
   * @deprecated Use storeDocumentsAndChunksWithContentTypes for multimodal support
   */
  private async storeDocumentsAndChunks(
    documentChunks: Array<{ document: Document; chunks: any[] }>,
    embeddings: EmbeddingResult[]
  ): Promise<void> {
    await this.storeDocumentsAndChunksWithContentTypes(documentChunks, embeddings);
  }

  /**
   * Update vector index with new embeddings
   */
  private async updateVectorIndex(embeddings: EmbeddingResult[]): Promise<void> {
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
   * Converts MIME type to simple content type for embedding function
   * @param mimeType - MIME type string (e.g., 'text/plain', 'image/jpeg')
   * @returns Simple content type ('text', 'image', etc.)
   */
  private getContentTypeForEmbedding(mimeType?: string): string {
    if (!mimeType) {
      return 'text';
    }

    // Convert MIME types to simple content types
    if (mimeType.startsWith('text/')) {
      return 'text';
    } else if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType === 'application/pdf') {
      return 'text'; // PDFs are processed as text
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'text'; // DOCX files are processed as text
    } else {
      return 'text'; // Default to text for unknown types
    }
  }

  /**
   * Save the vector index to disk
   */
  async saveIndex(): Promise<void> {
    await this.indexManager.saveIndex();
  }

  /**
   * Process image content from memory using the existing image processing pipeline
   * @private
   */
  private async processImageFromMemory(
    content: Buffer,
    contentResult: ContentIngestionResult,
    metadata: MemoryContentMetadata,
    options: IngestionOptions
  ): Promise<Document> {
    try {
      // Import image processing functions
      const { generateImageDescriptionForFile, extractImageMetadataForFile } = await import('../file-processor.js');

      // Use the content path from the content manager (where the image is stored)
      const imagePath = contentResult.contentPath;

      // Extract image metadata
      let imageMetadata: any = {};
      try {
        imageMetadata = await extractImageMetadataForFile(imagePath);
      } catch (error) {
        console.warn(`Failed to extract image metadata for ${metadata.displayName}:`, error instanceof Error ? error.message : String(error));
        // Continue with empty metadata
      }

      // Generate text description for the image
      let descriptionResult: any = { description: 'Image content', model: 'none', confidence: 0 };
      try {
        const imageToTextOptions = {}; // Use default options for now
        descriptionResult = await generateImageDescriptionForFile(imagePath, imageToTextOptions);
        console.log(`✓ Generated image description: "${descriptionResult.description}"`);
      } catch (error) {
        console.warn(`Failed to generate image description for ${metadata.displayName}:`, error instanceof Error ? error.message : String(error));
        // Continue with fallback description
      }

      // Update metadata with description information
      imageMetadata.description = descriptionResult.description;
      imageMetadata.descriptionModel = descriptionResult.model;
      imageMetadata.descriptionConfidence = descriptionResult.confidence;

      // Create document with image description as content
      const title = metadata.displayName;

      // Create content that includes description and key metadata
      const contentParts = [
        `Image: ${title}`,
        `Description: ${descriptionResult.description}`
      ];

      if (imageMetadata.dimensions) {
        contentParts.push(`Dimensions: ${imageMetadata.dimensions.width}x${imageMetadata.dimensions.height}`);
      }
      if (imageMetadata.format) {
        contentParts.push(`Format: ${imageMetadata.format}`);
      }

      const documentContent = contentParts.join('\n');

      return {
        source: metadata.displayName,
        title,
        content: documentContent.trim(),
        metadata: {
          contentType: 'image',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          ...imageMetadata // Spread all image metadata fields
        }
      };
    } catch (error) {
      console.warn(`Failed to process image from memory, falling back to basic processing:`, error instanceof Error ? error.message : String(error));
      
      // Fallback to basic document creation
      return {
        source: metadata.displayName,
        title: metadata.displayName,
        content: `Image: ${metadata.displayName}\nPath: ${contentResult.contentPath}`,
        metadata: {
          contentType: 'image',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          processingError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Process PDF content from memory using the existing PDF processing pipeline
   * @private
   */
  private async processPDFFromMemory(
    content: Buffer,
    contentResult: ContentIngestionResult,
    metadata: MemoryContentMetadata,
    options: IngestionOptions
  ): Promise<Document> {
    try {
      // Import PDF processing
      const pdfParse = require('pdf-parse');
      
      // Parse PDF content directly from buffer
      const pdfData = await pdfParse(content);
      
      console.log(`✓ Extracted ${pdfData.text.length} characters from PDF`);

      return {
        source: metadata.displayName,
        title: metadata.displayName,
        content: pdfData.text.trim(),
        metadata: {
          contentType: 'application/pdf',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          pages: pdfData.numpages,
          pdfInfo: pdfData.info
        }
      };
    } catch (error) {
      console.warn(`Failed to process PDF from memory, falling back to basic processing:`, error instanceof Error ? error.message : String(error));
      
      // Fallback to basic document creation
      return {
        source: metadata.displayName,
        title: metadata.displayName,
        content: `PDF Document: ${metadata.displayName}\nPath: ${contentResult.contentPath}`,
        metadata: {
          contentType: 'application/pdf',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          processingError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Process DOCX content from memory using the existing DOCX processing pipeline
   * @private
   */
  private async processDOCXFromMemory(
    content: Buffer,
    contentResult: ContentIngestionResult,
    metadata: MemoryContentMetadata,
    options: IngestionOptions
  ): Promise<Document> {
    try {
      // Import DOCX processing
      const mammoth = await import('mammoth');
      
      // Parse DOCX content directly from buffer
      const docxResult = await mammoth.extractRawText({ buffer: content });
      
      console.log(`✓ Extracted ${docxResult.value.length} characters from DOCX`);

      return {
        source: metadata.displayName,
        title: metadata.displayName,
        content: docxResult.value.trim(),
        metadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          messages: docxResult.messages
        }
      };
    } catch (error) {
      console.warn(`Failed to process DOCX from memory, falling back to basic processing:`, error instanceof Error ? error.message : String(error));
      
      // Fallback to basic document creation
      return {
        source: metadata.displayName,
        title: metadata.displayName,
        content: `DOCX Document: ${metadata.displayName}\nPath: ${contentResult.contentPath}`,
        metadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentId: contentResult.contentId,
          storageType: contentResult.storageType,
          originalPath: metadata.originalPath,
          processingError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Clean up resources - explicit cleanup method
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up ContentManager to prevent resource leaks
      if (this.contentManager && typeof this.contentManager.cleanup === 'function') {
        this.contentManager.cleanup();
      }
      
      await this.db.close();
      await this.indexManager.close();
    } catch (error) {
      console.error('Error during IngestionPipeline cleanup:', error instanceof Error ? error.message : String(error));
    }
  }
}