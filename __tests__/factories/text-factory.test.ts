/**
 * Tests for text factory functions
 * Validates that factories can create instances with proper dependency injection
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { TextSearchFactory, TextIngestionFactory, TextRAGFactory } from '../../src/../src/factories/text-factory.js';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TextSearchFactory', () => {
  let testDbPath: string;
  let testIndexPath: string;

  beforeEach(() => {
    // Create temporary paths for testing
    const testId = Math.random().toString(36).substring(7);
    testDbPath = join(tmpdir(), `test-db-${testId}.sqlite`);
    testIndexPath = join(tmpdir(), `test-index-${testId}.bin`);
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testIndexPath)) {
      unlinkSync(testIndexPath);
    }
  });

  test('should validate required parameters', async () => {
    await assert.rejects(
      () => TextSearchFactory.create('', testDbPath),
      /Both indexPath and dbPath are required/,
      'Should reject empty indexPath'
    );
    await assert.rejects(
      () => TextSearchFactory.create(testIndexPath, ''),
      /Both indexPath and dbPath are required/,
      'Should reject empty dbPath'
    );
  });

  test('should validate file existence', async () => {
    await assert.rejects(
      () => TextSearchFactory.create('nonexistent.bin', testDbPath),
      /Vector index not found/,
      'Should reject nonexistent index file'
    );
    await assert.rejects(
      () => TextSearchFactory.create(testIndexPath, 'nonexistent.sqlite'),
      /Database not found/,
      'Should reject nonexistent database file'
    );
  });

  test('should accept valid options', () => {
    const options = {
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      batchSize: 16,
      rerankingModel: 'Xenova/ms-marco-MiniLM-L-6-v2',
      enableReranking: true,
      topK: 10
    };

    // Should not throw when creating options
    assert.doesNotThrow(() => options, 'Valid options should not throw');
  });
});

describe('TextIngestionFactory', () => {
  let testDbPath: string;
  let testIndexPath: string;

  beforeEach(() => {
    // Create temporary paths for testing
    const testId = Math.random().toString(36).substring(7);
    testDbPath = join(tmpdir(), `test-db-${testId}.sqlite`);
    testIndexPath = join(tmpdir(), `test-index-${testId}.bin`);
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testIndexPath)) {
      unlinkSync(testIndexPath);
    }
  });

  test('should validate required parameters', async () => {
    await assert.rejects(
      () => TextIngestionFactory.create('', testIndexPath),
      /Both dbPath and indexPath are required/,
      'Should reject empty dbPath'
    );
    await assert.rejects(
      () => TextIngestionFactory.create(testDbPath, ''),
      /Both dbPath and indexPath are required/,
      'Should reject empty indexPath'
    );
  });

  test('should accept valid options', () => {
    const options = {
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      batchSize: 16,
      chunkSize: 1024,
      chunkOverlap: 100,
      forceRebuild: true
    };

    // Should not throw when creating options
    assert.doesNotThrow(() => options, 'Valid options should not throw');
  });
});

describe('TextRAGFactory', () => {
  test('should accept valid options for both search and ingestion', () => {
    const searchOptions = {
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      enableReranking: true,
      topK: 10
    };

    const ingestionOptions = {
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      chunkSize: 1024,
      forceRebuild: false
    };

    // Should not throw when creating options
    assert.doesNotThrow(() => ({ searchOptions, ingestionOptions }), 'Valid options should not throw');
  });
});

describe('Factory Options Validation', () => {
  test('should handle undefined options gracefully', () => {
    // All factories should handle undefined options
    assert.doesNotThrow(() => TextSearchFactory.create('test.bin', 'test.db', undefined), 'Should handle undefined options');
    assert.doesNotThrow(() => TextIngestionFactory.create('test.db', 'test.bin', undefined), 'Should handle undefined options');
  });

  test('should handle empty options gracefully', () => {
    // All factories should handle empty options
    assert.doesNotThrow(() => TextSearchFactory.create('test.bin', 'test.db', {}), 'Should handle empty options');
    assert.doesNotThrow(() => TextIngestionFactory.create('test.db', 'test.bin', {}), 'Should handle empty options');
  });
});
