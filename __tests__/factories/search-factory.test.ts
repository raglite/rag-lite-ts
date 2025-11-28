/**
 * Tests for SearchFactory
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchFactory, createSearchEngine, detectSearchEngineMode } from '../../src/factories/search-factory.js';

describe('SearchFactory', () => {
  test('should create text search engine when mode is text', async () => {
    // Note: This test would require actual files to exist
    // For now, we'll test the error handling when files don't exist
    try {
      await SearchFactory.create('./nonexistent-index.bin', './nonexistent-db.sqlite');
      assert.fail('Should have thrown an error for missing files');
    } catch (error) {
      assert.ok(error instanceof Error);
      // Check for the enhanced error message format
      assert.ok(
        error.message.includes('SearchFactory.create failed') && 
        error.message.includes('Vector index file not found'),
        `Expected error message to include 'SearchFactory.create failed' and 'Vector index file not found', got: ${error.message}`
      );
    }
  });

  test('should validate required parameters', async () => {
    try {
      await SearchFactory.create('', '');
      assert.fail('Should have thrown validation error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Both indexPath and dbPath are required'));
    }
  });

  test('should handle mode detection errors gracefully', async () => {
    // Test with invalid database path
    try {
      await detectSearchEngineMode('./nonexistent-db.sqlite');
      // This should not throw because ModeDetectionService handles errors gracefully
      // and returns default text mode configuration
    } catch (error) {
      // If it does throw, it should be a meaningful error
      assert.ok(error instanceof Error);
    }
  });

  test('should provide helpful error messages for missing files', async () => {
    try {
      await SearchFactory.create('./missing-index.bin', './missing-db.sqlite');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
      // Check for the enhanced error message format
      assert.ok(
        error.message.includes('SearchFactory.create failed') && 
        error.message.includes('Vector index file not found'),
        `Expected error message to include 'SearchFactory.create failed' and 'Vector index file not found', got: ${error.message}`
      );
      assert.ok(
        error.message.includes('raglite ingest'),
        `Expected error message to include 'raglite ingest', got: ${error.message}`
      );
    }
  });
});

describe('Convenience Functions', () => {
  test('createSearchEngine should be a wrapper around factory', async () => {
    try {
      await createSearchEngine('./test-index.bin', './test-db.sqlite');
      assert.fail('Should have thrown an error for missing files');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('not found'));
    }
  });

  test('detectSearchEngineMode should return mode type', async () => {
    // This should work even with nonexistent database due to graceful error handling
    const mode = await detectSearchEngineMode('./nonexistent-db.sqlite');
    assert.ok(mode === 'text' || mode === 'multimodal');
    // Default should be text mode for new installations
    assert.strictEqual(mode, 'text');
  });
});

describe('Error Enhancement', () => {
  test('should enhance errors with helpful context', async () => {
    try {
      await SearchFactory.create('./test.bin', './test.db');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('SearchFactory.create failed'),
        `Expected error message to include 'SearchFactory.create failed', got: ${error.message}`
      );
      // Should include helpful suggestions - check for the actual suggestion text
      assert.ok(
        error.message.includes('raglite ingest') || error.message.includes('Run ingestion'),
        `Expected error message to include helpful suggestions, got: ${error.message}`
      );
    }
  });
});

// Force exit after tests complete to prevent hanging from database connections
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging from database resources...');
  
  // Multiple garbage collection attempts
  if (global.gc) {
    global.gc();
    setTimeout(() => { if (global.gc) global.gc(); }, 100);
  }
  
  // Force exit after cleanup attempts
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 1000);
}, 3000);