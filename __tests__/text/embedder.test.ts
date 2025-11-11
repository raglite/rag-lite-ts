import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { EmbeddingEngine, getEmbeddingEngine, initializeEmbeddingEngine } from '../../src/../src/text/embedder.js';
import { config, getModelDefaults } from '../../src/core/config.js';

describe('EmbeddingEngine', () => {
  // Get expected dimensions from current model configuration
  const modelDefaults = getModelDefaults(config.embedding_model);
  const expectedDimensions = modelDefaults.dimensions;
  test('should create embedding engine instance', () => {
    const engine = new EmbeddingEngine();
    assert.ok(engine instanceof EmbeddingEngine);
    assert.strictEqual(engine.isLoaded(), false);
  });

  test('should throw error when getting model version before loading', () => {
    const engine = new EmbeddingEngine();
    assert.throws(() => {
      engine.getModelVersion();
    }, /Model not loaded/);
  });

  test('should throw error when embedding before loading model', async () => {
    const engine = new EmbeddingEngine();
    await assert.rejects(
      engine.embedSingle('test text'),
      /Missing required object: model/
    );
  });

  test('should load model successfully', async () => {
    const engine = new EmbeddingEngine();
    
    // This test may take a while as it downloads the model
    console.log('Loading model for test (this may take a moment)...');
    await engine.loadModel();
    
    assert.strictEqual(engine.isLoaded(), true);
    assert.ok(typeof engine.getModelVersion() === 'string');
    assert.ok(engine.getModelVersion().length > 0);
  });

  test('should generate embeddings for single text', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    const result = await engine.embedSingle('This is a test sentence.');
    
    assert.ok(result.embedding_id);
    assert.ok(result.vector instanceof Float32Array);
    assert.strictEqual(result.vector.length, expectedDimensions, 
      `Expected ${expectedDimensions} dimensions for model ${config.embedding_model}, got ${result.vector.length}`);
    
    // Check that vector values are normalized (should be between -1 and 1)
    for (const value of result.vector) {
      assert.ok(value >= -1 && value <= 1);
    }
  });

  test('should generate embeddings for batch of texts', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    const texts = [
      'This is the first sentence.',
      'This is the second sentence.',
      'This is the third sentence.'
    ];
    
    const results = await engine.embedBatch(texts);
    
    assert.strictEqual(results.length, 3);
    
    for (const result of results) {
      assert.ok(result.embedding_id);
      assert.ok(result.vector instanceof Float32Array);
      assert.strictEqual(result.vector.length, expectedDimensions,
        `Expected ${expectedDimensions} dimensions for model ${config.embedding_model}, got ${result.vector.length}`);
    }
    
    // Check that different texts produce different embeddings
    assert.notDeepStrictEqual(results[0].vector, results[1].vector);
    assert.notDeepStrictEqual(results[1].vector, results[2].vector);
  });

  test('should handle empty batch', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    const results = await engine.embedBatch([]);
    assert.strictEqual(results.length, 0);
  });

  test('singleton pattern should work correctly', () => {
    const engine1 = getEmbeddingEngine();
    const engine2 = getEmbeddingEngine();
    
    assert.strictEqual(engine1, engine2);
  });

  test('initializeEmbeddingEngine should load model', async () => {
    console.log('Testing initialization (this may take a moment)...');
    const engine = await initializeEmbeddingEngine();
    
    assert.ok(engine.isLoaded());
    assert.ok(typeof engine.getModelVersion() === 'string');
  });

  test('should handle batch processing with configurable batch size', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    // Create a larger batch to test batch size handling
    const texts = Array.from({ length: 35 }, (_, i) => `Test sentence number ${i + 1}.`);
    
    const results = await engine.embedBatch(texts);
    
    // Should process all texts despite batch size limits
    assert.strictEqual(results.length, 35);
    
    // Each result should have valid embedding
    for (const result of results) {
      assert.ok(result.embedding_id);
      assert.ok(result.vector instanceof Float32Array);
      assert.strictEqual(result.vector.length, expectedDimensions,
        `Expected ${expectedDimensions} dimensions for model ${config.embedding_model}, got ${result.vector.length}`);
    }
  });

  test('should handle embedDocumentBatch with progress logging', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    const chunks = [
      'First document chunk with some content.',
      'Second document chunk with different content.',
      'Third document chunk with more content.',
      'Fourth document chunk with additional content.',
      'Fifth document chunk with final content.'
    ];
    
    const results = await engine.embedDocumentBatch(chunks);
    
    assert.strictEqual(results.length, 5);
    
    for (const result of results) {
      assert.ok(result.embedding_id);
      assert.ok(result.vector instanceof Float32Array);
      assert.strictEqual(result.vector.length, expectedDimensions,
        `Expected ${expectedDimensions} dimensions for model ${config.embedding_model}, got ${result.vector.length}`);
    }
  });

  test('should handle individual chunk failures gracefully', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    // Create a mix of valid and potentially problematic texts
    const texts = [
      'This is a normal sentence.',
      '', // Empty string might cause issues
      'Another normal sentence.',
      'A' + 'very '.repeat(1000) + 'long sentence that might cause memory issues.', // Very long text
      'Final normal sentence.'
    ];
    
    const results = await engine.embedBatch(texts);
    
    // Should get results for at least the valid texts
    assert.ok(results.length >= 3); // At least the 3 normal sentences
    
    for (const result of results) {
      assert.ok(result.embedding_id);
      assert.ok(result.vector instanceof Float32Array);
      assert.strictEqual(result.vector.length, expectedDimensions,
        `Expected ${expectedDimensions} dimensions for model ${config.embedding_model}, got ${result.vector.length}`);
    }
  });

  test('should throw error for embedSingle when no results', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    // Mock the embedBatch to return empty array
    const originalEmbedBatch = engine.embedBatch.bind(engine);
    engine.embedBatch = async () => [];
    
    await assert.rejects(
      engine.embedSingle('test'),
      /Empty text content provided/
    );
    
    // Restore original method
    engine.embedBatch = originalEmbedBatch;
  });

  test('should generate deterministic embedding IDs', async () => {
    const engine = new EmbeddingEngine();
    await engine.loadModel();
    
    const texts = [
      'Same text content',
      'Same text content', // Duplicate content
      'Different text content'
    ];
    
    const results = await engine.embedBatch(texts);
    
    assert.strictEqual(results.length, 3);
    
    // Duplicate content should have the same embedding ID (deterministic)
    const embeddingIds = results.map(r => r.embedding_id);
    const uniqueIds = new Set(embeddingIds);
    assert.strictEqual(uniqueIds.size, 2); // Only 2 unique IDs for 3 texts (2 duplicates + 1 unique)
    
    // Verify that duplicate content has the same ID
    assert.strictEqual(embeddingIds[0], embeddingIds[1]);
    assert.notStrictEqual(embeddingIds[0], embeddingIds[2]);
  });
});
