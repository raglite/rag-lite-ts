/**
 * Public API IngestionPipeline - Simple constructor interface with internal factory usage
 * 
 * This class provides a clean, simple API while using the new core architecture 
 * internally. It handles dependency injection automatically.
 * 
 * @example
 * ```typescript
 * // Simple usage
 * const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');
 * await pipeline.ingestDirectory('./documents');
 * 
 * // With options
 * const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   chunkSize: 512
 * });
 * ```
 */

import { IngestionPipeline as CoreIngestionPipeline } from './core/ingestion.js';
import { TextIngestionFactory, type TextIngestionOptions } from './factories/index.js';
import type { IngestionOptions, IngestionResult } from './core/ingestion.js';
import type { MemoryContentMetadata } from './core/content-manager.js';

export interface IngestionPipelineOptions extends TextIngestionOptions {}

export class IngestionPipeline {
  private corePipeline: CoreIngestionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private defaultChunkConfig: { chunkSize: number; chunkOverlap: number } | null = null;

  constructor(
    private dbPath: string,
    private indexPath: string,
    private options: IngestionPipelineOptions = {}
  ) {
    // Validate required parameters
    if (!dbPath || typeof dbPath !== 'string' || dbPath.trim() === '') {
      throw new Error(
        'Both dbPath and indexPath are required.\n' +
        'Example: const ingestion = new IngestionPipeline("./db.sqlite", "./index.bin");\n' +
        'Or use: const ingestion = await IngestionFactory.create("./db.sqlite", "./index.bin");'
      );
    }
    if (!indexPath || typeof indexPath !== 'string' || indexPath.trim() === '') {
      throw new Error(
        'Both dbPath and indexPath are required.\n' +
        'Example: const ingestion = new IngestionPipeline("./db.sqlite", "./index.bin");\n' +
        'Or use: const ingestion = await IngestionFactory.create("./db.sqlite", "./index.bin");'
      );
    }
  }

  /**
   * Initialize the ingestion pipeline using the factory
   */
  private async initialize(): Promise<void> {
    if (this.corePipeline) {
      return; // Already initialized
    }

    if (this.initPromise) {
      return this.initPromise; // Initialization in progress
    }

    this.initPromise = (async () => {
      this.corePipeline = await TextIngestionFactory.create(
        this.dbPath,
        this.indexPath,
        this.options
      );
    })();

    return this.initPromise;
  }

  /**
   * Ingest a single document
   */
  async ingestDocument(filePath: string, options?: IngestionOptions): Promise<IngestionResult> {
    await this.initialize();
    if (!this.corePipeline) {
      throw new Error('IngestionPipeline failed to initialize');
    }
    // Merge mode from constructor options with runtime options
    const mergedOptions = {
      ...options,
      mode: options?.mode || this.options.mode
    };
    return this.corePipeline.ingestFile(filePath, mergedOptions);
  }

  /**
   * Ingest all documents in a directory
   */
  async ingestDirectory(directoryPath: string, options?: IngestionOptions): Promise<IngestionResult> {
    await this.initialize();
    if (!this.corePipeline) {
      throw new Error('IngestionPipeline failed to initialize');
    }
    // Merge mode from constructor options with runtime options
    const mergedOptions = {
      ...options,
      mode: options?.mode || this.options.mode
    };
    return this.corePipeline.ingestDirectory(directoryPath, mergedOptions);
  }

  /**
   * Ingest content from memory buffer
   * Enables MCP integration and real-time content processing
   * 
   * @example
   * ```typescript
   * const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');
   * const contentId = await pipeline.ingestFromMemory(buffer, {
   *   displayName: 'uploaded-file.txt',
   *   contentType: 'text/plain'
   * });
   * console.log('Content ingested with ID:', contentId);
   * ```
   */
  async ingestFromMemory(
    content: Buffer, 
    metadata: MemoryContentMetadata, 
    options?: IngestionOptions
  ): Promise<string> {
    await this.initialize();
    if (!this.corePipeline) {
      throw new Error('IngestionPipeline failed to initialize');
    }
    // Merge mode from constructor options with runtime options
    const mergedOptions = {
      ...options,
      mode: options?.mode || this.options.mode
    };
    return this.corePipeline.ingestFromMemory(content, metadata, mergedOptions);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.corePipeline) {
      await this.corePipeline.cleanup();
    }
  }
}