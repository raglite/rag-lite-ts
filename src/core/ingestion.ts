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
 * Main ingestion pipeline class
 * Coordinates the entire process from file discovery to vector storage
 * Uses explicit dependency injection for clean architecture
 */
export class IngestionPipeline {
  private pathManager: DocumentPathManager;

  /**
   * Creates a new IngestionPipeline with explicit dependency injection
   * 
   * DEPENDENCY INJECTION PATTERN:
   * This constructor requires all dependencies to be explicitly provided, enabling:
   * - Clean separation between core ingestion logic and implementation-specific components
   * - Support for different embedding models and content types
   * - Testability through mock injection
   * - Future extensibility for multimodal content processing
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
   * USAGE EXAMPLES:
   * ```typescript
   * // Text-only ingestion pipeline
   * const textEmbedFn = await createTextEmbedder();
   * const indexManager = new IndexManager('./index.bin');
   * const db = await openDatabase('./db.sqlite');
   * const ingestion = new IngestionPipeline(textEmbedFn, indexManager, db);
   * 
   * // Custom embedding implementation
   * const customEmbedFn = async (text) => ({
   *   embedding_id: generateId(),
   *   vector: await myCustomModel.embed(text)
   * });
   * const ingestion = new IngestionPipeline(customEmbedFn, indexManager, db);
   * 
   * // Multimodal ingestion (future)
   * const multimodalEmbedFn = async (content, contentType) => {
   *   if (contentType === 'image') {
   *     return { embedding_id: generateId(), vector: await clipModel.embedImage(content) };
   *   }
   *   return { embedding_id: generateId(), vector: await clipModel.embedText(content) };
   * };
   * const ingestion = new IngestionPipeline(multimodalEmbedFn, indexManager, db);
   * ```
   */
  constructor(
    private embedFn: EmbedFunction,
    private indexManager: IndexManager,
    private db: DatabaseConnection,
    private defaultChunkConfig?: ChunkConfig
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
   * Ingest documents from a path (file or directory)
   * Implements the complete pipeline: file processing → chunking → embedding → storage
   */
  async ingestPath(path: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    const startTime = Date.now();
    console.log(`\n=== Starting ingestion from: ${path} ===`);

    try {
      // Phase 1: File Discovery and Processing
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
          processingTimeMs: Date.now() - startTime
        };
      }

      // Phase 2: Document Chunking
      console.log('\n--- Phase 2: Document Chunking ---');
      const effectiveChunkConfig = options.chunkConfig || this.defaultChunkConfig || {
        chunkSize: config.chunk_size,
        chunkOverlap: config.chunk_overlap
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

      // Phase 4: Database and Index Storage
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
      throw new Error(`Ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Chunk all documents and organize results
   */
  private async chunkDocuments(
    documents: Document[],
    chunkConfig?: ChunkConfig
  ): Promise<{
    documentChunks: Array<{ document: Document; chunks: any[] }>;
    allChunks: string[];
    totalChunks: number;
  }> {
    const documentChunks: Array<{ document: Document; chunks: any[] }> = [];
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
   */
  private async generateEmbeddings(chunkTexts: string[]): Promise<{
    embeddings: EmbeddingResult[];
    errors: number;
  }> {
    console.log(`Generating embeddings for ${chunkTexts.length} chunk${chunkTexts.length === 1 ? '' : 's'}...`);
    console.log('This may take a few minutes depending on the number of chunks...');

    try {
      // Generate embeddings using injected embed function
      const embeddings: EmbeddingResult[] = [];
      let errors = 0;

      for (let i = 0; i < chunkTexts.length; i++) {
        try {
          const embedding = await this.embedFn(chunkTexts[i]);
          embeddings.push(embedding);
        } catch (error) {
          console.warn(`Failed to embed chunk ${i + 1}:`, error instanceof Error ? error.message : String(error));
          errors++;
        }

        // Progress logging
        if (chunkTexts.length > 10 && (i + 1) % Math.max(1, Math.floor(chunkTexts.length / 10)) === 0) {
          const percentage = Math.round(((i + 1) / chunkTexts.length) * 100);
          console.log(`Generated ${i + 1} of ${chunkTexts.length} embeddings (${percentage}%)`);
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
   * Store documents and chunks in database
   */
  private async storeDocumentsAndChunks(
    documentChunks: Array<{ document: Document; chunks: any[] }>,
    embeddings: EmbeddingResult[]
  ): Promise<void> {
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

    // Process each document sequentially
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
   * Clean up resources - explicit cleanup method
   */
  async cleanup(): Promise<void> {
    try {
      await this.db.close();
      await this.indexManager.close();
    } catch (error) {
      console.error('Error during IngestionPipeline cleanup:', error instanceof Error ? error.message : String(error));
    }
  }
}