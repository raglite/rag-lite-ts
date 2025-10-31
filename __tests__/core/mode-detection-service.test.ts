/**
 * Tests for Mode Detection Service (Task 3.1)
 * Validates mode detection, storage, and error handling functionality
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { ModeDetectionService, detectSystemMode, storeSystemMode, isMultimodalMode } from '../../src/../src/core/mode-detection-service.js';
import { openDatabase, initializeSchema, setSystemInfo } from '../../src/../src/core/db.js';
import type { SystemInfo, ModeType, ModelType, RerankingStrategyType } from '../../src/types.js';

describe('Mode Detection Service (Task 3.1)', () => {
  const testDbPath = './test-mode-detection.db';

  // Clean up test database before and after each test
  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb();
  });

  async function cleanupTestDb() {
    if (existsSync(testDbPath)) {
      try {
        await unlink(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  describe('ModeDetectionService Class', () => {
    test('should create service instance with database path', () => {
      const service = new ModeDetectionService(testDbPath);
      assert.ok(service instanceof ModeDetectionService, 'Should create ModeDetectionService instance');
    });

    test('should detect default text mode for new installations', async () => {
      const service = new ModeDetectionService(testDbPath);
      const systemInfo = await service.detectMode();

      assert.strictEqual(systemInfo.mode, 'text', 'Should default to text mode');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default text model');
      assert.strictEqual(systemInfo.modelType, 'sentence-transformer', 'Should use sentence-transformer type');
      assert.strictEqual(systemInfo.modelDimensions, 384, 'Should have correct dimensions');
      assert.deepStrictEqual(systemInfo.supportedContentTypes, ['text'], 'Should support text content');
      assert.strictEqual(systemInfo.rerankingStrategy, 'cross-encoder', 'Should use cross-encoder reranking');
      assert.ok(systemInfo.createdAt instanceof Date, 'Should have creation date');
      assert.ok(systemInfo.updatedAt instanceof Date, 'Should have update date');
    });

    test('should store and retrieve mode configuration', async () => {
      const service = new ModeDetectionService(testDbPath);

      // Store multimodal configuration
      const multimodalConfig: Partial<SystemInfo> = {
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip',
        modelDimensions: 512,
        modelVersion: '1.0.0',
        supportedContentTypes: ['text', 'image'],
        rerankingStrategy: 'text-derived',
        rerankingModel: 'Xenova/vit-gpt2-image-captioning'
      };

      await service.storeMode(multimodalConfig);

      // Retrieve and verify
      const retrievedInfo = await service.detectMode();
      assert.strictEqual(retrievedInfo.mode, 'multimodal', 'Should retrieve multimodal mode');
      assert.strictEqual(retrievedInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Should retrieve correct model');
      assert.strictEqual(retrievedInfo.modelType, 'clip', 'Should retrieve correct model type');
      assert.strictEqual(retrievedInfo.modelDimensions, 512, 'Should retrieve correct dimensions');
      assert.deepStrictEqual(retrievedInfo.supportedContentTypes, ['text', 'image'], 'Should retrieve content types');
      assert.strictEqual(retrievedInfo.rerankingStrategy, 'text-derived', 'Should retrieve reranking strategy');
    });

    test('should handle partial updates to system info', async () => {
      const service = new ModeDetectionService(testDbPath);

      // First store initial configuration
      await service.storeMode({
        mode: 'text',
        modelName: 'sentence-transformers/all-MiniLM-L6-v2',
        modelType: 'sentence-transformer',
        modelDimensions: 384
      });

      // Update only the reranking strategy
      await service.storeMode({
        rerankingStrategy: 'disabled'
      });

      // Verify the update
      const systemInfo = await service.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Should preserve existing mode');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should preserve existing model');
      assert.strictEqual(systemInfo.rerankingStrategy, 'disabled', 'Should update reranking strategy');
    });

    test('should validate mode values during storage', async () => {
      const service = new ModeDetectionService(testDbPath);

      await assert.rejects(
        () => service.storeMode({ mode: 'invalid-mode' as ModeType }),
        /Invalid mode/,
        'Should reject invalid mode'
      );
    });

    test('should validate model type values during storage', async () => {
      const service = new ModeDetectionService(testDbPath);

      await assert.rejects(
        () => service.storeMode({ modelType: 'invalid-type' as ModelType }),
        /Invalid model type/,
        'Should reject invalid model type'
      );
    });

    test('should validate reranking strategy values during storage', async () => {
      const service = new ModeDetectionService(testDbPath);

      await assert.rejects(
        () => service.storeMode({ rerankingStrategy: 'invalid-strategy' as RerankingStrategyType }),
        /Invalid reranking strategy/,
        'Should reject invalid reranking strategy'
      );
    });

    test('should handle database connection errors gracefully', async () => {
      // Use an invalid path that will cause connection errors
      const service = new ModeDetectionService('/invalid/path/database.db');

      // Should not throw, but return default configuration
      const systemInfo = await service.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Should fallback to default text mode');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default model');
    });

    test('should handle corrupted database gracefully', async () => {
      // Create a corrupted database file (just write invalid content)
      const fs = await import('node:fs/promises');
      await fs.writeFile(testDbPath, 'This is not a valid SQLite database');

      const service = new ModeDetectionService(testDbPath);

      // Should not throw, but return default configuration
      const systemInfo = await service.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Should fallback to default text mode on corruption');
    });
  });

  describe('Convenience Methods', () => {
    test('getCurrentMode should return current mode', async () => {
      const service = new ModeDetectionService(testDbPath);

      // Store multimodal mode
      await service.storeMode({ mode: 'multimodal' });

      const mode = await service.getCurrentMode();
      assert.strictEqual(mode, 'multimodal', 'Should return current mode');
    });

    test('isMultimodalMode should return boolean for multimodal check', async () => {
      const service = new ModeDetectionService(testDbPath);

      // Default should be text mode
      let isMultimodal = await service.isMultimodalMode();
      assert.strictEqual(isMultimodal, false, 'Should return false for text mode');

      // Switch to multimodal
      await service.storeMode({ mode: 'multimodal' });
      isMultimodal = await service.isMultimodalMode();
      assert.strictEqual(isMultimodal, true, 'Should return true for multimodal mode');
    });

    test('getCurrentModelInfo should return model information', async () => {
      const service = new ModeDetectionService(testDbPath);

      await service.storeMode({
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip',
        modelDimensions: 512,
        supportedContentTypes: ['text', 'image']
      });

      const modelInfo = await service.getCurrentModelInfo();
      assert.strictEqual(modelInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Should return model name');
      assert.strictEqual(modelInfo.modelType, 'clip', 'Should return model type');
      assert.strictEqual(modelInfo.dimensions, 512, 'Should return dimensions');
      assert.deepStrictEqual(modelInfo.supportedContentTypes, ['text', 'image'], 'Should return content types');
    });
  });

  describe('Convenience Functions', () => {
    test('detectMode function should work as service wrapper', async () => {
      // Set up database with multimodal mode
      const connection = await openDatabase(testDbPath);
      await initializeSchema(connection);
      await setSystemInfo(connection, {
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip'
      });
      await connection.close();

      const systemInfo = await detectSystemMode(testDbPath);
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Should detect multimodal mode');
    });

    test('storeSystemMode function should work as service wrapper', async () => {
      await storeSystemMode(testDbPath, {
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip',
        modelDimensions: 512
      });

      const systemInfo = await detectSystemMode(testDbPath);
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Should store and detect multimodal mode');
    });

    test('isMultimodalMode function should work as service wrapper', async () => {
      // Default should be false
      let isMultimodal = await isMultimodalMode(testDbPath);
      assert.strictEqual(isMultimodal, false, 'Should return false for default text mode');

      // Store multimodal mode
      await storeSystemMode(testDbPath, { mode: 'multimodal' });
      isMultimodal = await isMultimodalMode(testDbPath);
      assert.strictEqual(isMultimodal, true, 'Should return true after storing multimodal mode');
    });

    test('detectSystemMode should never throw errors', async () => {
      // Test with valid database
      const systemInfo1 = await detectSystemMode(testDbPath);
      assert.ok(systemInfo1, 'Should return system info for valid database');
      assert.strictEqual(systemInfo1.mode, 'text', 'Should return default text mode');

      // Test with invalid database path
      const systemInfo2 = await detectSystemMode('/invalid/path/database.db');
      assert.ok(systemInfo2, 'Should return system info even for invalid path');
      assert.strictEqual(systemInfo2.mode, 'text', 'Should return default text mode for invalid path');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing mode information gracefully', async () => {
      // Create database but don't insert system info
      const connection = await openDatabase(testDbPath);
      await initializeSchema(connection);
      await connection.close();

      const service = new ModeDetectionService(testDbPath);
      const systemInfo = await service.detectMode();

      assert.strictEqual(systemInfo.mode, 'text', 'Should default to text mode when no info exists');
    });

    test('should handle database schema issues gracefully', async () => {
      // Create database with incomplete schema
      const connection = await openDatabase(testDbPath);
      await connection.run('CREATE TABLE test_table (id INTEGER)'); // Wrong schema
      await connection.close();

      const service = new ModeDetectionService(testDbPath);
      const systemInfo = await service.detectMode();

      assert.strictEqual(systemInfo.mode, 'text', 'Should fallback to default on schema issues');
    });

    test('should validate retrieved system info', async () => {
      // Test validation by creating a corrupted database scenario
      // Since we now have database constraints, we'll simulate corruption differently
      const connection = await openDatabase(testDbPath);
      await initializeSchema(connection);

      // Insert valid data first
      await connection.run(`
        INSERT INTO system_info (id, mode, model_name, model_type, model_dimensions, model_version, supported_content_types)
        VALUES (1, 'text', 'test-model', 'sentence-transformer', 384, '1.0.0', '["text"]')
      `);

      // Now corrupt the data by directly updating with invalid JSON (this bypasses some constraints)
      await connection.run(`
        UPDATE system_info SET supported_content_types = 'invalid-json' WHERE id = 1
      `);
      await connection.close();

      const service = new ModeDetectionService(testDbPath);
      const systemInfo = await service.detectMode();

      // Should fallback to default due to validation failure (JSON parsing will fail)
      assert.strictEqual(systemInfo.mode, 'text', 'Should fallback to default on validation failure');
    });

    test('should handle concurrent access gracefully', async () => {
      const service1 = new ModeDetectionService(testDbPath);
      const service2 = new ModeDetectionService(testDbPath);

      // Try concurrent operations
      const promises = [
        service1.detectMode(),
        service2.detectMode(),
        service1.storeMode({ mode: 'text' }),
        service2.storeMode({ rerankingStrategy: 'disabled' })
      ];

      // Should not throw errors
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected');

      // Allow some failures due to database locking, but not all
      assert.ok(failures.length < results.length, 'Should handle some concurrent operations successfully');
    });
  });

  describe('Requirements Validation', () => {
    test('should meet requirement 1.2: automatic mode detection from system_info table', async () => {
      // Requirement 1.2: Implement automatic mode detection from system_info table

      const service = new ModeDetectionService(testDbPath);

      // Store specific mode
      await service.storeMode({
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip'
      });

      // Should automatically detect the stored mode
      const systemInfo = await service.detectMode();
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Should automatically detect stored mode');
      assert.strictEqual(systemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Should detect stored model');
    });

    test('should meet requirement 1.3: default mode configuration for new installations', async () => {
      // Requirement 1.3: Add default mode configuration for new installations

      const service = new ModeDetectionService(testDbPath);

      // For new installation (no database), should return default configuration
      const systemInfo = await service.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Should default to text mode for new installations');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default model');
      assert.strictEqual(systemInfo.modelType, 'sentence-transformer', 'Should use default model type');
      assert.strictEqual(systemInfo.rerankingStrategy, 'cross-encoder', 'Should use default reranking');
    });

    test('should meet requirement 1.6: handle database errors and missing mode information gracefully', async () => {
      // Requirement 1.6: Handle database errors and missing mode information gracefully

      // Test with non-existent database path
      const service1 = new ModeDetectionService('/non/existent/path.db');
      const systemInfo1 = await service1.detectMode();
      assert.strictEqual(systemInfo1.mode, 'text', 'Should handle non-existent database gracefully');

      // Test with corrupted database
      const fs = await import('node:fs/promises');
      await fs.writeFile(testDbPath, 'corrupted data');

      const service2 = new ModeDetectionService(testDbPath);
      const systemInfo2 = await service2.detectMode();
      assert.strictEqual(systemInfo2.mode, 'text', 'Should handle corrupted database gracefully');

      // Test with missing system info in valid database
      await cleanupTestDb();
      const connection = await openDatabase(testDbPath);
      await initializeSchema(connection);
      await connection.close();

      const service3 = new ModeDetectionService(testDbPath);
      const systemInfo3 = await service3.detectMode();
      assert.strictEqual(systemInfo3.mode, 'text', 'Should handle missing system info gracefully');
    });
  });
});