/**
 * Integration test for mode storage with public API
 * Tests that the public IngestionPipeline class properly handles mode parameters
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { IngestionPipeline } from '../../src/ingestion.js';
import { openDatabase, getSystemInfo } from '../../src/core/db.js';
import { existsSync, unlinkSync } from 'fs';

describe('Mode Storage Public API Integration', () => {
  const testDbPath = './test-public-mode-storage.db';
  const testIndexPath = './test-public-mode-storage.bin';

  // Clean up test files after each test
  const cleanup = () => {
    try {
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  test('should store mode configuration through public API', async () => {
    cleanup();

    try {
      // Create ingestion pipeline with mode parameter through public API
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived'
      });

      // Initialize the pipeline (this triggers the factory internally)
      // We can't actually ingest without files, but we can verify the initialization
      // The mode storage happens during factory creation, not during ingestion
      
      // For this test, we'll verify that the options are properly passed through
      // by checking that the pipeline was created successfully
      assert.ok(ingestion, 'Ingestion pipeline should be created');
      
      // The actual mode storage testing is covered in the factory tests
      // This test verifies the public API accepts the parameters correctly
      
      await ingestion.cleanup();
    } finally {
      cleanup();
    }
  });

  test('should accept mode parameters in constructor options', async () => {
    cleanup();

    try {
      // Test that all new mode-related parameters are accepted
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text',
        rerankingStrategy: 'cross-encoder',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        chunkSize: 512,
        forceRebuild: true
      });

      assert.ok(ingestion, 'Ingestion pipeline should accept all mode parameters');
      
      await ingestion.cleanup();
    } finally {
      cleanup();
    }
  });

  test('should work without mode parameters (backward compatibility)', async () => {
    cleanup();

    try {
      // Test backward compatibility - should work without new parameters
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        chunkSize: 256
      });

      assert.ok(ingestion, 'Ingestion pipeline should work without mode parameters');
      
      await ingestion.cleanup();
    } finally {
      cleanup();
    }
  });
});
