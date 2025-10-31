import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  discoverFiles, 
  processFiles, 
  discoverAndProcessFiles,
  DEFAULT_FILE_PROCESSOR_OPTIONS 
} from '../../src/file-processor.js';
import { DocumentPathManager } from '../../src/core/path-manager.js';

// Helper function to create a temporary directory for testing
async function createTempDir(): Promise<string> {
  const tempDir = join(tmpdir(), `rag-lite-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Helper function to clean up temporary directory
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('File Processor', () => {
  test('should discover markdown and text files in directory', async () => {
    const tempDir = await createTempDir();
    
    try {
      // Create test files
      await fs.writeFile(join(tempDir, 'test1.md'), '# Test Document 1\n\nThis is a test.');
      await fs.writeFile(join(tempDir, 'test2.txt'), 'This is a plain text file.');
      await fs.writeFile(join(tempDir, 'ignored.xyz'), 'This should be ignored.');
      await fs.writeFile(join(tempDir, 'README.md'), '# README\n\nProject documentation.');
      
      const result = await discoverFiles(tempDir);
      
      assert.equal(result.files.length, 3);
      assert.equal(result.skipped.length, 0);
      
      // Check that all discovered files are supported types
      const filenames = result.files.map(f => {
        const parts = f.split(/[/\\]/);
        return parts[parts.length - 1];
      });
      assert.ok(filenames.includes('test1.md'));
      assert.ok(filenames.includes('test2.txt'));
      assert.ok(filenames.includes('README.md'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should discover files recursively in subdirectories', async () => {
    const tempDir = await createTempDir();
    
    try {
      // Create nested directory structure
      const subDir = join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      
      await fs.writeFile(join(tempDir, 'root.md'), '# Root Document');
      await fs.writeFile(join(subDir, 'nested.md'), '# Nested Document');
      await fs.writeFile(join(subDir, 'deep.txt'), 'Deep text file');
      
      const result = await discoverFiles(tempDir, { recursive: true });
      
      assert.equal(result.files.length, 3);
      assert.equal(result.skipped.length, 0);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should handle single file input', async () => {
    const tempDir = await createTempDir();
    
    try {
      const testFile = join(tempDir, 'single.md');
      await fs.writeFile(testFile, '# Single File\n\nThis is a single file test.');
      
      const result = await discoverFiles(testFile);
      
      assert.equal(result.files.length, 1);
      assert.equal(result.files[0], testFile);
      assert.equal(result.skipped.length, 0);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should skip unsupported file types', async () => {
    const tempDir = await createTempDir();
    
    try {
      const unsupportedFile = join(tempDir, 'test.xyz');
      await fs.writeFile(unsupportedFile, 'Unsupported content');
      
      const result = await discoverFiles(unsupportedFile);
      
      assert.equal(result.files.length, 0);
      assert.equal(result.skipped.length, 1);
      assert.ok(result.skipped[0].reason.includes('Unsupported file extension'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should skip files that are too large', async () => {
    const tempDir = await createTempDir();
    
    try {
      const largeFile = join(tempDir, 'large.md');
      const largeContent = 'x'.repeat(1000); // 1KB content
      await fs.writeFile(largeFile, largeContent);
      
      // Set max file size to 500 bytes
      const result = await discoverFiles(tempDir, { maxFileSize: 500 });
      
      assert.equal(result.files.length, 0);
      assert.equal(result.skipped.length, 1);
      assert.ok(result.skipped[0].reason.includes('exceeds maximum'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should handle non-existent paths gracefully', async () => {
    const nonExistentPath = join(tmpdir(), 'non-existent-path-12345');
    
    const result = await discoverFiles(nonExistentPath);
    
    assert.equal(result.files.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.ok(result.skipped[0].reason.includes('Failed to access path'));
  });

  test('should process files into documents with correct metadata', async () => {
    const tempDir = await createTempDir();
    
    try {
      const file1 = join(tempDir, 'doc1.md');
      const file2 = join(tempDir, 'doc2.txt');
      
      await fs.writeFile(file1, '# Document Title\n\nThis is the content of document 1.');
      await fs.writeFile(file2, 'This is a plain text document without a title.');
      
      const pathManager = new DocumentPathManager('relative', tempDir);
      const result = await processFiles([file1, file2], pathManager);
      
      assert.equal(result.documents.length, 2);
      assert.equal(result.errors.length, 0);
      
      // Check first document (with markdown title) - now using relative paths
      const doc1 = result.documents.find(d => d.source === 'doc1.md');
      assert.ok(doc1);
      assert.equal(doc1.title, 'Document Title');
      assert.ok(doc1.content.includes('This is the content'));
      
      // Check second document (title from filename) - now using relative paths
      const doc2 = result.documents.find(d => d.source === 'doc2.txt');
      assert.ok(doc2);
      assert.equal(doc2.title, 'doc2');
      assert.equal(doc2.content, 'This is a plain text document without a title.');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should handle corrupted/unreadable files gracefully', async () => {
    const tempDir = await createTempDir();
    
    try {
      const goodFile = join(tempDir, 'good.md');
      const emptyFile = join(tempDir, 'empty.md');
      
      await fs.writeFile(goodFile, '# Good Document\n\nThis is readable.');
      await fs.writeFile(emptyFile, '   \n\n   '); // Only whitespace
      
      const pathManager = new DocumentPathManager('relative', tempDir);
      const result = await processFiles([goodFile, emptyFile], pathManager);
      
      assert.equal(result.documents.length, 1);
      assert.equal(result.errors.length, 1);
      
      // Check that good file was processed
      assert.equal(result.documents[0].title, 'Good Document');
      
      // Check that empty file was skipped with error
      assert.equal(result.errors[0].path, emptyFile);
      assert.ok(result.errors[0].error.includes('empty'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should extract titles from markdown headers correctly', async () => {
    const tempDir = await createTempDir();
    
    try {
      const testCases = [
        { filename: 'h1.md', content: '# Main Title\n\nContent here.', expectedTitle: 'Main Title' },
        { filename: 'no-h1.md', content: '## Subtitle\n\nNo H1 header.', expectedTitle: 'no-h1' },
        { filename: 'empty-h1.md', content: '#   \n\nEmpty H1.', expectedTitle: 'empty-h1' },
        { filename: 'multiple-h1.md', content: '# First Title\n\n# Second Title', expectedTitle: 'First Title' }
      ];
      
      const filePaths: string[] = [];
      
      for (const testCase of testCases) {
        const filePath = join(tempDir, testCase.filename);
        await fs.writeFile(filePath, testCase.content);
        filePaths.push(filePath);
      }
      
      const pathManager = new DocumentPathManager('relative', tempDir);
      const result = await processFiles(filePaths, pathManager);
      
      assert.equal(result.documents.length, 4);
      assert.equal(result.errors.length, 0);
      
      for (let i = 0; i < testCases.length; i++) {
        const doc = result.documents.find(d => d.source.endsWith(testCases[i].filename));
        assert.ok(doc, `Document for ${testCases[i].filename} not found`);
        assert.equal(doc.title, testCases[i].expectedTitle);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should complete end-to-end discovery and processing', async () => {
    const tempDir = await createTempDir();
    
    try {
      // Create a mix of files
      await fs.writeFile(join(tempDir, 'doc1.md'), '# Document 1\n\nContent 1');
      await fs.writeFile(join(tempDir, 'doc2.txt'), 'Plain text content');
      await fs.writeFile(join(tempDir, 'ignored.xyz'), 'Should be ignored');
      
      const subDir = join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(join(subDir, 'nested.md'), '# Nested Doc\n\nNested content');
      
      const result = await discoverAndProcessFiles(tempDir);
      
      assert.equal(result.documents.length, 3);
      assert.equal(result.discoveryResult.files.length, 3);
      assert.equal(result.processingResult.documents.length, 3);
      assert.equal(result.processingResult.errors.length, 0);
      
      // Verify document contents
      const titles = result.documents.map(d => d.title).sort();
      assert.deepEqual(titles, ['Document 1', 'Nested Doc', 'doc2']);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
