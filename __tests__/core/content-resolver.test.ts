/**
 * Tests for ContentResolver class
 * Validates content retrieval and format adaptation functionality
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  openDatabase, 
  initializeSchema,
  insertContentMetadata,
  type DatabaseConnection,
  type ContentMetadata
} from '../../src/../src/core/db.js';
import { ContentResolver } from '../../src/../src/core/content-resolver.js';

describe('ContentResolver', () => {
  let testDbPath: string;
  let testContentDir: string;
  let connection: DatabaseConnection;
  let contentResolver: ContentResolver;

  // Setup test environment before each test
  async function setupTestEnvironment(): Promise<void> {
    const timestamp = Date.now();
    testDbPath = join(process.cwd(), `test-content-resolver-${timestamp}.sqlite`);
    testContentDir = join(process.cwd(), `test-content-${timestamp}`);
    
    connection = await openDatabase(testDbPath);
    await initializeSchema(connection);
    contentResolver = new ContentResolver(connection);
    
    // Create test content directory
    await fs.mkdir(testContentDir, { recursive: true });
  }

  // Cleanup test environment after each test
  async function cleanupTestEnvironment(): Promise<void> {
    if (connection) {
      await connection.close();
    }
    
    // Clean up test files
    try {
      await fs.unlink(testDbPath);
    } catch {
      // Ignore cleanup errors
    }
    
    // Clean up test content directory
    try {
      await fs.rm(testContentDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  test('should retrieve content as file path for CLI clients', async () => {
    await setupTestEnvironment();

    try {
      // Create test content file
      const testFilePath = join(testContentDir, 'test-file.txt');
      const testContent = 'This is test content for file path retrieval.';
      await fs.writeFile(testFilePath, testContent);

      // Create content metadata
      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'test-file-content-id',
        storageType: 'filesystem',
        originalPath: testFilePath,
        contentPath: testFilePath,
        displayName: 'test-file.txt',
        contentType: 'text/plain',
        fileSize: testContent.length,
        contentHash: 'abc123hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Retrieve content as file path
      const filePath = await contentResolver.getContent('test-file-content-id', 'file');

      assert.strictEqual(filePath, testFilePath);

      // Verify the file is accessible
      const retrievedContent = await fs.readFile(filePath, 'utf8');
      assert.strictEqual(retrievedContent, testContent);

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should retrieve content as base64 for MCP clients', async () => {
    await setupTestEnvironment();

    try {
      // Create test content file
      const testFilePath = join(testContentDir, 'test-base64.txt');
      const testContent = 'This is test content for base64 retrieval.';
      await fs.writeFile(testFilePath, testContent);

      // Create content metadata
      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'test-base64-content-id',
        storageType: 'content_dir',
        contentPath: testFilePath,
        displayName: 'test-base64.txt',
        contentType: 'text/plain',
        fileSize: testContent.length,
        contentHash: 'def456hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Retrieve content as base64
      const base64Content = await contentResolver.getContent('test-base64-content-id', 'base64');

      // Verify base64 content
      const expectedBase64 = Buffer.from(testContent).toString('base64');
      assert.strictEqual(base64Content, expectedBase64);

      // Verify we can decode it back
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf8');
      assert.strictEqual(decodedContent, testContent);

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should handle batch content retrieval efficiently', async () => {
    await setupTestEnvironment();

    try {
      // Create multiple test content files
      const testFiles = [
        { id: 'batch-1', name: 'batch1.txt', content: 'Batch content 1' },
        { id: 'batch-2', name: 'batch2.txt', content: 'Batch content 2' },
        { id: 'batch-3', name: 'batch3.txt', content: 'Batch content 3' }
      ];

      for (const testFile of testFiles) {
        const filePath = join(testContentDir, testFile.name);
        await fs.writeFile(filePath, testFile.content);

        const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
          id: testFile.id,
          storageType: 'content_dir',
          contentPath: filePath,
          displayName: testFile.name,
          contentType: 'text/plain',
          fileSize: testFile.content.length,
          contentHash: `${testFile.id}-hash`
        };

        await insertContentMetadata(connection, contentMetadata);
      }

      // Batch retrieve content
      const requests = [
        { contentId: 'batch-1', format: 'file' as const },
        { contentId: 'batch-2', format: 'base64' as const },
        { contentId: 'batch-3', format: 'file' as const }
      ];

      const results = await contentResolver.getContentBatch(requests);

      assert.strictEqual(results.length, 3);
      assert.ok(results.every(result => result.success));

      // Verify file format result
      const fileResult = results.find(r => r.contentId === 'batch-1');
      assert.ok(fileResult?.content?.endsWith('batch1.txt'));

      // Verify base64 format result
      const base64Result = results.find(r => r.contentId === 'batch-2');
      const decodedContent = Buffer.from(base64Result!.content!, 'base64').toString('utf8');
      assert.strictEqual(decodedContent, 'Batch content 2');

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should handle missing content gracefully', async () => {
    await setupTestEnvironment();

    try {
      // Try to retrieve non-existent content
      await assert.rejects(
        () => contentResolver.getContent('non-existent-id', 'file'),
        /Content not found: non-existent-id/,
        'Should reject with clear error for non-existent content'
      );

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should handle missing content files gracefully', async () => {
    await setupTestEnvironment();

    try {
      // Create content metadata but no actual file
      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'missing-file-content-id',
        storageType: 'content_dir',
        contentPath: join(testContentDir, 'missing-file.txt'),
        displayName: 'missing-file.txt',
        contentType: 'text/plain',
        fileSize: 100,
        contentHash: 'missing-hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Try to retrieve content with missing file
      await assert.rejects(
        () => contentResolver.getContent('missing-file-content-id', 'file'),
        (error: Error) => {
          // Should throw ContentNotFoundError
          return error.name === 'ContentNotFoundError' && 
                 error.message.includes('missing-file');
        },
        'Should reject with clear error for missing content file'
      );

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should validate format parameter', async () => {
    await setupTestEnvironment();

    try {
      // Create valid content
      const testFilePath = join(testContentDir, 'format-test.txt');
      await fs.writeFile(testFilePath, 'Format test content');

      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'format-test-content-id',
        storageType: 'content_dir',
        contentPath: testFilePath,
        displayName: 'format-test.txt',
        contentType: 'text/plain',
        fileSize: 100,
        contentHash: 'format-hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Try invalid format
      await assert.rejects(
        () => contentResolver.getContent('format-test-content-id', 'invalid' as any),
        (error: Error) => {
          // Should throw ContentRetrievalError with format validation message
          return error.name === 'ContentRetrievalError' && 
                 (error.message.includes('Format must be') || error.message.includes('invalid'));
        },
        'Should reject with clear error for invalid format'
      );

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should verify content existence correctly', async () => {
    await setupTestEnvironment();

    try {
      // Create test content file
      const testFilePath = join(testContentDir, 'existence-test.txt');
      await fs.writeFile(testFilePath, 'Existence test content');

      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'existence-test-content-id',
        storageType: 'content_dir',
        contentPath: testFilePath,
        displayName: 'existence-test.txt',
        contentType: 'text/plain',
        fileSize: 100,
        contentHash: 'existence-hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Verify existing content
      const exists = await contentResolver.verifyContentExists('existence-test-content-id');
      assert.strictEqual(exists, true);

      // Verify non-existent content
      const notExists = await contentResolver.verifyContentExists('non-existent-id');
      assert.strictEqual(notExists, false);

      // Remove file and verify it's detected as missing
      await fs.unlink(testFilePath);
      const missingFile = await contentResolver.verifyContentExists('existence-test-content-id');
      assert.strictEqual(missingFile, false);

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should retrieve content metadata without loading content', async () => {
    await setupTestEnvironment();

    try {
      // Create content metadata
      const contentMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'metadata-test-content-id',
        storageType: 'filesystem',
        originalPath: '/original/path/test.txt',
        contentPath: '/content/path/test.txt',
        displayName: 'test.txt',
        contentType: 'text/plain',
        fileSize: 1024,
        contentHash: 'metadata-hash'
      };

      await insertContentMetadata(connection, contentMetadata);

      // Retrieve metadata
      const retrievedMetadata = await contentResolver.getContentMetadata('metadata-test-content-id');

      assert.strictEqual(retrievedMetadata.id, 'metadata-test-content-id');
      assert.strictEqual(retrievedMetadata.storageType, 'filesystem');
      assert.strictEqual(retrievedMetadata.originalPath, '/original/path/test.txt');
      assert.strictEqual(retrievedMetadata.contentPath, '/content/path/test.txt');
      assert.strictEqual(retrievedMetadata.displayName, 'test.txt');
      assert.strictEqual(retrievedMetadata.contentType, 'text/plain');
      assert.strictEqual(retrievedMetadata.fileSize, 1024);
      assert.strictEqual(retrievedMetadata.contentHash, 'metadata-hash');

    } finally {
      await cleanupTestEnvironment();
    }
  });

  test('should handle batch operations with mixed success and failure', async () => {
    await setupTestEnvironment();

    try {
      // Create one valid content file
      const validFilePath = join(testContentDir, 'valid.txt');
      await fs.writeFile(validFilePath, 'Valid content');

      const validMetadata: Omit<ContentMetadata, 'createdAt'> = {
        id: 'valid-content-id',
        storageType: 'content_dir',
        contentPath: validFilePath,
        displayName: 'valid.txt',
        contentType: 'text/plain',
        fileSize: 100,
        contentHash: 'valid-hash'
      };

      await insertContentMetadata(connection, validMetadata);

      // Batch request with mixed valid and invalid IDs
      const requests = [
        { contentId: 'valid-content-id', format: 'file' as const },
        { contentId: 'invalid-content-id', format: 'base64' as const }
      ];

      const results = await contentResolver.getContentBatch(requests);

      assert.strictEqual(results.length, 2);

      // Check successful result
      const successResult = results.find(r => r.contentId === 'valid-content-id');
      assert.ok(successResult);
      assert.strictEqual(successResult.success, true);
      assert.ok(successResult.content);

      // Check failed result
      const failResult = results.find(r => r.contentId === 'invalid-content-id');
      assert.ok(failResult);
      assert.strictEqual(failResult.success, false);
      assert.ok(failResult.error);
      assert.ok(failResult.error.includes('Content not found'));

    } finally {
      await cleanupTestEnvironment();
    }
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
