/**
 * Tests for Database Schema Testing (Task 1.3)
 * Comprehensive tests for database schema initialization, migrations, and validation
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  openDatabase, 
  initializeSchema, 
  getSystemInfo, 
  setSystemInfo,
  insertDocument,
  insertChunk,
  getChunksByEmbeddingIds,
  getChunksByContentType
} from '../../src/core/db.js';
import type { SystemInfo } from '../../src/types.js';
import { unlink } from 'fs/promises';

describe('Database Schema Testing', () => {
  const testDbPath = './test-database-schema.db';

  // Clean up test database after each test
  async function cleanup() {
    try {
      await unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  test('should initialize database schema with all required tables', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Verify all tables exist
      const tables = await connection.all("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables.map((table: any) => table.name);
      
      assert.ok(tableNames.includes('documents'), 'documents table should exist');
      assert.ok(tableNames.includes('chunks'), 'chunks table should exist');
      assert.ok(tableNames.includes('system_info'), 'system_info table should exist');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should create system_info table with correct schema', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const tableInfo = await connection.all("PRAGMA table_info(system_info)");
      const columns = tableInfo.map((col: any) => ({ name: col.name, type: col.type, notnull: col.notnull }));
      
      // Check for all required columns
      const expectedColumns = [
        'id', 'mode', 'model_name', 'model_type', 'model_dimensions', 'model_version',
        'supported_content_types', 'reranking_strategy', 'reranking_model', 
        'reranking_config', 'created_at', 'updated_at'
      ];
      
      for (const expectedCol of expectedColumns) {
        const found = columns.find(col => col.name === expectedCol);
        assert.ok(found, `Column ${expectedCol} should exist in system_info table`);
      }
      
      // Verify CHECK constraints exist
      const schema = await connection.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='system_info'");
      assert.ok(schema.sql.includes("mode IN ('text', 'multimodal')"), 'mode CHECK constraint should exist');
      assert.ok(schema.sql.includes("model_type IN ('sentence-transformer', 'clip')"), 'model_type CHECK constraint should exist');
      assert.ok(schema.sql.includes("reranking_strategy IN"), 'reranking_strategy CHECK constraint should exist');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should create documents table with content_type and metadata support', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const tableInfo = await connection.all("PRAGMA table_info(documents)");
      const columnNames = tableInfo.map((col: any) => col.name);
      
      // Check for content-aware columns
      assert.ok(columnNames.includes('content_type'), 'content_type column should exist');
      assert.ok(columnNames.includes('metadata'), 'metadata column should exist');
      assert.ok(columnNames.includes('created_at'), 'created_at column should exist');
      assert.ok(columnNames.includes('updated_at'), 'updated_at column should exist');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should create chunks table with content_type and metadata support', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const tableInfo = await connection.all("PRAGMA table_info(chunks)");
      const columnNames = tableInfo.map((col: any) => col.name);
      
      // Check for content-aware columns
      assert.ok(columnNames.includes('content_type'), 'content_type column should exist');
      assert.ok(columnNames.includes('metadata'), 'metadata column should exist');
      assert.ok(columnNames.includes('created_at'), 'created_at column should exist');
      
      // Verify foreign key constraint
      const foreignKeys = await connection.all("PRAGMA foreign_key_list(chunks)");
      const documentFK = foreignKeys.find((fk: any) => fk.table === 'documents');
      assert.ok(documentFK, 'Foreign key to documents table should exist');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should create all required indexes for performance', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const indexes = await connection.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'");
      const indexNames = indexes.map((idx: any) => idx.name);
      
      const expectedIndexes = [
        'idx_chunks_document_id',
        'idx_chunks_embedding_id',
        'idx_documents_source',
        'idx_chunks_content_type',
        'idx_documents_content_type'
      ];
      
      for (const expectedIndex of expectedIndexes) {
        assert.ok(indexNames.includes(expectedIndex), `Index ${expectedIndex} should exist`);
      }
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle system_info table operations correctly', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Test initial state (should be null)
      let systemInfo = await getSystemInfo(connection);
      assert.strictEqual(systemInfo, null, 'Initial system info should be null');
      
      // Test insertion
      const testSystemInfo: Partial<SystemInfo> = {
        mode: 'multimodal',
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip',
        modelDimensions: 512,
        modelVersion: '1.0.0',
        supportedContentTypes: ['text', 'image'],
        rerankingStrategy: 'text-derived'
      };
      
      await setSystemInfo(connection, testSystemInfo);
      
      // Test retrieval
      systemInfo = await getSystemInfo(connection);
      assert.ok(systemInfo, 'System info should be retrieved');
      assert.strictEqual(systemInfo.mode, 'multimodal');
      assert.strictEqual(systemInfo.modelType, 'clip');
      assert.deepStrictEqual(systemInfo.supportedContentTypes, ['text', 'image']);
      
      // Test update
      await setSystemInfo(connection, { mode: 'text', rerankingStrategy: 'cross-encoder' });
      
      systemInfo = await getSystemInfo(connection);
      assert.ok(systemInfo, 'System info should exist after update');
      assert.strictEqual(systemInfo.mode, 'text');
      assert.strictEqual(systemInfo.rerankingStrategy, 'cross-encoder');
      // Other fields should be preserved
      assert.strictEqual(systemInfo.modelName, 'Xenova/clip-vit-base-patch32');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should validate content_type constraints', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Valid content types should work
      const validTypes = ['text', 'image', 'pdf', 'docx'];
      for (const contentType of validTypes) {
        const docId = await insertDocument(connection, `test-${contentType}.file`, `Test ${contentType}`, contentType);
        await insertChunk(connection, `chunk-${contentType}`, docId, `Content for ${contentType}`, 0, contentType);
      }
      
      // Invalid content types should be rejected
      await assert.rejects(
        () => insertDocument(connection, 'invalid.file', 'Invalid', 'invalid-type'),
        /Invalid content type/,
        'Should reject invalid document content type'
      );
      
      const docId = await insertDocument(connection, 'valid.txt', 'Valid', 'text');
      await assert.rejects(
        () => insertChunk(connection, 'invalid-chunk', docId, 'Invalid', 0, 'invalid-type'),
        /Invalid content type/,
        'Should reject invalid chunk content type'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle JSON metadata serialization/deserialization', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Test complex metadata structures
      const complexMetadata = {
        simple: 'string',
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 'two', { three: 3 }],
        nested: {
          deep: {
            object: {
              with: ['multiple', 'levels']
            }
          }
        },
        special: {
          unicode: '🚀 Unicode support',
          quotes: 'String with "quotes" and \'apostrophes\'',
          backslashes: 'Path\\with\\backslashes'
        }
      };
      
      // Test document metadata
      const docId = await insertDocument(connection, 'complex.json', 'Complex Metadata', 'text', complexMetadata);
      
      // Test chunk metadata
      await insertChunk(connection, 'complex-chunk', docId, 'Complex content', 0, 'text', complexMetadata);
      
      // Retrieve and verify
      const chunks = await getChunksByEmbeddingIds(connection, ['complex-chunk']);
      assert.strictEqual(chunks.length, 1);
      assert.deepStrictEqual(chunks[0].metadata, complexMetadata, 'Chunk metadata should be preserved exactly');
      
      // Test system_info JSON fields
      const testRerankingConfig = {
        strategy: 'text-derived' as const,
        enabled: true,
        fallback: 'disabled' as const
      };
      
      await setSystemInfo(connection, {
        supportedContentTypes: ['text', 'image', 'pdf'],
        rerankingConfig: testRerankingConfig
      });
      
      const systemInfo = await getSystemInfo(connection);
      assert.ok(systemInfo, 'System info should exist');
      assert.deepStrictEqual(systemInfo.supportedContentTypes, ['text', 'image', 'pdf']);
      assert.deepStrictEqual(systemInfo.rerankingConfig, testRerankingConfig, 'System info reranking config should be preserved exactly');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should create clean slate database schema', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      // Clean slate approach - initialize fresh schema
      await initializeSchema(connection);
      
      // Verify all tables have the complete schema from the start
      const docTableInfo = await connection.all("PRAGMA table_info(documents)");
      const docColumnNames = docTableInfo.map((col: any) => col.name);
      
      // All columns should be present in the initial schema
      assert.ok(docColumnNames.includes('id'), 'id column should exist');
      assert.ok(docColumnNames.includes('source'), 'source column should exist');
      assert.ok(docColumnNames.includes('title'), 'title column should exist');
      assert.ok(docColumnNames.includes('content_type'), 'content_type column should exist');
      assert.ok(docColumnNames.includes('metadata'), 'metadata column should exist');
      assert.ok(docColumnNames.includes('created_at'), 'created_at column should exist');
      assert.ok(docColumnNames.includes('updated_at'), 'updated_at column should exist');
      
      // Verify system_info has complete schema
      const systemInfoCols = await connection.all("PRAGMA table_info(system_info)");
      const systemInfoColNames = systemInfoCols.map((col: any) => col.name);
      
      const expectedSystemInfoCols = [
        'id', 'mode', 'model_name', 'model_type', 'model_dimensions', 'model_version',
        'supported_content_types', 'reranking_strategy', 'reranking_model', 
        'reranking_config', 'created_at', 'updated_at'
      ];
      
      for (const expectedCol of expectedSystemInfoCols) {
        assert.ok(systemInfoColNames.includes(expectedCol), `${expectedCol} column should exist in system_info`);
      }
      
      // Test that we can immediately use all new features
      const testSystemInfo = {
        mode: 'multimodal' as const,
        modelName: 'Xenova/clip-vit-base-patch32',
        modelType: 'clip' as const,
        modelDimensions: 512,
        supportedContentTypes: ['text', 'image'],
        rerankingStrategy: 'text-derived' as const
      };
      
      await setSystemInfo(connection, testSystemInfo);
      
      const docId = await insertDocument(connection, 'test.jpg', 'Test Image', 'image', { 
        dimensions: { width: 1920, height: 1080 } 
      });
      
      await insertChunk(connection, 'image-chunk', docId, 'Image description', 0, 'image', {
        originalPath: '/path/to/image.jpg'
      });
      
      // Verify everything works with the clean slate schema
      const retrievedSystemInfo = await getSystemInfo(connection);
      assert.ok(retrievedSystemInfo);
      assert.strictEqual(retrievedSystemInfo.mode, 'multimodal');
      
      const imageChunks = await getChunksByContentType(connection, 'image');
      assert.strictEqual(imageChunks.length, 1);
      assert.strictEqual(imageChunks[0].content_type, 'image');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should enforce foreign key constraints', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Try to insert chunk with non-existent document ID
      await assert.rejects(
        () => insertChunk(connection, 'orphan-chunk', 999, 'Orphan content', 0, 'text'),
        /Document with ID 999 does not exist/,
        'Should reject chunk with invalid document ID'
      );
      
      // Create document and chunk
      const docId = await insertDocument(connection, 'test.txt', 'Test Document', 'text');
      await insertChunk(connection, 'test-chunk', docId, 'Test content', 0, 'text');
      
      // Verify cascade delete works
      await connection.run('DELETE FROM documents WHERE id = ?', [docId]);
      
      const chunks = await getChunksByEmbeddingIds(connection, ['test-chunk']);
      assert.strictEqual(chunks.length, 0, 'Chunks should be deleted when parent document is deleted');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle concurrent schema operations safely', async () => {
    await cleanup();
    
    // Test that multiple schema initializations don't conflict
    const connection1 = await openDatabase(testDbPath);
    const connection2 = await openDatabase(testDbPath);
    
    try {
      // Initialize schema from both connections simultaneously
      await Promise.all([
        initializeSchema(connection1),
        initializeSchema(connection2)
      ]);
      
      // Both should succeed without errors
      const tables1 = await connection1.all("SELECT name FROM sqlite_master WHERE type='table'");
      const tables2 = await connection2.all("SELECT name FROM sqlite_master WHERE type='table'");
      
      assert.strictEqual(tables1.length, tables2.length, 'Both connections should see the same tables');
      
      // Test that we can insert data from both connections
      const docId1 = await insertDocument(connection1, 'doc1.txt', 'Document 1', 'text');
      const docId2 = await insertDocument(connection2, 'doc2.txt', 'Document 2', 'text');
      
      assert.ok(docId1 > 0 && docId2 > 0, 'Both connections should be able to insert documents');
      assert.notStrictEqual(docId1, docId2, 'Documents should have different IDs');
    } finally {
      await connection1.close();
      await connection2.close();
      await cleanup();
    }
  });
});
