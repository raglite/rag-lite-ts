/**
 * Simple API test to verify basic functionality
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from './index.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Simple API Test', () => {
  test('basic API functionality works', async () => {
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
    `);
    
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Test the README example API
      const embedder = await initializeEmbeddingEngine();
      
      // Test IngestionPipeline constructor variations
      const pipeline1 = new IngestionPipeline('./data/', embedder);
      assert.ok(pipeline1);
      
      const pipeline2 = new IngestionPipeline('./data/');
      assert.ok(pipeline2);
      
      const pipeline3 = new IngestionPipeline();
      assert.ok(pipeline3);
      
      // Test ingestion
      await pipeline1.ingestDirectory('./docs/');
      
      // Verify files were created
      assert.ok(existsSync('./data/db.sqlite'));
      assert.ok(existsSync('./data/vector-index.bin'));
      
      // Test SearchEngine constructor variations
      const engine1 = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      assert.ok(engine1);
      
      const engine2 = new SearchEngine();
      assert.ok(engine2);
      
      // Test search
      const results = await engine1.search('machine learning');
      assert.ok(results);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Verify result structure
      const firstResult = results[0];
      assert.ok('text' in firstResult);
      assert.ok('score' in firstResult);
      assert.ok('document' in firstResult);
      
      console.log('✓ All API tests passed successfully');
    } finally {
      process.chdir(originalCwd);
    }
  });
});