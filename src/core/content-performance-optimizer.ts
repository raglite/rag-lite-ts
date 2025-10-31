/**
 * Content Performance Optimizer - Task 9.2 Implementation
 * Provides performance optimizations for content operations including caching,
 * batch processing, and I/O optimizations
 */

import { LRUCache } from 'lru-cache';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { 
  StreamingOperations,
  createStreamingOperations,
  formatBytes,
  formatProcessingTime,
  calculateProcessingSpeed
} from './streaming-operations.js';

/**
 * Configuration for performance optimizer
 */
export interface PerformanceOptimizerConfig {
  // Hash caching configuration
  hashCacheSize: number; // Maximum number of cached hashes
  hashCacheTTL: number; // Time to live for cached hashes in milliseconds
  
  // Batch processing configuration
  maxConcurrentOperations: number; // Maximum concurrent operations
  batchSize: number; // Optimal batch size for operations
  
  // I/O optimization configuration
  fileBufferSize: number; // Buffer size for file operations
  enableAsyncIO: boolean; // Enable asynchronous I/O optimizations
  
  // Performance monitoring
  enableMetrics: boolean; // Enable performance metrics collection
  metricsRetentionTime: number; // How long to keep metrics in milliseconds
}

/**
 * Default performance optimizer configuration
 */
const DEFAULT_PERFORMANCE_CONFIG: PerformanceOptimizerConfig = {
  hashCacheSize: 1000, // Cache up to 1000 hashes
  hashCacheTTL: 60 * 60 * 1000, // 1 hour TTL
  maxConcurrentOperations: 10,
  batchSize: 50,
  fileBufferSize: 256 * 1024, // 256KB buffer
  enableAsyncIO: true,
  enableMetrics: true,
  metricsRetentionTime: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  operationType: string;
  duration: number;
  bytesProcessed: number;
  cacheHit: boolean;
  timestamp: number;
}

/**
 * Hash cache entry
 */
interface HashCacheEntry {
  hash: string;
  fileSize: number;
  lastModified: number;
  computedAt: number;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
  results: T[];
  totalDuration: number;
  successCount: number;
  errorCount: number;
  averageSpeed: number; // MB/s
}

/**
 * Content Performance Optimizer class
 */
