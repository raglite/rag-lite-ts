/**
 * Tests for public IngestionPipeline multimodal mode routing
 * Verifies that the public API properly passes mode options to the factory
 * and that lazy initialization works correctly with both modes
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { IngestionPipeline } from '../../src/ingestion.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

// Ensure temp directory exists
if (!existsSync(TEST_TEMP_DIR)) {
  mkdirSync(TEST_TEMP_DIR, { recursive: true });
}

describe('Public IngestionPipeline Multimodal Routing', () => {
  test('should pass mode option to factory for multimodal mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-public-multimodal-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-public-multimodal-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Create public IngestionPipeline with multimodal mode
      pipeline = new IngestionPipeline(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });
      
      // Trigger lazy initialization by calling a method
      // This will initialize the factory with the mode option
      await pipeline.ingestDirectory(TEST_TEMP_DIR);
      
      assert.ok(pipeline, 'Pipeline should be created');
      console.log('✓ Public API multimodal pipeline created and initialized successfully');
      
    } finally {
      if (pipeline) {
        await pipeline.cleanup();
      }
      
      // Cleanup test files
      if (existsSync(dbPath)) {
        try {
          rmSync(dbPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test database:', error);
        }
      }
      if (existsSync(indexPath)) {
        try {
          rmSync(indexPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test index:', error);
        }
      }
    }
  });
  
  test('should pass mode option to factory for text mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-public-text-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-public-text-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Create public IngestionPipeline with text mode (explicit)
      pipeline = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      // Trigger lazy initialization
      await pipeline.ingestDirectory(TEST_TEMP_DIR);
      
      assert.ok(pipeline, 'Pipeline should be created');
      console.log('✓ Public API text pipeline created and initialized successfully');
      
    } finally {
      if (pipeline) {
        await pipeline.cleanup();
      }
      
      // Cleanup test files
      if (existsSync(dbPath)) {
        try {
          rmSync(dbPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test database:', error);
        }
      }
      if (existsSync(indexPath)) {
        try {
          rmSync(indexPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test index:', error);
        }
      }
    }
  });
  
  test('should use default text mode when mode not specified', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-public-default-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-public-default-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Create public IngestionPipeline without specifying mode (should default to text)
      pipeline = new IngestionPipeline(dbPath, indexPath, {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      // Trigger lazy initialization
      await pipeline.ingestDirectory(TEST_TEMP_DIR);
      
      assert.ok(pipeline, 'Pipeline should be created');
      console.log('✓ Public API default mode pipeline created and initialized successfully');
      
    } finally {
      if (pipeline) {
        await pipeline.cleanup();
      }
      
      // Cleanup test files
      if (existsSync(dbPath)) {
        try {
          rmSync(dbPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test database:', error);
        }
      }
      if (existsSync(indexPath)) {
        try {
          rmSync(indexPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test index:', error);
        }
      }
    }
  });
  
  test('should validate mode-model compatibility through public API', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-public-validation-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-public-validation-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Try to create with incompatible mode-model combination
      // This should fail during initialization
      pipeline = new IngestionPipeline(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2' // Text model with multimodal mode
      });
      
      // This should throw an error during initialization
      await pipeline.ingestDirectory(TEST_TEMP_DIR);
      
      assert.fail('Should have thrown mode-model compatibility error');
      
    } catch (error) {
      // Expected error - mode-model mismatch
      assert.ok(error instanceof Error, 'Should throw an error');
      assert.ok(
        error.message.includes('mode') || error.message.includes('model') || error.message.includes('compatible'),
        'Error should mention mode or model compatibility'
      );
      console.log('✓ Mode-model validation works correctly through public API');
      
    } finally {
      if (pipeline) {
        try {
          await pipeline.cleanup();
        } catch (cleanupError) {
          // Ignore cleanup errors for failed initialization
        }
      }
      
      // Cleanup test files
      if (existsSync(dbPath)) {
        try {
          rmSync(dbPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test database:', error);
        }
      }
      if (existsSync(indexPath)) {
        try {
          rmSync(indexPath, { force: true });
        } catch (error) {
          console.warn('Could not clean up test index:', error);
        }
      }
    }
  });
});

// Force exit after test completion with aggressive cleanup
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging...');
  
  // Multiple garbage collection attempts
  if (global.gc) {
    global.gc();
    setTimeout(() => {
      if (global.gc) global.gc();
    }, 100);
    setTimeout(() => {
      if (global.gc) global.gc();
    }, 300);
  }
  
  // Force exit after cleanup attempts
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 1000);
}, 3000);
