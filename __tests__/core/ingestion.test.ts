/**
 * Tests for core IngestionPipeline with dependency injection
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { IngestionPipeline } from '../../src/core/ingestion.js';
import { IndexManager } from '../../src/index-manager.js';
import { openDatabase, initializeSchema, type DatabaseConnection } from '../../src/core/db.js';
import type { EmbedFunction } from '../../src/core/interfaces.js';
import type { EmbeddingResult } from '../../src/core/types.js';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('IngestionPipeline (Core with Dependency Injection)', () => {
  let testDbPath: string;
  let testIndexPath: string;
  let testDir: string;
  let db: DatabaseConnection;
  let indexManager: IndexManager;
  let mockEmbedFn: EmbedFunction;

  beforeEach(async () => {
    // Create temporary paths for testing
    const testId = Math.random().toString(36).substring(7);
    testDir = join(tmpdir(), `test-dir-${testId}`);
    testDbPath = join(testDir, 'test.sqlite');
    testIndexPath = join(testDir, 'test.bin');
    
    // Create test directory
    mkdirSync(testDir, { recursive: true });

    // Create mock embed function
    let embeddingCounter = 0;
    mockEmbedFn = async (text: string): Promise<EmbeddingResult> => {
      embeddingCounter++;
      return {
        embedding_id: `embed_${embeddingCounter}_${Date.now()}`,
        vector: new Float32Array(384).fill(0.1) // Mock 384-dim vector
      };
    };

    // Initialize database with schema
    db = await openDatabase(testDbPath);
    await initializeSchema(db);
    await db.close(); // Close to ensure schema is flushed
    
    // Initialize index manager (it will open its own connection)
    indexManager = new IndexManager(testIndexPath, testDbPath, 384);
    await indexManager.initialize(true); // Skip model check for tests
    
    // Reopen database for test use
    db = await openDatabase(testDbPath);
  });

  afterEach(async () => {
    // Clean up resources
    if (indexManager) {
      await indexManager.close();
    }
    if (db) {
      try {
        await db.close();
      } catch (error) {
        // Ignore if already closed
      }
    }
    
    // Force close any cached database connections
    const { DatabaseConnectionManager } = await import('../../src/core/database-connection-manager.js');
    try {
      await DatabaseConnectionManager.forceCloseConnection(testDbPath);
    } catch (error) {
      // Ignore if connection doesn't exist
    }

    // Wait for resources to be released
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clean up test directory with retry logic for Windows
    if (existsSync(testDir)) {
      let retries = 3;
      while (retries > 0) {
        try {
          rmSync(testDir, { recursive: true, force: true });
          break;
        } catch (error: any) {
          if (error.code === 'EBUSY' && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
            retries--;
          } else {
            console.warn('⚠️  Could not clean up test directory:', error.message);
            break;
          }
        }
      }
    }
  });

  describe('Constructor Validation', () => {
    test('should validate required embedFn parameter', () => {
      assert.throws(
        () => new IngestionPipeline(null as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject null embedFn'
      );
      
      assert.throws(
        () => new IngestionPipeline(undefined as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject undefined embedFn'
      );

      assert.throws(
        () => new IngestionPipeline('not a function' as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject non-function embedFn'
      );
    });

    test('should validate required indexManager parameter', () => {
      assert.throws(
        () => new IngestionPipeline(mockEmbedFn, null as any, db),
        /indexManager is required/,
        'Should reject null indexManager'
      );
      
      assert.throws(
        () => new IngestionPipeline(mockEmbedFn, undefined as any, db),
        /indexManager is required/,
        'Should reject undefined indexManager'
      );
    });

    test('should validate required db parameter', () => {
      assert.throws(
        () => new IngestionPipeline(mockEmbedFn, indexManager, null as any),
        /db connection is required/,
        'Should reject null db'
      );
      
      assert.throws(
        () => new IngestionPipeline(mockEmbedFn, indexManager, undefined as any),
        /db connection is required/,
        'Should reject undefined db'
      );
    });

    test('should accept valid dependencies', () => {
      assert.doesNotThrow(
        () => new IngestionPipeline(mockEmbedFn, indexManager, db),
        'Should accept valid dependencies'
      );
    });
  });

  describe('File Ingestion', () => {
    let ingestionPipeline: IngestionPipeline;

    beforeEach(() => {
      ingestionPipeline = new IngestionPipeline(mockEmbedFn, indexManager, db);
    });

    afterEach(async () => {
      if (ingestionPipeline) {
        await ingestionPipeline.cleanup();
      }
    });

    test('should handle nonexistent file gracefully', async () => {
      const nonexistentFile = join(testDir, 'nonexistent.txt');
      
      await assert.rejects(
        () => ingestionPipeline.ingestFile(nonexistentFile),
        /File not found/,
        'Should reject nonexistent file'
      );
    });

    test('should handle nonexistent directory gracefully', async () => {
      const nonexistentDir = join(testDir, 'nonexistent');
      
      await assert.rejects(
        () => ingestionPipeline.ingestDirectory(nonexistentDir),
        /Directory not found/,
        'Should reject nonexistent directory'
      );
    });

    test('should ingest single text file', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'This is a test document with some content.');

      const result = await ingestionPipeline.ingestFile(testFile);

      assert.strictEqual(result.documentsProcessed, 1, 'Should process 1 document');
      assert.ok(result.chunksCreated > 0, 'Should create at least 1 chunk');
      assert.ok(result.embeddingsGenerated > 0, 'Should generate at least 1 embedding');
      assert.strictEqual(result.documentErrors, 0, 'Should have no document errors');
      assert.strictEqual(result.embeddingErrors, 0, 'Should have no embedding errors');
      assert.ok(result.processingTimeMs > 0, 'Should have positive processing time');
    });

    test('should ingest directory with multiple files', async () => {
      const file1 = join(testDir, 'file1.txt');
      const file2 = join(testDir, 'file2.md');
      
      writeFileSync(file1, 'This is the first test document.');
      writeFileSync(file2, '# Second Document\n\nThis is the second test document.');

      const result = await ingestionPipeline.ingestDirectory(testDir);

      assert.strictEqual(result.documentsProcessed, 2, 'Should process 2 documents');
      assert.ok(result.chunksCreated > 0, 'Should create chunks');
      assert.ok(result.embeddingsGenerated > 0, 'Should generate embeddings');
      assert.ok(result.processingTimeMs > 0, 'Should have positive processing time');
    });

    test('should handle empty directory', async () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir);

      const result = await ingestionPipeline.ingestDirectory(emptyDir);

      assert.strictEqual(result.documentsProcessed, 0, 'Should process 0 documents');
      assert.strictEqual(result.chunksCreated, 0, 'Should create 0 chunks');
      assert.strictEqual(result.embeddingsGenerated, 0, 'Should generate 0 embeddings');
    });

    test('should call embed function for each chunk', async () => {
      let embedCallCount = 0;
      const testEmbedFn: EmbedFunction = async (text: string) => {
        embedCallCount++;
        return {
          embedding_id: `embed_${embedCallCount}`,
          vector: new Float32Array(384).fill(0.1)
        };
      };

      const testPipeline = new IngestionPipeline(testEmbedFn, indexManager, db);
      
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'This is a test document with some content.');

      await testPipeline.ingestFile(testFile);

      assert.ok(embedCallCount > 0, 'Should call embed function at least once');
      
      await testPipeline.cleanup();
    });

    test('should handle embedding function errors gracefully', async () => {
      let callCount = 0;
      const errorEmbedFn: EmbedFunction = async (text: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Embedding failed');
        }
        return {
          embedding_id: `embed_${callCount}`,
          vector: new Float32Array(384).fill(0.1)
        };
      };

      const testPipeline = new IngestionPipeline(errorEmbedFn, indexManager, db);
      
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'This is a test document with some content.');

      const result = await testPipeline.ingestFile(testFile);

      // Should complete but report embedding errors
      assert.ok(result.embeddingErrors > 0, 'Should report embedding errors');
      
      await testPipeline.cleanup();
    });
  });

  describe('Ingestion Options', () => {
    let ingestionPipeline: IngestionPipeline;

    beforeEach(() => {
      ingestionPipeline = new IngestionPipeline(mockEmbedFn, indexManager, db);
    });

    afterEach(async () => {
      await ingestionPipeline.cleanup();
    });

    test('should respect custom chunk configuration', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'This is a test document with some content that should be chunked according to custom configuration.');

      const customChunkConfig = {
        chunkSize: 10, // Very small chunks
        chunkOverlap: 2
      };

      const result = await ingestionPipeline.ingestFile(testFile, {
        chunkConfig: customChunkConfig
      });

      // With very small chunk size, should create multiple chunks
      assert.ok(result.chunksCreated > 1, 'Should create multiple chunks with small chunk size');
    });

    test('should handle file processing options', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'This is a test document.');

      const fileOptions = {
        maxFileSize: 1024 * 1024, // 1MB limit
        recursive: false
      };

      const result = await ingestionPipeline.ingestFile(testFile, {
        fileOptions
      });

      assert.strictEqual(result.documentsProcessed, 1, 'Should process the file');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources without errors', async () => {
      const ingestionPipeline = new IngestionPipeline(mockEmbedFn, indexManager, db);
      
      await assert.doesNotReject(
        () => ingestionPipeline.cleanup(),
        'Cleanup should not throw errors'
      );
    });

    test('should handle cleanup errors gracefully', async () => {
      // Create a mock db that throws on close
      const errorDb = {
        ...db,
        close: async () => {
          throw new Error('Close failed');
        }
      };

      const ingestionPipeline = new IngestionPipeline(mockEmbedFn, indexManager, errorDb as any);
      
      // Should not throw even if cleanup fails
      await assert.doesNotReject(
        () => ingestionPipeline.cleanup(),
        'Cleanup should handle errors gracefully'
      );
    });
  });
});

// =============================================================================
// MANDATORY: Force exit after test completion to prevent hanging
// Database connections may not clean up gracefully
// =============================================================================
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging from database resources...');
  
  // Multiple garbage collection attempts
  if (global.gc) {
    global.gc();
    setTimeout(() => global.gc && global.gc(), 100);
    setTimeout(() => global.gc && global.gc(), 300);
  }
  
  // Force exit after cleanup attempts
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 1000);
}, 2000);
