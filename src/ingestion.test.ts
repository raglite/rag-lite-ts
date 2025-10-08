import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IngestionPipeline, ingestDocuments } from './ingestion.js';
import { openDatabase } from './db.js';

// Test data directory
const TEST_DATA_DIR = 'test-data';
const TEST_DB_PATH = 'test-ingestion.sqlite';
const TEST_INDEX_PATH = 'test-ingestion.bin';

describe('IngestionPipeline', () => {
  let testDataDir: string;

  beforeEach(async () => {
    // Create test data directory
    testDataDir = join(process.cwd(), TEST_DATA_DIR);
    await fs.mkdir(testDataDir, { recursive: true });

    // Create test documents
    await fs.writeFile(
      join(testDataDir, 'doc1.md'),
      '# Test Document 1\n\nThis is the first test document. It contains multiple paragraphs.\n\nThis is the second paragraph with more content to ensure proper chunking behavior.'
    );

    await fs.writeFile(
      join(testDataDir, 'doc2.txt'),
      'Test Document 2\n\nThis is a plain text document. It should be processed correctly by the ingestion pipeline.\n\nAnother paragraph here.'
    );

    await fs.writeFile(
      join(testDataDir, 'doc3.md'),
      '# Large Document\n\n' + 'This is a sentence. '.repeat(100) + '\n\nThis should create multiple chunks due to token limits.'
    );
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.unlink(TEST_DB_PATH).catch(() => {});
      await fs.unlink(TEST_INDEX_PATH).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should initialize pipeline successfully', async () => {
    const pipeline = new IngestionPipeline(testDataDir);
    
    try {
      await pipeline.initialize();
      
      const stats = await pipeline.getStats();
      assert.strictEqual(stats.isInitialized, true);
      assert.ok(stats.indexStats);
    } finally {
      await pipeline.cleanup();
    }
  });

  it('should ingest documents and create chunks', { timeout: 30000 }, async () => {
    const pipeline = new IngestionPipeline(testDataDir);
    
    try {
      const result = await pipeline.ingestPath(testDataDir);
      
      assert.strictEqual(result.documentsProcessed, 3);
      assert.ok(result.chunksCreated > 0);
      assert.ok(result.embeddingsGenerated > 0);
      assert.strictEqual(result.documentErrors, 0);
      assert.ok(result.processingTimeMs > 0);
      
      // Verify database contains data
      const db = await openDatabase(join(testDataDir, 'db.sqlite'));
      try {
        const documents = await db.all('SELECT * FROM documents');
        const chunks = await db.all('SELECT * FROM chunks');
        
        assert.strictEqual(documents.length, 3);
        assert.ok(chunks.length > 0);
        assert.strictEqual(chunks.length, result.chunksCreated);
      } finally {
        await db.close();
      }
      
    } finally {
      await pipeline.cleanup();
    }
  });

  it('should handle single file ingestion', { timeout: 30000 }, async () => {
    const singleFile = join(testDataDir, 'doc1.md');
    
    const result = await ingestDocuments(singleFile);
    
    assert.strictEqual(result.documentsProcessed, 1);
    assert.ok(result.chunksCreated > 0);
    assert.ok(result.embeddingsGenerated > 0);
    assert.strictEqual(result.documentErrors, 0);
  });

  it('should handle empty directory gracefully', async () => {
    const emptyDir = join(testDataDir, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });
    
    const result = await ingestDocuments(emptyDir);
    
    assert.strictEqual(result.documentsProcessed, 0);
    assert.strictEqual(result.chunksCreated, 0);
    assert.strictEqual(result.embeddingsGenerated, 0);
    assert.strictEqual(result.documentErrors, 0);
  });

  it('should handle corrupted files gracefully', { timeout: 30000 }, async () => {
    // Create a file that will cause processing errors
    const corruptedFile = join(testDataDir, 'corrupted.md');
    await fs.writeFile(corruptedFile, ''); // Empty file
    
    const result = await ingestDocuments(testDataDir);
    
    // Should process the good files and report errors for bad ones
    assert.strictEqual(result.documentsProcessed, 3); // Only the good files
    assert.strictEqual(result.documentErrors, 1); // The empty file
  });

  it('should provide progress logging', { timeout: 30000 }, async () => {
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      consoleLogs.push(args.join(' '));
      originalLog(...args);
    };
    
    try {
      await ingestDocuments(testDataDir);
      
      // Check that progress messages were logged
      const progressMessages = consoleLogs.filter(log => 
        log.includes('Phase') || 
        log.includes('Processed') || 
        log.includes('Complete')
      );
      
      assert.ok(progressMessages.length > 0);
    } finally {
      console.log = originalLog;
    }
  });

  it('should handle database initialization', async () => {
    // Test with non-existent database
    const pipeline = new IngestionPipeline(testDataDir);
    
    try {
      await pipeline.initialize();
      
      // Verify database was created and schema initialized
      const db = await openDatabase(join(testDataDir, 'db.sqlite'));
      try {
        // Check that tables exist
        const tables = await db.all(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        const tableNames = tables.map(t => t.name);
        assert.ok(tableNames.includes('documents'));
        assert.ok(tableNames.includes('chunks'));
        assert.ok(tableNames.includes('system_info'));
      } finally {
        await db.close();
      }
    } finally {
      await pipeline.cleanup();
    }
  });
});