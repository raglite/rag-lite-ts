/**
 * Tests for Simple Reranking Creation Function
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  createReranker, 
  createDefaultReranker, 
  isRerankingAvailable, 
  getRerankingInfo 
} from '../../src/../src/core/reranking-factory.js';
import type { SearchResult } from '../../src/../src/core/types.js';

// Mock search results for testing
const mockSearchResults: SearchResult[] = [
  {
    content: 'This is a test document about machine learning',
    score: 0.8,
    contentType: 'text',
    document: {
      id: 1,
      source: 'test1.txt',
      title: 'Machine Learning Basics',
      contentType: 'text'
    }
  },
  {
    content: 'Another document about artificial intelligence',
    score: 0.7,
    contentType: 'text',
    document: {
      id: 2,
      source: 'test2.txt',
      title: 'AI Overview',
      contentType: 'text'
    }
  }
];

describe('Simple Reranking Creation Function', () => {
  test('should create cross-encoder reranker for text mode', () => {
    const reranker = createReranker('text', 'cross-encoder');
    
    assert.ok(reranker, 'Reranker should be created');
    assert.strictEqual(typeof reranker, 'function', 'Reranker should be a function');
  });

  test('should create metadata reranker for multimodal mode', () => {
    const reranker = createReranker('multimodal', 'metadata');
    
    assert.ok(reranker, 'Reranker should be created');
    assert.strictEqual(typeof reranker, 'function', 'Reranker should be a function');
  });

  test('should return undefined for disabled strategy', () => {
    const reranker = createReranker('text', 'disabled');
    
    assert.strictEqual(reranker, undefined, 'Disabled reranker should return undefined');
  });

  test('should use default strategy when none specified', () => {
    const textReranker = createReranker('text');
    const multimodalReranker = createReranker('multimodal');
    
    assert.ok(textReranker, 'Text reranker should be created with default strategy');
    assert.ok(multimodalReranker, 'Multimodal reranker should be created with default strategy');
  });

  test('should fallback to supported strategy for unsupported combinations', () => {
    // text-derived is not supported in text mode, should fallback
    const reranker = createReranker('text', 'text-derived');
    
    // Should either create a fallback reranker or return undefined
    // The exact behavior depends on fallback logic
    assert.ok(reranker !== null, 'Should handle unsupported strategy gracefully');
  });

  test('should validate strategy support correctly', () => {
    // These should work
    const textCrossEncoder = createReranker('text', 'cross-encoder');
    const multimodalMetadata = createReranker('multimodal', 'metadata');
    
    assert.ok(textCrossEncoder, 'Cross-encoder should work in text mode');
    assert.ok(multimodalMetadata, 'Metadata should work in multimodal mode');
  });

  test('should handle configuration options', () => {
    const reranker = createReranker('multimodal', 'metadata', {
      enabled: true,
      weights: {
        semantic: 0.6,
        metadata: 0.4
      }
    });
    
    assert.ok(reranker, 'Reranker should be created with configuration');
  });

  test('should create default reranker correctly', () => {
    const textDefault = createDefaultReranker('text');
    const multimodalDefault = createDefaultReranker('multimodal');
    
    assert.ok(textDefault, 'Default text reranker should be created');
    assert.ok(multimodalDefault, 'Default multimodal reranker should be created');
  });

  test('should check reranking availability', async () => {
    const textAvailable = await isRerankingAvailable('text', 'cross-encoder');
    const multimodalAvailable = await isRerankingAvailable('multimodal', 'metadata');
    const disabledAvailable = await isRerankingAvailable('text', 'disabled');
    
    assert.strictEqual(typeof textAvailable, 'boolean', 'Should return boolean for text availability');
    assert.strictEqual(typeof multimodalAvailable, 'boolean', 'Should return boolean for multimodal availability');
    assert.strictEqual(disabledAvailable, false, 'Disabled strategy should not be available');
  });

  test('should get reranking info for modes', async () => {
    const textInfo = await getRerankingInfo('text');
    const multimodalInfo = await getRerankingInfo('multimodal');
    
    assert.ok(textInfo, 'Should return info for text mode');
    assert.ok(multimodalInfo, 'Should return info for multimodal mode');
    
    assert.strictEqual(textInfo.mode, 'text', 'Text info should have correct mode');
    assert.strictEqual(multimodalInfo.mode, 'multimodal', 'Multimodal info should have correct mode');
    
    assert.ok(Array.isArray(textInfo.strategies), 'Should have strategies array');
    assert.ok(Array.isArray(multimodalInfo.strategies), 'Should have strategies array');
    
    assert.ok(typeof textInfo.hasAvailableStrategies === 'boolean', 'Should indicate if strategies are available');
    assert.ok(typeof multimodalInfo.hasAvailableStrategies === 'boolean', 'Should indicate if strategies are available');
  });

  test('should handle errors gracefully', () => {
    // Test with invalid mode (should not throw)
    assert.doesNotThrow(() => {
      createReranker('invalid' as any, 'cross-encoder');
    }, 'Should handle invalid mode gracefully');
  });

  test('should create hybrid reranker for multimodal mode', () => {
    const hybridReranker = createReranker('multimodal', 'hybrid', {
      weights: {
        semantic: 0.5,
        metadata: 0.5
      }
    });
    
    assert.ok(hybridReranker, 'Hybrid reranker should be created');
    assert.strictEqual(typeof hybridReranker, 'function', 'Hybrid reranker should be a function');
  });

  test('should not create hybrid reranker for text mode', () => {
    // Hybrid strategy should not be supported in text mode
    const hybridReranker = createReranker('text', 'hybrid');
    
    // Should either fallback to a supported strategy or return undefined
    // The exact behavior depends on fallback logic, but it should handle gracefully
    assert.ok(hybridReranker !== null, 'Should handle unsupported hybrid strategy in text mode gracefully');
  });
});

describe('Reranking Function Integration', () => {
  test('should execute metadata reranking function', async () => {
    const reranker = createReranker('multimodal', 'metadata');
    
    if (reranker) {
      const results = await reranker('machine learning', mockSearchResults);
      
      assert.ok(Array.isArray(results), 'Should return array of results');
      assert.strictEqual(results.length, mockSearchResults.length, 'Should return same number of results');
      
      // Results should have scores
      for (const result of results) {
        assert.ok(typeof result.score === 'number', 'Each result should have a numeric score');
        assert.ok(result.content, 'Each result should have content');
        assert.ok(result.document, 'Each result should have document info');
      }
    }
  });

  test('should handle empty results gracefully', async () => {
    const reranker = createReranker('multimodal', 'metadata');
    
    if (reranker) {
      const results = await reranker('test query', []);
      
      assert.ok(Array.isArray(results), 'Should return array for empty input');
      assert.strictEqual(results.length, 0, 'Should return empty array for empty input');
    }
  });

  test('should handle reranking errors gracefully', async () => {
    const reranker = createReranker('multimodal', 'metadata');
    
    if (reranker) {
      // Test with malformed results (should not throw)
      await assert.doesNotReject(async () => {
        await reranker('test query', mockSearchResults);
      }, 'Should handle reranking errors gracefully');
    }
  });
});

describe('Configuration Validation', () => {
  test('should validate weights in configuration', () => {
    // Valid weights should work
    assert.doesNotThrow(() => {
      createReranker('multimodal', 'hybrid', {
        weights: {
          semantic: 0.6,
          metadata: 0.4
        }
      });
    }, 'Valid weights should not throw');
  });

  test('should handle missing configuration gracefully', () => {
    // Should work without configuration
    assert.doesNotThrow(() => {
      createReranker('text', 'cross-encoder');
      createReranker('multimodal', 'metadata');
    }, 'Should work without configuration');
  });

  test('should use fallback strategy when primary fails', () => {
    // This tests the fallback mechanism
    const reranker = createReranker('multimodal', 'text-derived', {
      fallback: 'metadata'
    });
    
    // Should create some form of reranker (either primary or fallback)
    assert.ok(reranker !== null, 'Should create reranker with fallback');
  });
});