/**
 * Tests for ContentManager (Task 1.2)
 * Comprehensive tests for content ingestion routing, deduplication, and content ID generation
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  openDatabase, 
  initializeSchema,
  getContentMetadata,
  getContentMetadataByHash
} from '../../src/../src/core/db.js';
import { ContentManager } from '../../src/../src/core/content-manager.js';

describe('ContentManager', () => {
  const testDbPath = './test-content-manager.db';
  const testContentDir = './test-content';
  const testFilesDir = './test-files';

  // Clean up test files and database
  async function cleanup() {
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist, ignore
    }
    
    try {
      await fs.rm(testContentDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, ignore
    }
    
    try {
      await fs.rm(testFilesDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, ignore
    }
  }

  beforeEach(async () => {
    await cleanup();
    
    // Create test files directory
    await fs.mkdir(testFilesDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanup();
  });

  test('should create ContentManager with default configuration', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection);
      assert.ok(contentManager, 'ContentManager should be created');
    } finally {
      await connection.close();
    }
  });

  test('should create ContentManager with custom configuration', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const config = {
        contentDir: testContentDir,
        maxFileSize: 1024 * 1024, // 1MB
        enableDeduplication: false
      };
      
      const contentManager = new ContentManager(connection, config);
      assert.ok(contentManager, 'ContentManager should be created with custom config');
    } finally {
      await connection.close();
    }
  });

  test('should generate stable content IDs from content', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection);
      
      const content1 = Buffer.from('Hello, World!');
      const content2 = Buffer.from('Hello, World!'); // Same content
      const content3 = Buffer.from('Different content');
      
      const id1 = contentManager.generateContentId(content1);
      const id2 = contentManager.generateContentId(content2);
      const id3 = contentManager.generateContentId(content3);
      
      assert.strictEqual(id1, id2, 'Same content should generate same ID');
      assert.notStrictEqual(id1, id3, 'Different content should generate different IDs');
      assert.ok(typeof id1 === 'string' && id1.length > 0, 'Content ID should be a non-empty string');
    } finally {
      await connection.close();
    }
  });

  test('should ingest from filesystem and create filesystem reference', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Create test file
      const testFilePath = join(testFilesDir, 'test.txt');
      const testContent = 'This is a test file for filesystem ingestion.';
      await fs.writeFile(testFilePath, testContent);
      
      // Ingest from filesystem
      const result = await contentManager.ingestFromFilesystem(testFilePath);
      
      assert.ok(result.contentId, 'Should return content ID');
      assert.strictEqual(result.storageType, 'filesystem', 'Should use filesystem storage');
      assert.strictEqual(result.contentPath, testFilePath, 'Content path should be original file path');
      assert.strictEqual(result.wasDeduped, false, 'First ingestion should not be deduped');
      
      // Verify content metadata was created
      const metadata = await getContentMetadata(connection, result.contentId);
      assert.ok(metadata, 'Content metadata should exist');
      assert.strictEqual(metadata.storageType, 'filesystem');
      assert.strictEqual(metadata.originalPath, testFilePath);
      assert.strictEqual(metadata.contentPath, testFilePath);
      assert.strictEqual(metadata.displayName, 'test.txt');
      assert.strictEqual(metadata.contentType, 'text/plain');
      assert.strictEqual(metadata.fileSize, testContent.length);
    } finally {
      await connection.close();
    }
  });

  test('should ingest from memory and store in content directory', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Ingest from memory
      const testContent = Buffer.from('This is memory content for testing.');
      const metadata = {
        displayName: 'memory-test.txt',
        contentType: 'text/plain'
      };
      
      const result = await contentManager.ingestFromMemory(testContent, metadata);
      
      assert.ok(result.contentId, 'Should return content ID');
      assert.strictEqual(result.storageType, 'content_dir', 'Should use content_dir storage');
      // Normalize paths for cross-platform compatibility and remove ./ prefix
      const normalizedContentPath = result.contentPath.replace(/\\/g, '/');
      const normalizedTestContentDir = testContentDir.replace(/\\/g, '/').replace(/^\.\//, '');
      
      assert.ok(normalizedContentPath.includes(normalizedTestContentDir), 'Content path should be in content directory');
      assert.strictEqual(result.wasDeduped, false, 'First ingestion should not be deduped');
      
      // Verify content metadata was created
      const contentMetadata = await getContentMetadata(connection, result.contentId);
      assert.ok(contentMetadata, 'Content metadata should exist');
      assert.strictEqual(contentMetadata.storageType, 'content_dir');
      assert.strictEqual(contentMetadata.displayName, 'memory-test.txt');
      assert.strictEqual(contentMetadata.contentType, 'text/plain');
      assert.strictEqual(contentMetadata.fileSize, testContent.length);
      
      // Verify file was actually written
      const writtenContent = await fs.readFile(result.contentPath);
      assert.ok(testContent.equals(writtenContent), 'Written content should match original');
    } finally {
      await connection.close();
    }
  });

  test('should deduplicate filesystem content', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableDeduplication: true 
      });
      
      // Create test file
      const testFilePath = join(testFilesDir, 'duplicate-test.txt');
      const testContent = 'This content will be duplicated.';
      await fs.writeFile(testFilePath, testContent);
      
      // First ingestion
      const result1 = await contentManager.ingestFromFilesystem(testFilePath);
      assert.strictEqual(result1.wasDeduped, false, 'First ingestion should not be deduped');
      
      // Create another file with same content
      const testFilePath2 = join(testFilesDir, 'duplicate-test-2.txt');
      await fs.writeFile(testFilePath2, testContent);
      
      // Second ingestion should be deduped
      const result2 = await contentManager.ingestFromFilesystem(testFilePath2);
      assert.strictEqual(result2.wasDeduped, true, 'Second ingestion should be deduped');
      assert.strictEqual(result2.contentId, result1.contentId, 'Should return same content ID');
    } finally {
      await connection.close();
    }
  });

  test('should deduplicate memory content', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableDeduplication: true 
      });
      
      const testContent = Buffer.from('Duplicate memory content test.');
      const metadata1 = {
        displayName: 'first.txt',
        contentType: 'text/plain'
      };
      const metadata2 = {
        displayName: 'second.txt',
        contentType: 'text/plain'
      };
      
      // First ingestion
      const result1 = await contentManager.ingestFromMemory(testContent, metadata1);
      assert.strictEqual(result1.wasDeduped, false, 'First ingestion should not be deduped');
      
      // Second ingestion with same content should be deduped
      const result2 = await contentManager.ingestFromMemory(testContent, metadata2);
      assert.strictEqual(result2.wasDeduped, true, 'Second ingestion should be deduped');
      assert.strictEqual(result2.contentId, result1.contentId, 'Should return same content ID');
    } finally {
      await connection.close();
    }
  });

  test('should detect content types correctly', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Test different content types
      const testCases = [
        {
          filename: 'test.txt',
          content: Buffer.from('Plain text content'),
          expectedType: 'text/plain'
        },
        {
          filename: 'test.md',
          content: Buffer.from('# Markdown content'),
          expectedType: 'text/markdown'
        },
        {
          filename: 'test.pdf',
          content: Buffer.from('%PDF-1.4\nPDF content'),
          expectedType: 'application/pdf'
        }
      ];
      
      for (const testCase of testCases) {
        const result = await contentManager.ingestFromMemory(testCase.content, {
          displayName: testCase.filename
        });
        
        const metadata = await getContentMetadata(connection, result.contentId);
        assert.ok(metadata, `Metadata should exist for ${testCase.filename}`);
        assert.strictEqual(
          metadata.contentType, 
          testCase.expectedType, 
          `Content type should be ${testCase.expectedType} for ${testCase.filename}`
        );
      }
    } finally {
      await connection.close();
    }
  });

  test('should enforce file size limits', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        maxFileSize: 100 // Very small limit for testing
      });
      
      // Test filesystem size limit
      const largeFilePath = join(testFilesDir, 'large.txt');
      const largeContent = 'x'.repeat(200); // Exceeds 100 byte limit
      await fs.writeFile(largeFilePath, largeContent);
      
      await assert.rejects(
        () => contentManager.ingestFromFilesystem(largeFilePath),
        /exceeds maximum allowed size/,
        'Should reject large filesystem files'
      );
      
      // Test memory size limit
      const largeBuffer = Buffer.from('x'.repeat(200));
      
      await assert.rejects(
        () => contentManager.ingestFromMemory(largeBuffer, { displayName: 'large.txt' }),
        /exceeds maximum allowed size/,
        'Should reject large memory content'
      );
    } finally {
      await connection.close();
    }
  });

  test('should handle non-existent files gracefully', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      await assert.rejects(
        () => contentManager.ingestFromFilesystem('/non/existent/file.txt'),
        /ENOENT|no such file or directory/,
        'Should reject non-existent files'
      );
    } finally {
      await connection.close();
    }
  });

  test('should handle directories gracefully', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      await assert.rejects(
        () => contentManager.ingestFromFilesystem(testFilesDir),
        /Path is not a file/,
        'Should reject directories'
      );
    } finally {
      await connection.close();
    }
  });

  test('should create content directory automatically', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Content directory should not exist initially
      try {
        await fs.access(testContentDir);
        assert.fail('Content directory should not exist initially');
      } catch {
        // Expected - directory doesn't exist
      }
      
      // Ingest memory content should create directory
      const testContent = Buffer.from('Test content for directory creation.');
      await contentManager.ingestFromMemory(testContent, { displayName: 'test.txt' });
      
      // Directory should now exist
      const stats = await fs.stat(testContentDir);
      assert.ok(stats.isDirectory(), 'Content directory should be created');
    } finally {
      await connection.close();
    }
  });

  test('should use hash-based filenames for memory content', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      const testContent = Buffer.from('Content for hash-based filename test.');
      const result = await contentManager.ingestFromMemory(testContent, { 
        displayName: 'test.txt',
        contentType: 'text/plain'
      });
      
      // Verify filename is hash-based
      const metadata = await getContentMetadata(connection, result.contentId);
      assert.ok(metadata, 'Metadata should exist');
      
      const filename = metadata.contentPath.split('/').pop() || metadata.contentPath.split('\\').pop();
      assert.ok(filename, 'Filename should exist');
      assert.ok(filename.includes('.txt'), 'Filename should have correct extension');
      assert.ok(filename.length > 10, 'Filename should be hash-based (long)');
    } finally {
      await connection.close();
    }
  });

  test('should handle deduplication check correctly', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      const testContent = Buffer.from('Deduplication check test content.');
      const contentId = contentManager.generateContentId(testContent);
      
      // Initially should not exist
      const existsBefore = await contentManager.deduplicateContent(contentId);
      assert.strictEqual(existsBefore, false, 'Content should not exist initially');
      
      // Ingest content
      await contentManager.ingestFromMemory(testContent, { displayName: 'test.txt' });
      
      // Now should exist
      const existsAfter = await contentManager.deduplicateContent(contentId);
      assert.strictEqual(existsAfter, true, 'Content should exist after ingestion');
    } finally {
      await connection.close();
    }
  });

  test('should remove orphaned files from content directory', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Create content directory
      await fs.mkdir(testContentDir, { recursive: true });
      
      // Create some orphaned files (files without metadata)
      const orphanedFile1 = join(testContentDir, 'orphaned1.txt');
      const orphanedFile2 = join(testContentDir, 'orphaned2.txt');
      const orphanedContent1 = 'This is orphaned content 1';
      const orphanedContent2 = 'This is orphaned content 2';
      
      await fs.writeFile(orphanedFile1, orphanedContent1);
      await fs.writeFile(orphanedFile2, orphanedContent2);
      
      // Ingest one legitimate file
      const legitimateContent = Buffer.from('This is legitimate content');
      const result = await contentManager.ingestFromMemory(legitimateContent, { 
        displayName: 'legitimate.txt' 
      });
      
      // Verify legitimate file exists
      const legitimateExists = await fs.access(result.contentPath).then(() => true).catch(() => false);
      assert.ok(legitimateExists, 'Legitimate file should exist');
      
      // Run cleanup
      const cleanupResult = await contentManager.removeOrphanedFiles();
      
      // Verify orphaned files were removed
      assert.strictEqual(cleanupResult.removedFiles.length, 2, 'Should remove 2 orphaned files');
      assert.ok(cleanupResult.removedFiles.includes('orphaned1.txt'), 'Should remove orphaned1.txt');
      assert.ok(cleanupResult.removedFiles.includes('orphaned2.txt'), 'Should remove orphaned2.txt');
      assert.strictEqual(cleanupResult.errors.length, 0, 'Should have no errors');
      assert.ok(cleanupResult.freedSpace > 0, 'Should report freed space');
      
      // Verify files are actually gone
      const orphaned1Exists = await fs.access(orphanedFile1).then(() => true).catch(() => false);
      const orphaned2Exists = await fs.access(orphanedFile2).then(() => true).catch(() => false);
      const legitimateStillExists = await fs.access(result.contentPath).then(() => true).catch(() => false);
      
      assert.strictEqual(orphaned1Exists, false, 'Orphaned file 1 should be removed');
      assert.strictEqual(orphaned2Exists, false, 'Orphaned file 2 should be removed');
      assert.ok(legitimateStillExists, 'Legitimate file should still exist');
    } finally {
      await connection.close();
    }
  });

  test('should remove duplicate content files and keep first occurrence', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableDeduplication: false // Disable deduplication to create duplicates
      });
      
      // Create content with same hash but different content IDs by manually creating files
      const duplicateContent = Buffer.from('This content will be duplicated');
      const contentHash = contentManager.generateContentId(duplicateContent);
      
      // Manually create duplicate files in content directory with same hash
      await fs.mkdir(testContentDir, { recursive: true });
      
      const file1Path = join(testContentDir, `${contentHash}_1.txt`);
      const file2Path = join(testContentDir, `${contentHash}_2.txt`);
      const file3Path = join(testContentDir, `${contentHash}_3.txt`);
      
      await fs.writeFile(file1Path, duplicateContent);
      await fs.writeFile(file2Path, duplicateContent);
      await fs.writeFile(file3Path, duplicateContent);
      
      // Create metadata entries for these files with same hash but different IDs
      const { insertContentMetadata } = await import('../../src/../src/core/db.js');
      
      await insertContentMetadata(connection, {
        id: `${contentHash}_1`,
        storageType: 'content_dir',
        contentPath: file1Path,
        displayName: 'first.txt',
        contentType: 'text/plain',
        fileSize: duplicateContent.length,
        contentHash
      });
      
      await insertContentMetadata(connection, {
        id: `${contentHash}_2`,
        storageType: 'content_dir',
        contentPath: file2Path,
        displayName: 'second.txt',
        contentType: 'text/plain',
        fileSize: duplicateContent.length,
        contentHash
      });
      
      await insertContentMetadata(connection, {
        id: `${contentHash}_3`,
        storageType: 'content_dir',
        contentPath: file3Path,
        displayName: 'third.txt',
        contentType: 'text/plain',
        fileSize: duplicateContent.length,
        contentHash
      });
      
      // Verify all files exist
      const file1Exists = await fs.access(file1Path).then(() => true).catch(() => false);
      const file2Exists = await fs.access(file2Path).then(() => true).catch(() => false);
      const file3Exists = await fs.access(file3Path).then(() => true).catch(() => false);
      
      assert.ok(file1Exists, 'First file should exist');
      assert.ok(file2Exists, 'Second file should exist');
      assert.ok(file3Exists, 'Third file should exist');
      
      // Run deduplication
      const dedupeResult = await contentManager.removeDuplicateContent();
      
      // Should remove 2 duplicates, keep 1
      assert.strictEqual(dedupeResult.removedFiles.length, 2, 'Should remove 2 duplicate files');
      assert.strictEqual(dedupeResult.errors.length, 0, 'Should have no errors');
      assert.ok(dedupeResult.freedSpace > 0, 'Should report freed space');
      
      // Verify only one file remains (the first one chronologically)
      const remainingFiles = await fs.readdir(testContentDir);
      const contentFiles = remainingFiles.filter(f => !f.startsWith('.'));
      assert.strictEqual(contentFiles.length, 1, 'Should have only 1 content file remaining');
    } finally {
      await connection.close();
    }
  });

  test('should handle cleanup operations atomically', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Create content directory
      await fs.mkdir(testContentDir, { recursive: true });
      
      // Create a mix of legitimate and orphaned files
      const legitimateContent = Buffer.from('Legitimate content');
      const result = await contentManager.ingestFromMemory(legitimateContent, { 
        displayName: 'legitimate.txt' 
      });
      
      const orphanedFile = join(testContentDir, 'orphaned.txt');
      await fs.writeFile(orphanedFile, 'Orphaned content');
      
      // Create a file that will cause an error (simulate permission issue)
      const problematicFile = join(testContentDir, 'problematic.txt');
      await fs.writeFile(problematicFile, 'Problematic content');
      
      // Make file read-only to simulate permission error (on systems that support it)
      try {
        await fs.chmod(problematicFile, 0o444);
      } catch {
        // Skip this part of the test on systems that don't support chmod
      }
      
      // Run cleanup - should handle errors gracefully
      const cleanupResult = await contentManager.removeOrphanedFiles();
      
      // Should remove at least the orphaned file
      assert.ok(cleanupResult.removedFiles.length >= 1, 'Should remove at least 1 file');
      
      // Legitimate file should still exist
      const legitimateExists = await fs.access(result.contentPath).then(() => true).catch(() => false);
      assert.ok(legitimateExists, 'Legitimate file should still exist');
      
      // Cleanup should complete even if some files cause errors
      assert.ok(Array.isArray(cleanupResult.errors), 'Should return errors array');
      assert.ok(typeof cleanupResult.freedSpace === 'number', 'Should return freed space number');
    } finally {
      await connection.close();
    }
  });

  test('should report cleanup results accurately', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Create content directory
      await fs.mkdir(testContentDir, { recursive: true });
      
      // Create orphaned files with known sizes
      const orphanedFile1 = join(testContentDir, 'orphaned1.txt');
      const orphanedFile2 = join(testContentDir, 'orphaned2.txt');
      const content1 = 'Small content';
      const content2 = 'Slightly larger content for testing';
      
      await fs.writeFile(orphanedFile1, content1);
      await fs.writeFile(orphanedFile2, content2);
      
      const expectedFreedSpace = content1.length + content2.length;
      
      // Run cleanup
      const cleanupResult = await contentManager.removeOrphanedFiles();
      
      // Verify accurate reporting
      assert.strictEqual(cleanupResult.removedFiles.length, 2, 'Should report 2 removed files');
      assert.ok(cleanupResult.removedFiles.includes('orphaned1.txt'), 'Should report orphaned1.txt removed');
      assert.ok(cleanupResult.removedFiles.includes('orphaned2.txt'), 'Should report orphaned2.txt removed');
      assert.strictEqual(cleanupResult.freedSpace, expectedFreedSpace, 'Should report accurate freed space');
      assert.strictEqual(cleanupResult.errors.length, 0, 'Should report no errors');
    } finally {
      await connection.close();
    }
  });

  test('should handle empty content directory gracefully', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { contentDir: testContentDir });
      
      // Run cleanup on non-existent directory
      const cleanupResult = await contentManager.removeOrphanedFiles();
      
      // Should handle gracefully
      assert.strictEqual(cleanupResult.removedFiles.length, 0, 'Should remove no files');
      assert.strictEqual(cleanupResult.errors.length, 0, 'Should have no errors');
      assert.strictEqual(cleanupResult.freedSpace, 0, 'Should report no freed space');
      
      // Directory should be created
      const dirExists = await fs.access(testContentDir).then(() => true).catch(() => false);
      assert.ok(dirExists, 'Content directory should be created');
    } finally {
      await connection.close();
    }
  });

  test('should update storage statistics after cleanup operations', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableStorageTracking: true
      });
      
      // Create content directory and add some content
      await fs.mkdir(testContentDir, { recursive: true });
      
      const legitimateContent = Buffer.from('Legitimate content for stats test');
      await contentManager.ingestFromMemory(legitimateContent, { 
        displayName: 'legitimate.txt' 
      });
      
      // Add orphaned file
      const orphanedFile = join(testContentDir, 'orphaned.txt');
      await fs.writeFile(orphanedFile, 'Orphaned content');
      
      // Get stats before cleanup
      const statsBefore = await contentManager.getContentDirectoryStats();
      
      // Run cleanup
      await contentManager.removeOrphanedFiles();
      
      // Get stats after cleanup
      const statsAfter = await contentManager.getContentDirectoryStats();
      
      // Stats should be updated
      assert.ok(statsAfter.totalFiles <= statsBefore.totalFiles, 'File count should decrease or stay same');
      assert.ok(statsAfter.totalSize <= statsBefore.totalSize, 'Total size should decrease or stay same');
      assert.ok(statsAfter.lastCleanup instanceof Date, 'Last cleanup time should be set');
    } finally {
      await connection.close();
    }
  });

  test('should provide comprehensive storage statistics', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        maxContentDirSize: 10 * 1024 * 1024, // 10MB limit
        enableStorageTracking: true
      });
      
      // Create test file for filesystem reference
      const testFilePath = join(testFilesDir, 'filesystem-test.txt');
      const filesystemContent = 'This is filesystem content for testing.';
      await fs.writeFile(testFilePath, filesystemContent);
      
      // Ingest from filesystem
      const filesystemResult = await contentManager.ingestFromFilesystem(testFilePath);
      
      // Ingest from memory
      const memoryContent = Buffer.from('This is memory content for testing.');
      const memoryResult = await contentManager.ingestFromMemory(memoryContent, { 
        displayName: 'memory-test.txt' 
      });
      
      // Get comprehensive storage statistics
      const stats = await contentManager.getStorageStats();
      
      // Verify structure and content
      assert.ok(stats.contentDirectory, 'Should have content directory stats');
      assert.ok(stats.filesystemReferences, 'Should have filesystem reference stats');
      assert.ok(stats.overall, 'Should have overall stats');
      assert.ok(stats.limits, 'Should have limits stats');
      assert.ok(stats.lastUpdated instanceof Date, 'Should have last updated timestamp');
      
      // Verify content directory stats
      assert.strictEqual(stats.contentDirectory.totalFiles, 1, 'Should have 1 file in content directory');
      assert.ok(stats.contentDirectory.totalSize > 0, 'Content directory should have size > 0');
      assert.ok(stats.contentDirectory.totalSizeMB >= 0, 'Should have MB size');
      assert.ok(stats.contentDirectory.averageFileSize > 0, 'Should have average file size');
      
      // Verify filesystem reference stats
      assert.strictEqual(stats.filesystemReferences.totalRefs, 1, 'Should have 1 filesystem reference');
      assert.ok(stats.filesystemReferences.totalSize > 0, 'Filesystem refs should have size > 0');
      assert.ok(stats.filesystemReferences.totalSizeMB >= 0, 'Should have MB size for filesystem refs');
      
      // Verify overall stats
      assert.strictEqual(stats.overall.totalContentItems, 2, 'Should have 2 total content items');
      assert.ok(stats.overall.totalStorageUsed > 0, 'Should have total storage used');
      assert.ok(stats.overall.storageEfficiency > 0, 'Should have storage efficiency');
      
      // Verify limits stats
      assert.strictEqual(stats.limits.maxContentDirSize, 10 * 1024 * 1024, 'Should have correct max size');
      assert.ok(stats.limits.currentUsagePercent >= 0, 'Should have usage percentage');
      assert.ok(stats.limits.remainingSpace >= 0, 'Should have remaining space');
      
    } finally {
      await connection.close();
    }
  });

  test('should generate human-readable storage report', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableStorageTracking: true
      });
      
      // Add some content
      const testContent = Buffer.from('Test content for report generation.');
      await contentManager.ingestFromMemory(testContent, { 
        displayName: 'test-report.txt' 
      });
      
      // Generate storage report
      const report = await contentManager.generateStorageReport();
      
      // Verify report structure
      assert.ok(typeof report === 'string', 'Report should be a string');
      assert.ok(report.includes('RAG-lite Content Storage Report'), 'Should have report title');
      assert.ok(report.includes('Content Directory:'), 'Should have content directory section');
      assert.ok(report.includes('Filesystem References:'), 'Should have filesystem references section');
      assert.ok(report.includes('Overall Usage:'), 'Should have overall usage section');
      assert.ok(report.includes('Storage Limits:'), 'Should have storage limits section');
      assert.ok(report.includes('Maintenance:'), 'Should have maintenance section');
      
      // Verify report contains actual data
      assert.ok(report.includes('Files: 1'), 'Should show correct file count');
      assert.ok(report.includes('Total content items: 1'), 'Should show correct total items');
      
    } finally {
      await connection.close();
    }
  });

  test('should provide monitoring-friendly storage metrics', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableStorageTracking: true
      });
      
      // Add some content
      const testContent = Buffer.from('Test content for metrics.');
      await contentManager.ingestFromMemory(testContent, { 
        displayName: 'test-metrics.txt' 
      });
      
      // Get storage metrics
      const metrics = await contentManager.getStorageMetrics();
      
      // Verify metrics structure
      assert.ok(typeof metrics.contentDirFiles === 'number', 'Should have content dir files count');
      assert.ok(typeof metrics.contentDirSizeBytes === 'number', 'Should have content dir size in bytes');
      assert.ok(typeof metrics.contentDirSizeMB === 'number', 'Should have content dir size in MB');
      assert.ok(typeof metrics.filesystemRefs === 'number', 'Should have filesystem refs count');
      assert.ok(typeof metrics.filesystemSizeBytes === 'number', 'Should have filesystem size in bytes');
      assert.ok(typeof metrics.filesystemSizeMB === 'number', 'Should have filesystem size in MB');
      assert.ok(typeof metrics.totalContentItems === 'number', 'Should have total content items');
      assert.ok(typeof metrics.totalStorageBytes === 'number', 'Should have total storage in bytes');
      assert.ok(typeof metrics.totalStorageMB === 'number', 'Should have total storage in MB');
      assert.ok(typeof metrics.usagePercent === 'number', 'Should have usage percentage');
      assert.ok(typeof metrics.remainingBytes === 'number', 'Should have remaining bytes');
      assert.ok(typeof metrics.remainingMB === 'number', 'Should have remaining MB');
      assert.ok(typeof metrics.lastUpdatedTimestamp === 'number', 'Should have last updated timestamp');
      
      // Verify metrics values
      assert.strictEqual(metrics.contentDirFiles, 1, 'Should have 1 content dir file');
      assert.strictEqual(metrics.totalContentItems, 1, 'Should have 1 total content item');
      assert.ok(metrics.contentDirSizeBytes > 0, 'Should have positive content dir size');
      assert.ok(metrics.lastUpdatedTimestamp > 0, 'Should have valid timestamp');
      
    } finally {
      await connection.close();
    }
  });

  test('should handle storage statistics initialization', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableStorageTracking: true
      });
      
      // Get stats before any content is added (should initialize)
      const initialStats = await contentManager.getStorageStats();
      
      // Verify initialization
      assert.strictEqual(initialStats.contentDirectory.totalFiles, 0, 'Should start with 0 files');
      assert.strictEqual(initialStats.contentDirectory.totalSize, 0, 'Should start with 0 size');
      assert.strictEqual(initialStats.filesystemReferences.totalRefs, 0, 'Should start with 0 refs');
      assert.strictEqual(initialStats.overall.totalContentItems, 0, 'Should start with 0 total items');
      assert.ok(initialStats.lastUpdated instanceof Date, 'Should have last updated date');
      
    } finally {
      await connection.close();
    }
  });

  test('should update statistics after ingestion operations', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        enableStorageTracking: true
      });
      
      // Get initial stats
      const initialStats = await contentManager.getStorageStats();
      
      // Add content
      const testContent = Buffer.from('Test content for stats update verification.');
      await contentManager.ingestFromMemory(testContent, { 
        displayName: 'stats-update-test.txt' 
      });
      
      // Get updated stats
      const updatedStats = await contentManager.getStorageStats();
      
      // Verify stats were updated
      assert.ok(updatedStats.contentDirectory.totalFiles > initialStats.contentDirectory.totalFiles, 
        'File count should increase');
      assert.ok(updatedStats.contentDirectory.totalSize > initialStats.contentDirectory.totalSize, 
        'Total size should increase');
      assert.ok(updatedStats.overall.totalContentItems > initialStats.overall.totalContentItems, 
        'Total content items should increase');
      assert.ok(updatedStats.lastUpdated.getTime() >= initialStats.lastUpdated.getTime(), 
        'Last updated should be more recent');
      
    } finally {
      await connection.close();
    }
  });

  test('should parse size strings correctly', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Test various size string formats
      const testCases = [
        { input: '50MB', expected: 50 * 1024 * 1024 },
        { input: '2GB', expected: 2 * 1024 * 1024 * 1024 },
        { input: '1024KB', expected: 1024 * 1024 },
        { input: '500B', expected: 500 },
        { input: 1000000, expected: 1000000 }, // Number input
        { input: '1.5GB', expected: 1.5 * 1024 * 1024 * 1024 }
      ];
      
      for (const testCase of testCases) {
        const contentManager = new ContentManager(connection, { 
          contentDir: testContentDir,
          maxContentDirSize: testCase.input
        });
        
        const stats = await contentManager.getStorageStats();
        assert.strictEqual(stats.limits.maxContentDirSize, testCase.expected, 
          `Size parsing failed for ${testCase.input}`);
      }
      
      // Test invalid size strings
      const invalidSizes = ['invalid', '50XB', 'GB50', ''];
      
      for (const invalidSize of invalidSizes) {
        assert.throws(
          () => new ContentManager(connection, { maxContentDirSize: invalidSize }),
          /Invalid size format/,
          `Should reject invalid size: ${invalidSize}`
        );
      }
      
    } finally {
      await connection.close();
    }
  });

  test('should enforce storage limits with clear error messages', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Set very small limit to trigger enforcement
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        maxContentDirSize: '1KB', // 1024 bytes
        storageErrorThreshold: 90,
        enableStorageTracking: true
      });
      
      // Add content that approaches the limit
      const smallContent = Buffer.from('x'.repeat(800)); // 800 bytes, ~78% of limit
      await contentManager.ingestFromMemory(smallContent, { 
        displayName: 'small.txt' 
      });
      
      // Try to add content that would exceed the error threshold
      const largeContent = Buffer.from('x'.repeat(300)); // 300 bytes, would make total >90%
      
      await assert.rejects(
        () => contentManager.ingestFromMemory(largeContent, { displayName: 'large.txt' }),
        /Storage limit exceeded/,
        'Should reject content that exceeds storage limit'
      );
      
      // Verify error message contains helpful guidance
      try {
        await contentManager.ingestFromMemory(largeContent, { displayName: 'large.txt' });
        assert.fail('Should have thrown storage limit error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        assert.ok(errorMessage.includes('removeOrphanedFiles'), 'Should suggest cleanup operations');
        assert.ok(errorMessage.includes('removeDuplicateContent'), 'Should suggest deduplication');
        assert.ok(errorMessage.includes('Current usage:'), 'Should show current usage');
        assert.ok(errorMessage.includes('Storage limit:'), 'Should show storage limit');
        assert.ok(errorMessage.includes('Remaining space:'), 'Should show remaining space');
      }
      
    } finally {
      await connection.close();
    }
  });

  test('should provide storage limit status and recommendations', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const contentManager = new ContentManager(connection, { 
        contentDir: testContentDir,
        maxContentDirSize: '2MB', // 2MB for clearer MB calculations
        storageWarningThreshold: 75,
        storageErrorThreshold: 95,
        enableStorageTracking: true
      });
      
      // Test initial status (empty)
      const initialStatus = await contentManager.getStorageLimitStatus();
      assert.strictEqual(initialStatus.currentUsagePercent, 0, 'Should start with 0% usage');
      assert.strictEqual(initialStatus.canAcceptContent, true, 'Should accept content initially');
      assert.strictEqual(initialStatus.isNearWarningThreshold, false, 'Should not be near warning initially');
      assert.ok(initialStatus.recommendations.some(r => r.includes('healthy')), 'Should show healthy status');
      
      // Add content to reach warning threshold
      const warningContent = Buffer.from('x'.repeat(1600 * 1024)); // ~78% of 2MB limit
      await contentManager.ingestFromMemory(warningContent, { 
        displayName: 'warning-test.txt' 
      });
      
      const warningStatus = await contentManager.getStorageLimitStatus();
      assert.ok(warningStatus.currentUsagePercent > 75, 'Should be above warning threshold');
      assert.strictEqual(warningStatus.isNearWarningThreshold, true, 'Should be near warning threshold');
      assert.strictEqual(warningStatus.isNearErrorThreshold, false, 'Should not be at error threshold yet');
      assert.strictEqual(warningStatus.canAcceptContent, true, 'Should still accept content');
      assert.ok(warningStatus.recommendations.some(r => r.includes('WARNING')), 'Should show warning');
      
      // Verify limits information
      assert.strictEqual(warningStatus.limits.warningThreshold, 75, 'Should show correct warning threshold');
      assert.strictEqual(warningStatus.limits.errorThreshold, 95, 'Should show correct error threshold');
      assert.ok(warningStatus.limits.maxSizeMB > 0, 'Should show positive max size in MB');
      
      // Verify status structure
      assert.ok(typeof warningStatus.currentUsagePercent === 'number', 'Should have usage percent');
      assert.ok(typeof warningStatus.canAcceptContent === 'boolean', 'Should have can accept flag');
      assert.ok(Array.isArray(warningStatus.recommendations), 'Should have recommendations array');
      assert.ok(warningStatus.limits.currentSizeMB >= 0, 'Should have current size');
      assert.ok(warningStatus.limits.remainingSizeMB >= 0, 'Should have remaining size');
      
    } finally {
      await connection.close();
    }
  });

  test('should validate configuration thresholds', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Test invalid warning threshold
      assert.throws(
        () => new ContentManager(connection, { storageWarningThreshold: -1 }),
        /Storage warning threshold must be between 0 and 100/,
        'Should reject negative warning threshold'
      );
      
      assert.throws(
        () => new ContentManager(connection, { storageWarningThreshold: 101 }),
        /Storage warning threshold must be between 0 and 100/,
        'Should reject warning threshold > 100'
      );
      
      // Test invalid error threshold
      assert.throws(
        () => new ContentManager(connection, { storageErrorThreshold: -1 }),
        /Storage error threshold must be between 0 and 100/,
        'Should reject negative error threshold'
      );
      
      assert.throws(
        () => new ContentManager(connection, { storageErrorThreshold: 101 }),
        /Storage error threshold must be between 0 and 100/,
        'Should reject error threshold > 100'
      );
      
      // Test error threshold <= warning threshold
      assert.throws(
        () => new ContentManager(connection, { 
          storageWarningThreshold: 80, 
          storageErrorThreshold: 75 
        }),
        /Storage error threshold must be greater than warning threshold/,
        'Should reject error threshold <= warning threshold'
      );
      
      assert.throws(
        () => new ContentManager(connection, { 
          storageWarningThreshold: 80, 
          storageErrorThreshold: 80 
        }),
        /Storage error threshold must be greater than warning threshold/,
        'Should reject error threshold = warning threshold'
      );
      
    } finally {
      await connection.close();
    }
  });

  test('should handle storage warnings during ingestion', async () => {
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Capture console.warn calls
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };
      
      try {
        const contentManager = new ContentManager(connection, { 
          contentDir: testContentDir,
          maxContentDirSize: '1KB',
          storageWarningThreshold: 70,
          storageErrorThreshold: 95,
          enableStorageTracking: true
        });
        
        // Add content that will trigger warning on next addition
        const initialContent = Buffer.from('x'.repeat(600)); // ~58% of 1KB
        await contentManager.ingestFromMemory(initialContent, { 
          displayName: 'initial.txt' 
        });
        
        // Add content that will push usage over warning threshold
        const warningContent = Buffer.from('x'.repeat(200)); // Will make total ~78%
        await contentManager.ingestFromMemory(warningContent, { 
          displayName: 'warning.txt' 
        });
        
        // Check that warning was issued
        assert.ok(warnings.some(w => w.includes('Storage Warning')), 'Should issue storage warning');
        assert.ok(warnings.some(w => w.includes('cleanup operations')), 'Should suggest cleanup');
        
      } finally {
        console.warn = originalWarn;
      }
      
    } finally {
      await connection.close();
    }
  });
});