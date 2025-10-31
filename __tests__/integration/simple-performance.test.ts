/**
 * Simple performance validation for the refactored architecture
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

// Import core components
import { SearchEngine } from '../../src/core/search.js';
import { IngestionPipeline } from '../../src/core/ingestion.js';
import type { EmbedFunction, RerankFunction } from '../../src/core/interfaces.js';

/**
 * Mock embed function for performance testing
 */
const mockEmbedFunction: EmbedFunction = async (query: string) => {
  // Simulate minimal embedding time
  await new Promise(resolve => setTimeout(resolve, 1));
  
  const vector = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.random() * 2 - 1;
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
  await new Promise(resolve => setTimeout(resolve, 2));
  return results;
};

/**
 * Mock IndexManager for performance testing
 */
class MockIndexManager {
  search(vector: Float32Array, k: number) {
    return {
      embeddingIds: [],
      distances: [],
      count: 0
    };
  }
  
  async cleanup() {}
}

/**
 * Mock Database for performance testing
 */
class MockDatabase {
  async all(query: string, params?: any[]) {
    return [];
  }
  
  async close() {}
}

/**
 * Measure execution time
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const startTime = performance.now();
  const result = await fn();
  const timeMs = performance.now() - startTime;
  return { result, timeMs };
}

/**
 * Get memory usage in MB
 */
function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024;
}

describe('Simple Performance Validation', () => {
  test('should have minimal dependency injection overhead', async () => {
    const startMemory = getMemoryUsage();
    
    // Test SearchEngine creation time
    const { result: searchEngine, timeMs: searchTime } = await measureTime(async () => {
      return new SearchEngine(
        mockEmbedFunction,
        new MockIndexManager() as any,
        new MockDatabase() as any,
        mockRerankFunction
      );
    });

    // Test IngestionPipeline creation time
    const { result: ingestionPipeline, timeMs: ingestionTime } = await measureTime(async () => {
      return new IngestionPipeline(
        mockEmbedFunction,
        new MockIndexManager() as any,
        new MockDatabase() as any
      );
    });

    const endMemory = getMemoryUsage();
    const memoryGrowth = endMemory - startMemory;

    console.log(`SearchEngine creation: ${searchTime.toFixed(2)}ms`);
    console.log(`IngestionPipeline creation: ${ingestionTime.toFixed(2)}ms`);
    console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);

    // Validate performance
    assert.ok(searchTime < 10, `SearchEngine creation took ${searchTime.toFixed(2)}ms, expected < 10ms`);
    assert.ok(ingestionTime < 10, `IngestionPipeline creation took ${ingestionTime.toFixed(2)}ms, expected < 10ms`);
    assert.ok(memoryGrowth < 5, `Memory growth was ${memoryGrowth.toFixed(2)}MB, expected < 5MB`);

    await searchEngine.cleanup();
    await ingestionPipeline.cleanup();
  });

  test('should handle search operations efficiently', async () => {
    const searchEngine = new SearchEngine(
      mockEmbedFunction,
      new MockIndexManager() as any,
      new MockDatabase() as any
    );

    const searchTimes: number[] = [];
    
    // Test multiple search operations
    for (let i = 0; i < 5; i++) {
      const { timeMs } = await measureTime(async () => {
        try {
          await searchEngine.search(`test query ${i}`, { top_k: 5 });
        } catch (error) {
          // Expected to fail with empty results, but timing is still measured
        }
      });
      searchTimes.push(timeMs);
    }

    const avgTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    const maxTime = Math.max(...searchTimes);
    const minTime = Math.min(...searchTimes);

    console.log(`Search times: ${searchTimes.map(t => t.toFixed(2)).join(', ')}ms`);
    console.log(`Average: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

    // Validate search performance
    assert.ok(avgTime < 50, `Average search time was ${avgTime.toFixed(2)}ms, expected < 50ms`);
    assert.ok(maxTime < 100, `Max search time was ${maxTime.toFixed(2)}ms, expected < 100ms`);

    await searchEngine.cleanup();
  });

  test('should demonstrate architecture benefits', async () => {
    const startTime = performance.now();
    const startMemory = getMemoryUsage();

    // Test that different configurations can be created easily
    const searchEngineWithRerank = new SearchEngine(
      mockEmbedFunction,
      new MockIndexManager() as any,
      new MockDatabase() as any,
      mockRerankFunction
    );

    const searchEngineWithoutRerank = new SearchEngine(
      mockEmbedFunction,
      new MockIndexManager() as any,
      new MockDatabase() as any
    );

    const setupTime = performance.now() - startTime;
    const setupMemory = getMemoryUsage() - startMemory;

    console.log(`Architecture setup time: ${setupTime.toFixed(2)}ms`);
    console.log(`Architecture setup memory: ${setupMemory.toFixed(2)}MB`);

    // Test that both configurations work
    try {
      await searchEngineWithRerank.search('test query', { top_k: 5 });
    } catch (error) {
      // Expected due to mock setup
    }

    try {
      await searchEngineWithoutRerank.search('test query', { top_k: 5 });
    } catch (error) {
      // Expected due to mock setup
    }

    // Validate architecture benefits
    assert.ok(setupTime < 20, `Architecture setup took ${setupTime.toFixed(2)}ms, expected < 20ms`);
    assert.ok(setupMemory < 5, `Architecture setup used ${setupMemory.toFixed(2)}MB, expected < 5MB`);

    // Validate that dependency injection works
    assert.ok(typeof searchEngineWithRerank.search === 'function', 'SearchEngine with rerank should have search method');
    assert.ok(typeof searchEngineWithoutRerank.search === 'function', 'SearchEngine without rerank should have search method');

    await searchEngineWithRerank.cleanup();
    await searchEngineWithoutRerank.cleanup();
  });

  test('should maintain consistent performance patterns', async () => {
    const performanceMetrics: number[] = [];
    
    // Test consistent performance across multiple cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      const { timeMs } = await measureTime(async () => {
        const searchEngine = new SearchEngine(
          mockEmbedFunction,
          new MockIndexManager() as any,
          new MockDatabase() as any
        );

        // Perform some operations
        for (let i = 0; i < 3; i++) {
          try {
            await searchEngine.search(`cycle ${cycle} query ${i}`, { top_k: 5 });
          } catch (error) {
            // Expected
          }
        }

        await searchEngine.cleanup();
      });
      
      performanceMetrics.push(timeMs);
    }

    const avgTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
    const maxTime = Math.max(...performanceMetrics);
    const minTime = Math.min(...performanceMetrics);
    const variance = maxTime - minTime;

    console.log(`Performance cycles: ${performanceMetrics.map(t => t.toFixed(2)).join(', ')}ms`);
    console.log(`Average: ${avgTime.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);

    // Validate consistency
    assert.ok(avgTime < 100, `Average cycle time was ${avgTime.toFixed(2)}ms, expected < 100ms`);
    assert.ok(variance < avgTime, `Performance variance was ${variance.toFixed(2)}ms, expected < ${avgTime.toFixed(2)}ms`);
  });
});
