/**
 * Integration Tests for VectorIndex with Binary Format
 * Verifies that VectorIndex correctly saves and loads using binary format
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { VectorIndex } from '../src/core/vector-index.js';
import { unlinkSync, existsSync, mkdirSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

describe('VectorIndex Binary Format Integration', () => {
  const indexPath = join(TEST_TEMP_DIR, 'test-integration.index');
  const dimensions = 128;
  
  beforeEach(() => {
    // Ensure temp directory exists
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });
  
  afterEach(async () => {
    // Cleanup test files
    if (existsSync(indexPath)) {
      try {
        unlinkSync(indexPath);
      } catch (error) {
        console.warn('Could not clean up test file:', error);
      }
    }
    
    // Force garbage collection for ML resources
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });
  
  test('should save and load index with binary format', async () => {
    // Create and initialize index
    const index1 = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index1.initialize();
    
    // Add test vectors
    const testVectors = [
      { id: 1, vector: new Float32Array(dimensions).fill(0.1) },
      { id: 2, vector: new Float32Array(dimensions).fill(0.2) },
      { id: 3, vector: new Float32Array(dimensions).fill(0.3) }
    ];
    
    index1.addVectors(testVectors);
    assert.strictEqual(index1.getCurrentCount(), 3, 'Should have 3 vectors');
    
    // Save index
    await index1.saveIndex();
    assert.ok(existsSync(indexPath), 'Index file should exist');
    
    // Verify it's a binary file (not JSON)
    const fileSize = statSync(indexPath).size;
    const expectedBinarySize = 24 + (3 * (4 + dimensions * 4)); // header + vectors
    assert.strictEqual(fileSize, expectedBinarySize, 'File size should match binary format');
    
    // Load index in new instance
    const index2 = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index2.loadIndex();
    
    // Verify loaded correctly
    assert.strictEqual(index2.getCurrentCount(), 3, 'Should have loaded 3 vectors');
    
    // Verify search works
    const queryVector = new Float32Array(dimensions).fill(0.15);
    const results = index2.search(queryVector, 2);
    
    assert.strictEqual(results.neighbors.length, 2, 'Should return 2 neighbors');
    assert.strictEqual(results.distances.length, 2, 'Should return 2 distances');
    
    // First result should be vector with id 1 (closest to 0.15)
    assert.strictEqual(results.neighbors[0], 1, 'Closest vector should be id 1');
  });
  
  test('should handle larger dataset efficiently', async () => {
    const vectorCount = 1000;
    
    // Create and initialize index
    const index1 = new VectorIndex(indexPath, { dimensions, maxElements: 10000 });
    await index1.initialize();
    
    // Add many vectors
    const vectors: Array<{ id: number; vector: Float32Array }> = [];
    for (let i = 0; i < vectorCount; i++) {
      const vector = new Float32Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        vector[j] = Math.random();
      }
      vectors.push({ id: i, vector });
    }
    
    index1.addVectors(vectors);
    assert.strictEqual(index1.getCurrentCount(), vectorCount, `Should have ${vectorCount} vectors`);
    
    // Measure save time
    const saveStart = Date.now();
    await index1.saveIndex();
    const saveTime = Date.now() - saveStart;
    
    console.log(`   Save time for ${vectorCount} vectors: ${saveTime}ms`);
    assert.ok(saveTime < 1000, 'Save should be fast (<1s)');
    
    // Measure load time
    const index2 = new VectorIndex(indexPath, { dimensions, maxElements: 10000 });
    const loadStart = Date.now();
    await index2.loadIndex();
    const loadTime = Date.now() - loadStart;
    
    console.log(`   Load time for ${vectorCount} vectors: ${loadTime}ms`);
    assert.ok(loadTime < 500, 'Load should be fast (<500ms)');
    
    // Verify correctness
    assert.strictEqual(index2.getCurrentCount(), vectorCount, 'All vectors should be loaded');
    
    // Verify search works
    const queryVector = new Float32Array(dimensions).fill(0.5);
    const results = index2.search(queryVector, 10);
    assert.strictEqual(results.neighbors.length, 10, 'Should return 10 neighbors');
  });
  
  test('should preserve index parameters', async () => {
    const customOptions = {
      dimensions,
      maxElements: 5000,
      M: 32,
      efConstruction: 400,
      seed: 42
    };
    
    // Create index with custom parameters
    const index1 = new VectorIndex(indexPath, customOptions);
    await index1.initialize();
    
    // Add a vector
    index1.addVector(1, new Float32Array(dimensions).fill(0.5));
    await index1.saveIndex();
    
    // Load in new instance with default parameters
    const index2 = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index2.loadIndex();
    
    // Verify parameters were loaded from file
    assert.strictEqual(index2.getCurrentCount(), 1, 'Should have 1 vector');
    
    // Search should work with loaded parameters
    const results = index2.search(new Float32Array(dimensions).fill(0.5), 1);
    assert.strictEqual(results.neighbors.length, 1, 'Should find the vector');
  });
  
  test('should handle dimension mismatch error', async () => {
    // Create index with 128 dimensions
    const index1 = new VectorIndex(indexPath, { dimensions: 128, maxElements: 1000 });
    await index1.initialize();
    index1.addVector(1, new Float32Array(128).fill(0.5));
    await index1.saveIndex();
    
    // Try to load with different dimensions
    const index2 = new VectorIndex(indexPath, { dimensions: 256, maxElements: 1000 });
    
    await assert.rejects(
      () => index2.loadIndex(),
      /dimension mismatch/i,
      'Should reject with dimension mismatch error'
    );
  });
  
  test('should handle empty index', async () => {
    // Create empty index
    const index1 = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index1.initialize();
    
    assert.strictEqual(index1.getCurrentCount(), 0, 'Should be empty');
    
    // Save empty index
    await index1.saveIndex();
    assert.ok(existsSync(indexPath), 'Index file should exist');
    
    // Load empty index
    const index2 = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index2.loadIndex();
    
    assert.strictEqual(index2.getCurrentCount(), 0, 'Should still be empty');
    
    // Search on empty index should return empty results
    const results = index2.search(new Float32Array(dimensions).fill(0.5), 5);
    assert.strictEqual(results.neighbors.length, 0, 'Should return no neighbors');
  });
  
  test('should verify binary format file size', async () => {
    const vectorCount = 100;
    
    // Create index with known size
    const index = new VectorIndex(indexPath, { dimensions, maxElements: 1000 });
    await index.initialize();
    
    for (let i = 0; i < vectorCount; i++) {
      index.addVector(i, new Float32Array(dimensions).fill(i * 0.01));
    }
    
    await index.saveIndex();
    
    // Calculate expected binary size
    const headerSize = 24;
    const vectorSize = 4 + (dimensions * 4);
    const expectedSize = headerSize + (vectorCount * vectorSize);
    
    const actualSize = statSync(indexPath).size;
    
    console.log(`   Expected binary size: ${expectedSize} bytes`);
    console.log(`   Actual file size: ${actualSize} bytes`);
    
    assert.strictEqual(actualSize, expectedSize, 'File size should match binary format exactly');
    
    // Compare to estimated JSON size
    const estimatedJsonSize = expectedSize * 3.6;
    console.log(`   Estimated JSON size: ${estimatedJsonSize} bytes`);
    console.log(`   Size reduction: ${(estimatedJsonSize / actualSize).toFixed(2)}x`);
  });
});
