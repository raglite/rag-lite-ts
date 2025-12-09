/**
 * Tests for Enhanced System Info Table Implementation
 * Tests the new system_info table schema and functions
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { openDatabase, initializeSchema, getSystemInfo, setSystemInfo } from '../../src/core/db.js';
import type { SystemInfo } from '../../src/types.js';
import { unlink } from 'fs/promises';

describe('Enhanced System Info Table', () => {
  const testDbPath = './test-system-info.db';

  // Clean up test database after each test
  async function cleanup() {
    try {
      await unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  test('should create system_info table with new schema', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Verify table exists with correct columns
      const tableInfo = await connection.all("PRAGMA table_info(system_info)");
      const columnNames = tableInfo.map((col: any) => col.name);
      
      // Check for new columns
      assert.ok(columnNames.includes('mode'), 'mode column should exist');
      assert.ok(columnNames.includes('model_type'), 'model_type column should exist');
      assert.ok(columnNames.includes('supported_content_types'), 'supported_content_types column should exist');
      assert.ok(columnNames.includes('reranking_strategy'), 'reranking_strategy column should exist');
      assert.ok(columnNames.includes('reranking_model'), 'reranking_model column should exist');
      assert.ok(columnNames.includes('reranking_config'), 'reranking_config column should exist');
      assert.ok(columnNames.includes('created_at'), 'created_at column should exist');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should return null when no system info exists', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const systemInfo = await getSystemInfo(connection);
      assert.strictEqual(systemInfo, null, 'should return null for empty table');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should store and retrieve complete system info', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const testSystemInfo: Partial<SystemInfo> = {
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip',
        modelDimensions: 512,
        modelVersion: '1.0.0',
        supportedContentTypes: ['text', 'image'],
        rerankingStrategy: 'text-derived',
        rerankingModel: 'cross-encoder-model',
        rerankingConfig: {
          strategy: 'text-derived',
          enabled: true,
          fallback: 'disabled'
        }
      };
      
      await setSystemInfo(connection, testSystemInfo);
      
      const retrieved = await getSystemInfo(connection);
      assert.ok(retrieved, 'should retrieve system info');
      assert.strictEqual(retrieved.mode, 'multimodal');
      assert.strictEqual(retrieved.modelName, 'Xenova/clip-vit-base-patch32');
      assert.strictEqual(retrieved.modelType, 'clip');
      assert.strictEqual(retrieved.modelDimensions, 512);
      assert.strictEqual(retrieved.modelVersion, '1.0.0');
      assert.deepStrictEqual(retrieved.supportedContentTypes, ['text', 'image']);
      assert.strictEqual(retrieved.rerankingStrategy, 'text-derived');
      assert.strictEqual(retrieved.rerankingModel, 'cross-encoder-model');
      assert.deepStrictEqual(retrieved.rerankingConfig, {
        strategy: 'text-derived',
        enabled: true,
        fallback: 'disabled'
      });
      assert.ok(retrieved.createdAt instanceof Date);
      assert.ok(retrieved.updatedAt instanceof Date);
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should validate mode enum values', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      await assert.rejects(
        () => setSystemInfo(connection, { mode: 'invalid' as any }),
        /Invalid mode 'invalid'/,
        'should reject invalid mode'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should validate model type enum values', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      await assert.rejects(
        () => setSystemInfo(connection, { modelType: 'invalid' as any }),
        /Invalid model type 'invalid'/,
        'should reject invalid model type'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should validate reranking strategy enum values', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      await assert.rejects(
        () => setSystemInfo(connection, { rerankingStrategy: 'invalid' as any }),
        /Invalid reranking strategy 'invalid'/,
        'should reject invalid reranking strategy'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should update existing system info partially', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Insert initial data
      await setSystemInfo(connection, {
        mode: 'text',
        modelName: 'sentence-transformers/all-MiniLM-L6-v2',
        modelType: 'sentence-transformer',
        modelDimensions: 384
      });
      
      // Update only specific fields
      await setSystemInfo(connection, {
        mode: 'multimodal',
        rerankingStrategy: 'text-derived'
      });
      
      const retrieved = await getSystemInfo(connection);
      assert.ok(retrieved, 'should retrieve updated system info');
      assert.strictEqual(retrieved.mode, 'multimodal', 'mode should be updated');
      assert.strictEqual(retrieved.rerankingStrategy, 'text-derived', 'reranking strategy should be updated');
      assert.strictEqual(retrieved.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'model name should be preserved');
      assert.strictEqual(retrieved.modelDimensions, 384, 'model dimensions should be preserved');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle JSON serialization for complex fields', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const complexConfig = {
        strategy: 'text-derived' as const,
        enabled: true,
        fallback: 'disabled' as const
      };
      
      await setSystemInfo(connection, {
        supportedContentTypes: ['text', 'image', 'pdf'],
        rerankingConfig: complexConfig
      });
      
      const retrieved = await getSystemInfo(connection);
      assert.ok(retrieved, 'should retrieve system info');
      assert.deepStrictEqual(retrieved.supportedContentTypes, ['text', 'image', 'pdf']);
      assert.deepStrictEqual(retrieved.rerankingConfig, complexConfig);
    } finally {
      await connection.close();
      await cleanup();
    }
  });
});
