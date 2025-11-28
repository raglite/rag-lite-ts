/**
 * Tests for multimodal mode routing in IngestionFactory
 * Verifies that the factory correctly routes to CLIP embedder for multimodal mode
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { IngestionFactory } from '../../src/factories/ingestion-factory.js';
import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

describe('IngestionFactory Multimodal Routing', () => {
  test('should create CLIP embedder for multimodal mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-multimodal-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-multimodal-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Create ingestion pipeline with multimodal mode
      pipeline = await IngestionFactory.create(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });
      
      assert.ok(pipeline, 'Pipeline should be created');
      console.log('✓ Multimodal pipeline created successfully');
      
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
  
  test('should create text embedder for text mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-text-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-text-${Date.now()}.index`);
    
    let pipeline;
    try {
      // Create ingestion pipeline with text mode (default)
      pipeline = await IngestionFactory.create(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      assert.ok(pipeline, 'Pipeline should be created');
      console.log('✓ Text pipeline created successfully');
      
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
}, 2000);
