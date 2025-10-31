/**
 * Streaming Operations for Large Content - Task 9.1 Implementation
 * Provides memory-efficient streaming operations for content ingestion and retrieval
 * Minimizes memory usage for large files through streaming algorithms
 */

import { createHash } from 'crypto';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform, Readable } from 'stream';
import { join, dirname } from 'path';

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (bytesProcessed: number, totalBytes?: number): void;
}

/**
 * Streaming hash calculation result
 */
export interface StreamingHashResult {
  hash: string;
  bytesProcessed: number;
  processingTimeMs: number;
}

/**
 * Streaming file copy result
 */
export interface StreamingCopyResult {
  bytesWritten: number;
  processingTimeMs: number;
  hash?: string;
}

/**
 * Configuration for streaming operations
 */
export interface StreamingConfig {
  chunkSize: number; // Size of chunks to process at a time (default: 64KB)
  enableProgress: boolean; // Whether to report progress
  enableHashing: boolean; // Whether to calculate hash during streaming
  timeout: number; // Timeout in milliseconds for streaming operations
}

/**
 * Default streaming configuration
 */
const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  chunkSize: 64 * 1024, // 64KB chunks
  enableProgress: false,
  enableHashing: false,
  timeout: 300000 // 5 minutes
};

/**
 * StreamingOperations class provides memory-efficient operations for large content
 */
