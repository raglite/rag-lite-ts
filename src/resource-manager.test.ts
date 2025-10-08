import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ResourceManager } from './resource-manager.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('ResourceManager', () => {
  const testBasePath = './test-resource-manager';
  const testDbPath = join(testBasePath, 'db.sqlite');
  const testIndexPath = join(testBasePath, 'vector-index.bin');

  beforeEach(async () => {
    // Clean up any existing instances
    await ResourceManager.cleanupAll();
  });

  afterEach(async () => {
    // Clean up test files and instances
    await ResourceManager.cleanupAll();
    
    try {
      if (existsSync(testDbPath)) {
        unlinkSync(testDbPath);
      }
      if (existsSync(testIndexPath)) {
        unlinkSync(testIndexPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should create singleton instances based on configuration', () => {
    const config1 = { basePath: testBasePath };
    const config2 = { basePath: testBasePath };
    const config3 = { basePath: './different-path' };

    const manager1 = ResourceManager.getInstance(config1);
    const manager2 = ResourceManager.getInstance(config2);
    const manager3 = ResourceManager.getInstance(config3);

    // Same configuration should return same instance
    assert.strictEqual(manager1, manager2);
    
    // Different configuration should return different instance
    assert.notStrictEqual(manager1, manager3);
  });

  test('should track active instances', () => {
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 0);

    const manager1 = ResourceManager.getInstance({ basePath: testBasePath });
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 1);

    const manager2 = ResourceManager.getInstance({ basePath: './different-path' });
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 2);

    // Same config should not increase count
    const manager3 = ResourceManager.getInstance({ basePath: testBasePath });
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 2);
    assert.strictEqual(manager1, manager3);
  });

  test('should check if instance exists for configuration', () => {
    const config = { basePath: testBasePath };
    
    assert.strictEqual(ResourceManager.hasInstance(config), false);
    
    ResourceManager.getInstance(config);
    assert.strictEqual(ResourceManager.hasInstance(config), true);
  });

  test('should validate search files and throw appropriate errors', async () => {
    const manager = ResourceManager.getInstance({ basePath: testBasePath });

    // Should throw error for missing files
    await assert.rejects(manager.validateSearchFiles());
  });

  test('should handle cleanup gracefully', async () => {
    const manager = ResourceManager.getInstance({ basePath: testBasePath });
    
    // Should not throw even if resources are not initialized
    await assert.doesNotReject(manager.cleanup());
    
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 0);
  });

  test('should cleanup all instances', async () => {
    ResourceManager.getInstance({ basePath: testBasePath });
    ResourceManager.getInstance({ basePath: './path1' });
    ResourceManager.getInstance({ basePath: './path2' });
    
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 3);
    
    await ResourceManager.cleanupAll();
    assert.strictEqual(ResourceManager.getActiveInstanceCount(), 0);
  });

  test('should resolve configuration with defaults', () => {
    const manager1 = ResourceManager.getInstance({});
    const manager2 = ResourceManager.getInstance({ basePath: testBasePath });
    const manager3 = ResourceManager.getInstance({ 
      basePath: testBasePath,
      modelName: 'custom-model',
      batchSize: 32
    });

    // Each should create different instances due to different resolved configs
    assert.notStrictEqual(manager1, manager2);
    assert.notStrictEqual(manager2, manager3);
  });
});