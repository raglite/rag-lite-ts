import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, unlinkSync } from 'fs';
import { IndexManager } from './index-manager.js';
import { openDatabase, initializeSchema, insertDocument, insertChunk, setStoredModelInfo, getStoredModelInfo } from './db.js';
import { getModelDefaults } from './config.js';

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

describe('Model Switching Integration Test', () => {
  test('complete model switching workflow', async () => {
    const testDbPath = 'test-model-switching-integration.sqlite';
    const testIndexPath = 'test-model-switching-integration.bin';
    cleanup(testDbPath, testIndexPath);
    
    try {
      // === STEP 1: Start with original model and create index ===
      console.log('Step 1: Setting up with original model...');
      
      const originalModel = 'sentence-transformers/all-MiniLM-L6-v2';
      const originalDefaults = getModelDefaults(originalModel);
      
      // Initialize database and store model info
      let db = await openDatabase(testDbPath);
      await initializeSchema(db);
      await setStoredModelInfo(db, originalModel, originalDefaults.dimensions);
      
      // Add test data
      const docId = await insertDocument(db, 'test-doc.txt', 'Test Document');
      await insertChunk(db, 'chunk-1', docId, 'This is test content for the original model', 0);
      
      await db.close();
      
      // Create and initialize IndexManager with original model
      const originalIndexManager = new IndexManager(testIndexPath, testDbPath, originalDefaults.dimensions);
      
      // Mock the config to use original model
      const configModule = await import('./config.js');
      const actualEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = originalModel;
      
      try {
        await originalIndexManager.initialize();
        console.log('✓ Original model setup successful');
        await originalIndexManager.close();
      } finally {
        (configModule.config as any).embedding_model = actualEmbeddingModel;
      }
      
      // === STEP 2: Change to different model and verify error ===
      console.log('Step 2: Switching to new model...');
      
      const newModel = 'Xenova/all-mpnet-base-v2';
      const newDefaults = getModelDefaults(newModel);
      
      // Try to initialize with new model (should fail)
      const newIndexManager = new IndexManager(testIndexPath, testDbPath, newDefaults.dimensions);
      
      // Mock config to use new model
      (configModule.config as any).embedding_model = newModel;
      
      let errorThrown = false;
      let errorMessage = '';
      
      try {
        await newIndexManager.initialize();
      } catch (error) {
        errorThrown = true;
        errorMessage = error instanceof Error ? error.message : String(error);
      } finally {
        (configModule.config as any).embedding_model = actualEmbeddingModel;
      }
      
      // Verify error was thrown with correct message
      assert.ok(errorThrown, 'Expected model mismatch error was not thrown');
      assert.match(errorMessage, /Model mismatch detected!/, 'Error should mention model mismatch');
      assert.ok(errorMessage.includes(`Current model: ${newModel}`), 'Error should show current model');
      assert.ok(errorMessage.includes(`Index model: ${originalModel}`), 'Error should show stored model');
      assert.ok(errorMessage.includes('npm run rebuild'), 'Error should suggest rebuild');
      
      console.log('✓ Model mismatch detected correctly');
      
      // === STEP 3: Perform rebuild with new model ===
      console.log('Step 3: Rebuilding with new model...');
      
      // Mock config for rebuild
      (configModule.config as any).embedding_model = newModel;
      
      try {
        // Create mock embedding engine
        const mockEmbeddingEngine = {
          embedDocumentBatch: async (texts: string[]) => {
            return texts.map((text, index) => ({
              embedding_id: `chunk-${index + 1}`,
              vector: new Float32Array(newDefaults.dimensions).fill(0.1) // Mock vector with correct dimensions
            }));
          },
          getModelVersion: () => `${newModel}-v1.0`
        };
        
        // For rebuild, we need to bypass the model compatibility check
        // This simulates what the CLI rebuild command would do
        
        // Manually open database connection for rebuild
        const rebuildDb = await openDatabase(testDbPath);
        (newIndexManager as any).db = rebuildDb;
        (newIndexManager as any).isInitialized = true; // Set initialized flag
        
        // Perform rebuild
        await newIndexManager.rebuildWithEmbeddings(mockEmbeddingEngine);
        
        // Close the manual connection
        await rebuildDb.close();
        (newIndexManager as any).db = null;
        (newIndexManager as any).isInitialized = false;
        console.log('✓ Rebuild completed successfully');
        
        // === STEP 4: Verify system works with new model ===
        console.log('Step 4: Verifying new model works...');
        
        // Initialize should now work
        await newIndexManager.initialize();
        
        // Verify stats
        const stats = await newIndexManager.getStats();
        assert.strictEqual(stats.totalVectors, 1, 'Should have 1 vector after rebuild');
        assert.strictEqual(stats.modelVersion, `${newModel}-v1.0`, 'Model version should be updated');
        
        // Verify model info was updated in database
        db = await openDatabase(testDbPath);
        const storedInfo = await getStoredModelInfo(db);
        await db.close();
        
        assert.ok(storedInfo !== null, 'Stored model info should exist');
        assert.strictEqual(storedInfo!.modelName, newModel, 'Model name should be updated');
        assert.strictEqual(storedInfo!.dimensions, newDefaults.dimensions, 'Dimensions should be updated');
        
        console.log('✓ New model verification successful');
        
        // === STEP 5: Verify subsequent operations work normally ===
        console.log('Step 5: Verifying normal operations...');
        
        // Close and reinitialize to simulate restart
        await newIndexManager.close();
        
        const finalIndexManager = new IndexManager(testIndexPath, testDbPath, newDefaults.dimensions);
        await finalIndexManager.initialize(); // Should work without error
        
        const finalStats = await finalIndexManager.getStats();
        assert.strictEqual(finalStats.totalVectors, 1, 'Should maintain vector count');
        assert.strictEqual(finalStats.modelVersion, `${newModel}-v1.0`, 'Should maintain model version');
        
        await finalIndexManager.close();
        console.log('✓ Normal operations verified');
        
        console.log('🎉 Complete model switching workflow successful!');
        
      } finally {
        (configModule.config as any).embedding_model = actualEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });
  
  test('should show clear error messages for different mismatch scenarios', async () => {
    const testDbPath = 'test-error-messages.sqlite';
    const testIndexPath = 'test-error-messages.bin';
    cleanup(testDbPath, testIndexPath);
    
    try {
      // Test 1: Model name mismatch
      let db = await openDatabase(testDbPath);
      await initializeSchema(db);
      
      const originalModel = 'sentence-transformers/all-MiniLM-L6-v2';
      const newModel = 'Xenova/all-mpnet-base-v2';
      
      await setStoredModelInfo(db, originalModel, 384);
      await db.close();
      
      const indexManager = new IndexManager(testIndexPath, testDbPath, 768);
      
      // Mock config
      const configModule = await import('./config.js');
      const actualEmbeddingModel = configModule.config.embedding_model;
      (configModule.config as any).embedding_model = newModel;
      
      try {
        let errorMessage = '';
        try {
          await indexManager.initialize();
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        
        // Verify comprehensive error message
        assert.ok(errorMessage.includes('Model mismatch detected!'), 'Should detect model mismatch');
        assert.ok(errorMessage.includes(`Current model: ${newModel}`), 'Should show current model');
        assert.ok(errorMessage.includes(`Index model: ${originalModel}`), 'Should show stored model');
        assert.ok(errorMessage.includes('768 dimensions'), 'Should show current dimensions');
        assert.ok(errorMessage.includes('384 dimensions'), 'Should show stored dimensions');
        assert.ok(errorMessage.includes('embedding model has changed'), 'Should explain the issue');
        assert.ok(errorMessage.includes('full index rebuild'), 'Should mention rebuild requirement');
        assert.ok(errorMessage.includes('maintain consistency'), 'Should explain why rebuild is needed');
        assert.ok(errorMessage.includes('npm run rebuild'), 'Should provide npm command');
        assert.ok(errorMessage.includes('node dist/cli.js rebuild'), 'Should provide CLI command');
        
        console.log('✓ Model mismatch error message is comprehensive and helpful');
        
      } finally {
        (configModule.config as any).embedding_model = actualEmbeddingModel;
      }
      
    } finally {
      cleanup(testDbPath, testIndexPath);
    }
  });
});