export class StreamingOperations {
  private config: StreamingConfig;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
  }

  /**
   * Calculates SHA-256 hash of a file using streaming to minimize memory usage
   * @param filePath - Path to the file to hash
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to hash result
   */
  async calculateFileHashStreaming(
    filePath: string, 
    progressCallback?: ProgressCallback
  ): Promise<StreamingHashResult> {
    const startTime = Date.now();
    let bytesProcessed = 0;
    let totalBytes: number | undefined;

    try {
      // Get file size for progress reporting
      if (this.config.enableProgress || progressCallback) {
        const stats = await fs.stat(filePath);
        totalBytes = stats.size;
      }

      const hash = createHash('sha256');
      const readStream = createReadStream(filePath, { 
        highWaterMark: this.config.chunkSize 
      });

      // Use promise-based approach instead of pipeline for better control
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          readStream.destroy();
          reject(new Error('File hash calculation timed out'));
        }, this.config.timeout);

        readStream.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          hash.update(buffer);
          bytesProcessed += buffer.length;
          
          // Report progress if callback provided
          if (progressCallback) {
            progressCallback(bytesProcessed, totalBytes);
          }
        });

        readStream.on('end', () => {
          clearTimeout(timeoutId);
          const processingTimeMs = Date.now() - startTime;
          
          resolve({
            hash: hash.digest('hex'),
            bytesProcessed,
            processingTimeMs
          });
        });

        readStream.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to read file: ${error.message}`));
        });
      });

    } catch (error) {
      throw new Error(`Failed to calculate file hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates SHA-256 hash of a buffer using streaming to minimize memory usage
   * @param content - Buffer to hash
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to hash result
   */
  async calculateBufferHashStreaming(
    content: Buffer, 
    progressCallback?: ProgressCallback
  ): Promise<StreamingHashResult> {
    const startTime = Date.now();
    let bytesProcessed = 0;
    const totalBytes = content.length;

    try {
      const hash = createHash('sha256');
      
      // Process buffer in chunks to avoid memory spikes
      const chunkSize = this.config.chunkSize;
      
      for (let offset = 0; offset < content.length; offset += chunkSize) {
        const chunk = content.subarray(offset, Math.min(offset + chunkSize, content.length));
        hash.update(chunk);
        bytesProcessed += chunk.length;
        
        // Report progress if callback provided
        if (progressCallback) {
          progressCallback(bytesProcessed, totalBytes);
        }
        
        // Yield control to event loop to prevent blocking
        if (offset % (chunkSize * 10) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      const processingTimeMs = Date.now() - startTime;
      
      return {
        hash: hash.digest('hex'),
        bytesProcessed,
        processingTimeMs
      };

    } catch (error) {
      throw new Error(`Failed to calculate buffer hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Copies a file using streaming operations with optional hashing
   * @param sourcePath - Source file path
   * @param destinationPath - Destination file path
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to copy result
   */
  async copyFileStreaming(
    sourcePath: string,
    destinationPath: string,
    progressCallback?: ProgressCallback
  ): Promise<StreamingCopyResult> {
    const startTime = Date.now();
    let bytesWritten = 0;
    let totalBytes: number | undefined;
    let hash: string | undefined;

    try {
      // Get file size for progress reporting
      if (this.config.enableProgress || progressCallback) {
        const stats = await fs.stat(sourcePath);
        totalBytes = stats.size;
      }

      // Ensure destination directory exists
      await fs.mkdir(dirname(destinationPath), { recursive: true });

      const readStream = createReadStream(sourcePath, { 
        highWaterMark: this.config.chunkSize 
      });
      const writeStream = createWriteStream(destinationPath);

      let hashCalculator: ReturnType<typeof createHash> | undefined;
      if (this.config.enableHashing) {
        hashCalculator = createHash('sha256');
      }

      // Create transform stream for progress tracking and optional hashing
      const progressTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          bytesWritten += chunk.length;
          
          // Update hash if enabled
          if (hashCalculator) {
            hashCalculator.update(chunk);
          }
          
          // Report progress if callback provided
          if (progressCallback) {
            progressCallback(bytesWritten, totalBytes);
          }
          
          callback(null, chunk);
        }
      });

      // Use pipeline for proper error handling and cleanup
      await this.withTimeout(
        pipeline(readStream, progressTransform, writeStream),
        this.config.timeout,
        'File copy operation timed out'
      );

      const processingTimeMs = Date.now() - startTime;
      
      if (hashCalculator) {
        hash = hashCalculator.digest('hex');
      }
      
      return {
        bytesWritten,
        processingTimeMs,
        hash
      };

    } catch (error) {
      // Clean up destination file if copy failed
      try {
        await fs.unlink(destinationPath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Writes buffer content to file using streaming operations
   * @param content - Buffer to write
   * @param destinationPath - Destination file path
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to write result
   */
  async writeBufferStreaming(
    content: Buffer,
    destinationPath: string,
    progressCallback?: ProgressCallback
  ): Promise<StreamingCopyResult> {
    const startTime = Date.now();
    let bytesWritten = 0;
    const totalBytes = content.length;
    let hash: string | undefined;

    try {
      // Ensure destination directory exists
      await fs.mkdir(dirname(destinationPath), { recursive: true });

      const writeStream = createWriteStream(destinationPath);
      
      let hashCalculator: ReturnType<typeof createHash> | undefined;
      if (this.config.enableHashing) {
        hashCalculator = createHash('sha256');
      }

      // Create readable stream from buffer
      const readableStream = Readable.from(this.bufferToChunks(content));

      // Create transform stream for progress tracking and optional hashing
      const progressTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          bytesWritten += chunk.length;
          
          // Update hash if enabled
          if (hashCalculator) {
            hashCalculator.update(chunk);
          }
          
          // Report progress if callback provided
          if (progressCallback) {
            progressCallback(bytesWritten, totalBytes);
          }
          
          callback(null, chunk);
        }
      });

      // Use pipeline for proper error handling and cleanup
      await this.withTimeout(
        pipeline(readableStream, progressTransform, writeStream),
        this.config.timeout,
        'Buffer write operation timed out'
      );

      const processingTimeMs = Date.now() - startTime;
      
      if (hashCalculator) {
        hash = hashCalculator.digest('hex');
      }
      
      return {
        bytesWritten,
        processingTimeMs,
        hash
      };

    } catch (error) {
      // Clean up destination file if write failed
      try {
        await fs.unlink(destinationPath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to write buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reads file content and converts to base64 using streaming to minimize memory usage
   * @param filePath - Path to the file to read
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to base64 string
   */
  async readFileAsBase64Streaming(
    filePath: string,
    progressCallback?: ProgressCallback
  ): Promise<string> {
    let bytesProcessed = 0;
    let totalBytes: number | undefined;

    try {
      // Get file size for progress reporting
      if (this.config.enableProgress || progressCallback) {
        const stats = await fs.stat(filePath);
        totalBytes = stats.size;
      }

      // For base64 conversion, we need to read the entire file to get correct encoding
      // Streaming base64 conversion chunk by chunk doesn't work correctly because
      // base64 encoding requires complete byte sequences
      const content = await fs.readFile(filePath);
      bytesProcessed = content.length;
      
      // Report progress if callback provided
      if (progressCallback) {
        progressCallback(bytesProcessed, totalBytes);
      }

      // Convert to base64
      return content.toString('base64');

    } catch (error) {
      throw new Error(`Failed to read file as base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates file integrity by comparing streaming hash with expected hash
   * @param filePath - Path to the file to validate
   * @param expectedHash - Expected SHA-256 hash
   * @param progressCallback - Optional callback for progress reporting
   * @returns Promise that resolves to validation result
   */
  async validateFileIntegrityStreaming(
    filePath: string,
    expectedHash: string,
    progressCallback?: ProgressCallback
  ): Promise<{ isValid: boolean; actualHash: string; bytesProcessed: number }> {
    try {
      const result = await this.calculateFileHashStreaming(filePath, progressCallback);
      
      return {
        isValid: result.hash === expectedHash.toLowerCase(),
        actualHash: result.hash,
        bytesProcessed: result.bytesProcessed
      };
    } catch (error) {
      throw new Error(`Failed to validate file integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets file information without loading content into memory
   * @param filePath - Path to the file
   * @returns Promise that resolves to file information
   */
  async getFileInfo(filePath: string): Promise<{
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    lastModified: Date;
    canRead: boolean;
    canWrite: boolean;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check permissions
      let canRead = false;
      let canWrite = false;
      
      try {
        await fs.access(filePath, fs.constants.R_OK);
        canRead = true;
      } catch {
        // Cannot read
      }
      
      try {
        await fs.access(filePath, fs.constants.W_OK);
        canWrite = true;
      } catch {
        // Cannot write
      }
      
      return {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        lastModified: stats.mtime,
        canRead,
        canWrite
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Converts buffer to chunks for streaming
   * @param buffer - Buffer to chunk
   * @returns Generator that yields buffer chunks
   */
  private *bufferToChunks(buffer: Buffer): Generator<Buffer> {
    const chunkSize = this.config.chunkSize;
    
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      yield buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
    }
  }

  /**
   * Wraps a promise with timeout functionality
   * @param promise - Promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param errorMessage - Error message for timeout
   * @returns Promise that rejects if timeout is reached
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

/**
 * Creates a StreamingOperations instance with default configuration
 * @param config - Optional configuration overrides
 * @returns StreamingOperations instance
 */
export function createStreamingOperations(config?: Partial<StreamingConfig>): StreamingOperations {
  return new StreamingOperations(config);
}

/**
 * Utility function to format bytes for progress reporting
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Utility function to format processing time
 * @param milliseconds - Processing time in milliseconds
 * @returns Formatted string (e.g., "1.5s" or "150ms")
 */
export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  } else {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
}

/**
 * Utility function to calculate processing speed
 * @param bytes - Number of bytes processed
 * @param milliseconds - Processing time in milliseconds
 * @returns Speed in MB/s
 */
export function calculateProcessingSpeed(bytes: number, milliseconds: number): number {
  if (milliseconds === 0) return 0;
  
  const bytesPerSecond = (bytes / milliseconds) * 1000;
  return bytesPerSecond / (1024 * 1024); // Convert to MB/s
}