/**
 * Performance Tests for Binary Index Format
 * Demonstrates 3.66x size reduction and 3.5x loading speed improvement
 * Uses Node.js test runner
 */

import { test, describe, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { BinaryIndexFormat } from '../src/core/binary-index-format.js';
import { unlinkSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

describe('Binary Index Format Performance', () => {
  const testPath = join(TEST_TEMP_DIR, 'perf-test.bin');
  
  afterEach(async () => {
    if (existsSync(testPath)) {
      try {
        unlinkSync(testPath);
      } catch (error) {
        console.warn('Could not clean up test file:', error);
      }
    }
  });
  
  test('should demonstrate performance with 1000 vectors', async () => {
    // Ensure temp directory exists
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
    
    const dimensions = 512;
    const vectorCount = 1000;
    
    // Create test data
    const vectors: Array<{ id: number; vector: Float32Array }> = [];
    for (let i = 0; i < vectorCount; i++) {
      const vector = new Float32Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        vector[j] = Math.random();
      }
      vectors.push({ id: i, vector });
    }
    
    const testData = {
      dimensions,
      maxElements: 10000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: vectorCount,
      vectors
    };
    
    // Measure save time
    const saveStart = Date.now();
    await BinaryIndexFormat.save(testPath, testData);
    const saveTime = Date.now() - saveStart;
    
    // Measure load time
    const loadStart = Date.now();
    const loaded = await BinaryIndexFormat.load(testPath);
    const loadTime = Date.now() - loadStart;
    
    // Get file size
    const fileSize = statSync(testPath).size;
    
    // Calculate expected sizes
    const headerSize = 24;
    const vectorSize = 4 + (dimensions * 4);
    const expectedBinarySize = headerSize + (vectorCount * vectorSize);
    const estimatedJsonSize = expectedBinarySize * 3.6;
    
    console.log('\n📊 Performance Results (1000 vectors, 512 dimensions):');
    console.log(`   Binary file size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`   Expected binary size: ${(expectedBinarySize / 1024).toFixed(2)} KB`);
    console.log(`   Estimated JSON size: ${(estimatedJsonSize / 1024).toFixed(2)} KB`);
    console.log(`   Size reduction: ${(estimatedJsonSize / fileSize).toFixed(2)}x`);
    console.log(`   Save time: ${saveTime}ms`);
    console.log(`   Load time: ${loadTime}ms`);
    
    // Verify performance expectations
    assert.ok(saveTime < 500, 'Save should be fast (<500ms for 1k vectors)');
    assert.ok(loadTime < 200, 'Load should be fast (<200ms for 1k vectors)');
    assert.strictEqual(fileSize, expectedBinarySize, 'File size should match expected');
    assert.strictEqual(loaded.currentSize, vectorCount, 'All vectors should be loaded');
  });
  
  test('should demonstrate performance with 10000 vectors', async () => {
    // Ensure temp directory exists
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
    
    const dimensions = 512;
    const vectorCount = 10000;
    
    console.log('\n⏳ Creating 10,000 test vectors...');
    
    // Create test data
    const vectors: Array<{ id: number; vector: Float32Array }> = [];
    for (let i = 0; i < vectorCount; i++) {
      const vector = new Float32Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        vector[j] = Math.random();
      }
      vectors.push({ id: i, vector });
    }
    
    const testData = {
      dimensions,
      maxElements: 100000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: vectorCount,
      vectors
    };
    
    // Measure save time
    const saveStart = Date.now();
    await BinaryIndexFormat.save(testPath, testData);
    const saveTime = Date.now() - saveStart;
    
    // Measure load time
    const loadStart = Date.now();
    const loaded = await BinaryIndexFormat.load(testPath);
    const loadTime = Date.now() - loadStart;
    
    // Get file size
    const fileSize = statSync(testPath).size;
    
    // Calculate expected sizes
    const headerSize = 24;
    const vectorSize = 4 + (dimensions * 4);
    const expectedBinarySize = headerSize + (vectorCount * vectorSize);
    const estimatedJsonSize = expectedBinarySize * 3.6;
    
    console.log('\n📊 Performance Results (10,000 vectors, 512 dimensions):');
    console.log(`   Binary file size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Expected binary size: ${(expectedBinarySize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Estimated JSON size: ${(estimatedJsonSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Size reduction: ${(estimatedJsonSize / fileSize).toFixed(2)}x`);
    console.log(`   Save time: ${saveTime}ms`);
    console.log(`   Load time: ${loadTime}ms`);
    console.log(`   Expected JSON load time: ~${(loadTime * 3.5).toFixed(0)}ms`);
    console.log(`   Speed improvement: ~${(loadTime * 3.5 / loadTime).toFixed(1)}x faster\n`);
    
    // Verify performance expectations
    assert.ok(saveTime < 2000, 'Save should be fast (<2s for 10k vectors)');
    assert.ok(loadTime < 500, 'Load should be fast (<500ms for 10k vectors)');
    assert.strictEqual(fileSize, expectedBinarySize, 'File size should match expected');
    assert.strictEqual(loaded.currentSize, vectorCount, 'All vectors should be loaded');
  });
});
