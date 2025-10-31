import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { VectorIndex } from '../../src/../src/core/vector-index.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { TEST_MODELS } from '../../src/../src/test-utils.js';

// Clean up test files
function cleanup(indexPath: string) {
  if (existsSync(indexPath)) {
    unlinkSync(indexPath);
  }
}

describe('VectorIndex', () => {
  // Test each model configuration
  for (const model of TEST_MODELS) {
    const TEST_INDEX_PATH = join(process.cwd(), `test-index-${model.dimensions}d.bin`);
    
    describe(`with ${model.name} (${model.dimensions}D)`, () => {
      test('should initialize HNSW index with correct dimensions', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index.initialize();
        assert.equal(index.getCurrentCount(), 0);
        
        cleanup(TEST_INDEX_PATH);
      });

      test('should add and search vectors correctly', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index.initialize();

        // Create test vectors with different directions for proper cosine similarity testing
        const vector1 = new Float32Array(model.dimensions);
        vector1.fill(1.0);
        vector1[0] = 0.5; // Make it slightly different
        
        const vector2 = new Float32Array(model.dimensions);
        vector2.fill(0.5);
        vector2[0] = 1.0; // Different direction
        
        const vector3 = new Float32Array(model.dimensions);
        vector3.fill(-0.5); // Opposite direction

        // Add vectors
        index.addVector(1, vector1);
        index.addVector(2, vector2);
        index.addVector(3, vector3);

        assert.equal(index.getCurrentCount(), 3);

        // Search for similar vector - should be most similar to vector1
        const queryVector = new Float32Array(model.dimensions);
        queryVector.fill(1.0);
        queryVector[0] = 0.6; // Similar to vector1
        
        const results = index.search(queryVector, 2);

        assert.equal(results.neighbors.length, 2);
        assert.equal(results.distances.length, 2);
        
        // Vector1 should be closest to query based on cosine similarity
        assert.equal(results.neighbors[0], 1);
        
        cleanup(TEST_INDEX_PATH);
      });

      test('should save and load index from disk', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index1 = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index1.initialize();

        // Add test vectors with distinct directions
        const vector1 = new Float32Array(model.dimensions);
        vector1.fill(1.0);
        vector1[0] = 0.5; // Make it distinct
        
        const vector2 = new Float32Array(model.dimensions);
        vector2.fill(-0.5); // Opposite direction
        
        index1.addVector(1, vector1);
        index1.addVector(2, vector2);
        
        // Save index
        await index1.saveIndex();
        assert.equal(index1.indexExists(), true);

        // Load index in new instance
        const index2 = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index2.loadIndex();
        assert.equal(index2.getCurrentCount(), 2);

        // Test search works after loading - query similar to vector1
        const queryVector = new Float32Array(model.dimensions);
        queryVector.fill(1.0);
        queryVector[0] = 0.6; // Similar to vector1
        
        const results = index2.search(queryVector, 1);
        
        assert.equal(results.neighbors.length, 1);
        assert.equal(results.neighbors[0], 1);
        
        cleanup(TEST_INDEX_PATH);
      });

      test('should handle batch vector addition', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index.initialize();

        // Create batch of vectors
        const vectors = [
          { id: 1, vector: new Float32Array(model.dimensions).fill(0.1) },
          { id: 2, vector: new Float32Array(model.dimensions).fill(0.2) },
          { id: 3, vector: new Float32Array(model.dimensions).fill(0.3) }
        ];

        index.addVectors(vectors);
        assert.equal(index.getCurrentCount(), 3);

        // Test search
        const queryVector = new Float32Array(model.dimensions).fill(0.25);
        const results = index.search(queryVector, 2);
        
        assert.equal(results.neighbors.length, 2);
        // Should find vectors 2 and 3 as closest to 0.25
        assert.ok(results.neighbors.includes(2));
        
        cleanup(TEST_INDEX_PATH);
      });

      test('should handle dimension mismatch errors', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index.initialize();

        // Try to add vector with wrong dimensions (use a different dimension than the model)
        const wrongDimensions = model.dimensions === 384 ? 768 : 384;
        const wrongVector = new Float32Array(wrongDimensions).fill(0.1);
        
        assert.throws(() => {
          index.addVector(1, wrongVector);
        }, /Vector dimension mismatch/);

        // Try to search with wrong dimensions
        assert.throws(() => {
          index.search(wrongVector, 1);
        }, /Query vector dimension mismatch/);
        
        cleanup(TEST_INDEX_PATH);
      });

      test('should handle empty index search', async () => {
        cleanup(TEST_INDEX_PATH);
        
        const index = new VectorIndex(TEST_INDEX_PATH, {
          dimensions: model.dimensions,
          maxElements: 1000
        });

        await index.initialize();

        const queryVector = new Float32Array(model.dimensions).fill(0.1);
        const results = index.search(queryVector, 5);
        
        assert.equal(results.neighbors.length, 0);
        assert.equal(results.distances.length, 0);
        
        cleanup(TEST_INDEX_PATH);
      });
    });
  }
});