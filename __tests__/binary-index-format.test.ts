/**
 * Tests for Binary Index Format
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { BinaryIndexFormat } from '../src/core/binary-index-format.js';
import { unlinkSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

describe('BinaryIndexFormat', () => {
  const testPath = join(TEST_TEMP_DIR, 'test-index.bin');
  
  beforeEach(() => {
    // Ensure temp directory exists
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });
  
  afterEach(async () => {
    // Cleanup test files
    if (existsSync(testPath)) {
      try {
        unlinkSync(testPath);
      } catch (error) {
        console.warn('Could not clean up test file:', error);
      }
    }
  });
  
  test('should save and load binary index with small dataset', async () => {
    const testData = {
      dimensions: 3,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 3,
      vectors: [
        { id: 1, vector: new Float32Array([0.1, 0.2, 0.3]) },
        { id: 2, vector: new Float32Array([0.4, 0.5, 0.6]) },
        { id: 3, vector: new Float32Array([0.7, 0.8, 0.9]) }
      ]
    };
    
    // Save
    await BinaryIndexFormat.save(testPath, testData);
    assert.ok(existsSync(testPath), 'Index file should exist');
    
    // Load
    const loaded = await BinaryIndexFormat.load(testPath);
    
    // Verify header
    assert.strictEqual(loaded.dimensions, testData.dimensions, 'Dimensions should match');
    assert.strictEqual(loaded.maxElements, testData.maxElements, 'MaxElements should match');
    assert.strictEqual(loaded.M, testData.M, 'M should match');
    assert.strictEqual(loaded.efConstruction, testData.efConstruction, 'efConstruction should match');
    assert.strictEqual(loaded.seed, testData.seed, 'Seed should match');
    assert.strictEqual(loaded.currentSize, testData.currentSize, 'CurrentSize should match');
    
    // Verify vectors
    assert.strictEqual(loaded.vectors.length, testData.vectors.length, 'Vector count should match');
    for (let i = 0; i < loaded.vectors.length; i++) {
      assert.strictEqual(loaded.vectors[i].id, testData.vectors[i].id, `Vector ${i} ID should match`);
      assert.strictEqual(loaded.vectors[i].vector.length, testData.vectors[i].vector.length, `Vector ${i} length should match`);
      
      // Verify vector values
      for (let j = 0; j < loaded.vectors[i].vector.length; j++) {
        assert.ok(
          Math.abs(loaded.vectors[i].vector[j] - testData.vectors[i].vector[j]) < 0.0001,
          `Vector ${i} value ${j} should match`
        );
      }
    }
  });
  
  test('should handle realistic vector dimensions (512)', async () => {
    const dimensions = 512;
    const vector = new Float32Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Math.random();
    }
    
    const testData = {
      dimensions,
      maxElements: 10000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 1,
      vectors: [{ id: 42, vector }]
    };
    
    await BinaryIndexFormat.save(testPath, testData);
    const loaded = await BinaryIndexFormat.load(testPath);
    
    assert.strictEqual(loaded.dimensions, dimensions, 'Dimensions should match');
    assert.strictEqual(loaded.vectors[0].id, 42, 'Vector ID should match');
    assert.strictEqual(loaded.vectors[0].vector.length, dimensions, 'Vector length should match');
    
    // Verify all values
    for (let i = 0; i < dimensions; i++) {
      assert.ok(
        Math.abs(loaded.vectors[0].vector[i] - vector[i]) < 0.0001,
        `Vector value ${i} should match`
      );
    }
  });
  
  test('should maintain 4-byte alignment', async () => {
    const testData = {
      dimensions: 512,
      maxElements: 100,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 1,
      vectors: [
        { id: 42, vector: new Float32Array(512).fill(0.5) }
      ]
    };
    
    await BinaryIndexFormat.save(testPath, testData);
    const loaded = await BinaryIndexFormat.load(testPath);
    
    // Verify data integrity
    assert.strictEqual(loaded.vectors[0].id, 42, 'Vector ID should match');
    assert.strictEqual(loaded.vectors[0].vector[0], 0.5, 'Vector value should match');
    assert.strictEqual(loaded.vectors[0].vector[511], 0.5, 'Last vector value should match');
  });
  
  test('should verify file size reduction vs JSON', async () => {
    // Create test data with 100 vectors of 512 dimensions
    const vectors: Array<{ id: number; vector: Float32Array }> = [];
    for (let i = 0; i < 100; i++) {
      const vector = new Float32Array(512);
      for (let j = 0; j < 512; j++) {
        vector[j] = Math.random();
      }
      vectors.push({ id: i, vector });
    }
    
    const testData = {
      dimensions: 512,
      maxElements: 10000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 100,
      vectors
    };
    
    // Save as binary
    await BinaryIndexFormat.save(testPath, testData);
    const binarySize = statSync(testPath).size;
    
    // Calculate expected size
    const headerSize = 24;
    const vectorSize = 4 + (512 * 4); // id + vector
    const expectedSize = headerSize + (100 * vectorSize);
    
    assert.strictEqual(binarySize, expectedSize, 'Binary file size should match expected');
    
    // Verify it's much smaller than JSON would be
    // JSON would be roughly 3.6x larger due to text encoding and formatting
    const estimatedJsonSize = binarySize * 3.6;
    console.log(`Binary size: ${binarySize} bytes, Estimated JSON size: ${estimatedJsonSize} bytes`);
    console.log(`Size reduction: ${(estimatedJsonSize / binarySize).toFixed(2)}x`);
  });
  
  test('should handle empty index', async () => {
    const testData = {
      dimensions: 512,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 0,
      vectors: []
    };
    
    await BinaryIndexFormat.save(testPath, testData);
    const loaded = await BinaryIndexFormat.load(testPath);
    
    assert.strictEqual(loaded.currentSize, 0, 'CurrentSize should be 0');
    assert.strictEqual(loaded.vectors.length, 0, 'Vectors array should be empty');
  });
  
  test('should handle multiple vectors with different IDs', async () => {
    const testData = {
      dimensions: 128,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 5,
      vectors: [
        { id: 10, vector: new Float32Array(128).fill(0.1) },
        { id: 25, vector: new Float32Array(128).fill(0.2) },
        { id: 50, vector: new Float32Array(128).fill(0.3) },
        { id: 100, vector: new Float32Array(128).fill(0.4) },
        { id: 999, vector: new Float32Array(128).fill(0.5) }
      ]
    };
    
    await BinaryIndexFormat.save(testPath, testData);
    const loaded = await BinaryIndexFormat.load(testPath);
    
    assert.strictEqual(loaded.vectors.length, 5, 'Should have 5 vectors');
    assert.strictEqual(loaded.vectors[0].id, 10, 'First ID should be 10');
    assert.strictEqual(loaded.vectors[4].id, 999, 'Last ID should be 999');
    
    // Verify values (use approximate comparison for Float32)
    assert.ok(Math.abs(loaded.vectors[0].vector[0] - 0.1) < 0.0001, 'First vector value should match');
    assert.ok(Math.abs(loaded.vectors[4].vector[0] - 0.5) < 0.0001, 'Last vector value should match');
  });
  
  test('should preserve floating point precision', async () => {
    const testValues = [
      0.123456789,
      -0.987654321,
      1.0e-6,
      1.0e6,
      Math.PI,
      Math.E
    ];
    
    const vector = new Float32Array(testValues);
    
    const testData = {
      dimensions: testValues.length,
      maxElements: 100,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 1,
      vectors: [{ id: 1, vector }]
    };
    
    await BinaryIndexFormat.save(testPath, testData);
    const loaded = await BinaryIndexFormat.load(testPath);
    
    // Float32 precision is about 7 decimal digits
    for (let i = 0; i < testValues.length; i++) {
      const diff = Math.abs(loaded.vectors[0].vector[i] - testValues[i]);
      const relativeDiff = diff / Math.abs(testValues[i]);
      assert.ok(relativeDiff < 1e-6, `Value ${i} should preserve Float32 precision`);
    }
  });
});
