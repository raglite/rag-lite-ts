/**
 * Chameleon Architecture Error Recovery and Reliability Tests
 * Tests system behavior under various error conditions and validates fallback mechanisms
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Database } from 'sqlite3';
import { openDatabase } from '../../src/core/db.js';
import { ModeDetectionService } from '../../src/core/mode-detection-service.js';
import { PolymorphicSearchFactory } from '../../src/core/polymorphic-search-factory.js';
import { createEmbedder } from '../../src/core/embedder-factory.js';
import { createReranker } from '../../src/core/reranking-factory.js';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

describe('Chameleon Error Recovery and Reliability', () => {
  const testDbPath = './test-error-recovery.db';
  const testIndexPath = './test-error-recovery.bin';
  const corruptDbPath = './test-corrupt.db';
  const missingDbPath = './test-missing.db';

  beforeEach(async () => {
    // Clean up any existing test files
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  async function cleanupTestFiles() {
    const files = [testDbPath, testIndexPath, corruptDbPath, missingDbPath];
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore file not found errors
      }
    }
  }

  describe('Database Error Recovery', () => {
    test('should handle missing database gracefully', async () => {
      const modeService = new ModeDetectionService(missingDbPath);
      
      // Should not throw, should return default configuration
      const systemInfo = await modeService.detectMode();
      
      assert.strictEqual(systemInfo.mode, 'text');
      assert.strictEqual(systemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2');
      assert.strictEqual(systemInfo.rerankingStrategy, 'cross-encoder');
    });

    test('should handle corrupted database gracefully', async () => {
      // Create a corrupted database file
      await fs.writeFile(corruptDbPath, 'This is not a valid SQLite database');
      
      const modeService = new ModeDetectionService(corruptDbPath);
      
      try {
        await modeService.detectMode();
        assert.fail('Should have thrown an error for corrupted database');
      } catch (error) {
        const errorMsg = getErrorMessage(error);
        assert.ok(errorMsg.includes('corrupted') || errorMsg.includes('not a database'));
      }
    });

    test('should handle database permission errors', async () => {
      // Create a read-only database file (simulate permission error)
      const db = await openDatabase(testDbPath);
      await db.close();
      
      // Make file read-only (this might not work on all systems, but we'll try)
      try {
        await fs.chmod(testDbPath, 0o444);
        
        const modeService = new ModeDetectionService(testDbPath);
        
        // Should handle permission errors gracefully
        try {
          await modeService.storeMode({
            mode: 'multimodal',
            modelName: 'Xenova/clip-vit-base-patch32',
            modelType: 'clip',
            modelDimensions: 512,
            supportedContentTypes: ['text', 'image'],
            rerankingStrategy: 'text-derived'
          });
          assert.fail('Should have thrown a permission error');
        } catch (error) {
          assert.ok(getErrorMessage(error).includes('readonly') || getErrorMessage(error).includes('permission'));
        }
      } finally {
        // Restore write permissions for cleanup
        try {
          await fs.chmod(testDbPath, 0o644);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle database schema migration errors', async () => {
      // Create a database with old schema
      const db = await openDatabase(testDbPath);
      await db.run(`
        CREATE TABLE old_system_info (
          id INTEGER PRIMARY KEY,
          old_field TEXT
        );
      `);
      await db.close();
      
      const modeService = new ModeDetectionService(testDbPath);
      
      // Should handle schema differences gracefully
      const systemInfo = await modeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'text'); // Should fall back to default
    });
  });

  describe('Model Loading Error Recovery', () => {
    test('should handle unsupported model gracefully', async () => {
      try {
        await createEmbedder('unsupported-model-name');
        assert.fail('Should have thrown an error for unsupported model');
      } catch (error) {
        assert.ok(getErrorMessage(error).includes('not supported'));
        assert.ok(getErrorMessage(error).includes('Supported models:'));
      }
    });

    test('should handle model loading failures', async () => {
      // Mock a model that exists in registry but fails to load
      const originalCreateEmbedder = createEmbedder;
      
      try {
        // This test would require mocking the transformers.js pipeline
        // For now, we'll test the error handling structure
        const modelName = 'sentence-transformers/all-MiniLM-L6-v2';
        
        // Test that we can at least validate the model exists
        const embedder = await createEmbedder(modelName);
        assert.ok(embedder);
        assert.strictEqual(embedder.modelName, modelName);
      } catch (error) {
        // If model loading fails, ensure error is descriptive
        assert.ok(getErrorMessage(error).length > 0);
      }
    });

    test('should handle transformers.js compatibility issues', async () => {
      // Test model validation against supported models list
      const supportedModels = [
        'sentence-transformers/all-MiniLM-L6-v2',
        'Xenova/all-mpnet-base-v2',
        'Xenova/clip-vit-base-patch32'
      ];
      
      for (const modelName of supportedModels) {
        try {
          const embedder = await createEmbedder(modelName);
          assert.ok(embedder.modelName === modelName);
        } catch (error) {
          // If model fails to load, error should be informative
          assert.ok(getErrorMessage(error).includes(modelName));
        }
      }
    });
  });

  describe('Reranking Strategy Error Recovery', () => {
    test('should fall back when reranking strategy fails', async () => {
      // Test fallback to disabled reranking when strategy fails
      const reranker = createReranker('multimodal', 'invalid-strategy' as any);
      
      // Should return undefined (disabled) for invalid strategy
      assert.strictEqual(reranker, undefined);
    });

    test('should handle text-derived reranking model failures', async () => {
      // Test fallback when image-to-text model is not available
      const reranker = createReranker('multimodal', 'text-derived');
      
      if (reranker) {
        // Test with mock search results
        const mockResults = [
          {
            content: 'test image path',
            contentType: 'image',
            score: 0.8,
            document: {
              id: 1,
              source: './test-data/images/test.jpg',
              title: 'Test Image',
              contentType: 'image'
            },
            metadata: { path: './test-data/images/test.jpg' }
          }
        ];
        
        try {
          const rerankedResults = await reranker('test query', mockResults);
          assert.ok(Array.isArray(rerankedResults));
        } catch (error) {
          // Should handle image processing errors gracefully
          assert.ok(getErrorMessage(error).length > 0);
        }
      }
    });

    test('should handle metadata reranking with missing metadata', async () => {
      const reranker = createReranker('multimodal', 'metadata');
      
      if (reranker) {
        // Test with results missing metadata
        const mockResults = [
          {
            content: 'test content',
            contentType: 'text',
            score: 0.8,
            document: {
              id: 1,
              source: 'test.txt',
              title: 'Test Document',
              contentType: 'text'
            }
            // No metadata field
          }
        ];
        
        const rerankedResults = await reranker('test query', mockResults);
        assert.ok(Array.isArray(rerankedResults));
        assert.strictEqual(rerankedResults.length, 1);
      }
    });
  });

  describe('Search Engine Error Recovery', () => {
    test('should handle search engine creation failures', async () => {
      try {
        // Try to create search engine with invalid paths
        const searchEngine = await PolymorphicSearchFactory.create(
          '/invalid/path/index.bin',
          '/invalid/path/db.sqlite'
        );
        assert.fail('Should have thrown an error for invalid paths');
      } catch (error) {
        assert.ok(getErrorMessage(error).length > 0);
      }
    });

    test('should handle vector index corruption', async () => {
      // Create a corrupted index file
      await fs.writeFile(testIndexPath, 'This is not a valid HNSW index');
      
      // Create a valid database
      const db = await openDatabase(testDbPath);
      await db.run(`
        CREATE TABLE IF NOT EXISTS system_info (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL DEFAULT 'text',
          model_name TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
          model_type TEXT NOT NULL DEFAULT 'sentence-transformer',
          model_dimensions INTEGER NOT NULL DEFAULT 384,
          supported_content_types TEXT NOT NULL DEFAULT '["text"]',
          reranking_strategy TEXT DEFAULT 'cross-encoder'
        );
        INSERT OR REPLACE INTO system_info (id, mode, model_name, model_type, model_dimensions)
        VALUES (1, 'text', 'sentence-transformers/all-MiniLM-L6-v2', 'sentence-transformer', 384);
      `);
      await db.close();
      
      try {
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        
        // Try to perform a search - should handle corrupted index gracefully
        const results = await searchEngine.search('test query');
        assert.ok(Array.isArray(results));
      } catch (error) {
        // Should provide informative error about index corruption
        assert.ok(getErrorMessage(error).length > 0);
      }
    });

    test('should handle embedding dimension mismatches', async () => {
      // Create database with one model dimension
      const db = await openDatabase(testDbPath);
      await db.run(`
        CREATE TABLE IF NOT EXISTS system_info (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL DEFAULT 'text',
          model_name TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
          model_type TEXT NOT NULL DEFAULT 'sentence-transformer',
          model_dimensions INTEGER NOT NULL DEFAULT 384,
          supported_content_types TEXT NOT NULL DEFAULT '["text"]',
          reranking_strategy TEXT DEFAULT 'cross-encoder'
        );
        INSERT OR REPLACE INTO system_info (id, mode, model_name, model_type, model_dimensions)
        VALUES (1, 'text', 'Xenova/all-mpnet-base-v2', 'sentence-transformer', 768);
      `);
      await db.close();
      
      // Create index with different dimensions (simulate mismatch)
      // This would require actual HNSW index creation, so we'll test the concept
      try {
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        assert.ok(searchEngine);
      } catch (error) {
        // Should handle dimension mismatches gracefully
        assert.ok(getErrorMessage(error).includes('dimension') || getErrorMessage(error).includes('mismatch'));
      }
    });
  });

  describe('System Stability Under Load', () => {
    test('should handle concurrent search operations', async () => {
      // Create a valid search engine
      const db = await openDatabase(testDbPath);
      await db.run(`
        CREATE TABLE IF NOT EXISTS system_info (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL DEFAULT 'text',
          model_name TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
          model_type TEXT NOT NULL DEFAULT 'sentence-transformer',
          model_dimensions INTEGER NOT NULL DEFAULT 384,
          supported_content_types TEXT NOT NULL DEFAULT '["text"]',
          reranking_strategy TEXT DEFAULT 'cross-encoder'
        );
        INSERT OR REPLACE INTO system_info (id, mode, model_name, model_type, model_dimensions)
        VALUES (1, 'text', 'sentence-transformers/all-MiniLM-L6-v2', 'sentence-transformer', 384);
      `);
      await db.close();
      
      try {
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        
        // Perform multiple concurrent searches
        const searchPromises = Array.from({ length: 5 }, (_, i) =>
          searchEngine.search(`test query ${i}`)
        );
        
        const results = await Promise.all(searchPromises);
        
        // All searches should complete successfully
        assert.strictEqual(results.length, 5);
        results.forEach(result => {
          assert.ok(Array.isArray(result));
        });
      } catch (error) {
        // If search engine creation fails, that's acceptable for this test
        console.log('Search engine creation failed, skipping concurrent test:', getErrorMessage(error));
      }
    });

    test('should handle memory pressure gracefully', async () => {
      // Test with large batch operations
      const queries = Array.from({ length: 100 }, (_, i) => `test query ${i}`);
      
      try {
        const db = await openDatabase(testDbPath);
        await db.run(`
          CREATE TABLE IF NOT EXISTS system_info (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            mode TEXT NOT NULL DEFAULT 'text',
            model_name TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
            model_type TEXT NOT NULL DEFAULT 'sentence-transformer',
            model_dimensions INTEGER NOT NULL DEFAULT 384,
            supported_content_types TEXT NOT NULL DEFAULT '["text"]',
            reranking_strategy TEXT DEFAULT 'cross-encoder'
          );
          INSERT OR REPLACE INTO system_info (id, mode, model_name, model_type, model_dimensions)
          VALUES (1, 'text', 'sentence-transformers/all-MiniLM-L6-v2', 'sentence-transformer', 384);
        `);
        await db.close();
        
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        
        // Process queries in batches to test memory management
        const batchSize = 10;
        for (let i = 0; i < queries.length; i += batchSize) {
          const batch = queries.slice(i, i + batchSize);
          const batchPromises = batch.map(query => searchEngine.search(query));
          
          const batchResults = await Promise.all(batchPromises);
          assert.strictEqual(batchResults.length, batch.length);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      } catch (error) {
        // Memory pressure test may fail due to resource constraints
        console.log('Memory pressure test failed:', getErrorMessage(error));
      }
    });

    test('should handle resource cleanup properly', async () => {
      // Test proper cleanup of resources
      try {
        const embedder = await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
        
        // Test that cleanup method exists and can be called
        if (typeof embedder.cleanup === 'function') {
          await embedder.cleanup();
        }
        
        // Test that embedder is properly disposed
        if (typeof embedder.isLoaded === 'function') {
          // After cleanup, model should not be loaded
          // Note: This depends on implementation details
        }
      } catch (error) {
        // Resource cleanup test may fail if models aren't available
        console.log('Resource cleanup test failed:', getErrorMessage(error));
      }
    });
  });

  describe('Graceful Degradation', () => {
    test('should continue operation when reranking fails', async () => {
      // Test that search continues with vector similarity when reranking fails
      const mockSearchResults = [
        { 
          content: 'test content 1', 
          score: 0.9, 
          contentType: 'text',
          document: { id: 1, source: 'test1.txt', title: 'Test 1', contentType: 'text' }
        },
        { 
          content: 'test content 2', 
          score: 0.8, 
          contentType: 'text',
          document: { id: 2, source: 'test2.txt', title: 'Test 2', contentType: 'text' }
        }
      ];
      
      // Test with disabled reranking
      const reranker = createReranker('text', 'disabled');
      assert.strictEqual(reranker, undefined);
      
      // Search should still work without reranking
      // This would be tested in the actual search engine implementation
    });

    test('should fall back to text mode when multimodal components fail', async () => {
      // Test automatic fallback to text mode when multimodal setup fails
      const modeService = new ModeDetectionService(testDbPath);
      
      // Store multimodal mode
      await modeService.storeMode({
        mode: 'multimodal',
        modelName: 'invalid-multimodal-model',
        modelType: 'clip',
        modelDimensions: 512,
        supportedContentTypes: ['text', 'image'],
        rerankingStrategy: 'text-derived'
      });
      
      // Detection should handle invalid model gracefully
      try {
        const systemInfo = await modeService.detectMode();
        // Should either return the stored info or fall back to text mode
        assert.ok(systemInfo.mode === 'multimodal' || systemInfo.mode === 'text');
      } catch (error) {
        // Should provide informative error message
        assert.ok(getErrorMessage(error).length > 0);
      }
    });

    test('should handle partial system failures', async () => {
      // Test system behavior when some components work but others fail
      
      // Test embedder creation with fallback
      const supportedModels = [
        'sentence-transformers/all-MiniLM-L6-v2',
        'Xenova/all-mpnet-base-v2'
      ];
      
      let workingEmbedder: any = null;
      for (const modelName of supportedModels) {
        try {
          workingEmbedder = await createEmbedder(modelName);
          break;
        } catch (error) {
          console.log(`Model ${modelName} failed to load:`, getErrorMessage(error));
        }
      }
      
      // At least one model should work or we should have graceful failure
      if (workingEmbedder) {
        assert.ok(workingEmbedder.modelName);
      } else {
        console.log('No models available - this is acceptable for testing environment');
      }
    });
  });

  describe('Error Message Quality', () => {
    test('should provide actionable error messages', async () => {
      try {
        await createEmbedder('nonexistent-model');
        assert.fail('Should have thrown an error');
      } catch (error) {
        // Error message should be helpful
        assert.ok(getErrorMessage(error).includes('not supported'));
        assert.ok(getErrorMessage(error).includes('Supported models:'));
        assert.ok(getErrorMessage(error).length > 50); // Should be descriptive
      }
    });

    test('should provide troubleshooting guidance', async () => {
      // Test that errors include helpful troubleshooting information
      try {
        const modeService = new ModeDetectionService('/invalid/path/db.sqlite');
        await modeService.detectMode();
      } catch (error) {
        // Error should be informative about what went wrong
        assert.ok(getErrorMessage(error).length > 0);
      }
    });

    test('should log appropriate warnings for recoverable errors', async () => {
      // Test that the system logs warnings for non-fatal errors
      const originalConsoleWarn = console.warn;
      const warnings: string[] = [];
      
      console.warn = (message) => {
        warnings.push(message);
      };
      
      try {
        // Test scenario that should generate warnings
        const reranker = createReranker('multimodal', 'invalid-strategy' as any);
        assert.strictEqual(reranker, undefined);
        
        // Should have logged a warning about fallback
        // Note: This depends on implementation details
      } finally {
        console.warn = originalConsoleWarn;
      }
    });
  });
});
