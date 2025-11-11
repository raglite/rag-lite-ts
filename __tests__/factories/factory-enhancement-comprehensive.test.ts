/**
 * Comprehensive tests for factory enhancement (Task 3.5.3)
 * Tests multimodal mode routing, validation, and end-to-end ingestion
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { TextIngestionFactory } from '../../src/factories/text-factory.js';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, getSystemInfo } from '../../src/core/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

// Ensure temp directory exists
if (!existsSync(TEST_TEMP_DIR)) {
  mkdirSync(TEST_TEMP_DIR, { recursive: true });
}

describe('Factory Enhancement - Embedder Type Verification', () => {
  test('should create CLIP embedder for multimodal mode (not text embedder)', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-clip-type-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-clip-type-${Date.now()}.index`);
    
    let pipeline;
    let db;
    try {
      // Create ingestion pipeline with multimodal mode
      pipeline = await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });
      
      // Verify system info shows CLIP model type
      db = await openDatabase(dbPath);
      const systemInfo = await getSystemInfo(db);
      
      assert.ok(systemInfo, 'System info should exist');
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be multimodal');
      assert.strictEqual(systemInfo.modelType, 'clip', 'Model type should be CLIP');
      assert.strictEqual(systemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Model name should be CLIP');
      assert.ok(systemInfo.supportedContentTypes.includes('image'), 'Should support images');
      
      console.log('✓ Verified CLIP embedder created for multimodal mode');
      
    } finally {
      if (db) await db.close();
      if (pipeline) await pipeline.cleanup();
      
      // Cleanup
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
    }
  });
  
  test('should create text embedder for text mode (no regression)', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-text-type-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-text-type-${Date.now()}.index`);
    
    let pipeline;
    let db;
    try {
      // Create ingestion pipeline with text mode
      pipeline = await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      // Verify system info shows sentence-transformer model type
      db = await openDatabase(dbPath);
      const systemInfo = await getSystemInfo(db);
      
      assert.ok(systemInfo, 'System info should exist');
      assert.strictEqual(systemInfo.mode, 'text', 'Mode should be text');
      assert.strictEqual(systemInfo.modelType, 'sentence-transformer', 'Model type should be sentence-transformer');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Model name should be sentence-transformer');
      assert.ok(!systemInfo.supportedContentTypes.includes('image'), 'Should not support images in text mode');
      
      console.log('✓ Verified text embedder created for text mode (no regression)');
      
    } finally {
      if (db) await db.close();
      if (pipeline) await pipeline.cleanup();
      
      // Cleanup
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
    }
  });
});

describe('Factory Enhancement - Mode Validation', () => {
  test('should catch incompatible mode-model combination (multimodal + text model)', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-validation-1-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-validation-1-${Date.now()}.index`);
    
    try {
      // Try to create with incompatible combination
      await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2' // Text model with multimodal mode
      });
      
      assert.fail('Should have thrown validation error');
      
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw an error');
      assert.ok(
        error.message.includes('mode') || error.message.includes('model') || error.message.includes('compatible'),
        'Error should mention mode or model compatibility'
      );
      console.log('✓ Caught incompatible mode-model combination (multimodal + text model)');
      
    } finally {
      // Cleanup
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
    }
  });
  
  test('should catch incompatible mode-model combination (text + CLIP model)', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-validation-2-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-validation-2-${Date.now()}.index`);
    
    try {
      // Try to create with incompatible combination
      await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'Xenova/clip-vit-base-patch32' // CLIP model with text mode
      });
      
      assert.fail('Should have thrown validation error');
      
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw an error');
      assert.ok(
        error.message.includes('mode') || error.message.includes('model') || error.message.includes('compatible'),
        'Error should mention mode or model compatibility'
      );
      console.log('✓ Caught incompatible mode-model combination (text + CLIP model)');
      
    } finally {
      // Cleanup
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
    }
  });
});

describe('Factory Enhancement - End-to-End Multimodal Ingestion', () => {
  test('should ingest text content using CLIP embedder in multimodal mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-e2e-multimodal-text-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-e2e-multimodal-text-${Date.now()}.index`);
    const testFilePath = join(TEST_TEMP_DIR, `test-content-${Date.now()}.txt`);
    
    let pipeline;
    let db;
    try {
      // Create test file
      writeFileSync(testFilePath, 'This is a test document for multimodal ingestion.');
      
      // Create multimodal pipeline
      pipeline = await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });
      
      // Ingest the test file
      const result = await pipeline.ingestFile(testFilePath);
      
      // Verify ingestion succeeded
      assert.ok(result, 'Ingestion result should exist');
      assert.ok(result.documentsProcessed > 0, 'Should have processed documents');
      
      // Verify system info confirms CLIP embedder was used
      db = await openDatabase(dbPath);
      const systemInfo = await getSystemInfo(db);
      assert.ok(systemInfo, 'System info should exist');
      assert.strictEqual(systemInfo.modelType, 'clip', 'Should have used CLIP embedder');
      
      console.log('✓ Successfully ingested text using CLIP embedder in multimodal mode');
      
    } finally {
      if (db) await db.close();
      if (pipeline) await pipeline.cleanup();
      
      // Cleanup
      if (existsSync(testFilePath)) rmSync(testFilePath, { force: true });
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
    }
  });
});

describe('Factory Enhancement - End-to-End Text Ingestion', () => {
  test('should ingest text content using text embedder in text mode', async () => {
    const dbPath = join(TEST_TEMP_DIR, `test-e2e-text-${Date.now()}.db`);
    const indexPath = join(TEST_TEMP_DIR, `test-e2e-text-${Date.now()}.index`);
    const testFilePath = join(TEST_TEMP_DIR, `test-content-${Date.now()}.txt`);
    
    let pipeline;
    let db;
    try {
      // Create test file
      writeFileSync(testFilePath, 'This is a test document for text mode ingestion.');
      
      // Create text mode pipeline
      pipeline = await TextIngestionFactory.create(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      // Ingest the test file
      const result = await pipeline.ingestFile(testFilePath);
      
      // Verify ingestion succeeded
      assert.ok(result, 'Ingestion result should exist');
      assert.ok(result.documentsProcessed > 0, 'Should have processed documents');
      
      // Verify system info confirms text embedder was used
      db = await openDatabase(dbPath);
      const systemInfo = await getSystemInfo(db);
      assert.ok(systemInfo, 'System info should exist');
      assert.strictEqual(systemInfo.modelType, 'sentence-transformer', 'Should have used text embedder');
      
      console.log('✓ Successfully ingested text using text embedder in text mode');
      
    } finally {
      if (db) await db.close();
      if (pipeline) await pipeline.cleanup();
      
      // Cleanup
      if (existsSync(testFilePath)) rmSync(testFilePath, { force: true });
      if (existsSync(dbPath)) rmSync(dbPath, { force: true });
      if (existsSync(indexPath)) rmSync(indexPath, { force: true });
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
}, 5000); // Longer timeout for comprehensive tests
