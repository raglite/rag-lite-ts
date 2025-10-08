import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, unlinkSync } from 'fs';
import { IndexManager } from './index-manager.js';
import { openDatabase, initializeSchema, insertDocument, insertChunk, setStoredModelInfo } from './db.js';
import { getModelDefaults } from './config.js';
import type { DatabaseConnection } from './db.js';

// Helper function to clean up test files
function cleanup(testDbPath: string, testIndexPath: string) {
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
}

describe('Model Switching Scenario', () => {

  test('should detect model mismatch and show clear error message', async () => {
    const testDbPath = 'test-model-switching-1.sqlite';
    const testIndexPath = 'test-model-switching-1.bin';
    cleanup(testDbPath, testIndexPath);
    
    // Initialize fresh database
    const db = await openDatabase(testDbPath);
    await initializeSchema(db);
    
    try {
      // Step 1: Start with one model and create an index
      const originalModel = 'sentence-transformers/all-MiniLM-L6-v2';
      const originalDefaults = getModelDefaults(originalModel);
      
      // Store the original model info in database
      await setStoredModelInfo(db, originalModel, originalDefaults.dimensions);
      
      // Add some test data to simulate an existing index
      const docId = await insertDocument(db, 'test-doc.txt', 'Test Document');
      await insertChunk(db, 'chunk-1', docId, 'This is test content', 0);
      
      // Close the database connection to simulate a fresh start
      await db.close();
      
      // Step 2: Simulate different model by creating IndexManager with different dimensions
      // This simulates what would happen if the user changed their config to use a different model
      const newModel = 'Xenova/all-mpnet-base-v2';
      const newDefaults = getModelDefaults(newModel);
      
      // Step 3: Try to initialize IndexManager with new model dimensions
      // We'll create a custom IndexManager that simulates the new model config
      const indexManager = new IndexManager(testIndexPath, testDbPath, newDefaults.dimensions);
      
      // Mock the config.embedding_model to simulate the change
      const originalConfig = (await import('./config.js')).config;
      const mockConfig = { ...originalConfig, embedding_model: newModel };
      
      // Replace the config temporarily for this test
      const configModule = await import('./config.js');
      const originalEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = newModel;
      
      try {
        // This should throw an error about model mismatch
        let errorThrown = false;
        let errorMessage = '';
        
        try {
          await indexManager.initialize();
        } catch (error) {
          errorThrown = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        
        // Verify error was thrown
        assert.ok(errorThrown, 'Expected model mismatch error was not thrown');
        assert.match(errorMessage, /Model mismatch detected!/, 'Error should mention model mismatch');
        
        // Verify error message contains current model info
        assert.ok(errorMessage.includes(`Current model: ${newModel}`), 'Error should show current model');
        assert.ok(errorMessage.includes(`${newDefaults.dimensions} dimensions`), 'Error should show current dimensions');
        
        // Verify error message contains stored model info
        assert.ok(errorMessage.includes(`Index model: ${originalModel}`), 'Error should show stored model');
        assert.ok(errorMessage.includes(`${originalDefaults.dimensions} dimensions`), 'Error should show stored dimensions');
        
        // Verify error message suggests rebuild
        assert.ok(errorMessage.includes('npm run rebuild'), 'Error should suggest npm run rebuild');
        assert.ok(errorMessage.includes('node dist/cli.js rebuild'), 'Error should suggest CLI rebuild');
        
        // Verify error explains the issue clearly
        assert.ok(errorMessage.includes('embedding model has changed'), 'Error should explain model change');
        assert.ok(errorMessage.includes('full index rebuild'), 'Error should mention full rebuild');
        assert.ok(errorMessage.includes('maintain consistency'), 'Error should mention consistency');
        
      } finally {
        // Restore original config
        (configModule.config as any).embedding_model = originalEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });

  test('should allow rebuild with new model after mismatch', async () => {
    const testDbPath = 'test-model-switching-2.sqlite';
    const testIndexPath = 'test-model-switching-2.bin';
    cleanup(testDbPath, testIndexPath);
    
    // Initialize fresh database
    let db = await openDatabase(testDbPath);
    await initializeSchema(db);
    
    try {
      // Step 1: Start with original model
      const originalModel = 'sentence-transformers/all-MiniLM-L6-v2';
      const originalDefaults = getModelDefaults(originalModel);
      
      // Store the original model info
      await setStoredModelInfo(db, originalModel, originalDefaults.dimensions);
      
      // Add test data
      const docId = await insertDocument(db, 'test-doc.txt', 'Test Document');
      await insertChunk(db, 'chunk-1', docId, 'This is test content', 0);
      
      await db.close();
      
      // Step 2: Switch to new model
      const newModel = 'Xenova/all-mpnet-base-v2';
      const newDefaults = getModelDefaults(newModel);
      
      // Step 3: Verify mismatch is detected
      const indexManager = new IndexManager(testIndexPath, testDbPath, newDefaults.dimensions);
      
      // Mock the config to simulate model change
      const configModule = await import('./config.js');
      const originalEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = newModel;
      
      try {
        let errorThrown = false;
        try {
          await indexManager.initialize();
        } catch (error) {
          errorThrown = true;
          assert.match(error instanceof Error ? error.message : String(error), /Model mismatch detected!/);
        }
        assert.ok(errorThrown, 'Expected model mismatch error');
        
        // Step 4: Simulate rebuild process
        // Create a mock embedding engine for testing
        const mockEmbeddingEngine = {
          embedDocumentBatch: async (texts: string[]) => {
            return texts.map((text, index) => ({
              embedding_id: `chunk-${index + 1}`,
              vector: new Float32Array(newDefaults.dimensions).fill(0.1) // Mock 768-dim vector
            }));
          },
          getModelVersion: () => `${newModel}-v1.0`
        };
        
        // For rebuild, we need to manually set up the database connection
        // This simulates what the CLI rebuild command would do
        const rebuildDb = await openDatabase(testDbPath);
        (indexManager as any).db = rebuildDb;
        (indexManager as any).isInitialized = true;
        
        // Run rebuild with embeddings
        await indexManager.rebuildWithEmbeddings(mockEmbeddingEngine);
        
        // Clean up the manual connection
        await rebuildDb.close();
        (indexManager as any).db = null;
        (indexManager as any).isInitialized = false;
        
        // Step 5: Verify system works with new model after rebuild
        await indexManager.initialize();
        
        // Verify the index manager is properly initialized
        const stats = await indexManager.getStats();
        assert.strictEqual(stats.totalVectors, 1, 'Should have 1 vector from test chunk');
        assert.strictEqual(stats.modelVersion, `${newModel}-v1.0`, 'Model version should be updated');
        
        // Verify model info was updated in database
        const updatedDb = await openDatabase(testDbPath);
        const { getStoredModelInfo } = await import('./db.js');
        const storedInfo = await getStoredModelInfo(updatedDb);
        
        assert.ok(storedInfo !== null, 'Stored model info should exist');
        assert.strictEqual(storedInfo!.modelName, newModel, 'Model name should be updated');
        assert.strictEqual(storedInfo!.dimensions, newDefaults.dimensions, 'Dimensions should be updated');
        
        await updatedDb.close();
        await indexManager.close();
        
      } finally {
        // Restore original environment
        if (originalEmbeddingModel) {
          process.env.RAG_EMBEDDING_MODEL = originalEmbeddingModel;
        } else {
          delete process.env.RAG_EMBEDDING_MODEL;
        }
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });

  test('should work normally when model matches stored model', async () => {
    const testDbPath = 'test-model-switching-3.sqlite';
    const testIndexPath = 'test-model-switching-3.bin';
    cleanup(testDbPath, testIndexPath);
    
    // Initialize fresh database
    const db = await openDatabase(testDbPath);
    await initializeSchema(db);
    
    try {
      // Step 1: Set up with consistent model
      const model = 'sentence-transformers/all-MiniLM-L6-v2';
      const modelDefaults = getModelDefaults(model);
      
      // Store model info
      await setStoredModelInfo(db, model, modelDefaults.dimensions);
      
      // Add test data
      const docId = await insertDocument(db, 'test-doc.txt', 'Test Document');
      await insertChunk(db, 'chunk-1', docId, 'This is test content', 0);
      
      await db.close();
      
      // Step 2: Initialize with same model (should work without error)
      const configModule = await import('./config.js');
      const originalEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = model;
      
      try {
        const indexManager = new IndexManager(testIndexPath, testDbPath, modelDefaults.dimensions);
        
        // This should NOT throw an error
        let errorThrown = false;
        try {
          await indexManager.initialize();
        } catch (error) {
          errorThrown = true;
          console.error('Unexpected error:', error);
        }
        assert.ok(!errorThrown, 'Should not throw error when models match');
        
        // Verify system works normally
        const stats = await indexManager.getStats();
        assert.strictEqual(stats.totalVectors, 0, 'No vectors in index yet (just database chunks)');
        
        await indexManager.close();
        
      } finally {
        // Restore original config
        (configModule.config as any).embedding_model = originalEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });

  test('should handle first run with no stored model info', async () => {
    const testDbPath = 'test-model-switching-4.sqlite';
    const testIndexPath = 'test-model-switching-4.bin';
    cleanup(testDbPath, testIndexPath);
    
    // Initialize fresh database
    const db = await openDatabase(testDbPath);
    await initializeSchema(db);
    
    try {
      // Step 1: Fresh database with no model info stored
      const model = 'Xenova/all-mpnet-base-v2';
      const modelDefaults = getModelDefaults(model);
      
      // Don't store any model info - simulate first run
      await db.close();
      
      // Step 2: Initialize IndexManager (should work on first run)
      const configModule = await import('./config.js');
      const originalEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = model;
      
      try {
        const indexManager = new IndexManager(testIndexPath, testDbPath, modelDefaults.dimensions);
        
        // Should work without error on first run
        let errorThrown = false;
        try {
          await indexManager.initialize();
        } catch (error) {
          errorThrown = true;
          console.error('Unexpected error on first run:', error);
        }
        assert.ok(!errorThrown, 'Should not throw error on first run');
        
        // Verify it works normally
        const stats = await indexManager.getStats();
        assert.strictEqual(stats.totalVectors, 0, 'Should start with 0 vectors');
        
        await indexManager.close();
        
      } finally {
        // Restore original config
        (configModule.config as any).embedding_model = originalEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });

  test('should detect dimension mismatch as additional safety check', async () => {
    const testDbPath = 'test-model-switching-5.sqlite';
    const testIndexPath = 'test-model-switching-5.bin';
    cleanup(testDbPath, testIndexPath);
    
    // Initialize fresh database
    const db = await openDatabase(testDbPath);
    await initializeSchema(db);
    
    try {
      // Step 1: Store model info with wrong dimensions (simulate corruption)
      // Use same model name but wrong dimensions to test dimension check specifically
      const model = 'sentence-transformers/all-MiniLM-L6-v2';
      const wrongDimensions = 768; // Should be 384 for this model
      
      await setStoredModelInfo(db, model, wrongDimensions);
      await db.close();
      
      // Step 2: Try to initialize with correct model config
      const correctDefaults = getModelDefaults(model);
      
      const configModule = await import('./config.js');
      const originalEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = model;
      
      try {
        const indexManager = new IndexManager(testIndexPath, testDbPath, correctDefaults.dimensions);
        
        // Should throw dimension mismatch error
        let errorThrown = false;
        let errorMessage = '';
        
        try {
          await indexManager.initialize();
        } catch (error) {
          errorThrown = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        
        assert.ok(errorThrown, 'Expected dimension mismatch error was not thrown');
        // The system should detect dimension mismatch since model names match but dimensions don't
        assert.match(errorMessage, /Model dimension mismatch detected!/, 'Should detect dimension mismatch');
        
        assert.ok(errorMessage.includes(`Current model dimensions: ${correctDefaults.dimensions}`), 'Should show current dimensions');
        assert.ok(errorMessage.includes(`Index model dimensions: ${wrongDimensions}`), 'Should show stored dimensions');
        assert.ok(errorMessage.includes('configuration inconsistency'), 'Should mention inconsistency');
        assert.ok(errorMessage.includes('npm run rebuild'), 'Should suggest rebuild');
        
      } finally {
        // Restore original config
        (configModule.config as any).embedding_model = originalEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });
});