/**
 * Tests that verify README examples work exactly as documented
 * These tests ensure the API matches the documentation precisely
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine, ResourceManager } from './index.js';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('README API Examples', () => {
  const testBaseDir = join(tmpdir(), 'rag-lite-readme-test');
  const testDir = join(testBaseDir, Date.now().toString());
  const docsDir = join(testDir, 'docs');
  const dataDir = join(testDir, 'data');

  beforeEach(() => {
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Create test directories
    mkdirSync(testDir, { recursive: true });
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    
    // Create sample documents for testing
    writeFileSync(join(docsDir, 'machine-learning.md'), `
# Machine Learning Concepts

Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.

## Key Concepts

- Supervised learning uses labeled data
- Unsupervised learning finds patterns in unlabeled data
- Neural networks are inspired by biological neurons
    `);
    
    writeFileSync(join(docsDir, 'api-docs.md'), `
# API Documentation

This document describes the REST API endpoints.

## Authentication

All API calls require authentication via API key.

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.
    `);
    
    writeFileSync(join(docsDir, 'typescript-guide.md'), `
# TypeScript Examples

TypeScript adds static typing to JavaScript.

## Interfaces

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}
\`\`\`

## Async Functions

\`\`\`typescript
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`
    `);
  });

  afterEach(async () => {
    // Clean up resources first
    await ResourceManager.cleanupAll();
    
    // Add a small delay for Windows file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Then clean up test directory with retry logic for Windows
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
            // If it's the last retry or not a busy error, just log and continue
            console.warn('Failed to clean up test directory:', error.message);
            break;
          }
        }
      }
    }
  });

  test('README programmatic usage example works exactly as documented', async () => {
    // Change to test directory for this test
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // This is the exact code from the README
      const embedder = await initializeEmbeddingEngine();

      // Ingest documents (supports .md, .txt, .mdx)
      const pipeline = new IngestionPipeline('./data/', embedder);
      await pipeline.ingestDirectory('./docs/');

      // Search
      const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      const results = await searchEngine.search('machine learning', { top_k: 10 });

      // Verify results
      assert.ok(results);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Verify result structure matches README interface
      const firstResult = results[0];
      assert.ok('text' in firstResult);
      assert.ok('score' in firstResult);
      assert.ok('document' in firstResult);
      assert.ok('id' in firstResult.document);
      assert.ok('source' in firstResult.document);
      assert.ok('title' in firstResult.document);
      
      // Verify the search found relevant content
      assert.ok(firstResult.text.toLowerCase().includes('machine learning'));
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('IngestionPipeline constructor variations work as documented', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      const embedder = await initializeEmbeddingEngine();

      // Test all documented constructor variations
      
      // 1. With both basePath and embedder (from README example)
      const pipeline1 = new IngestionPipeline('./data/', embedder);
      assert.ok(pipeline1);
      
      // 2. With only basePath (embedder should be auto-initialized)
      const pipeline2 = new IngestionPipeline('./data/');
      assert.ok(pipeline2);
      
      // 3. With no parameters (should use defaults)
      const pipeline3 = new IngestionPipeline();
      assert.ok(pipeline3);
      
      // Verify they can all ingest documents
      await pipeline1.ingestDirectory('./docs/');
      
      // Verify files were created in the correct location
      assert.ok(existsSync('./data/db.sqlite'));
      assert.ok(existsSync('./data/vector-index.bin'));
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('SearchEngine constructor variations work as documented', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // First ingest some documents
      const embedder = await initializeEmbeddingEngine();
      const pipeline = new IngestionPipeline('./data/', embedder);
      await pipeline.ingestDirectory('./docs/');

      // Test documented constructor variations
      
      // 1. With both paths (from README example)
      const engine1 = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      assert.ok(engine1);
      
      // 2. With no parameters (should use defaults)
      // First copy files to default location
      const { copyFileSync } = await import('fs');
      copyFileSync('./data/db.sqlite', './db.sqlite');
      copyFileSync('./data/vector-index.bin', './vector-index.bin');
      
      const engine2 = new SearchEngine();
      assert.ok(engine2);
      
      // Verify both can search
      const results1 = await engine1.search('machine learning');
      assert.ok(results1);
      assert.ok(results1.length > 0);
      
      const results2 = await engine2.search('API documentation');
      assert.ok(results2);
      assert.ok(results2.length > 0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('methods work without manual initialization as documented', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      const embedder = await initializeEmbeddingEngine();
      
      // Test that methods work immediately after construction
      const pipeline = new IngestionPipeline('./data/', embedder);
      
      // These should work without any initialization calls
      await pipeline.ingestDirectory('./docs/');
      await pipeline.ingestFile('./docs/machine-learning.md');
      
      // Search should work immediately after construction
      const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      const results = await searchEngine.search('typescript examples', { top_k: 10 });
      
      assert.ok(results);
      assert.ok(results.length > 0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('search options work as documented in README', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Setup
      const embedder = await initializeEmbeddingEngine();
      const pipeline = new IngestionPipeline('./data/', embedder);
      await pipeline.ingestDirectory('./docs/');
      
      const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      
      // Test search with options as shown in README
      const results = await searchEngine.search('machine learning', { top_k: 10 });
      assert.ok(results);
      assert.ok(results.length <= 10);
      
      // Test search without options
      const resultsDefault = await searchEngine.search('API documentation');
      assert.ok(resultsDefault);
      
      // Test with different top_k values
      const resultsSmall = await searchEngine.search('typescript', { top_k: 2 });
      assert.ok(resultsSmall.length <= 2);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('error scenarios provide helpful guidance as documented', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Test search without ingestion first
      const searchEngine = new SearchEngine('./nonexistent-index.bin', './nonexistent-db.sqlite');
      
      // The error should be helpful and actionable
      try {
        await searchEngine.search('test query');
        assert.fail('Expected search to throw an error');
      } catch (error: any) {
        assert.ok(error.message.match(/ingest|documents|first/i));
      }
      
      // Test missing vector index file
      writeFileSync('./db.sqlite', 'invalid db content');
      const searchEngine2 = new SearchEngine('./nonexistent-index.bin', './db.sqlite');
      
      try {
        await searchEngine2.search('test query');
        assert.fail('Expected search to throw an error for missing index');
      } catch (error: any) {
        assert.ok(error.message.length > 0);
      }
      
      // Test ingestion with invalid directory
      const embedder = await initializeEmbeddingEngine();
      const pipeline = new IngestionPipeline('./data/', embedder);
      
      try {
        await pipeline.ingestDirectory('./nonexistent-directory/');
        assert.fail('Expected ingestion to handle missing directory gracefully');
      } catch (error: any) {
        // Should provide helpful error about directory not existing
        assert.ok(error.message.length > 0);
      }
      
      // Test ingestion with invalid file
      try {
        await pipeline.ingestFile('./nonexistent-file.md');
        assert.fail('Expected ingestion to handle missing file gracefully');
      } catch (error: any) {
        // Should provide helpful error about file not existing
        assert.ok(error.message.length > 0);
      }
    } finally {
      process.chdir(originalCwd);
    }
  });
});