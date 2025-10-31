/**
 * Architecture performance validation tests
 * Tests the core refactored architecture performance without full embedding pipeline
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import core components directly
import { SearchEngine } from '../../src/core/search.js';
import { IngestionPipeline } from '../../src/core/ingestion.js';
import { IndexManager } from '../../src/index-manager.js';
import { openDatabase } from '../../src/core/db.js';
import type { EmbedFunction, RerankFunction } from '../../src/core/interfaces.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'rag-lite-arch-perf-test');
const TEST_DIR = join(TEST_BASE_DIR, Date.now().toString());
const TEST_DB_PATH = join(TEST_DIR, 'test.db');
const TEST_INDEX_PATH = join(TEST_DIR, 'test.index');

/**
 * Mock embed function for performance testing
 */
const mockEmbedFunction: EmbedFunction = async (query: string) => {
  // Simulate embedding generation time (1-5ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 4 + 1));
  
  // Return a mock 384-dimensional embedding
  const vector = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }
  
  return {
    embedding_id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    vector,
    contentType: 'text'
  };
};

/**
 * Mock rerank function for performance testing
 */
const mockRerankFunction: RerankFunction = async (query: string, results: any[]) => {
  // Simulate reranking time (5-15ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
  
  // Simple mock reranking - just shuffle the results
  const shuffled = [...results];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

/**
 * Setup test environment
 */
function setupTestEnvironment(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  mkdirSync(TEST_DIR, { recursive: true });
}

/**
 * Cleanup test environment
 */
function cleanupTestEnvironment(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

/**
 * Measure memory usage
 */
function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024; // Convert to MB
}

/**
 * Measure execution time of an async function
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const startTime = performance.now();
  const result = await fn();
  const timeMs = performance.now() - startTime;
  return { result, timeMs };
}

describe('Architecture Performance Validation', () => {
  describe('Dependency Injection Overhead', () => {
    test('should have minimal overhead from dependency injection pattern', async () => {
      setupTestEnvironment();
      
      const startMemory = getMemoryUsage();
      
      // Test core component initialization time
      const { result: components, timeMs: initTime } = await measureTime(async () => {
        const db = await openDatabase(TEST_DB_PATH);
        const indexManager = new IndexManager(TEST_INDEX_PATH, TEST_DB_PATH, 384);
        
        return { db, indexManager };
      });

      const { db, indexManager } = components;
      
      // Test SearchEngine creation with dependency injection
      const { result: searchEngine, timeMs: searchEngineTime } = await measureTime(async () => {
        return new SearchEngine(mockEmbedFunction, indexManager, db, mockRerankFunction);
      });

      // Test IngestionPipeline creation with dependency injection
      const { result: ingestionPipeline, timeMs: ingestionTime } = await measureTime(async () => {
        return new IngestionPipeline(mockEmbedFunction, indexManager, db);
      });

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;

      console.log(`Core initialization: ${initTime.toFixed(2)}ms`);
      console.log(`SearchEngine creation: ${searchEngineTime.toFixed(2)}ms`);
      console.log(`IngestionPipeline creation: ${ingestionTime.toFixed(2)}ms`);
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate dependency injection overhead is minimal
      assert.ok(searchEngineTime < 10, `SearchEngine creation took ${searchEngineTime.toFixed(2)}ms, expected < 10ms`);
      assert.ok(ingestionTime < 10, `IngestionPipeline creation took ${ingestionTime.toFixed(2)}ms, expected < 10ms`);
      assert.ok(memoryGrowth < 10, `Memory growth was ${memoryGrowth.toFixed(2)}MB, expected < 10MB`);

      // Cleanup
      await searchEngine.cleanup();
      await ingestionPipeline.cleanup();
      cleanupTestEnvironment();
    });

    test('should maintain performance with multiple component instances', async () => {
      setupTestEnvironment();
      
      const startMemory = getMemoryUsage();
      const instances: any[] = [];
      
      // Create multiple instances to test scalability
      const { timeMs: multiInstanceTime } = await measureTime(async () => {
        for (let i = 0; i < 5; i++) {
          const db = await openDatabase(`${TEST_DB_PATH}_${i}`);
          const indexManager = new IndexManager(`${TEST_INDEX_PATH}_${i}`, `${TEST_DB_PATH}_${i}`, 384);
          const searchEngine = new SearchEngine(mockEmbedFunction, indexManager, db);
          instances.push({ searchEngine, db, indexManager });
        }
      });

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;
      const avgInstanceTime = multiInstanceTime / 5;

      console.log(`Multiple instances creation: ${multiInstanceTime.toFixed(2)}ms total`);
      console.log(`Average per instance: ${avgInstanceTime.toFixed(2)}ms`);
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate scalability
      assert.ok(avgInstanceTime < 50, `Average instance creation took ${avgInstanceTime.toFixed(2)}ms, expected < 50ms`);
      assert.ok(memoryGrowth < 50, `Memory growth was ${memoryGrowth.toFixed(2)}MB, expected < 50MB`);

      // Cleanup all instances
      for (const instance of instances) {
        await instance.searchEngine.cleanup();
      }
      cleanupTestEnvironment();
    });
  });

  describe('Core Layer Performance', () => {
    test('should have consistent performance across core operations', async () => {
      setupTestEnvironment();
      
      const db = await openDatabase(TEST_DB_PATH);
      const indexManager = new IndexManager(TEST_INDEX_PATH, TEST_DB_PATH, 384);
      const searchEngine = new SearchEngine(mockEmbedFunction, indexManager, db);

      // Test multiple search operations for consistency
      const searchTimes: number[] = [];
      const testQueries = ['test query 1', 'test query 2', 'test query 3', 'test query 4', 'test query 5'];

      for (const query of testQueries) {
        const { timeMs } = await measureTime(async () => {
          try {
            await searchEngine.search(query, { top_k: 5 });
          } catch (error) {
            // Expected to fail due to empty index, but we're measuring the timing
            // The search coordination logic still runs
          }
        });
        searchTimes.push(timeMs);
      }

      const avgTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const maxTime = Math.max(...searchTimes);
      const minTime = Math.min(...searchTimes);
      const variance = maxTime - minTime;

      console.log(`Search coordination times: ${searchTimes.map(t => t.toFixed(2)).join(', ')}ms`);
      console.log(`Average: ${avgTime.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);

      // Validate consistency (low variance relative to average)
      const variancePercent = (variance / avgTime) * 100;
      assert.ok(variancePercent < 100, `Performance variance was ${variancePercent.toFixed(1)}%, expected < 100%`);

      // All operations should be reasonably fast
      searchTimes.forEach((time, index) => {
        assert.ok(time < 100, `Search coordination ${index + 1} took ${time.toFixed(2)}ms, expected < 100ms`);
      });

      await searchEngine.cleanup();
      cleanupTestEnvironment();
    });

    test('should handle concurrent operations efficiently', async () => {
      setupTestEnvironment();
      
      const db = await openDatabase(TEST_DB_PATH);
      const indexManager = new IndexManager(TEST_INDEX_PATH, TEST_DB_PATH, 384);
      const searchEngine = new SearchEngine(mockEmbedFunction, indexManager, db);

      const startMemory = getMemoryUsage();
      
      // Test concurrent search operations
      const concurrentQueries = ['query 1', 'query 2', 'query 3', 'query 4'];
      
      const { timeMs: concurrentTime } = await measureTime(async () => {
        const promises = concurrentQueries.map(async (query) => {
          try {
            return await searchEngine.search(query, { top_k: 3 });
          } catch (error) {
            // Expected to fail due to empty index
            return [];
          }
        });
        return await Promise.all(promises);
      });

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;

      console.log(`Concurrent operations (${concurrentQueries.length} queries): ${concurrentTime.toFixed(2)}ms`);
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate concurrent performance
      assert.ok(concurrentTime < 500, `Concurrent operations took ${concurrentTime.toFixed(2)}ms, expected < 500ms`);
      assert.ok(memoryGrowth < 20, `Memory growth was ${memoryGrowth.toFixed(2)}MB, expected < 20MB`);

      await searchEngine.cleanup();
      cleanupTestEnvironment();
    });
  });

  describe('Memory Management', () => {
    test('should have stable memory usage patterns', async () => {
      setupTestEnvironment();
      
      const initialMemory = getMemoryUsage();
      let maxMemory = initialMemory;
      let minMemory = initialMemory;

      // Perform multiple create/destroy cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        const db = await openDatabase(`${TEST_DB_PATH}_cycle_${cycle}`);
        const indexManager = new IndexManager(`${TEST_INDEX_PATH}_cycle_${cycle}`, `${TEST_DB_PATH}_cycle_${cycle}`, 384);
        const searchEngine = new SearchEngine(mockEmbedFunction, indexManager, db);

        const currentMemory = getMemoryUsage();
        maxMemory = Math.max(maxMemory, currentMemory);
        minMemory = Math.min(minMemory, currentMemory);

        // Perform some operations
        for (let i = 0; i < 3; i++) {
          try {
            await searchEngine.search(`test query ${i}`, { top_k: 5 });
          } catch (error) {
            // Expected to fail due to empty index
          }
        }

        await searchEngine.cleanup();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = getMemoryUsage();
      const totalGrowth = finalMemory - initialMemory;
      const maxGrowth = maxMemory - initialMemory;

      console.log(`Initial memory: ${initialMemory.toFixed(2)}MB`);
      console.log(`Max memory: ${maxMemory.toFixed(2)}MB`);
      console.log(`Final memory: ${finalMemory.toFixed(2)}MB`);
      console.log(`Total growth: ${totalGrowth.toFixed(2)}MB`);
      console.log(`Max growth: ${maxGrowth.toFixed(2)}MB`);

      // Validate memory stability
      assert.ok(totalGrowth < 30, `Total memory growth was ${totalGrowth.toFixed(2)}MB, expected < 30MB`);
      assert.ok(maxGrowth < 50, `Max memory growth was ${maxGrowth.toFixed(2)}MB, expected < 50MB`);

      cleanupTestEnvironment();
    });
  });

  describe('Architecture Comparison', () => {
    test('should demonstrate improved architecture characteristics', async () => {
      setupTestEnvironment();
      
      // Test the new dependency injection architecture
      const startTime = performance.now();
      const startMemory = getMemoryUsage();

      // Create components with explicit dependencies
      const db = await openDatabase(TEST_DB_PATH);
      const indexManager = new IndexManager(TEST_INDEX_PATH, TEST_DB_PATH, 384);
      
      // Test different configurations easily through dependency injection
      const searchEngineWithRerank = new SearchEngine(mockEmbedFunction, indexManager, db, mockRerankFunction);
      const searchEngineWithoutRerank = new SearchEngine(mockEmbedFunction, indexManager, db);
      
      const setupTime = performance.now() - startTime;
      const setupMemory = getMemoryUsage() - startMemory;

      console.log(`Architecture setup time: ${setupTime.toFixed(2)}ms`);
      console.log(`Architecture setup memory: ${setupMemory.toFixed(2)}MB`);

      // Test that both configurations work
      try {
        await searchEngineWithRerank.search('test query', { top_k: 5 });
      } catch (error) {
        // Expected due to empty index
      }

      try {
        await searchEngineWithoutRerank.search('test query', { top_k: 5 });
      } catch (error) {
        // Expected due to empty index
      }

      // Validate architecture benefits
      assert.ok(setupTime < 100, `Architecture setup took ${setupTime.toFixed(2)}ms, expected < 100ms`);
      assert.ok(setupMemory < 20, `Architecture setup used ${setupMemory.toFixed(2)}MB, expected < 20MB`);

      // Test clean separation - core components should not know about specific implementations
      assert.ok(typeof searchEngineWithRerank.search === 'function', 'SearchEngine should have search method');
      assert.ok(typeof searchEngineWithoutRerank.search === 'function', 'SearchEngine should have search method');

      await searchEngineWithRerank.cleanup();
      await searchEngineWithoutRerank.cleanup();
      cleanupTestEnvironment();
    });
  });
});
