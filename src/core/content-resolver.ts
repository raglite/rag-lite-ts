/**
 * Content Resolver - Handles content retrieval and format adaptation for unified content system
 * Resolves content IDs to actual content locations and adapts format based on client needs
 * Supports efficient batch retrieval operations and handles missing content gracefully
 */

import { promises as fs } from 'fs';
import {
  DatabaseConnection,
  getContentMetadata,
  type ContentMetadata
} from './db.js';
import {
  ContentNotFoundError,
  ContentRetrievalError,
  ContentErrorHandler
} from './content-errors.js';
import {
  withTimeout,
  SafeBuffer
} from './resource-cleanup.js';
import {
  StreamingOperations,
  createStreamingOperations,
  formatBytes,
  formatProcessingTime,
  calculateProcessingSpeed
} from './streaming-operations.js';
import {
  ContentPerformanceOptimizer,
  createContentPerformanceOptimizer,
  formatProcessingSpeed
} from './content-performance-optimizer.js';

// Re-export ContentMetadata for use by SearchEngine
export type { ContentMetadata };

/**
 * Content request for batch operations
 */
export interface ContentRequest {
  contentId: string;
  format: 'file' | 'base64';
}

/**
 * Content result for batch operations
 */
export interface ContentResult {
  contentId: string;
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * ContentResolver class for handling content retrieval and format conversion
 * Implements format-adaptive content retrieval for CLI and MCP clients
 */
export class ContentResolver {
  private db: DatabaseConnection;
  private streamingOps: StreamingOperations;
  private performanceOptimizer: ContentPerformanceOptimizer;

  constructor(db: DatabaseConnection) {
    this.db = db;

    // Initialize streaming operations for content retrieval
    this.streamingOps = createStreamingOperations({
      chunkSize: 256 * 1024, // 256KB chunks for retrieval operations
      enableProgress: false,
      enableHashing: false,
      timeout: 300000 // 5 minutes
    });

    // Initialize performance optimizer for batch operations and caching
    this.performanceOptimizer = createContentPerformanceOptimizer({
      hashCacheSize: 500, // Smaller cache for resolver
      hashCacheTTL: 30 * 60 * 1000, // 30 minutes TTL
      maxConcurrentOperations: 15, // Higher concurrency for retrieval
      batchSize: 25,
      fileBufferSize: 256 * 1024,
      enableAsyncIO: true,
      enableMetrics: true,
      metricsRetentionTime: 12 * 60 * 60 * 1000 // 12 hours
    });
  }

  /**
   * Retrieves content by ID and adapts format based on client needs
   * @param contentId - Content ID to retrieve
   * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
   * @returns Promise that resolves to content in requested format
   */
  async getContent(contentId: string, format: 'file' | 'base64' = 'file'): Promise<string> {
    try {
      // Validate format parameter
      if (format !== 'file' && format !== 'base64') {
        throw new ContentRetrievalError(
          contentId,
          format,
          'Format must be either "file" or "base64"',
          'format_validation'
        );
      }

      // Get content metadata with timeout
      const metadata = await withTimeout(
        getContentMetadata(this.db, contentId),
        10000, // 10 second timeout for database query
        'Database query for content metadata timed out'
      );

      if (!metadata) {
        throw new ContentNotFoundError(contentId, undefined, 'metadata_lookup');
      }

      // Check if content file exists with timeout
      const contentExists = await withTimeout(
        this.verifyContentExists(contentId),
        5000, // 5 second timeout for file verification
        'Content file verification timed out'
      );

      if (!contentExists) {
        throw new ContentNotFoundError(contentId, metadata.displayName, 'file_verification');
      }

      // Return content in requested format with timeout
      if (format === 'file') {
        return await withTimeout(
          this.getContentAsFilePath(metadata),
          5000, // 5 second timeout for file path resolution
          'File path resolution timed out'
        );
      } else {
        return await withTimeout(
          this.getContentAsBase64(metadata),
          30000, // 30 second timeout for base64 conversion (can be slow for large files)
          'Base64 conversion timed out'
        );
      }

    } catch (error) {
      if (error instanceof ContentNotFoundError || error instanceof ContentRetrievalError) {
        throw error; // Re-throw content-specific errors
      }
      ContentErrorHandler.handleContentError(error, 'content retrieval', 'getContent');
    }
  }

