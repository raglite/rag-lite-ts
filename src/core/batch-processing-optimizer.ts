/**
 * CORE MODULE — Batch Processing Optimizer
 * Optimizes embedding generation for large multimodal content batches
 * Implements efficient image processing pipelines with progress reporting
 * Creates memory-efficient processing for large image collections
 */

import type { EmbeddingResult } from '../types.js';
import type { EmbeddingBatchItem } from './universal-embedder.js';
import { LazyMultimodalLoader } from './lazy-dependency-loader.js';
import { createError, ErrorCategory, ErrorSeverity } from './error-handler.js';
import { getResourceManager } from './resource-manager.js';

// =============================================================================
// BATCH PROCESSING CONFIGURATION
// =============================================================================

/**
 * Configuration for batch processing optimization
 */
export interface BatchProcessingConfig {
  // Batch size configuration
  textBatchSize: number;
  imageBatchSize: number;
  maxConcurrentBatches: number;
  
  // Memory management
  memoryThresholdMB: number;
  enableMemoryMonitoring: boolean;
  enableGarbageCollection: boolean;
  
  // Progress reporting
  enableProgressReporting: boolean;
  progressReportInterval: number; // Report every N batches
  
  // Error handling
  maxRetries: number;
  retryDelayMs: number;
  enableFallbackProcessing: boolean;
  
  // Performance optimization
  enableParallelProcessing: boolean;
  enableResourcePooling: boolean;
  preloadModels: boolean;
}

/**
 * Default batch processing configuration optimized for multimodal content
 */
export const DEFAULT_BATCH_CONFIG: BatchProcessingConfig = {
  // Conservative batch sizes for memory efficiency
  textBatchSize: 16,
  imageBatchSize: 4, // Smaller for memory-intensive image processing
  maxConcurrentBatches: 2,
  
  // Memory management (512MB threshold for multimodal processing)
  memoryThresholdMB: 512,
  enableMemoryMonitoring: true,
  enableGarbageCollection: true,
  
  // Progress reporting every 5 batches
  enableProgressReporting: true,
  progressReportInterval: 5,
  
  // Error handling with retries
  maxRetries: 3,
  retryDelayMs: 1000,
  enableFallbackProcessing: true,
  
  // Performance optimization
  enableParallelProcessing: true,
  enableResourcePooling: true,
  preloadModels: false // Lazy loading by default
};

// =============================================================================
// BATCH PROCESSING STATISTICS
// =============================================================================

/**
 * Statistics for batch processing operations
 */
export interface BatchProcessingStats {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  skippedItems: number;
  
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  
  processingTimeMs: number;
  averageBatchTimeMs: number;
  itemsPerSecond: number;
  
  memoryUsageMB: number;
  peakMemoryUsageMB: number;
  
  retryCount: number;
  fallbackCount: number;
}

/**
 * Progress callback for batch processing
 */
export type BatchProgressCallback = (stats: BatchProcessingStats) => void;

// =============================================================================
// BATCH PROCESSING RESULT
// =============================================================================

/**
 * Result of batch processing operation
 */
export interface BatchProcessingResult {
  results: EmbeddingResult[];
  stats: BatchProcessingStats;
  errors: Array<{
    item: EmbeddingBatchItem;
    error: string;
    batchIndex: number;
    itemIndex: number;
  }>;
}

// =============================================================================
// MEMORY MONITORING
// =============================================================================

/**
 * Memory monitoring utilities for batch processing
 */
class MemoryMonitor {
  private initialMemoryMB: number;
  private peakMemoryMB: number;
  
  constructor() {
    this.initialMemoryMB = this.getCurrentMemoryUsageMB();
    this.peakMemoryMB = this.initialMemoryMB;
  }
  
