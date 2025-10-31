/**
 * Simple API test to verify basic functionality with clean architecture
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from '../../src/index.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Simple API Test - Clean Architecture', () => {
  test('basic API functionality works with constructor patterns', async () => {
    const testDir = join(tmpdir(), 'rag-lite-simple-test', Date.now().toString());
    const docsDir = join(testDir, 'docs');
    const dataDir = join(testDir, 'data');
    
    // Create test directories
    mkdirSync(testDir, { recursive: true });
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    
    // Create a test document
    writeFileSync(join(docsDir, 'test.md'), `
# Test Document

This is a test document for API validation.

## Content

Machine learning is a powerful technology.
Natural language processing is another important field.
Deep learning has revolutionized artificial intelligence.
    `);
    
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Test the API patterns
      
      // Test IngestionPipeline with constructor signature (dbPath, indexPath, options)
      const pipeline1 = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      assert.ok(pipeline1);
      
      // Test IngestionPipeline with options
      const pipeline2 = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin', {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        chunkSize: 250
      });
      assert.ok(pipeline2);
      
      // Test ingestion
      await pipeline1.ingestDirectory('./docs/');
      
      // Verify files were created
      assert.ok(existsSync('./data/db.sqlite'));
      assert.ok(existsSync('./data/vector-index.bin'));
      
      // Test SearchEngine with new constructor signature (indexPath, dbPath, options)
      const engine1 = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      assert.ok(engine1);
      
      // Test SearchEngine with options
      const engine2 = new SearchEngine('./data/vector-index.bin', './data/db.sqlite', {
        enableReranking: true
      });
      assert.ok(engine2);
      
      // Test search
      const results = await engine1.search('machine learning');
      assert.ok(results);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Verify result structure
      const firstResult = results[0];
      assert.ok('content' in firstResult);
      assert.ok('score' in firstResult);
      assert.ok('document' in firstResult);
      assert.ok('contentType' in firstResult);
      
      // Test that we can search for different terms
      const results2 = await engine1.search('artificial intelligence');
      assert.ok(results2);
      assert.ok(Array.isArray(results2));
      
      console.log('✓ All API tests passed successfully');
    } finally {
      process.chdir(originalCwd);
    }
  });
  
  test('constructor validation works correctly', () => {
    // Test that constructors validate required parameters
    assert.throws(() => {
      new IngestionPipeline('', './index.bin');
    }, /Both dbPath and indexPath are required/);
    
    assert.throws(() => {
      new IngestionPipeline('./db.sqlite', '');
    }, /Both dbPath and indexPath are required/);
    
    assert.throws(() => {
      new SearchEngine('', './db.sqlite');
    }, /Both indexPath and dbPath are required/);
    
    assert.throws(() => {
      new SearchEngine('./index.bin', '');
    }, /Both indexPath and dbPath are required/);
    
    console.log('✓ Constructor validation tests passed');
  });
});