export class ContentPerformanceOptimizer {
  private config: PerformanceOptimizerConfig;
  private hashCache: LRUCache<string, HashCacheEntry>;
  private streamingOps: StreamingOperations;
  private metrics: PerformanceMetrics[] = [];
  private metricsCleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    
    // Initialize hash cache
    this.hashCache = new LRUCache({
      max: this.config.hashCacheSize,
      ttl: this.config.hashCacheTTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Initialize streaming operations with optimized settings
    this.streamingOps = createStreamingOperations({
      chunkSize: this.config.fileBufferSize,
      enableProgress: false,
      enableHashing: true,
      timeout: 300000 // 5 minutes
    });

    // Start metrics cleanup if enabled
    if (this.config.enableMetrics) {
      this.startMetricsCleanup();
    }
  }

  /**
   * Optimized hash calculation with caching
   * @param filePath - Path to the file to hash
   * @returns Promise that resolves to hash string
   */
  async calculateFileHashOptimized(filePath: string): Promise<string> {
    const startTime = Date.now();
    let cacheHit = false;
    let bytesProcessed = 0;

    try {
      // Get file stats for cache validation
      const stats = await fs.stat(filePath);
      bytesProcessed = stats.size;
      
      // Check cache first
      const cacheKey = `${filePath}:${stats.size}:${stats.mtime.getTime()}`;
      const cachedEntry = this.hashCache.get(cacheKey);
      
      if (cachedEntry && 
          cachedEntry.fileSize === stats.size && 
          cachedEntry.lastModified === stats.mtime.getTime()) {
        cacheHit = true;
        
        // Record metrics
        if (this.config.enableMetrics) {
          this.recordMetric({
            operationType: 'hash_calculation',
            duration: Date.now() - startTime,
            bytesProcessed,
            cacheHit: true,
            timestamp: Date.now()
          });
        }
        
        return cachedEntry.hash;
      }

      // Calculate hash using streaming operations
      const hashResult = await this.streamingOps.calculateFileHashStreaming(filePath);
      
      // Cache the result
      const cacheEntry: HashCacheEntry = {
        hash: hashResult.hash,
        fileSize: stats.size,
        lastModified: stats.mtime.getTime(),
        computedAt: Date.now()
      };
      
      this.hashCache.set(cacheKey, cacheEntry);
      
      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetric({
          operationType: 'hash_calculation',
          duration: Date.now() - startTime,
          bytesProcessed,
          cacheHit: false,
          timestamp: Date.now()
        });
      }
      
      return hashResult.hash;
      
    } catch (error) {
      // Record error metric
      if (this.config.enableMetrics) {
        this.recordMetric({
          operationType: 'hash_calculation_error',
          duration: Date.now() - startTime,
          bytesProcessed,
          cacheHit,
          timestamp: Date.now()
        });
      }
      
      throw new Error(`Optimized hash calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimized buffer hash calculation with caching
   * @param content - Buffer to hash
   * @param cacheKey - Optional cache key for the content
   * @returns Promise that resolves to hash string
   */
  async calculateBufferHashOptimized(content: Buffer, cacheKey?: string): Promise<string> {
    const startTime = Date.now();
    let cacheHit = false;
    const bytesProcessed = content.length;

    try {
      // Check cache if key provided
      if (cacheKey) {
        const cachedEntry = this.hashCache.get(cacheKey);
        if (cachedEntry && cachedEntry.fileSize === content.length) {
          cacheHit = true;
          
          // Record metrics
          if (this.config.enableMetrics) {
            this.recordMetric({
              operationType: 'buffer_hash_calculation',
              duration: Date.now() - startTime,
              bytesProcessed,
              cacheHit: true,
              timestamp: Date.now()
            });
          }
          
          return cachedEntry.hash;
        }
      }

      // Calculate hash using streaming operations for large buffers
      let hash: string;
      if (content.length > 1024 * 1024) { // Use streaming for buffers > 1MB
        const hashResult = await this.streamingOps.calculateBufferHashStreaming(content);
        hash = hashResult.hash;
      } else {
        // Use direct calculation for small buffers
        hash = createHash('sha256').update(content).digest('hex');
      }
      
      // Cache the result if key provided
      if (cacheKey) {
        const cacheEntry: HashCacheEntry = {
          hash,
          fileSize: content.length,
          lastModified: Date.now(),
          computedAt: Date.now()
        };
        
        this.hashCache.set(cacheKey, cacheEntry);
      }
      
      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetric({
          operationType: 'buffer_hash_calculation',
          duration: Date.now() - startTime,
          bytesProcessed,
          cacheHit: false,
          timestamp: Date.now()
        });
      }
      
      return hash;
      
    } catch (error) {
      // Record error metric
      if (this.config.enableMetrics) {
        this.recordMetric({
          operationType: 'buffer_hash_calculation_error',
          duration: Date.now() - startTime,
          bytesProcessed,
          cacheHit,
          timestamp: Date.now()
        });
      }
      
      throw new Error(`Optimized buffer hash calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimized batch processing with controlled concurrency and resource management
   * @param items - Array of items to process
   * @param processor - Function to process each item
   * @param options - Batch processing options
   * @returns Promise that resolves to batch operation result
   */
  async processBatchOptimized<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      enableMetrics?: boolean;
    } = {}
  ): Promise<BatchOperationResult<R>> {
    const startTime = Date.now();
    const batchSize = options.batchSize || this.config.batchSize;
    const maxConcurrency = options.maxConcurrency || this.config.maxConcurrentOperations;
    const enableMetrics = options.enableMetrics !== undefined ? options.enableMetrics : this.config.enableMetrics;
    
    const results: R[] = [];
    let successCount = 0;
    let errorCount = 0;
    let totalBytesProcessed = 0;

    try {
      // Split items into batches
      const batches: T[][] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }

      // Process batches with controlled concurrency
      for (const batch of batches) {
        // Create semaphore for concurrency control
        const semaphore = new Array(Math.min(maxConcurrency, batch.length)).fill(null);
        
        const batchPromises = batch.map(async (item, index) => {
          // Wait for semaphore slot
          await new Promise(resolve => {
            const checkSlot = () => {
              const slotIndex = index % semaphore.length;
              if (semaphore[slotIndex] === null) {
                semaphore[slotIndex] = item;
                resolve(undefined);
              } else {
                setTimeout(checkSlot, 1);
              }
            };
            checkSlot();
          });

          try {
            const result = await processor(item);
            successCount++;
            
            // Estimate bytes processed (rough approximation)
            if (typeof item === 'string') {
              totalBytesProcessed += Buffer.byteLength(item);
            } else if (Buffer.isBuffer(item)) {
              totalBytesProcessed += item.length;
            }
            
            return result;
          } catch (error) {
            errorCount++;
            throw error;
          } finally {
            // Release semaphore slot
            const slotIndex = index % semaphore.length;
            semaphore[slotIndex] = null;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      const averageSpeed = totalBytesProcessed > 0 ? 
        calculateProcessingSpeed(totalBytesProcessed, totalDuration) : 0;

      // Record batch metrics
      if (enableMetrics) {
        this.recordMetric({
          operationType: 'batch_processing',
          duration: totalDuration,
          bytesProcessed: totalBytesProcessed,
          cacheHit: false,
          timestamp: Date.now()
        });
      }

      return {
        results,
        totalDuration,
        successCount,
        errorCount,
        averageSpeed
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      // Record error metric
      if (enableMetrics) {
        this.recordMetric({
          operationType: 'batch_processing_error',
          duration: totalDuration,
          bytesProcessed: totalBytesProcessed,
          cacheHit: false,
          timestamp: Date.now()
        });
      }
      
      throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimized file I/O operations with better buffering
   * @param filePath - Path to the file to read
   * @param options - I/O options
   * @returns Promise that resolves to file content
   */
  async readFileOptimized(
    filePath: string,
    options: {
      encoding?: BufferEncoding;
      bufferSize?: number;
      enableCaching?: boolean;
    } = {}
  ): Promise<string | Buffer> {
    const startTime = Date.now();
    const bufferSize = options.bufferSize || this.config.fileBufferSize;
    
    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // For small files, use direct read
      if (stats.size <= bufferSize) {
        const content = await fs.readFile(filePath, options.encoding);
        
        // Record metrics
        if (this.config.enableMetrics) {
          this.recordMetric({
            operationType: 'file_read_direct',
            duration: Date.now() - startTime,
            bytesProcessed: stats.size,
            cacheHit: false,
            timestamp: Date.now()
          });
        }
        
        return content;
      }

      // For large files, use streaming read with optimized buffer size
      const chunks: Buffer[] = [];
      const readStream = await fs.open(filePath, 'r');
      
      try {
        let position = 0;
        while (position < stats.size) {
          const chunkSize = Math.min(bufferSize, stats.size - position);
          const buffer = Buffer.alloc(chunkSize);
          
          const { bytesRead } = await readStream.read(buffer, 0, chunkSize, position);
          if (bytesRead === 0) break;
          
          chunks.push(buffer.subarray(0, bytesRead));
          position += bytesRead;
        }
        
        const content = Buffer.concat(chunks);
        
        // Record metrics
        if (this.config.enableMetrics) {
          this.recordMetric({
            operationType: 'file_read_streaming',
            duration: Date.now() - startTime,
            bytesProcessed: stats.size,
            cacheHit: false,
            timestamp: Date.now()
          });
        }
        
        return options.encoding ? content.toString(options.encoding) : content;
        
      } finally {
        await readStream.close();
      }
      
    } catch (error) {
      // Record error metric
      if (this.config.enableMetrics) {
        this.recordMetric({
          operationType: 'file_read_error',
          duration: Date.now() - startTime,
          bytesProcessed: 0,
          cacheHit: false,
          timestamp: Date.now()
        });
      }
      
      throw new Error(`Optimized file read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets performance metrics for monitoring and optimization
   * @param operationType - Optional filter by operation type
   * @param timeRange - Optional time range in milliseconds
   * @returns Array of performance metrics
   */
  getPerformanceMetrics(operationType?: string, timeRange?: number): PerformanceMetrics[] {
    if (!this.config.enableMetrics) {
      return [];
    }

    let filteredMetrics = this.metrics;
    
    // Filter by operation type
    if (operationType) {
      filteredMetrics = filteredMetrics.filter(m => m.operationType === operationType);
    }
    
    // Filter by time range
    if (timeRange) {
      const cutoffTime = Date.now() - timeRange;
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= cutoffTime);
    }
    
    return filteredMetrics;
  }

  /**
   * Gets performance statistics summary
   * @param operationType - Optional filter by operation type
   * @returns Performance statistics
   */
  getPerformanceStats(operationType?: string): {
    totalOperations: number;
    averageDuration: number;
    totalBytesProcessed: number;
    averageSpeed: number; // MB/s
    cacheHitRate: number;
    errorRate: number;
  } {
    const metrics = this.getPerformanceMetrics(operationType);
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        totalBytesProcessed: 0,
        averageSpeed: 0,
        cacheHitRate: 0,
        errorRate: 0
      };
    }
    
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalBytes = metrics.reduce((sum, m) => sum + m.bytesProcessed, 0);
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const errors = metrics.filter(m => m.operationType.includes('error')).length;
    
    return {
      totalOperations: metrics.length,
      averageDuration: totalDuration / metrics.length,
      totalBytesProcessed: totalBytes,
      averageSpeed: totalBytes > 0 ? calculateProcessingSpeed(totalBytes, totalDuration) : 0,
      cacheHitRate: (cacheHits / metrics.length) * 100,
      errorRate: (errors / metrics.length) * 100
    };
  }

  /**
   * Clears the hash cache
   */
  clearHashCache(): void {
    this.hashCache.clear();
  }

  /**
   * Gets hash cache statistics
   * @returns Cache statistics
   */
  getHashCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    const metrics = this.getPerformanceMetrics();
    const hashMetrics = metrics.filter(m => 
      m.operationType === 'hash_calculation' || 
      m.operationType === 'buffer_hash_calculation'
    );
    
    const cacheHits = hashMetrics.filter(m => m.cacheHit).length;
    const hitRate = hashMetrics.length > 0 ? (cacheHits / hashMetrics.length) * 100 : 0;
    
    return {
      size: this.hashCache.size,
      maxSize: this.config.hashCacheSize,
      hitRate
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = undefined;
    }
    
    this.hashCache.clear();
    this.metrics = [];
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Records a performance metric
   * @param metric - Metric to record
   */
  private recordMetric(metric: PerformanceMetrics): void {
    if (!this.config.enableMetrics) {
      return;
    }
    
    this.metrics.push(metric);
    
    // Keep metrics array size manageable
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000); // Keep last 5000 metrics
    }
  }

  /**
   * Starts periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    this.metricsCleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - this.config.metricsRetentionTime;
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    }, 60000); // Cleanup every minute
  }
}

/**
 * Creates a ContentPerformanceOptimizer instance with default configuration
 * @param config - Optional configuration overrides
 * @returns ContentPerformanceOptimizer instance
 */
export function createContentPerformanceOptimizer(
  config?: Partial<PerformanceOptimizerConfig>
): ContentPerformanceOptimizer {
  return new ContentPerformanceOptimizer(config);
}

/**
 * Utility function to format cache hit rate
 * @param hitRate - Hit rate as percentage
 * @returns Formatted string
 */
export function formatCacheHitRate(hitRate: number): string {
  return `${hitRate.toFixed(1)}%`;
}

/**
 * Utility function to format processing speed
 * @param speed - Speed in MB/s
 * @returns Formatted string
 */
export function formatProcessingSpeed(speed: number): string {
  if (speed < 1) {
    return `${(speed * 1024).toFixed(1)} KB/s`;
  } else {
    return `${speed.toFixed(1)} MB/s`;
  }
}