  /**
   * Get current memory usage in MB
   */
  getCurrentMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }
  
  /**
   * Update peak memory usage
   */
  updatePeakMemory(): void {
    const current = this.getCurrentMemoryUsageMB();
    if (current > this.peakMemoryMB) {
      this.peakMemoryMB = current;
    }
  }
  
  /**
   * Check if memory usage exceeds threshold
   */
  isMemoryThresholdExceeded(thresholdMB: number): boolean {
    return this.getCurrentMemoryUsageMB() > thresholdMB;
  }
  
  /**
   * Force garbage collection if enabled
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Get memory statistics
   */
  getStats(): { currentMB: number; peakMB: number; initialMB: number } {
    return {
      currentMB: this.getCurrentMemoryUsageMB(),
      peakMB: this.peakMemoryMB,
      initialMB: this.initialMemoryMB
    };
  }
}

// =============================================================================
// BATCH PROCESSING OPTIMIZER
// =============================================================================

/**
 * Optimized batch processor for multimodal content
 * Handles large collections of text and image content efficiently
 */
export class BatchProcessingOptimizer {
  private config: BatchProcessingConfig;
  private memoryMonitor: MemoryMonitor;
  private resourcePool: Map<string, any> = new Map();
  private resourceManager = getResourceManager();
  
  constructor(config: Partial<BatchProcessingConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.memoryMonitor = new MemoryMonitor();
  }
  
  // =============================================================================
  // PUBLIC API
  // =============================================================================
  
