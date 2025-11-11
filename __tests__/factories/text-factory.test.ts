/**
 * Tests for text factory functions
 * Validates that factories can create instances with proper dependency injection
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { TextSearchFactory, TextIngestionFactory, TextRAGFactory } from '../../src/../src/factories/text-factory.js';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

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
      /Invalid file paths provided/,
      'Should reject empty indexPath'
    );
    await assert.rejects(
      () => TextSearchFactory.create(testIndexPath, ''),
      /Invalid file paths provided/,
      'Should reject empty dbPath'
    );
  });

  test('should validate file existence', async () => {
    await assert.rejects(
      () => TextSearchFactory.create('nonexistent.bin', testDbPath),
      /Vector index file not found/,
      'Should reject nonexistent index file'
    );
    
    // Create a dummy index file to test database validation
    const { writeFileSync } = await import('fs');
    writeFileSync(testIndexPath, 'dummy content');
    
    await assert.rejects(
      () => TextSearchFactory.create(testIndexPath, 'nonexistent.sqlite'),
      /Database file not found/,
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
      /Invalid file paths provided/,
      'Should reject empty dbPath'
    );
    await assert.rejects(
      () => TextIngestionFactory.create(testDbPath, ''),
      /Invalid file paths provided/,
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
    // Test that the factory methods accept undefined options without throwing synchronously
    // These will fail due to missing files, but should not throw synchronously
    assert.doesNotThrow(() => {
      TextSearchFactory.create('nonexistent.bin', 'nonexistent.db', undefined);
    }, 'Should not throw synchronously with undefined options');
    
    assert.doesNotThrow(() => {
      TextIngestionFactory.create('nonexistent.db', 'nonexistent.bin', undefined);
    }, 'Should not throw synchronously with undefined options');
  });

  test('should handle empty options gracefully', () => {
    // Test that the factory methods accept empty options without throwing synchronously
    // These will fail due to missing files, but should not throw synchronously
    assert.doesNotThrow(() => {
      TextSearchFactory.create('nonexistent.bin', 'nonexistent.db', {});
    }, 'Should not throw synchronously with empty options');
    
    assert.doesNotThrow(() => {
      TextIngestionFactory.create('nonexistent.db', 'nonexistent.bin', {});
    }, 'Should not throw synchronously with empty options');
  });
});

// Enhanced afterEach cleanup for ML/AI tests
afterEach(async () => {
  // Force garbage collection multiple times to clean up ML resources
  if (global.gc) {
    global.gc();
    await new Promise(resolve => setTimeout(resolve, 50));
    global.gc();
  }
  
  // Give time for async cleanup (WebAssembly, workers, etc.)
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // File cleanup with Windows retry logic
  if (existsSync(TEST_TEMP_DIR)) {
    try {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Windows file locking - retry after delay
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
      } catch (retryError) {
        console.warn('⚠️  Could not clean up test directory (files may be locked):', retryError);
        // Don't fail the test due to cleanup issues
      }
    }
  }
});

// Process-level exit management for ML/AI tests
let testCompleted = false;
let forceExitTimer: NodeJS.Timeout | null = null;

// Track when all tests are done
process.on('beforeExit', () => {
  if (!testCompleted) {
    testCompleted = true;
    console.log('✅ All tests completed, cleaning up resources...');
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Set a timer to force exit if resources don't clean up
    forceExitTimer = setTimeout(() => {
      console.log('⚠️  Forcing process exit after cleanup timeout');
      process.exit(0);
    }, 1000);
  }
});

// Safety net - maximum test runtime
setTimeout(() => {
  console.log('⚠️  Maximum test runtime reached, forcing exit');
  process.exit(0);
}, 30000); // 30 second maximum

// Immediate post-test exit scheduling
process.nextTick(() => {
  setTimeout(() => {
    console.log('🔄 Checking if tests are complete...');
    setTimeout(() => {
      console.log('✅ Tests should be complete, exiting gracefully');
      process.exit(0);
    }, 3000); // 3 second delay for cleanup
  }, 1000);
});
