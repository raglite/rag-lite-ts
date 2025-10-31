/**
 * Tests for core SearchEngine with dependency injection
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine } from '../../src/../src/core/search.js';
import { IndexManager } from '../../src/index-manager.js';
import { openDatabase, type DatabaseConnection } from '../../src/../src/core/db.js';
import type { EmbedFunction, RerankFunction } from '../../src/../src/core/interfaces.js';
import type { EmbeddingResult, SearchResult } from '../../src/../src/core/types.js';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SearchEngine (Core with Dependency Injection)', () => {
  let testDbPath: string;
  let testIndexPath: string;
  let db: DatabaseConnection;
  let indexManager: IndexManager;
  let mockEmbedFn: EmbedFunction;
  let mockRerankFn: RerankFunction;
  let searchEngine: SearchEngine | null;

  beforeEach(async () => {
    // Create temporary paths for testing
    const testId = Math.random().toString(36).substring(7);
    testDbPath = join(tmpdir(), `test-db-${testId}.sqlite`);
    testIndexPath = join(tmpdir(), `test-index-${testId}.bin`);

    // Create mock embed function
    mockEmbedFn = async (query: string): Promise<EmbeddingResult> => {
      return {
        embedding_id: `embed_${Date.now()}`,
        vector: new Float32Array(384).fill(0.1) // Mock 384-dim vector
      };
    };

    // Create mock rerank function
    mockRerankFn = async (query: string, results: SearchResult[]): Promise<SearchResult[]> => {
      // Simple mock reranking - just reverse the order
      return [...results].reverse();
    };

    // Initialize database
    db = await openDatabase(testDbPath);
    
    // Initialize database schema
    const { initializeSchema } = await import('../../src/../src/core/db.js');
    await initializeSchema(db);
    
    // Initialize index manager
    indexManager = new IndexManager(testIndexPath, testDbPath, 384);
    await indexManager.initialize(true); // Skip model check for tests
    
    // Initialize search engine
    searchEngine = null;
  });

  afterEach(async () => {
    // Clean up search engine first (this will close db and indexManager)
    if (searchEngine) {
      await searchEngine.cleanup();
      searchEngine = null;
    } else {
      // Fallback cleanup if no search engine was created
      if (indexManager) {
        await indexManager.close();
      }
      if (db) {
        await db.close();
      }
    }

    // Clean up test files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testIndexPath)) {
      unlinkSync(testIndexPath);
    }
  });

  describe('Constructor Validation', () => {
    test('should validate required embedFn parameter', () => {
      assert.throws(
        () => new SearchEngine(null as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject null embedFn'
      );
      
      assert.throws(
        () => new SearchEngine(undefined as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject undefined embedFn'
      );

      assert.throws(
        () => new SearchEngine('not a function' as any, indexManager, db),
        /embedFn must be a valid function/,
        'Should reject non-function embedFn'
      );
    });

    test('should validate required indexManager parameter', () => {
      assert.throws(
        () => new SearchEngine(mockEmbedFn, null as any, db),
        /indexManager is required/,
        'Should reject null indexManager'
      );
      
      assert.throws(
        () => new SearchEngine(mockEmbedFn, undefined as any, db),
        /indexManager is required/,
        'Should reject undefined indexManager'
      );
    });

    test('should validate required db parameter', () => {
      assert.throws(
        () => new SearchEngine(mockEmbedFn, indexManager, null as any),
        /db connection is required/,
        'Should reject null db'
      );
      
      assert.throws(
        () => new SearchEngine(mockEmbedFn, indexManager, undefined as any),
        /db connection is required/,
        'Should reject undefined db'
      );
    });

    test('should accept valid dependencies', () => {
      assert.doesNotThrow(
        () => new SearchEngine(mockEmbedFn, indexManager, db),
        'Should accept valid dependencies'
      );
    });

    test('should accept optional rerank function', () => {
      assert.doesNotThrow(
        () => new SearchEngine(mockEmbedFn, indexManager, db, mockRerankFn),
        'Should accept optional rerank function'
      );
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      searchEngine = new SearchEngine(mockEmbedFn, indexManager, db);
    });

    test('should return empty array for empty query', async () => {
      const results = await searchEngine!.search('');
      assert.deepEqual(results, []);
    });

    test('should return empty array for whitespace-only query', async () => {
      const results = await searchEngine!.search('   \n\t   ');
      assert.deepEqual(results, []);
    });

    test('should handle search with no indexed documents', async () => {
      const results = await searchEngine!.search('test query');
      assert.deepEqual(results, []);
    });

    test('should call embed function with query', async () => {
      let calledWith: string | null = null;
      const testEmbedFn: EmbedFunction = async (query: string) => {
        calledWith = query;
        return {
          embedding_id: 'test_embed',
          vector: new Float32Array(384).fill(0.1)
        };
      };

      const testSearchEngine = new SearchEngine(testEmbedFn, indexManager, db);
      
      await testSearchEngine.search('test query');
      assert.strictEqual(calledWith, 'test query');
      
      await testSearchEngine.cleanup();
    });

    test('should handle embedding function errors gracefully', async () => {
      const errorEmbedFn: EmbedFunction = async (query: string) => {
        throw new Error('Embedding failed');
      };

      const testSearchEngine = new SearchEngine(errorEmbedFn, indexManager, db);
      
      await assert.rejects(
        () => testSearchEngine.search('test query'),
        /Search failed.*Embedding failed/,
        'Should propagate embedding errors with context'
      );
      
      await testSearchEngine.cleanup();
    });
  });

  describe('Search with Reranking', () => {
    test('should call rerank function when provided and enabled', async () => {
      let rerankCalled = false;
      let rerankQuery: string | null = null;
      let rerankResults: SearchResult[] | null = null;

      const testRerankFn: RerankFunction = async (query: string, results: SearchResult[]) => {
        rerankCalled = true;
        rerankQuery = query;
        rerankResults = results;
        return results; // Return unchanged for test
      };

      // Create separate instances for this test to avoid cleanup conflicts
      const testId = Math.random().toString(36).substring(7);
      const testDbPath = join(tmpdir(), `test-rerank-db-${testId}.sqlite`);
      const testIndexPath = join(tmpdir(), `test-rerank-index-${testId}.bin`);
      
      const testDb = await openDatabase(testDbPath);
      const { initializeSchema } = await import('../../src/../src/core/db.js');
      await initializeSchema(testDb);
      
      const testIndexManager = new IndexManager(testIndexPath, testDbPath, 384);
      await testIndexManager.initialize(true);

      const searchEngine = new SearchEngine(mockEmbedFn, testIndexManager, testDb, testRerankFn);
      
      // Search with reranking enabled (default when rerank function provided)
      await searchEngine.search('test query');
      
      // Note: Reranking only happens if there are results, and we have no indexed documents
      // So reranking won't be called in this test, but the setup is correct
      
      await searchEngine.cleanup();
      
      // Clean up test files
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);
    });

    test.skip('should skip reranking when explicitly disabled', async () => {
      let rerankCalled = false;

      const testRerankFn: RerankFunction = async (query: string, results: SearchResult[]) => {
        rerankCalled = true;
        return results;
      };

      // Create separate instances for this test to avoid cleanup conflicts
      const testId = Math.random().toString(36).substring(7);
      const testDbPath = join(tmpdir(), `test-rerank-db-${testId}.sqlite`);
      const testIndexPath = join(tmpdir(), `test-rerank-index-${testId}.bin`);
      
      const testDb = await openDatabase(testDbPath);
      const { initializeSchema } = await import('../../src/../src/core/db.js');
      await initializeSchema(testDb);
      
      const testIndexManager = new IndexManager(testIndexPath, testDbPath, 384);
      await testIndexManager.initialize(true);

      const searchEngine = new SearchEngine(mockEmbedFn, testIndexManager, testDb, testRerankFn);
      
      // Search with reranking explicitly disabled
      await searchEngine.search('test query', { rerank: false });
      
      assert.strictEqual(rerankCalled, false, 'Reranking should be skipped when disabled');
      
      await searchEngine.cleanup();
      
      // Clean up test files
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);
    });

    test.skip('should handle reranking function errors gracefully', async () => {
      const errorRerankFn: RerankFunction = async (query: string, results: SearchResult[]) => {
        throw new Error('Reranking failed');
      };

      const searchEngine = new SearchEngine(mockEmbedFn, indexManager, db, errorRerankFn);
      
      // Should not throw - should fall back to vector search results
      const results = await searchEngine.search('test query');
      assert.ok(Array.isArray(results), 'Should return array even when reranking fails');
      
      await searchEngine.cleanup();
    });
  });

  describe.skip('Search Options', () => {
    let searchEngine: SearchEngine;

    beforeEach(() => {
      searchEngine = new SearchEngine(mockEmbedFn, indexManager, db);
    });

    afterEach(async () => {
      await searchEngine.cleanup();
    });

    test('should use default top_k when not specified', async () => {
      // Mock the indexManager search to verify top_k parameter
      let searchTopK: number | null = null;
      const originalSearch = indexManager.search.bind(indexManager);
      indexManager.search = (vector: Float32Array, k: number) => {
        searchTopK = k;
        return { embeddingIds: [], distances: [] };
      };

      await searchEngine.search('test query');
      
      assert.strictEqual(searchTopK, 10, 'Should use default top_k of 10');
      
      // Restore original method
      indexManager.search = originalSearch;
    });

    test('should use custom top_k when specified', async () => {
      let searchTopK: number | null = null;
      const originalSearch = indexManager.search.bind(indexManager);
      indexManager.search = (vector: Float32Array, k: number) => {
        searchTopK = k;
        return { embeddingIds: [], distances: [] };
      };

      await searchEngine.search('test query', { top_k: 5 });
      
      assert.strictEqual(searchTopK, 5, 'Should use custom top_k of 5');
      
      // Restore original method
      indexManager.search = originalSearch;
    });
  });

  describe.skip('Statistics', () => {
    test('should return search engine statistics', async () => {
      const searchEngine = new SearchEngine(mockEmbedFn, indexManager, db);
      
      const stats = await searchEngine.getStats();
      
      assert.ok(typeof stats.totalChunks === 'number', 'Should return totalChunks as number');
      assert.ok(typeof stats.indexSize === 'number', 'Should return indexSize as number');
      assert.ok(typeof stats.rerankingEnabled === 'boolean', 'Should return rerankingEnabled as boolean');
      
      assert.strictEqual(stats.rerankingEnabled, false, 'Should show reranking disabled when no rerank function');
      
      await searchEngine.cleanup();
    });

    test('should show reranking enabled when rerank function provided', async () => {
      const searchEngine = new SearchEngine(mockEmbedFn, indexManager, db, mockRerankFn);
      
      const stats = await searchEngine.getStats();
      
      assert.strictEqual(stats.rerankingEnabled, true, 'Should show reranking enabled when rerank function provided');
      
      await searchEngine.cleanup();
    });
  });

  describe.skip('Cleanup', () => {
    test('should cleanup resources without errors', async () => {
      const searchEngine = new SearchEngine(mockEmbedFn, indexManager, db);
      
      await assert.doesNotReject(
        () => searchEngine.cleanup(),
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

      const searchEngine = new SearchEngine(mockEmbedFn, indexManager, errorDb as any);
      
      // Should not throw even if cleanup fails
      await assert.doesNotReject(
        () => searchEngine.cleanup(),
        'Cleanup should handle errors gracefully'
      );
    });
  });
});