  /**
   * Process a large batch of multimodal content with optimization
   */
  async processBatch(
    items: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    progressCallback?: BatchProgressCallback
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    
    // Initialize statistics
    const stats: BatchProcessingStats = {
      totalItems: items.length,
      processedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      totalBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      processingTimeMs: 0,
      averageBatchTimeMs: 0,
      itemsPerSecond: 0,
      memoryUsageMB: this.memoryMonitor.getCurrentMemoryUsageMB(),
      peakMemoryUsageMB: this.memoryMonitor.getCurrentMemoryUsageMB(),
      retryCount: 0,
      fallbackCount: 0
    };
    
    const results: EmbeddingResult[] = [];
    const errors: Array<{
      item: EmbeddingBatchItem;
      error: string;
      batchIndex: number;
      itemIndex: number;
    }> = [];
    
    try {
      // Preload models if configured
      if (this.config.preloadModels) {
        await this.preloadRequiredModels(items);
      }
      
      // Separate items by content type for optimized processing
      const textItems = items.filter(item => item.contentType === 'text');
      const imageItems = items.filter(item => item.contentType === 'image');
      
      // Process text items in optimized batches
      if (textItems.length > 0) {
        const textResults = await this.processTextBatches(
          textItems,
          embedFunction,
          stats,
          errors,
          progressCallback
        );
        results.push(...textResults);
      }
      
      // Process image items in optimized batches
      if (imageItems.length > 0) {
        const imageResults = await this.processImageBatches(
          imageItems,
          embedFunction,
          stats,
          errors,
          progressCallback
        );
        results.push(...imageResults);
      }
      
      // Calculate final statistics
      const endTime = Date.now();
      stats.processingTimeMs = endTime - startTime;
      stats.averageBatchTimeMs = stats.totalBatches > 0 ? stats.processingTimeMs / stats.totalBatches : 0;
      stats.itemsPerSecond = stats.processingTimeMs > 0 ? (stats.processedItems / stats.processingTimeMs) * 1000 : 0;
      
      const memoryStats = this.memoryMonitor.getStats();
      stats.memoryUsageMB = memoryStats.currentMB;
      stats.peakMemoryUsageMB = memoryStats.peakMB;
      
      // Final progress report
      if (progressCallback && this.config.enableProgressReporting) {
        progressCallback(stats);
      }
      
      return { results, stats, errors };
      
    } catch (error) {
      throw createError.model(
        `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Cleanup resources
      await this.cleanupResources();
    }
  }
  
  // =============================================================================
  // TEXT BATCH PROCESSING
  // =============================================================================
  
  /**
   * Process text items in optimized batches
   */
  private async processTextBatches(
    textItems: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    stats: BatchProcessingStats,
    errors: Array<any>,
    progressCallback?: BatchProgressCallback
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const batchSize = this.config.textBatchSize;
    const totalBatches = Math.ceil(textItems.length / batchSize);
    
    console.log(`Processing ${textItems.length} text items in ${totalBatches} batches (batch size: ${batchSize})`);
    
    for (let i = 0; i < textItems.length; i += batchSize) {
      const batch = textItems.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      
      stats.totalBatches++;
      
      try {
        const batchResults = await this.processTextBatch(
          batch,
          embedFunction,
          batchIndex,
          stats,
          errors
        );
        
        results.push(...batchResults);
        stats.completedBatches++;
        
        // Memory management
        await this.performMemoryManagement();
        
        // Progress reporting
        if (progressCallback && this.shouldReportProgress(batchIndex)) {
          progressCallback({ ...stats });
        }
        
      } catch (error) {
        stats.failedBatches++;
        console.warn(`Text batch ${batchIndex + 1}/${totalBatches} failed: ${error instanceof Error ? error.message : String(error)}`);
        
        // Try fallback processing if enabled
        if (this.config.enableFallbackProcessing) {
          const fallbackResults = await this.processBatchWithFallback(
            batch,
            embedFunction,
            batchIndex,
            stats,
            errors
          );
          results.push(...fallbackResults);
          stats.fallbackCount++;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Process a single text batch with error handling
   */
  private async processTextBatch(
    batch: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    batchIndex: number,
    stats: BatchProcessingStats,
    errors: Array<any>
  ): Promise<EmbeddingResult[]> {
    const batchStartTime = Date.now();
    
    try {
      // Process batch items in parallel if enabled
      if (this.config.enableParallelProcessing) {
        const promises = batch.map(async (item, itemIndex) => {
          try {
            const result = await embedFunction(item);
            stats.processedItems++;
            return result;
          } catch (error) {
            stats.failedItems++;
            errors.push({
              item,
              error: error instanceof Error ? error.message : String(error),
              batchIndex,
              itemIndex
            });
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter((result: EmbeddingResult | null): result is EmbeddingResult => result !== null);
        
      } else {
        // Sequential processing
        const results: EmbeddingResult[] = [];
        
        for (let itemIndex = 0; itemIndex < batch.length; itemIndex++) {
          const item = batch[itemIndex];
          
          try {
            const result = await embedFunction(item);
            results.push(result);
            stats.processedItems++;
          } catch (error) {
            stats.failedItems++;
            errors.push({
              item,
              error: error instanceof Error ? error.message : String(error),
              batchIndex,
              itemIndex
            });
          }
        }
        
        return results;
      }
      
    } finally {
      // Update batch timing
      const batchTime = Date.now() - batchStartTime;
      stats.averageBatchTimeMs = ((stats.averageBatchTimeMs * (stats.completedBatches + stats.failedBatches)) + batchTime) / (stats.completedBatches + stats.failedBatches + 1);
    }
  }
  
  // =============================================================================
  // IMAGE BATCH PROCESSING
  // =============================================================================
  
  /**
   * Process image items in optimized batches with memory management
   */
  private async processImageBatches(
    imageItems: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    stats: BatchProcessingStats,
    errors: Array<any>,
    progressCallback?: BatchProgressCallback
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const batchSize = this.config.imageBatchSize;
    const totalBatches = Math.ceil(imageItems.length / batchSize);
    
    console.log(`Processing ${imageItems.length} image items in ${totalBatches} batches (batch size: ${batchSize})`);
    
    // Preload image processing models
    await this.preloadImageProcessingModels();
    
    for (let i = 0; i < imageItems.length; i += batchSize) {
      const batch = imageItems.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + Math.ceil(stats.totalBatches);
      
      stats.totalBatches++;
      
      try {
        const batchResults = await this.processImageBatch(
          batch,
          embedFunction,
          batchIndex,
          stats,
          errors
        );
        
        results.push(...batchResults);
        stats.completedBatches++;
        
        // Aggressive memory management for images
        await this.performMemoryManagement(true);
        
        // Progress reporting
        if (progressCallback && this.shouldReportProgress(batchIndex)) {
          progressCallback({ ...stats });
        }
        
      } catch (error) {
        stats.failedBatches++;
        console.warn(`Image batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        
        // Try fallback processing if enabled
        if (this.config.enableFallbackProcessing) {
          const fallbackResults = await this.processBatchWithFallback(
            batch,
            embedFunction,
            batchIndex,
            stats,
            errors
          );
          results.push(...fallbackResults);
          stats.fallbackCount++;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Process a single image batch with memory optimization
   */
  private async processImageBatch(
    batch: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    batchIndex: number,
    stats: BatchProcessingStats,
    errors: Array<any>
  ): Promise<EmbeddingResult[]> {
    const batchStartTime = Date.now();
    
    try {
      // For images, use sequential processing to manage memory better
      const results: EmbeddingResult[] = [];
      
      for (let itemIndex = 0; itemIndex < batch.length; itemIndex++) {
        const item = batch[itemIndex];
        
        try {
          // Check memory before processing each image
          if (this.memoryMonitor.isMemoryThresholdExceeded(this.config.memoryThresholdMB)) {
            console.warn(`Memory threshold exceeded (${this.memoryMonitor.getCurrentMemoryUsageMB()}MB), forcing garbage collection`);
            this.memoryMonitor.forceGarbageCollection();
          }
          
          const result = await embedFunction(item);
          results.push(result);
          stats.processedItems++;
          
          // Update memory tracking
          this.memoryMonitor.updatePeakMemory();
          
        } catch (error) {
          stats.failedItems++;
          errors.push({
            item,
            error: error instanceof Error ? error.message : String(error),
            batchIndex,
            itemIndex
          });
        }
      }
      
      return results;
      
    } finally {
      // Update batch timing
      const batchTime = Date.now() - batchStartTime;
      stats.averageBatchTimeMs = ((stats.averageBatchTimeMs * (stats.completedBatches + stats.failedBatches)) + batchTime) / (stats.completedBatches + stats.failedBatches + 1);
    }
  }
  
  // =============================================================================
  // FALLBACK PROCESSING
  // =============================================================================
  
  /**
   * Process batch with fallback to individual item processing
   */
  private async processBatchWithFallback(
    batch: EmbeddingBatchItem[],
    embedFunction: (item: EmbeddingBatchItem) => Promise<EmbeddingResult>,
    batchIndex: number,
    stats: BatchProcessingStats,
    errors: Array<any>
  ): Promise<EmbeddingResult[]> {
    console.log(`Attempting fallback processing for batch ${batchIndex} (${batch.length} items)`);
    
    const results: EmbeddingResult[] = [];
    
    for (let itemIndex = 0; itemIndex < batch.length; itemIndex++) {
      const item = batch[itemIndex];
      let retryCount = 0;
      
      while (retryCount <= this.config.maxRetries) {
        try {
          const result = await embedFunction(item);
          results.push(result);
          stats.processedItems++;
          break;
          
        } catch (error) {
          retryCount++;
          stats.retryCount++;
          
          if (retryCount <= this.config.maxRetries) {
            console.warn(`Retry ${retryCount}/${this.config.maxRetries} for item ${itemIndex} in batch ${batchIndex}`);
            await this.delay(this.config.retryDelayMs);
          } else {
            stats.failedItems++;
            errors.push({
              item,
              error: error instanceof Error ? error.message : String(error),
              batchIndex,
              itemIndex
            });
          }
        }
      }
    }
    
    return results;
  }
  
  // =============================================================================
  // RESOURCE MANAGEMENT
  // =============================================================================
  
  /**
   * Preload required models based on content types
   */
  private async preloadRequiredModels(items: EmbeddingBatchItem[]): Promise<void> {
    const hasImages = items.some(item => item.contentType === 'image');
    
    if (hasImages) {
      await this.preloadImageProcessingModels();
    }
  }
  
  /**
   * Preload image processing models
   */
  private async preloadImageProcessingModels(): Promise<void> {
    try {
      // Note: Image-to-text processor is loaded on-demand by file-processor.ts
      // to avoid conflicts with different pipeline configurations
      
      if (!this.resourcePool.has('metadataExtractor')) {
        console.log('Preloading image metadata extractor...');
        const extractor = await LazyMultimodalLoader.loadImageMetadataExtractor();
        this.resourcePool.set('metadataExtractor', extractor);
        
        // Register with resource manager
        this.resourceManager.registerImageProcessor(extractor, 'metadata-extractor');
      }
    } catch (error) {
      console.warn(`Failed to preload image processing models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Perform memory management operations
   */
  private async performMemoryManagement(aggressive: boolean = false): Promise<void> {
    if (!this.config.enableMemoryMonitoring) {
      return;
    }
    
    const currentMemory = this.memoryMonitor.getCurrentMemoryUsageMB();
    
    // Force garbage collection if memory threshold exceeded or aggressive mode
    if (aggressive || this.memoryMonitor.isMemoryThresholdExceeded(this.config.memoryThresholdMB)) {
      if (this.config.enableGarbageCollection) {
        this.memoryMonitor.forceGarbageCollection();
      }
    }
    
    // Update peak memory tracking
    this.memoryMonitor.updatePeakMemory();
  }
  
  /**
   * Cleanup resources after processing with resource manager integration
   */
  private async cleanupResources(): Promise<void> {
    try {
      // Clear resource pool if not using resource pooling
      if (!this.config.enableResourcePooling) {
        // Clean up registered processors
        for (const [key, processor] of this.resourcePool) {
          try {
            // The resource manager will handle proper cleanup
            if (processor && typeof processor.cleanup === 'function') {
              await processor.cleanup();
            }
          } catch (error) {
            console.warn(`Failed to cleanup processor ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        this.resourcePool.clear();
      }
      
      // Use resource manager for memory optimization
      if (this.config.enableGarbageCollection) {
        await this.resourceManager.optimizeMemory();
      }
      
    } catch (error) {
      console.warn(`Error during batch processing cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Check if progress should be reported for this batch
   */
  private shouldReportProgress(batchIndex: number): boolean {
    return this.config.enableProgressReporting && 
           (batchIndex + 1) % this.config.progressReportInterval === 0;
  }
  
  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current configuration
   */
  getConfig(): BatchProcessingConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get current memory statistics
   */
  getMemoryStats(): { currentMB: number; peakMB: number; initialMB: number } {
    return this.memoryMonitor.getStats();
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a batch processing optimizer with default configuration
 */
export function createBatchProcessor(config?: Partial<BatchProcessingConfig>): BatchProcessingOptimizer {
  return new BatchProcessingOptimizer(config);
}

/**
 * Create a batch processing optimizer optimized for large image collections
 */
export function createImageBatchProcessor(): BatchProcessingOptimizer {
  return new BatchProcessingOptimizer({
    imageBatchSize: 2, // Very small batches for memory efficiency
    textBatchSize: 8,
    memoryThresholdMB: 512, // Higher threshold for memory-intensive image processing
    enableMemoryMonitoring: true,
    enableGarbageCollection: true,
    enableParallelProcessing: false, // Sequential for better memory control
    progressReportInterval: 2 // More frequent progress reports
  });
}

/**
 * Create a batch processing optimizer optimized for text processing
 */
export function createTextBatchProcessor(): BatchProcessingOptimizer {
  return new BatchProcessingOptimizer({
    textBatchSize: 32, // Larger batches for text
    imageBatchSize: 4,
    enableParallelProcessing: true, // Parallel processing for text
    memoryThresholdMB: 256, // Lower threshold sufficient for text processing
    progressReportInterval: 10
  });
}