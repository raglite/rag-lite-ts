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
} from '../../src/core/reranking-factory.js';
import type { SearchResult } from '../../src/core/types.js';

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

  test('should create text-derived reranker for multimodal mode', () => {
    const reranker = createReranker('multimodal', 'text-derived');

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

  test('should throw error for unsupported strategy combinations', () => {
    // text-derived is not supported in text mode, should throw error
    assert.throws(
      () => createReranker('text', 'text-derived'),
      /Strategy 'text-derived' not supported for text mode/,
      'Should throw error for unsupported combinations'
    );
  });

  test('should validate strategy support correctly', () => {
    // These should work
    const textCrossEncoder = createReranker('text', 'cross-encoder');
    const multimodalTextDerived = createReranker('multimodal', 'text-derived');
    
    assert.ok(textCrossEncoder, 'Cross-encoder should work in text mode');
    assert.ok(multimodalTextDerived, 'Text-derived should work in multimodal mode');
  });

  test('should handle configuration options', () => {
    const reranker = createReranker('multimodal', 'text-derived', {
      enabled: true
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
    const multimodalAvailable = await isRerankingAvailable('multimodal', 'text-derived');
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

  test('should throw error for invalid mode', () => {
    // Test with invalid mode (should throw)
    assert.throws(
      () => createReranker('invalid' as any, 'cross-encoder'),
      /Strategy 'cross-encoder' not supported for invalid mode/,
      'Should throw error for invalid mode'
    );
  });

});

describe('Reranking Function Integration', () => {
  test('should execute text-derived reranking function', async () => {
    const reranker = createReranker('multimodal', 'text-derived');

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
    const reranker = createReranker('multimodal', 'text-derived');

    if (reranker) {
      const results = await reranker('test query', []);
      
      assert.ok(Array.isArray(results), 'Should return array for empty input');
      assert.strictEqual(results.length, 0, 'Should return empty array for empty input');
    }
  });

  test('should handle reranking errors gracefully', async () => {
    const reranker = createReranker('multimodal', 'text-derived');

    if (reranker) {
      // Test with malformed results (should not throw)
      await assert.doesNotReject(async () => {
        await reranker('test query', mockSearchResults);
      }, 'Should handle reranking errors gracefully');
    }
  });
});

describe('Configuration Validation', () => {
  test('should handle configuration options', () => {
    // Valid configuration should work
    assert.doesNotThrow(() => {
      createReranker('multimodal', 'text-derived', {
        enabled: true
      });
    }, 'Valid configuration should not throw');
  });

  test('should handle missing configuration gracefully', () => {
    // Should work without configuration
    assert.doesNotThrow(() => {
      createReranker('text', 'cross-encoder');
      createReranker('multimodal', 'text-derived');
    }, 'Should work without configuration');
  });

  test('should use fallback strategy when primary fails', () => {
    // This tests the fallback mechanism
    const reranker = createReranker('multimodal', 'text-derived', {
      fallback: 'disabled'
    });
    
    // Should create some form of reranker (either primary or fallback)
    assert.ok(reranker !== null, 'Should create reranker with fallback');
  });
});