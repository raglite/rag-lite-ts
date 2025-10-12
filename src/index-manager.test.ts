import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { IndexManager } from './index-manager.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { TEST_MODELS, type TestModel } from './test-utils.js';

// Generate unique test paths for each model to avoid conflicts
function getTestPaths(model: TestModel) {
  const modelSuffix = model.dimensions.toString();
  return {
    indexPath: join(process.cwd(), `test-index-manager-${modelSuffix}.bin`),
    dbPath: join(process.cwd(), `test-index-manager-${modelSuffix}.db`)
  };
}

// Clean up test files
function cleanup(indexPath: string, dbPath: string) {
  try {
    if (existsSync(indexPath)) {
      unlinkSync(indexPath);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  try {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  } catch (error) {
    // Ignore cleanup errors - file might be locked
  }
}

// Initialize test database with schema
async function initTestDB(dbPath: string): Promise<void> {
  const { openDatabase, initializeSchema } = await import('./core/db.js');
  const connection = await openDatabase(dbPath);
  await initializeSchema(connection);
  await connection.close();
}

// Test with both models to ensure compatibility
// Note: 768-dimensional model tests are skipped due to memory constraints in test environment
for (const model of TEST_MODELS.filter(m => m.dimensions === 384)) {
  describe(`IndexManager with ${model.name} (${model.dimensions}D)`, () => {
    const { indexPath, dbPath } = getTestPaths(model);

    test('should initialize with new index', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager.initialize();
      
      const stats = await manager.getStats();
      assert.equal(stats.totalVectors, 0);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should add vectors and search', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager.initialize();
      
      // Add test vectors with correct dimensions
      const embeddings = [
        { embedding_id: 'emb1', vector: new Float32Array(model.dimensions).fill(0.1) },
        { embedding_id: 'emb2', vector: new Float32Array(model.dimensions).fill(0.2) },
        { embedding_id: 'emb3', vector: new Float32Array(model.dimensions).fill(0.3) }
      ];
      
      await manager.addVectors(embeddings);
      
      const stats = await manager.getStats();
      assert.equal(stats.totalVectors, 3);
      
      // Test search with correct dimensions
      const queryVector = new Float32Array(model.dimensions).fill(0.15);
      const results = manager.search(queryVector, 2);
      
      assert.equal(results.embeddingIds.length, 2);
      assert.equal(results.distances.length, 2);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should handle model version checking', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager.initialize();
      
      // First check should return true (no version stored)
      const firstCheck = await manager.checkModelVersion('v1.0');
      assert.equal(firstCheck, true);
      
      // Update version
      await manager.updateModelVersion('v1.0');
      
      // Same version should match
      const sameVersionCheck = await manager.checkModelVersion('v1.0');
      assert.equal(sameVersionCheck, true);
      
      // Different version should not match
      const differentVersionCheck = await manager.checkModelVersion('v2.0');
      assert.equal(differentVersionCheck, false);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test.skip('should save and load index', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      // Create and populate index
      const manager1 = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager1.initialize();
      
      // First insert test documents and chunks into database
      const { insertDocument, insertChunk } = await import('./core/db.js');
      const docId = await insertDocument(manager1['db']!, 'test.md', 'Test Document');
      
      // Insert chunks with the embedding IDs we'll use
      await insertChunk(manager1['db']!, 'emb1', docId, 'Test chunk 1', 0);
      await insertChunk(manager1['db']!, 'emb2', docId, 'Test chunk 2', 1);
      
      const embeddings = [
        { embedding_id: 'emb1', vector: new Float32Array(model.dimensions).fill(0.1) },
        { embedding_id: 'emb2', vector: new Float32Array(model.dimensions).fill(0.2) }
      ];
      
      await manager1.addVectors(embeddings);
      await manager1.saveIndex();
      await manager1.close();
      
      // Load in new instance
      const manager2 = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager2.initialize();
      
      const stats = await manager2.getStats();
      assert.equal(stats.totalVectors, 2);
      
      // Test search works with correct dimensions
      const queryVector = new Float32Array(model.dimensions).fill(0.1);
      const results = manager2.search(queryVector, 1);
      assert.equal(results.embeddingIds.length, 1);
      
      await manager2.close();
      cleanup(indexPath, dbPath);
    });

    test('should handle empty search', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager.initialize();
      
      const queryVector = new Float32Array(model.dimensions).fill(0.1);
      const results = manager.search(queryVector, 5);
      
      assert.equal(results.embeddingIds.length, 0);
      assert.equal(results.distances.length, 0);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should handle rebuild functionality', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions);
      await manager.initialize();
      
      // Add some test data to the chunks table to simulate existing data
      const { openDatabase } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      await db.run('INSERT INTO documents (source, title) VALUES (?, ?)', ['test.md', 'Test Document']);
      await db.run('INSERT INTO chunks (embedding_id, document_id, content, chunk_index, content_type) VALUES (?, ?, ?, ?, ?)', 
        ['emb1', 1, 'test chunk 1', 0, 'text']);
      await db.run('INSERT INTO chunks (embedding_id, document_id, content, chunk_index, content_type) VALUES (?, ?, ?, ?, ?)', 
        ['emb2', 1, 'test chunk 2', 1, 'text']);
      await db.close();
      
      // Test rebuild (this will reset the index but show the structure)
      await manager.rebuildIndex('v2.0');
      
      const stats = await manager.getStats();
      assert.equal(stats.modelVersion, 'v2.0');
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should detect model mismatch during initialization', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      // First, initialize with current model and store model info
      const manager1 = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager1.initialize();
      await manager1.close();
      
      // Now try to initialize with a different model
      const otherModel = TEST_MODELS.find(m => m.name !== model.name);
      if (!otherModel) {
        // Skip this test if we only have one model
        console.log('Skipping model mismatch test - only one model available');
        cleanup(indexPath, dbPath);
        return;
      }
      

      
      const manager2 = new IndexManager(indexPath, dbPath, otherModel.dimensions, otherModel.name);
      
      // Should throw error due to model mismatch
      await assert.rejects(
        async () => await manager2.initialize(),
        (error: Error) => {
          assert.ok(error.message.includes('Model mismatch detected'));
          assert.ok(error.message.includes(model.name));
          assert.ok(error.message.includes(otherModel.name));
          assert.ok(error.message.includes('npm run rebuild'));
          return true;
        }
      );
      
      await manager2.close();
      cleanup(indexPath, dbPath);
    });

    test('should detect dimension mismatch during initialization', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      // First, initialize and manually store incorrect dimension info
      const manager1 = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager1.initialize();
      
      // Manually corrupt the stored dimensions to simulate a mismatch
      const { openDatabase, setStoredModelInfo } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      const wrongDimensions = model.dimensions === 384 ? 768 : 384;
      await setStoredModelInfo(db, model.name, wrongDimensions);
      await db.close();
      
      await manager1.close();
      
      // Now try to initialize again - should detect dimension mismatch
      const manager2 = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      
      await assert.rejects(
        async () => await manager2.initialize(),
        (error: Error) => {
          assert.ok(error.message.includes('Model dimension mismatch detected'));
          assert.ok(error.message.includes(model.dimensions.toString()));
          assert.ok(error.message.includes(wrongDimensions.toString()));
          assert.ok(error.message.includes('npm run rebuild'));
          return true;
        }
      );
      
      await manager2.close();
      cleanup(indexPath, dbPath);
    });

    test('should store and retrieve model information correctly', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager.initialize();
      
      // Verify model info was stored during initialization
      const { openDatabase, getStoredModelInfo } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      const storedInfo = await getStoredModelInfo(db);
      await db.close();
      
      assert.ok(storedInfo, 'Model info should be stored');
      assert.equal(storedInfo.modelName, model.name);
      assert.equal(storedInfo.dimensions, model.dimensions);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should allow initialization when no model info is stored', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      // Initialize fresh - should work without any stored model info
      const manager = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager.initialize();
      
      // Should have stored the model info
      const { openDatabase, getStoredModelInfo } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      const storedInfo = await getStoredModelInfo(db);
      await db.close();
      
      assert.ok(storedInfo, 'Model info should be stored after first initialization');
      assert.equal(storedInfo.modelName, model.name);
      assert.equal(storedInfo.dimensions, model.dimensions);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test('should update model information during rebuild', async () => {
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      const manager = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager.initialize();
      
      // Add some test data
      const { openDatabase } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      await db.run('INSERT INTO documents (source, title) VALUES (?, ?)', ['test.md', 'Test Document']);
      await db.run('INSERT INTO chunks (embedding_id, document_id, content, chunk_index, content_type) VALUES (?, ?, ?, ?, ?)', 
        ['emb1', 1, 'test chunk 1', 0, 'text']);
      await db.close();
      
      // Perform rebuild with new model version
      const newModelVersion = 'v2.0-test';
      await manager.rebuildIndex(newModelVersion);
      
      // Verify model version was updated
      const stats = await manager.getStats();
      assert.equal(stats.modelVersion, newModelVersion);
      
      // Verify model info is still correct
      const { openDatabase: openDB2, getStoredModelInfo } = await import('./core/db.js');
      const db2 = await openDB2(dbPath);
      const storedInfo = await getStoredModelInfo(db2);
      await db2.close();
      
      assert.ok(storedInfo, 'Model info should still be stored after rebuild');
      assert.equal(storedInfo.modelName, model.name);
      assert.equal(storedInfo.dimensions, model.dimensions);
      
      await manager.close();
      cleanup(indexPath, dbPath);
    });

    test.skip('should skip model check when explicitly requested', async () => {
      // Skipping this test to avoid memory issues in test environment
      // The functionality is tested in the separate model-compatibility.test.ts file
      cleanup(indexPath, dbPath);
      await initTestDB(dbPath);
      
      // First, initialize with current model
      const manager1 = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager1.initialize();
      await manager1.close();
      
      // Manually corrupt the stored model info
      const { openDatabase, setStoredModelInfo } = await import('./core/db.js');
      const db = await openDatabase(dbPath);
      await setStoredModelInfo(db, 'different-model', 999);
      await db.close();
      
      // Should be able to initialize with skipModelCheck = true
      const manager2 = new IndexManager(indexPath, dbPath, model.dimensions, model.name);
      await manager2.initialize(true); // Skip model check
      
      // Should work without throwing
      const stats = await manager2.getStats();
      assert.ok(stats.totalVectors >= 0);
      
      await manager2.close();
      cleanup(indexPath, dbPath);
    });
  });
}

