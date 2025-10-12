import { test, describe, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { CrossEncoderReranker } from './reranker.js';
import type { SearchResult } from '../core/types.js';

describe('CrossEncoderReranker', () => {
  let reranker: CrossEncoderReranker;

  before(async () => {
    reranker = new CrossEncoderReranker();
  });

  test('should initialize without loading model', () => {
    assert.strictEqual(reranker.isLoaded(), false);
    assert.strictEqual(typeof reranker.getModelName(), 'string');
    // Updated to check for the new default Xenova model
    assert.strictEqual(reranker.getModelName(), 'Xenova/ms-marco-MiniLM-L-6-v2');
  });

  test('should throw error when reranking without loaded model', async () => {
    const query = 'test query';
    const results: SearchResult[] = [{
      content: 'test document',
      score: 0.8,
      contentType: 'text',
      document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
    }];

    await assert.rejects(
      async () => await reranker.rerank(query, results),
      /Cross-encoder model not loaded/
    );
  });

  test('should handle empty results gracefully', async () => {
    // Skip model loading for this test since it's expensive
    // We'll test the empty results case by mocking the model
    const mockReranker = new CrossEncoderReranker();
    // @ts-ignore - accessing private property for testing
    mockReranker.model = { predict: () => Promise.resolve([]) };

    const query = 'test query';
    const results: SearchResult[] = [];

    const rerankedResults = await mockReranker.rerank(query, results);
    assert.deepStrictEqual(rerankedResults, []);
  });

  test('should fallback to original scores on reranking failure', async () => {
    const query = 'test query';
    const originalResults: SearchResult[] = [
      {
        content: 'first document about machine learning',
        score: 0.9,
        contentType: 'text',
        document: { id: 1, source: 'doc1.md', title: 'ML Doc', contentType: 'text' }
      },
      {
        content: 'second document about databases',
        score: 0.7,
        contentType: 'text',
        document: { id: 2, source: 'doc2.md', title: 'DB Doc', contentType: 'text' }
      }
    ];

    // Create a reranker with a failing model
    const mockReranker = new CrossEncoderReranker();
    // @ts-ignore - accessing private property for testing
    mockReranker.model = () => { throw new Error('Model failure'); };

    // Should fallback to original results without throwing
    const results = await mockReranker.rerank(query, originalResults);
    assert.deepStrictEqual(results, originalResults);
  });

  test('should use Xenova model as default for better compatibility', () => {
    const newReranker = new CrossEncoderReranker();
    assert.strictEqual(newReranker.getModelName(), 'Xenova/ms-marco-MiniLM-L-6-v2');
    assert.strictEqual(newReranker.isLoaded(), false);
  });

  test('should load cross-encoder model and rerank results', async () => {
    // Now that we use a working Xenova model, we can enable this test
    // It should work reliably since Xenova models are optimized for transformers.js
    
    await reranker.loadModel();
    assert.strictEqual(reranker.isLoaded(), true);

    const query = 'machine learning algorithms';
    const results: SearchResult[] = [
      {
        content: 'Machine learning is a subset of artificial intelligence',
        score: 0.8,
        contentType: 'text',
        document: { id: 1, source: 'ml.md', title: 'ML Basics', contentType: 'text' }
      },
      {
        content: 'Database systems store and retrieve data efficiently',
        score: 0.6,
        contentType: 'text',
        document: { id: 2, source: 'db.md', title: 'Database Systems', contentType: 'text' }
      }
    ];

    const rerankedResults = await reranker.rerank(query, results);

    assert.strictEqual(rerankedResults.length, results.length);
    assert.ok(rerankedResults.every(result => typeof result.score === 'number'));
    assert.ok(rerankedResults.every(result => result.score >= 0 && result.score <= 1));

    // Results should be sorted by score (descending)
    for (let i = 1; i < rerankedResults.length; i++) {
      assert.ok(rerankedResults[i - 1].score >= rerankedResults[i].score);
    }
  });
});