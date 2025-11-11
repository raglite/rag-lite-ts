/**
 * Performance validation tests for the refactored core layer architecture
 * Ensures equivalent or better performance compared to the original implementation
 * Uses Node.js test runner
 */

import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the new factory-based API
import { TextSearchFactory, TextIngestionFactory } from '../../src/factories/text-factory.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'rag-lite-performance-test');
const TEST_DIR = join(TEST_BASE_DIR, Date.now().toString());
const TEST_DB_PATH = join(TEST_DIR, 'test.db');
const TEST_INDEX_PATH = join(TEST_DIR, 'test.index');

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  SEARCH_MAX_TIME: 2000,      // Search should complete within 2 seconds
  INGESTION_MAX_TIME: 10000,  // Ingestion should complete within 10 seconds
  EMBEDDING_MAX_TIME: 1000,   // Single embedding should complete within 1 second
  MEMORY_GROWTH_MAX: 50       // Memory growth should be less than 50MB during operations
};

// Test documents for performance validation
const TEST_DOCUMENTS = [
  {
    name: 'short-doc.txt',
    content: 'This is a short document for testing search performance. It contains basic information about machine learning concepts.'
  },
  {
    name: 'medium-doc.txt', 
    content: `# Machine Learning Guide

Machine learning is a powerful subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every scenario.

## Core Concepts

### Supervised Learning
Supervised learning uses labeled training data to learn a mapping function from input variables to output variables. Common algorithms include:
- Linear Regression for continuous outputs
- Logistic Regression for binary classification
- Decision Trees for interpretable models
- Random Forest for ensemble learning
- Support Vector Machines for complex boundaries

### Unsupervised Learning  
Unsupervised learning finds hidden patterns in data without labeled examples:
- Clustering algorithms like K-means and hierarchical clustering
- Dimensionality reduction techniques like PCA and t-SNE
- Association rule learning for market basket analysis

### Deep Learning
Deep learning uses neural networks with multiple layers to automatically learn hierarchical representations:
- Convolutional Neural Networks (CNNs) for image processing
- Recurrent Neural Networks (RNNs) for sequential data
- Transformers for natural language processing
- Generative Adversarial Networks (GANs) for data generation

## Applications
Machine learning powers many modern applications including recommendation systems, image recognition, natural language processing, autonomous vehicles, and predictive analytics.`
  },
  {
    name: 'long-doc.txt',
    content: `# Comprehensive Guide to Artificial Intelligence and Machine Learning

${'## Introduction\n\nArtificial Intelligence represents one of the most significant technological advances of our time. '.repeat(10)}

${'### Historical Context\n\nThe field of AI has evolved significantly since its inception in the 1950s. '.repeat(15)}

${'### Modern Applications\n\nToday, AI systems are deployed across numerous industries and applications. '.repeat(20)}

${'## Technical Implementation\n\nImplementing AI systems requires careful consideration of multiple factors. '.repeat(25)}

${'### Performance Optimization\n\nOptimizing AI systems for performance involves multiple strategies and techniques. '.repeat(30)}`
  }
];

/**
 * Setup test environment
 */
