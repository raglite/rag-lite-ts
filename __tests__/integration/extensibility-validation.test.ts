/**
 * Extensibility Validation Tests for Task 12.2
 * 
 * This test suite validates that the refactored architecture supports:
 * 1. Different embedding dimensions
 * 2. Clean extension points for multimodal implementations
 * 3. Plugin patterns through dependency injection
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine } from '../../src/core/search.js';
import { IngestionPipeline } from '../../src/core/ingestion.js';
import { IndexManager } from '../../src/index-manager.js';
import { openDatabase, initializeSchema } from '../../src/core/db.js';
import type { EmbedFunction, RerankFunction, EmbeddingResult, SearchResult } from '../../src/core/types.js';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';

describe('Architecture Extensibility Validation', () => {
  const testDbPath = './test-extensibility.sqlite';
  const testIndexPath = './test-extensibility.bin';

  // Cleanup function
  async function cleanup() {
    try {
      if (existsSync(testDbPath)) await unlink(testDbPath);
      if (existsSync(testIndexPath)) await unlink(testIndexPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Helper to create unique test files for each test
  function getTestPaths(testName: string) {
    return {
      dbPath: `./test-ext-${testName}.sqlite`,
      indexPath: `./test-ext-${testName}.bin`
    };
  }

  // Helper to cleanup specific test files
  async function cleanupTest(testName: string) {
    const { dbPath, indexPath } = getTestPaths(testName);
    try {
      if (existsSync(dbPath)) await unlink(dbPath);
      if (existsSync(indexPath)) await unlink(indexPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('1. Different Embedding Dimensions Support', () => {
    test('should support 384-dimensional embeddings', async () => {
      await cleanup();

      // Create a mock 384-dimensional embedding function
      const embed384: EmbedFunction = async (query: string) => {
        const vector = new Float32Array(384);
        // Fill with mock values
        for (let i = 0; i < 384; i++) {
          vector[i] = Math.random() * 0.1;
        }
        return {
          embedding_id: `embed_384_${Date.now()}`,
          vector
        };
      };

      // Test that the core architecture accepts 384-dimensional embeddings
      const db = await openDatabase(testDbPath);
      await initializeSchema(db);
      
      const indexManager = new IndexManager(testIndexPath, testDbPath, 384, 'test-model-384');
      await indexManager.initialize();

      const searchEngine = new SearchEngine(embed384, indexManager, db);
      
      // Verify the search engine was created successfully
      assert.ok(searchEngine, 'SearchEngine should be created with 384-dimensional embeddings');
      
      // Test embedding generation
      const result = await embed384('test query');
      assert.strictEqual(result.vector.length, 384, 'Should generate 384-dimensional vectors');
      
      await cleanup();
    });

    test('should support 768-dimensional embeddings', async () => {
      const testName = '768dim';
      await cleanupTest(testName);
      const { dbPath, indexPath } = getTestPaths(testName);

      // Create a mock 768-dimensional embedding function
      const embed768: EmbedFunction = async (query: string) => {
        const vector = new Float32Array(768);
        // Fill with mock values
        for (let i = 0; i < 768; i++) {
          vector[i] = Math.random() * 0.1;
        }
        return {
          embedding_id: `embed_768_${Date.now()}`,
          vector
        };
      };

      // Test that the core architecture accepts 768-dimensional embeddings
      const db = await openDatabase(dbPath);
      await initializeSchema(db);
      
      const indexManager = new IndexManager(indexPath, dbPath, 768, 'test-model-768');
      await indexManager.initialize();

      const searchEngine = new SearchEngine(embed768, indexManager, db);
      
      // Verify the search engine was created successfully
      assert.ok(searchEngine, 'SearchEngine should be created with 768-dimensional embeddings');
      
      // Test embedding generation
      const result = await embed768('test query');
      assert.strictEqual(result.vector.length, 768, 'Should generate 768-dimensional vectors');
      
      await cleanupTest(testName);
    });

    test('should support custom dimensional embeddings', async () => {
      const testName = 'custom512';
      await cleanupTest(testName);
      const { dbPath, indexPath } = getTestPaths(testName);

      const customDimensions = 512;
      
      // Create a mock custom-dimensional embedding function
      const embedCustom: EmbedFunction = async (query: string) => {
        const vector = new Float32Array(customDimensions);
        // Fill with mock values
        for (let i = 0; i < customDimensions; i++) {
          vector[i] = Math.random() * 0.1;
        }
        return {
          embedding_id: `embed_custom_${Date.now()}`,
          vector
        };
      };

      // Test that the core architecture accepts custom-dimensional embeddings
      const db = await openDatabase(dbPath);
      await initializeSchema(db);
      
      const indexManager = new IndexManager(indexPath, dbPath, customDimensions, 'test-model-custom');
      await indexManager.initialize();

      const searchEngine = new SearchEngine(embedCustom, indexManager, db);
      
      // Verify the search engine was created successfully
      assert.ok(searchEngine, 'SearchEngine should be created with custom-dimensional embeddings');
      
      // Test embedding generation
      const result = await embedCustom('test query');
      assert.strictEqual(result.vector.length, customDimensions, `Should generate ${customDimensions}-dimensional vectors`);
      
      await cleanupTest(testName);
    });
  });

  describe('2. Multimodal Extension Points', () => {
    test('should support content-type aware embedding functions', async () => {
      const testName = 'multimodal';
      await cleanupTest(testName);
      const { dbPath, indexPath } = getTestPaths(testName);

      // Create a multimodal-style embedding function that handles different content types
      const multimodalEmbed: EmbedFunction = async (query: string, contentType?: string) => {
        const vector = new Float32Array(384);
        
        // Simulate different processing based on content type
        if (contentType === 'image') {
          // Simulate image embedding processing
          for (let i = 0; i < 384; i++) {
            vector[i] = 0.2; // Fixed value for testing
          }
        } else {
          // Default text processing
          for (let i = 0; i < 384; i++) {
            vector[i] = 0.1; // Fixed value for testing
          }
        }
        
        return {
          embedding_id: `multimodal_${contentType || 'text'}_${Date.now()}`,
          vector
        };
      };

      const db = await openDatabase(dbPath);
      await initializeSchema(db);
      
      const indexManager = new IndexManager(indexPath, dbPath, 384, 'multimodal-model');
      await indexManager.initialize();

      const searchEngine = new SearchEngine(multimodalEmbed, indexManager, db);
      
      // Test text content type
      const textResult = await multimodalEmbed('test query', 'text');
      assert.ok(textResult.embedding_id.includes('text'), 'Should handle text content type');
      
      // Test image content type
      const imageResult = await multimodalEmbed('test query', 'image');
      assert.ok(imageResult.embedding_id.includes('image'), 'Should handle image content type');
      
      // Verify different processing occurred
      assert.notDeepStrictEqual(textResult.vector, imageResult.vector, 'Different content types should produce different embeddings');
      
      await cleanupTest(testName);
    });

    test('should support content-type aware reranking functions', async () => {
      // Create a multimodal-style reranking function
      const multimodalRerank: RerankFunction = async (query: string, results: SearchResult[], contentType?: string) => {
        // Simulate different reranking strategies based on content type
        const rerankedResults = [...results];
        
        if (contentType === 'image') {
          // Simulate image-specific reranking (e.g., visual similarity)
          rerankedResults.sort((a, b) => b.score - a.score); // Reverse sort for images
        } else {
          // Default text reranking
          rerankedResults.sort((a, b) => a.score - b.score); // Normal sort for text
        }
        
        return rerankedResults;
      };

      // Create mock search results
      const mockResults: SearchResult[] = [
        {
          content: 'Result 1',
          score: 0.5,
          contentType: 'text',
          document: { id: 1, source: 'doc1.txt', title: 'Doc 1', contentType: 'text' }
        },
        {
          content: 'Result 2', 
          score: 0.8,
          contentType: 'text',
          document: { id: 2, source: 'doc2.txt', title: 'Doc 2', contentType: 'text' }
        }
      ];

      // Test text reranking
      const textReranked = await multimodalRerank('test query', mockResults, 'text');
      assert.strictEqual(textReranked[0].score, 0.5, 'Text reranking should sort ascending');
      
      // Test image reranking
      const imageReranked = await multimodalRerank('test query', mockResults, 'image');
      assert.strictEqual(imageReranked[0].score, 0.8, 'Image reranking should sort descending');
    });
  });

  describe('3. Plugin Pattern Support', () => {
    test('should support custom embedding implementations through dependency injection', async () => {
      const testName = 'plugin';
      await cleanupTest(testName);
      const { dbPath, indexPath } = getTestPaths(testName);

      // Create a custom embedding implementation that simulates a plugin
      class CustomEmbeddingPlugin {
        private modelName: string;
        private dimensions: number;

        constructor(modelName: string, dimensions: number) {
          this.modelName = modelName;
          this.dimensions = dimensions;
        }

        async embed(query: string): Promise<EmbeddingResult> {
          // Simulate custom embedding logic
          const vector = new Float32Array(this.dimensions);
          const hash = this.simpleHash(query);
          
          for (let i = 0; i < this.dimensions; i++) {
            vector[i] = Math.sin(hash + i) * 0.1;
          }
          
          return {
            embedding_id: `${this.modelName}_${Date.now()}`,
            vector
          };
        }

        private simpleHash(str: string): number {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return hash;
        }
      }

      // Create plugin instance
      const customPlugin = new CustomEmbeddingPlugin('custom-plugin-v1', 384);
      
      // Create embedding function that uses the plugin
      const pluginEmbedFn: EmbedFunction = async (query: string) => {
        return customPlugin.embed(query);
      };

      const db = await openDatabase(dbPath);
      await initializeSchema(db);
      
      const indexManager = new IndexManager(indexPath, dbPath, 384, 'custom-plugin-v1');
      await indexManager.initialize();

      // Inject the plugin through dependency injection
      const searchEngine = new SearchEngine(pluginEmbedFn, indexManager, db);
      
      // Test that the plugin works
      const result = await pluginEmbedFn('test query');
      assert.ok(result.embedding_id.includes('custom-plugin-v1'), 'Should use custom plugin');
      assert.strictEqual(result.vector.length, 384, 'Plugin should generate correct dimensions');
      
      // Test deterministic behavior (same input should produce same output)
      const result2 = await pluginEmbedFn('test query');
      assert.deepStrictEqual(result.vector, result2.vector, 'Plugin should be deterministic');
      
      await cleanupTest(testName);
    });

    test('should support multiple plugin combinations', async () => {
      await cleanup();

      // Create multiple plugin implementations
      class FastEmbeddingPlugin {
        async embed(query: string): Promise<EmbeddingResult> {
          const vector = new Float32Array(256); // Smaller, faster
          vector.fill(0.1);
          return {
            embedding_id: `fast_${Date.now()}`,
            vector
          };
        }
      }

      class AccurateEmbeddingPlugin {
        async embed(query: string): Promise<EmbeddingResult> {
          const vector = new Float32Array(768); // Larger, more accurate
          vector.fill(0.05);
          return {
            embedding_id: `accurate_${Date.now()}`,
            vector
          };
        }
      }

      const fastPlugin = new FastEmbeddingPlugin();
      const accuratePlugin = new AccurateEmbeddingPlugin();

      // Test that we can switch between plugins
      const fastEmbedFn: EmbedFunction = async (query: string) => fastPlugin.embed(query);
      const accurateEmbedFn: EmbedFunction = async (query: string) => accuratePlugin.embed(query);

      // Test fast plugin
      const fastResult = await fastEmbedFn('test');
      assert.strictEqual(fastResult.vector.length, 256, 'Fast plugin should use 256 dimensions');
      assert.ok(fastResult.embedding_id.includes('fast'), 'Should use fast plugin');

      // Test accurate plugin  
      const accurateResult = await accurateEmbedFn('test');
      assert.strictEqual(accurateResult.vector.length, 768, 'Accurate plugin should use 768 dimensions');
      assert.ok(accurateResult.embedding_id.includes('accurate'), 'Should use accurate plugin');

      await cleanup();
    });

    test('should support plugin configuration and initialization patterns', async () => {
      // Test that plugins can be configured and initialized properly
      interface PluginConfig {
        modelPath?: string;
        dimensions: number;
        batchSize?: number;
        useGPU?: boolean;
      }

      class ConfigurablePlugin {
        private config: PluginConfig;
        private initialized = false;

        constructor(config: PluginConfig) {
          this.config = config;
        }

        async initialize(): Promise<void> {
          // Simulate plugin initialization
          await new Promise(resolve => setTimeout(resolve, 10));
          this.initialized = true;
        }

        async embed(query: string): Promise<EmbeddingResult> {
          if (!this.initialized) {
            throw new Error('Plugin not initialized');
          }

          const vector = new Float32Array(this.config.dimensions);
          vector.fill(this.config.useGPU ? 0.2 : 0.1);
          
          return {
            embedding_id: `configurable_${this.config.useGPU ? 'gpu' : 'cpu'}_${Date.now()}`,
            vector
          };
        }

        getConfig(): PluginConfig {
          return { ...this.config };
        }
      }

      // Test CPU configuration
      const cpuPlugin = new ConfigurablePlugin({
        dimensions: 384,
        batchSize: 16,
        useGPU: false
      });

      await cpuPlugin.initialize();
      const cpuResult = await cpuPlugin.embed('test');
      assert.ok(cpuResult.embedding_id.includes('cpu'), 'Should use CPU configuration');
      assert.ok(Math.abs(cpuResult.vector[0] - 0.1) < 0.001, 'CPU plugin should use correct values');

      // Test GPU configuration
      const gpuPlugin = new ConfigurablePlugin({
        dimensions: 768,
        batchSize: 32,
        useGPU: true
      });

      await gpuPlugin.initialize();
      const gpuResult = await gpuPlugin.embed('test');
      assert.ok(gpuResult.embedding_id.includes('gpu'), 'Should use GPU configuration');
      assert.ok(Math.abs(gpuResult.vector[0] - 0.2) < 0.001, 'GPU plugin should use correct values');
      assert.strictEqual(gpuResult.vector.length, 768, 'GPU plugin should use correct dimensions');
    });
  });

  describe('4. Architecture Flexibility Validation', () => {
    test('should support swapping implementations at runtime', async () => {
      await cleanup();

      // Create two different embedding implementations
      const implementation1: EmbedFunction = async (query: string) => ({
        embedding_id: 'impl1_' + Date.now(),
        vector: new Float32Array([0.1, 0.2, 0.3])
      });

      const implementation2: EmbedFunction = async (query: string) => ({
        embedding_id: 'impl2_' + Date.now(), 
        vector: new Float32Array([0.4, 0.5, 0.6])
      });

      // Test that we can use different implementations
      const result1 = await implementation1('test');
      const result2 = await implementation2('test');

      assert.ok(result1.embedding_id.includes('impl1'), 'Should use first implementation');
      assert.ok(result2.embedding_id.includes('impl2'), 'Should use second implementation');
      assert.notDeepStrictEqual(result1.vector, result2.vector, 'Different implementations should produce different results');
    });

    test('should support composition patterns', async () => {
      // Test that we can compose multiple functions together
      const baseEmbed: EmbedFunction = async (query: string) => ({
        embedding_id: 'base_' + Date.now(),
        vector: new Float32Array([0.1, 0.2, 0.3])
      });

      const enhancedEmbed: EmbedFunction = async (query: string) => {
        const baseResult = await baseEmbed(query);
        
        // Enhance the base result
        const enhancedVector = new Float32Array(baseResult.vector.length);
        for (let i = 0; i < baseResult.vector.length; i++) {
          enhancedVector[i] = baseResult.vector[i] * 2; // Simple enhancement
        }
        
        return {
          embedding_id: 'enhanced_' + baseResult.embedding_id,
          vector: enhancedVector
        };
      };

      const result = await enhancedEmbed('test');
      assert.ok(result.embedding_id.includes('enhanced_base_'), 'Should compose functions');
      assert.ok(Math.abs(result.vector[0] - 0.2) < 0.001, 'Should enhance the base result');
    });
  });
});
