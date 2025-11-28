/**
 * CORE MODULE — Tests for SearchPipelineCoordinator
 * Verifies model-agnostic search pipeline coordination
 */

import { SearchPipelineCoordinator, SearchPipelineFactory } from '../../src/core/search-pipeline.js';
import type { EmbedFunction, RerankFunction } from '../../src/core/interfaces.js';
import type { EmbeddingResult, SearchResult } from '../../src/core/types.js';

/**
 * Mock embedding function for testing
 */
const createMockEmbedFunction = (): EmbedFunction => {
  return async (query: string, contentType?: string): Promise<EmbeddingResult> => {
    return {
      embedding_id: `mock_${query.replace(/\s+/g, '_')}_${Date.now()}`,
      vector: new Float32Array(384).fill(0.1),
      contentType: contentType || 'text'
    };
  };
};

/**
 * Mock reranking function for testing
 */
const createMockRerankFunction = (): RerankFunction => {
  return async (query: string, results: SearchResult[]): Promise<SearchResult[]> => {
    // Simple mock reranking - reverse order and boost scores
    return results.reverse().map(r => ({
      ...r,
      score: Math.min(1.0, r.score * 1.2)
    }));
  };
};

/**
 * Mock index manager for testing
 */
const createMockIndexManager = () => {
  return {
    search: async (vector: Float32Array, topK: number) => {
      return {
        embeddingIds: ['test_id_1', 'test_id_2', 'test_id_3'].slice(0, topK),
        distances: [0.1, 0.2, 0.3].slice(0, topK)
      };
    }
  };
};

/**
 * Mock database connection for testing
 */
const createMockDbConnection = () => {
  return {}; // Simple mock
};

/**
 * Test basic pipeline coordination
 */
export async function testBasicPipelineCoordination(): Promise<boolean> {
  console.log('Testing basic pipeline coordination...');

  try {
    const coordinator = SearchPipelineFactory.create(
      createMockEmbedFunction(),
      createMockIndexManager(),
      createMockDbConnection(),
      createMockRerankFunction(),
      'text'
    );

    // Check status
    const status = coordinator.getStatus();
    if (!status.isReady) {
      throw new Error('Pipeline should be ready');
    }

    console.log('✓ Pipeline coordinator created and ready');
    return true;

  } catch (error) {
    console.error('✗ Basic pipeline coordination test failed:', error);
    return false;
  }
}

/**
 * Test individual pipeline steps
 */
export async function testIndividualPipelineSteps(): Promise<boolean> {
  console.log('Testing individual pipeline steps...');

  try {
    const coordinator = new SearchPipelineCoordinator();
    coordinator.setEmbedFunction(createMockEmbedFunction());
    coordinator.setIndexManager(createMockIndexManager());
    coordinator.setDatabaseConnection(createMockDbConnection());
    coordinator.setRerankFunction(createMockRerankFunction());

    // Test embedding
    const embedding = await coordinator.embedQuery('test query');
    if (!embedding.embedding_id || !embedding.vector) {
      throw new Error('Embedding step failed');
    }

    // Test vector search
    const searchResult = await coordinator.vectorSearch(embedding.vector, 2);
    if (searchResult.embeddingIds.length !== 2) {
      throw new Error('Vector search step failed');
    }

    console.log('✓ Individual pipeline steps work correctly');
    return true;

  } catch (error) {
    console.error('✗ Individual pipeline steps test failed:', error);
    return false;
  }
}

/**
 * Test error handling
 */
export async function testErrorHandling(): Promise<boolean> {
  console.log('Testing error handling...');

  try {
    const coordinator = new SearchPipelineCoordinator();

    // Test missing dependencies
    try {
      await coordinator.executeSearchPipeline('test');
      throw new Error('Should have thrown error for missing dependencies');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Missing required dependencies')) {
        throw new Error('Wrong error type for missing dependencies');
      }
    }

    // Test embedding failure
    const failingEmbedFn: EmbedFunction = async () => {
      throw new Error('Embedding failed');
    };
    coordinator.setEmbedFunction(failingEmbedFn);
    coordinator.setIndexManager(createMockIndexManager());
    coordinator.setDatabaseConnection(createMockDbConnection());

    try {
      await coordinator.executeSearchPipeline('test');
      throw new Error('Should have thrown error for embedding failure');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Search pipeline failed')) {
        throw new Error('Wrong error type for embedding failure');
      }
    }

    console.log('✓ Error handling works correctly');
    return true;

  } catch (error) {
    console.error('✗ Error handling test failed:', error);
    return false;
  }
}

/**
 * Test pipeline factory
 */
export async function testPipelineFactory(): Promise<boolean> {
  console.log('Testing pipeline factory...');

  try {
    // Test factory creation
    const coordinator1 = SearchPipelineFactory.create(
      createMockEmbedFunction(),
      createMockIndexManager(),
      createMockDbConnection()
    );

    if (!coordinator1.getStatus().isReady) {
      throw new Error('Factory-created coordinator should be ready');
    }

    // Test empty factory
    const coordinator2 = SearchPipelineFactory.createEmpty();
    if (coordinator2.getStatus().isReady) {
      throw new Error('Empty coordinator should not be ready');
    }

    console.log('✓ Pipeline factory works correctly');
    return true;

  } catch (error) {
    console.error('✗ Pipeline factory test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('=== SearchPipelineCoordinator Tests ===\n');

  const tests = [
    testBasicPipelineCoordination,
    testIndividualPipelineSteps,
    testErrorHandling,
    testPipelineFactory
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    console.log(''); // Add spacing between tests
  }

  console.log(`=== Test Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${tests.length}`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }
}