function setupTestEnvironment(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  mkdirSync(TEST_DIR, { recursive: true });
  
  // Create test documents
  TEST_DOCUMENTS.forEach(doc => {
    writeFileSync(join(TEST_DIR, doc.name), doc.content);
  });
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

describe('Performance Validation', () => {
  before(() => {
    setupTestEnvironment();
  });

  after(() => {
    cleanupTestEnvironment();
  });

  describe('Ingestion Performance', () => {
    test('should ingest documents within performance thresholds', async () => {
      const startMemory = getMemoryUsage();
      
      const { result: ingestionPipeline, timeMs: initTime } = await measureTime(async () => {
        return await TextIngestionFactory.create(TEST_DB_PATH, TEST_INDEX_PATH, {
          embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2', // Use smaller model for faster tests
          batchSize: 8
        });
      });

      console.log(`Ingestion pipeline initialization: ${initTime.toFixed(2)}ms`);
      
      // Test ingestion of all documents
      const { timeMs: ingestionTime } = await measureTime(async () => {
        for (const doc of TEST_DOCUMENTS) {
          const docPath = join(TEST_DIR, doc.name);
          await ingestionPipeline.ingestFile(docPath);
        }
      });

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;

      console.log(`Total ingestion time: ${ingestionTime.toFixed(2)}ms`);
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate performance thresholds
      assert.ok(ingestionTime < PERFORMANCE_THRESHOLDS.INGESTION_MAX_TIME, 
        `Ingestion took ${ingestionTime.toFixed(2)}ms, expected < ${PERFORMANCE_THRESHOLDS.INGESTION_MAX_TIME}ms`);
      
      assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX,
        `Memory growth was ${memoryGrowth.toFixed(2)}MB, expected < ${PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX}MB`);

      await ingestionPipeline.cleanup();
    });
  });

  describe('Search Performance', () => {
    let searchEngine: any;

    before(async () => {
      // First ingest the documents
      const ingestionPipeline = await TextIngestionFactory.create(TEST_DB_PATH, TEST_INDEX_PATH, {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        batchSize: 8
      });

      for (const doc of TEST_DOCUMENTS) {
        const docPath = join(TEST_DIR, doc.name);
        await ingestionPipeline.ingestFile(docPath);
      }

      await ingestionPipeline.cleanup();

      // Create search engine
      searchEngine = await TextSearchFactory.create(TEST_INDEX_PATH, TEST_DB_PATH, {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        enableReranking: false // Disable reranking for consistent timing
      });
    });

    after(async () => {
      if (searchEngine) {
        await searchEngine.cleanup();
      }
    });

    test('should perform searches within performance thresholds', async () => {
      const testQueries = [
        'machine learning concepts',
        'supervised learning algorithms',
        'deep learning neural networks',
        'artificial intelligence applications'
      ];

      const startMemory = getMemoryUsage();
      let totalSearchTime = 0;

      for (const query of testQueries) {
        const { result: results, timeMs: searchTime } = await measureTime(async () => {
          return await searchEngine.search(query, { top_k: 5 });
        });

        totalSearchTime += searchTime;
        
        console.log(`Query "${query}": ${searchTime.toFixed(2)}ms, ${results.length} results`);

        // Validate individual search performance
        assert.ok(searchTime < PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME,
          `Search for "${query}" took ${searchTime.toFixed(2)}ms, expected < ${PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME}ms`);

        // Validate results quality
        assert.ok(results.length > 0, `Search for "${query}" should return results`);
      }

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;
      const avgSearchTime = totalSearchTime / testQueries.length;

      console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);
      console.log(`Total search memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate overall performance
      assert.ok(avgSearchTime < PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME / 2,
        `Average search time was ${avgSearchTime.toFixed(2)}ms, expected < ${PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME / 2}ms`);

      assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX / 2,
        `Search memory growth was ${memoryGrowth.toFixed(2)}MB, expected < ${PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX / 2}MB`);
    });

    test('should handle concurrent searches efficiently', async () => {
      const concurrentQueries = [
        'machine learning',
        'artificial intelligence', 
        'deep learning',
        'neural networks'
      ];

      const startMemory = getMemoryUsage();
      
      const { result: results, timeMs: concurrentTime } = await measureTime(async () => {
        const promises = concurrentQueries.map(query => 
          searchEngine.search(query, { top_k: 3 })
        );
        return await Promise.all(promises);
      });

      const endMemory = getMemoryUsage();
      const memoryGrowth = endMemory - startMemory;

      console.log(`Concurrent searches (${concurrentQueries.length} queries): ${concurrentTime.toFixed(2)}ms`);
      console.log(`Concurrent search memory growth: ${memoryGrowth.toFixed(2)}MB`);

      // Validate concurrent performance
      assert.ok(concurrentTime < PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME * 2,
        `Concurrent searches took ${concurrentTime.toFixed(2)}ms, expected < ${PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME * 2}ms`);

      assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX,
        `Concurrent search memory growth was ${memoryGrowth.toFixed(2)}MB, expected < ${PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MAX}MB`);

      // Validate all searches returned results
      results.forEach((result, index) => {
        assert.ok(result.length > 0, `Concurrent search ${index} should return results`);
      });
    });
  });

  describe('Architecture Performance', () => {
    test('should have minimal overhead from dependency injection', async () => {
      // Test factory creation time
      const { timeMs: factoryTime } = await measureTime(async () => {
        const searchEngine = await TextSearchFactory.create(TEST_INDEX_PATH, TEST_DB_PATH, {
          embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
        });
        await searchEngine.cleanup();
      });

      console.log(`Factory creation time: ${factoryTime.toFixed(2)}ms`);

      // Factory creation should be fast (dependency injection overhead should be minimal)
      assert.ok(factoryTime < 5000, // 5 seconds for model loading is reasonable
        `Factory creation took ${factoryTime.toFixed(2)}ms, expected < 5000ms`);
    });

    test('should maintain consistent performance across multiple operations', async () => {
      const searchEngine = await TextSearchFactory.create(TEST_INDEX_PATH, TEST_DB_PATH, {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        enableReranking: false
      });

      const searchTimes: number[] = [];
      const testQuery = 'machine learning concepts';

      // Perform multiple searches to test consistency
      for (let i = 0; i < 5; i++) {
        const { timeMs } = await measureTime(async () => {
          await searchEngine.search(testQuery, { top_k: 5 });
        });
        searchTimes.push(timeMs);
      }

      await searchEngine.cleanup();

      const avgTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const maxTime = Math.max(...searchTimes);
      const minTime = Math.min(...searchTimes);
      const variance = maxTime - minTime;

      console.log(`Search times: ${searchTimes.map(t => t.toFixed(2)).join(', ')}ms`);
      console.log(`Average: ${avgTime.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);

      // Performance should be consistent (low variance)
      assert.ok(variance < avgTime * 0.5, // Variance should be less than 50% of average
        `Performance variance was ${variance.toFixed(2)}ms (${(variance/avgTime*100).toFixed(1)}%), expected < 50% of average`);

      // All searches should be within reasonable time
      searchTimes.forEach((time, index) => {
        assert.ok(time < PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME,
          `Search ${index + 1} took ${time.toFixed(2)}ms, expected < ${PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME}ms`);
      });
    });
  });
});
