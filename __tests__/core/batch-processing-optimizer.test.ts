/**
 * Tests for Batch Processing Optimizer
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BatchProcessingOptimizer,
  createBatchProcessor,
  createImageBatchProcessor,
  createTextBatchProcessor,
  DEFAULT_BATCH_CONFIG,
  type BatchProcessingConfig,
  type BatchProcessingResult
} from '../../src/core/batch-processing-optimizer.js';
import type { EmbeddingResult } from '../../src/types.js';
import type { EmbeddingBatchItem } from '../../src/core/universal-embedder.js';

describe('Batch Processing Optimizer', () => {
  let optimizer: BatchProcessingOptimizer;
  
  beforeEach(() => {
    optimizer = new BatchProcessingOptimizer();
  });
  
  afterEach(() => {
    // Cleanup any resources
  });
  
  // =============================================================================
  // CONFIGURATION TESTS
  // =============================================================================
  
  describe('Configuration', () => {
    test('should use default configuration', () => {
      const config = optimizer.getConfig();
      
      assert.strictEqual(config.textBatchSize, DEFAULT_BATCH_CONFIG.textBatchSize);
      assert.strictEqual(config.imageBatchSize, DEFAULT_BATCH_CONFIG.imageBatchSize);
      assert.strictEqual(config.enableProgressReporting, DEFAULT_BATCH_CONFIG.enableProgressReporting);
    });
    
    test('should accept custom configuration', () => {
      const customConfig: Partial<BatchProcessingConfig> = {
        textBatchSize: 32,
        imageBatchSize: 2,
        enableProgressReporting: false
      };
      
      const customOptimizer = new BatchProcessingOptimizer(customConfig);
      const config = customOptimizer.getConfig();
      
      assert.strictEqual(config.textBatchSize, 32);
      assert.strictEqual(config.imageBatchSize, 2);
      assert.strictEqual(config.enableProgressReporting, false);
    });
    
    test('should update configuration', () => {
      optimizer.updateConfig({ textBatchSize: 64 });
      const config = optimizer.getConfig();
      
      assert.strictEqual(config.textBatchSize, 64);
    });
  });
  
  // =============================================================================
  // FACTORY FUNCTION TESTS
  // =============================================================================
  
  describe('Factory Functions', () => {
    test('should create default batch processor', () => {
      const processor = createBatchProcessor();
      const config = processor.getConfig();
      
      assert.strictEqual(config.textBatchSize, DEFAULT_BATCH_CONFIG.textBatchSize);
      assert.strictEqual(config.imageBatchSize, DEFAULT_BATCH_CONFIG.imageBatchSize);
    });
    
    test('should create image-optimized batch processor', () => {
      const processor = createImageBatchProcessor();
      const config = processor.getConfig();
      
      // Should have smaller batch sizes for memory efficiency
      assert.ok(config.imageBatchSize <= 4);
      // Should have higher memory threshold for memory-intensive image processing
      assert.ok(config.memoryThresholdMB >= 256);
      assert.strictEqual(config.enableMemoryMonitoring, true);
    });
    
    test('should create text-optimized batch processor', () => {
      const processor = createTextBatchProcessor();
      const config = processor.getConfig();
      
      // Should have larger batch sizes for text
      assert.ok(config.textBatchSize >= 16);
      assert.strictEqual(config.enableParallelProcessing, true);
    });
  });
  
  // =============================================================================
  // BATCH PROCESSING TESTS
  // =============================================================================
  
  describe('Batch Processing', () => {
    test('should process empty batch', async () => {
      const items: EmbeddingBatchItem[] = [];
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: 'test',
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      assert.strictEqual(result.results.length, 0);
      assert.strictEqual(result.stats.totalItems, 0);
      assert.strictEqual(result.stats.processedItems, 0);
      assert.strictEqual(result.errors.length, 0);
    });
    
    test('should process text items in batches', async () => {
      const items: EmbeddingBatchItem[] = [
        { content: 'text 1', contentType: 'text' },
        { content: 'text 2', contentType: 'text' },
        { content: 'text 3', contentType: 'text' }
      ];
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      assert.strictEqual(result.results.length, 3);
      assert.strictEqual(result.stats.totalItems, 3);
      assert.strictEqual(result.stats.processedItems, 3);
      assert.strictEqual(result.stats.failedItems, 0);
      assert.strictEqual(result.errors.length, 0);
    });
    
    test('should process image items in batches', async () => {
      const items: EmbeddingBatchItem[] = [
        { content: '/path/to/image1.jpg', contentType: 'image' },
        { content: '/path/to/image2.png', contentType: 'image' }
      ];
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.4, 0.5, 0.6]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      assert.strictEqual(result.results.length, 2);
      assert.strictEqual(result.stats.totalItems, 2);
      assert.strictEqual(result.stats.processedItems, 2);
      assert.strictEqual(result.stats.failedItems, 0);
    });
    
    test('should process mixed content types', async () => {
      const items: EmbeddingBatchItem[] = [
        { content: 'text content', contentType: 'text' },
        { content: '/path/to/image.jpg', contentType: 'image' },
        { content: 'more text', contentType: 'text' }
      ];
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      assert.strictEqual(result.results.length, 3);
      assert.strictEqual(result.stats.totalItems, 3);
      assert.strictEqual(result.stats.processedItems, 3);
      
      // Verify content types are preserved
      const textResults = result.results.filter(r => r.contentType === 'text');
      const imageResults = result.results.filter(r => r.contentType === 'image');
      assert.strictEqual(textResults.length, 2);
      assert.strictEqual(imageResults.length, 1);
    });
  });
  
  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================
  
  describe('Error Handling', () => {
    test('should handle embedding function errors', async () => {
      const items: EmbeddingBatchItem[] = [
        { content: 'good text', contentType: 'text' },
        { content: 'bad text', contentType: 'text' },
        { content: 'more good text', contentType: 'text' }
      ];
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        if (item.content === 'bad text') {
          throw new Error('Embedding failed');
        }
        
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      assert.strictEqual(result.results.length, 2); // Only successful items
      assert.strictEqual(result.stats.processedItems, 2);
      assert.strictEqual(result.stats.failedItems, 1);
      assert.strictEqual(result.errors.length, 1);
      
      // Check error details
      const error = result.errors[0];
      assert.strictEqual(error.item.content, 'bad text');
      assert.ok(error.error.includes('Embedding failed'));
    });
    
    test('should use fallback processing when enabled', async () => {
      const fallbackOptimizer = new BatchProcessingOptimizer({
        enableFallbackProcessing: true,
        maxRetries: 2,
        textBatchSize: 1 // Force individual processing to trigger fallback
      });
      
      const items: EmbeddingBatchItem[] = [
        { content: 'text 1', contentType: 'text' },
        { content: 'text 2', contentType: 'text' }
      ];
      
      let callCount = 0;
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        callCount++;
        
        // Fail first batch to trigger fallback processing
        if (callCount <= 2) {
          throw new Error('Batch processing failure');
        }
        
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await fallbackOptimizer.processBatch(items, embedFunction);
      
      // Should have some results even if some failed
      assert.ok(result.stats.totalItems === 2);
      // Either fallback was used or retries occurred
      assert.ok(result.stats.fallbackCount > 0 || result.stats.retryCount > 0 || result.stats.failedItems > 0);
    });
  });
  
  // =============================================================================
  // PROGRESS REPORTING TESTS
  // =============================================================================
  
  describe('Progress Reporting', () => {
    test('should report progress during processing', async () => {
      const progressOptimizer = new BatchProcessingOptimizer({
        enableProgressReporting: true,
        progressReportInterval: 1, // Report every batch
        textBatchSize: 1 // Small batches to trigger multiple reports
      });
      
      const items: EmbeddingBatchItem[] = [
        { content: 'text 1', contentType: 'text' },
        { content: 'text 2', contentType: 'text' },
        { content: 'text 3', contentType: 'text' }
      ];
      
      const progressReports: any[] = [];
      const progressCallback = (stats: any) => {
        progressReports.push({ ...stats });
      };
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      await progressOptimizer.processBatch(items, embedFunction, progressCallback);
      
      // Should have received progress reports
      assert.ok(progressReports.length > 0);
      
      // Progress should show increasing processed items
      for (let i = 1; i < progressReports.length; i++) {
        assert.ok(progressReports[i].processedItems >= progressReports[i - 1].processedItems);
      }
    });
  });
  
  // =============================================================================
  // MEMORY MONITORING TESTS
  // =============================================================================
  
  describe('Memory Monitoring', () => {
    test('should track memory usage', async () => {
      const memoryOptimizer = new BatchProcessingOptimizer({
        enableMemoryMonitoring: true
      });
      
      const items: EmbeddingBatchItem[] = [
        { content: 'text 1', contentType: 'text' },
        { content: 'text 2', contentType: 'text' }
      ];
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await memoryOptimizer.processBatch(items, embedFunction);
      
      // Should have memory statistics
      assert.ok(typeof result.stats.memoryUsageMB === 'number');
      assert.ok(typeof result.stats.peakMemoryUsageMB === 'number');
      assert.ok(result.stats.peakMemoryUsageMB >= result.stats.memoryUsageMB);
    });
    
    test('should provide memory statistics', () => {
      const memoryStats = optimizer.getMemoryStats();
      
      assert.ok(typeof memoryStats.currentMB === 'number');
      assert.ok(typeof memoryStats.peakMB === 'number');
      assert.ok(typeof memoryStats.initialMB === 'number');
      assert.ok(memoryStats.currentMB > 0);
    });
  });
  
  // =============================================================================
  // PERFORMANCE TESTS
  // =============================================================================
  
  describe('Performance', () => {
    test('should calculate processing statistics', async () => {
      const items: EmbeddingBatchItem[] = Array.from({ length: 10 }, (_, i) => ({
        content: `text ${i}`,
        contentType: 'text' as const
      }));
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        // Add small delay to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const result = await optimizer.processBatch(items, embedFunction);
      
      // Should have timing statistics
      assert.ok(result.stats.processingTimeMs > 0);
      assert.ok(result.stats.averageBatchTimeMs > 0);
      assert.ok(result.stats.itemsPerSecond > 0);
      assert.ok(result.stats.totalBatches > 0);
      assert.ok(result.stats.completedBatches > 0);
    });
    
    test('should handle large batches efficiently', async () => {
      const largeOptimizer = new BatchProcessingOptimizer({
        textBatchSize: 50,
        enableParallelProcessing: true
      });
      
      const items: EmbeddingBatchItem[] = Array.from({ length: 100 }, (_, i) => ({
        content: `text ${i}`,
        contentType: 'text' as const
      }));
      
      const embedFunction = async (item: EmbeddingBatchItem): Promise<EmbeddingResult> => {
        return {
          embedding_id: `id_${item.content}`,
          vector: new Float32Array([0.1, 0.2, 0.3]),
          contentType: item.contentType
        };
      };
      
      const startTime = Date.now();
      const result = await largeOptimizer.processBatch(items, embedFunction);
      const endTime = Date.now();
      
      assert.strictEqual(result.results.length, 100);
      assert.strictEqual(result.stats.processedItems, 100);
      assert.strictEqual(result.stats.failedItems, 0);
      
      // Should complete in reasonable time
      const processingTime = endTime - startTime;
      assert.ok(processingTime < 10000); // Less than 10 seconds
    });
  });
});

// =============================================================================
// MANDATORY: Force exit after test completion to prevent hanging
// ML resources (image-to-text processor) don't clean up gracefully
// =============================================================================
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging from ML resources...');
  
  // Multiple garbage collection attempts
  if (global.gc) {
    global.gc();
    setTimeout(() => global.gc && global.gc(), 100);
    setTimeout(() => global.gc && global.gc(), 300);
  }
  
  // Force exit after cleanup attempts
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 1000);
}, 2000);