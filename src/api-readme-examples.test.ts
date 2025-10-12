/**
 * Tests that verify README examples work exactly as documented
 * These tests ensure the API matches the documentation precisely
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from './index.js';
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
- Deep learning uses multi-layer neural networks
    `);
    
    writeFileSync(join(docsDir, 'api-docs.md'), `
# API Documentation

This document describes the REST API endpoints for our service.

## Authentication

All API calls require authentication via API key in the header.

## Endpoints

### GET /search
Search for documents using natural language queries.

### POST /documents
Upload new documents to the knowledge base.
    `);

    writeFileSync(join(docsDir, 'getting-started.md'), `
# Getting Started Guide

Welcome to our platform! This guide will help you get up and running quickly.

## Installation

1. Install the required dependencies
2. Configure your environment
3. Run the setup script

## First Steps

After installation, you can start by creating your first project.
    `);
  });

  afterEach(async () => {
    // Add a small delay for Windows file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clean up test directory
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
            console.warn('Failed to clean up test directory:', error.message);
            break;
          }
        }
      }
    }
  });

  test('Quick Start Example', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // README Quick Start Example
      
      // Simple ingestion - just works!
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      await ingestion.ingestDirectory('./docs');
      
      // Simple search - just works!
      const search = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      const results = await search.search('machine learning concepts');
      
      // Verify the example works
      assert.ok(results);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Verify result structure
      const firstResult = results[0];
      assert.ok('content' in firstResult);
      assert.ok('score' in firstResult);
      assert.ok('document' in firstResult);
      assert.ok('contentType' in firstResult);
      
      console.log('✓ Quick Start example works');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Configuration Example', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // README Configuration Example
      
      const search = new SearchEngine('./data/vector-index.bin', './data/db.sqlite', {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        enableReranking: true
      });
      
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin', {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        chunkSize: 300,
        chunkOverlap: 60
      });
      
      // Test the configured instances
      await ingestion.ingestDirectory('./docs');
      const results = await search.search('API documentation');
      
      assert.ok(results);
      assert.ok(Array.isArray(results));
      
      console.log('✓ Configuration example works');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Advanced Usage Example - Custom Dependencies', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // First ingest with default settings
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      await ingestion.ingestDirectory('./docs');
      
      // Advanced Usage: Custom Dependencies
      const customEmbedFn = async (query: string) => {
        // Custom embedding logic (mock for testing)
        return {
          embedding_id: 'custom_' + Date.now(),
          vector: new Float32Array(384).fill(0.1),
          contentType: 'text'
        };
      };
      
      const customRerankFn = async (query: string, results: any[]) => {
        // Custom reranking logic (mock for testing)
        return results.map(r => ({ ...r, score: r.score * 1.1 }));
      };
      
      const search = new SearchEngine('./data/vector-index.bin', './data/db.sqlite', {
        embedFn: customEmbedFn,
        rerankFn: customRerankFn
      });
      
      const results = await search.search('neural networks');
      assert.ok(results);
      assert.ok(Array.isArray(results));
      
      console.log('✓ Advanced usage example works');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Factory Pattern Example', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // Using factory functions for complex scenarios
      const { TextSearchFactory, TextIngestionFactory } = await import('./index.js');
      
      // Factory-based ingestion
      const ingestion = await TextIngestionFactory.create('./data/db.sqlite', './data/vector-index.bin', {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      await ingestion.ingestDirectory('./docs');
      
      // Factory-based search
      const search = await TextSearchFactory.create('./data/vector-index.bin', './data/db.sqlite', {
        enableReranking: true
      });
      
      const results = await search.search('getting started');
      assert.ok(results);
      assert.ok(Array.isArray(results));
      
      console.log('✓ Factory pattern example works');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Error Handling Examples', async () => {
    // Test that error handling works as documented
    
    // Missing files should provide clear error messages (async since initialization is lazy)
    const searchEngine = new SearchEngine('./missing-index.bin', './missing-db.sqlite');
    await assert.rejects(async () => {
      await searchEngine.search('test query');
    }, /Vector index not found/);
    
    // Invalid parameters should provide clear error messages
    assert.throws(() => {
      new IngestionPipeline('', '');
    }, /Both dbPath and indexPath are required/);
    
    console.log('✓ Error handling examples work as documented');
  });

  test('Search Result Structure', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // Test that search results have the documented structure
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      await ingestion.ingestDirectory('./docs');
      
      const search = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      const results = await search.search('machine learning');
      
      assert.ok(results.length > 0);
      
      // Verify result structure as documented
      const result = results[0];
      assert.ok(typeof result.content === 'string');
      assert.ok(typeof result.score === 'number');
      assert.ok(typeof result.contentType === 'string');
      assert.ok(typeof result.document === 'object');
      assert.ok(typeof result.document.id === 'number');
      assert.ok(typeof result.document.source === 'string');
      assert.ok(typeof result.document.title === 'string');
      assert.ok(typeof result.document.contentType === 'string');
      
      console.log('✓ Search result structure matches documentation');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Multiple Search Queries', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // Test multiple different search queries work correctly
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      await ingestion.ingestDirectory('./docs');
      
      const search = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
      
      // Test different types of queries
      const mlResults = await search.search('machine learning');
      const apiResults = await search.search('API documentation');
      const startResults = await search.search('getting started');
      
      assert.ok(mlResults.length > 0);
      assert.ok(apiResults.length > 0);
      assert.ok(startResults.length > 0);
      
      // Results should be different for different queries (if both have results)
      if (mlResults.length > 0 && apiResults.length > 0 && mlResults[0] && apiResults[0]) {
        assert.notStrictEqual(mlResults[0].content, apiResults[0].content);
      }
      
      console.log('✓ Multiple search queries work correctly');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Ingestion Statistics', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      // Test that ingestion provides useful statistics
      const ingestion = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
      const result = await ingestion.ingestDirectory('./docs');
      
      // Verify ingestion result structure
      assert.ok(typeof result.documentsProcessed === 'number');
      assert.ok(typeof result.chunksCreated === 'number');
      assert.ok(typeof result.embeddingsGenerated === 'number');
      assert.ok(typeof result.processingTimeMs === 'number');
      
      assert.ok(result.documentsProcessed > 0);
      assert.ok(result.chunksCreated > 0);
      assert.ok(result.embeddingsGenerated > 0);
      assert.ok(result.processingTimeMs > 0);
      
      console.log('✓ Ingestion statistics work as documented');
    } finally {
      process.chdir(originalCwd);
    }
  });
});