  /**
   * Retrieves multiple content items efficiently in batch with performance optimizations
   * @param requests - Array of content requests with IDs and formats
   * @returns Promise that resolves to array of content results
   */
  async getContentBatch(requests: ContentRequest[]): Promise<ContentResult[]> {
    const startTime = Date.now();

    try {
      // Use performance optimizer for batch processing
      const batchResult = await this.performanceOptimizer.processBatchOptimized(
        requests,
        async (request: ContentRequest): Promise<ContentResult> => {
          try {
            const content = await this.getContent(request.contentId, request.format);
            return {
              contentId: request.contentId,
              success: true,
              content
            };
          } catch (error) {
            return {
              contentId: request.contentId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        {
          batchSize: 25, // Optimized batch size for content retrieval
          maxConcurrency: 15, // Higher concurrency for I/O operations
          enableMetrics: true
        }
      );

      // Log performance metrics for large batches
      if (requests.length > 10) {
        const duration = Date.now() - startTime;
        const speed = batchResult.averageSpeed;
        console.log(
          `Batch retrieval completed: ${requests.length} items in ${formatProcessingTime(duration)} ` +
          `(${batchResult.successCount} success, ${batchResult.errorCount} errors, ${formatProcessingSpeed(speed)})`
        );
      }

      return batchResult.results;

    } catch (error) {
      // Fallback to original implementation if optimization fails
      console.warn('Batch optimization failed, using fallback:', error);
      return this.getContentBatchFallback(requests);
    }
  }

  /**
   * Fallback batch processing implementation
   * @param requests - Array of content requests
   * @returns Promise that resolves to array of content results
   */
  private async getContentBatchFallback(requests: ContentRequest[]): Promise<ContentResult[]> {
    const results: ContentResult[] = [];
    const concurrencyLimit = 10;
    const batches: ContentRequest[][] = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      batches.push(requests.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (request): Promise<ContentResult> => {
        try {
          const content = await this.getContent(request.contentId, request.format);
          return {
            contentId: request.contentId,
            success: true,
            content
          };
        } catch (error) {
          return {
            contentId: request.contentId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Retrieves content metadata without loading the actual content
   * @param contentId - Content ID to get metadata for
   * @returns Promise that resolves to content metadata
   */
  async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    const metadata = await getContentMetadata(this.db, contentId);
    if (!metadata) {
      throw new ContentNotFoundError(contentId, undefined, 'metadata_retrieval');
    }
    return metadata;
  }

  /**
   * Verifies that content exists and is accessible
   * @param contentId - Content ID to verify
   * @returns Promise that resolves to true if content exists, false otherwise
   */
  async verifyContentExists(contentId: string): Promise<boolean> {
    try {
      const metadata = await getContentMetadata(this.db, contentId);
      if (!metadata) {
        return false;
      }

      // Check if the content file exists and is accessible
      try {
        const stats = await fs.stat(metadata.contentPath);
        return stats.isFile();
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Gets performance statistics for batch operations and content retrieval
   * @returns Performance statistics
   */
  getPerformanceStats(): {
    batchOperations: {
      totalOperations: number;
      averageDuration: number;
      totalBytesProcessed: number;
      averageSpeed: number;
      errorRate: number;
    };
    contentRetrieval: {
      totalRetrievals: number;
      averageDuration: number;
      cacheHitRate: number;
    };
  } {
    const batchStats = this.performanceOptimizer.getPerformanceStats('batch_processing');
    const retrievalStats = this.performanceOptimizer.getPerformanceStats('file_read');

    return {
      batchOperations: batchStats,
      contentRetrieval: {
        totalRetrievals: retrievalStats.totalOperations,
        averageDuration: retrievalStats.averageDuration,
        cacheHitRate: retrievalStats.cacheHitRate
      }
    };
  }

  /**
   * Clears performance caches and resets metrics
   */
  clearPerformanceCaches(): void {
    this.performanceOptimizer.clearHashCache();
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Returns content as file path for CLI clients
   * @param metadata - Content metadata
   * @returns File path that can be accessed directly
   */
  private async getContentAsFilePath(metadata: ContentMetadata): Promise<string> {
    // For both filesystem and content_dir storage, return the content path
    // CLI clients can access files directly regardless of storage type
    return metadata.contentPath;
  }

  /**
   * Returns content as base64 string for MCP clients with optimized I/O
   * @param metadata - Content metadata
   * @returns Base64-encoded content ready for display
   */
  private async getContentAsBase64(metadata: ContentMetadata): Promise<string> {
    let safeBuffer: SafeBuffer | null = null;

    try {
      // Use optimized file reading for better performance
      if (metadata.fileSize > 10 * 1024 * 1024) { // Use streaming for files > 10MB
        const startTime = Date.now();

        const base64Content = await withTimeout(
          this.streamingOps.readFileAsBase64Streaming(metadata.contentPath),
          300000, // 5 minute timeout for large file base64 conversion
          'Streaming base64 conversion timed out'
        );

        const processingTime = Date.now() - startTime;
        const speed = calculateProcessingSpeed(metadata.fileSize, processingTime);

        // Log performance metrics for large files
        if (metadata.fileSize > 50 * 1024 * 1024) {
          console.log(`Optimized base64 conversion completed: ${formatBytes(metadata.fileSize)} in ${formatProcessingTime(processingTime)} (${formatProcessingSpeed(speed)})`);
        }

        return base64Content;
      } else {
        // For smaller files, use traditional method with memory management
        const content = await fs.readFile(metadata.contentPath);

        // Use safe buffer for memory management (don't clear original for normal operations)
        safeBuffer = new SafeBuffer(content, { clearOriginal: false });

        // Convert to base64
        const base64Content = safeBuffer.get().toString('base64');

        return base64Content;
      }
    } catch (error) {
      throw new ContentRetrievalError(
        metadata.id,
        'base64',
        `Failed to read content file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'file_reading'
      );
    } finally {
      // Clear sensitive buffer data
      if (safeBuffer) {
        safeBuffer.clear();
      }
    }
  }

  /**
   * Cleanup resources to prevent memory leaks and hanging processes
   * Should be called when ContentResolver is no longer needed
   */
  cleanup(): void {
    // Clean up performance optimizer interval that prevents process exit
    if (this.performanceOptimizer && typeof this.performanceOptimizer.cleanup === 'function') {
      this.performanceOptimizer.cleanup();
    }
  }
}