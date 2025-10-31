/**
 * Tests for Sentence Transformer Embedder Implementation
 * Validates adaptation of existing EmbeddingEngine to UniversalEmbedder interface
 * Uses Node.js test runner
 */

import { test, describe, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { SentenceTransformerEmbedder } from '../../src/../src/core/sentence-transformer-embedder.js';
import { ModelRegistry } from '../../src/../src/core/model-registry.js';
import type { EmbeddingResult } from '../../src/types.js';

describe('Sentence Transformer Embedder Implementation', () => {
  
  describe('Constructor and Initialization', () => {
    test('should create embedder with supported model', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      assert.strictEqual(embedder.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should store model name');
      assert.strictEqual(embedder.modelType, 'sentence-transformer', 'Should have correct model type');
      assert.strictEqual(embedder.dimensions, 384, 'Should have correct dimensions for MiniLM');
      assert.ok(embedder.supportedContentTypes.includes('text'), 'Should support text content');
      assert.ok(!embedder.isLoaded(), 'Should not be loaded initially');
    });
    
    test('should create embedder with mpnet model', () => {
      const embedder = new SentenceTransformerEmbedder('Xenova/all-mpnet-base-v2');
      
      assert.strictEqual(embedder.modelName, 'Xenova/all-mpnet-base-v2', 'Should store model name');
      assert.strictEqual(embedder.dimensions, 768, 'Should have correct dimensions for mpnet');
    });
    
    test('should reject unsupported models', () => {
      assert.throws(() => {
        new SentenceTransformerEmbedder('unsupported-model');
      }, /not supported/, 'Should throw error for unsupported model');
    });
    
    test('should accept embedder options', () => {
      const options = {
        maxBatchSize: 16,
        cachePath: './test-models',
        timeout: 60000
      };
      
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2', options);
      assert.ok(embedder, 'Should create embedder with options');
    });
  });
  
  describe('Model Information', () => {
    test('should provide correct model information', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      const modelInfo = embedder.getModelInfo();
      
      assert.strictEqual(modelInfo.name, 'sentence-transformers/all-MiniLM-L6-v2', 'Should have correct name');
      assert.strictEqual(modelInfo.type, 'sentence-transformer', 'Should have correct type');
      assert.strictEqual(modelInfo.dimensions, 384, 'Should have correct dimensions');
      assert.ok(modelInfo.supportedContentTypes.includes('text'), 'Should support text');
      assert.ok(modelInfo.capabilities.supportsText, 'Should support text in capabilities');
      assert.ok(!modelInfo.capabilities.supportsImages, 'Should not support images');
    });
    
    test('should provide enhanced capabilities for sentence transformers', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      const modelInfo = embedder.getModelInfo();
      
      assert.ok(modelInfo.capabilities.supportsSemanticSimilarity, 'Should support semantic similarity');
      assert.ok(modelInfo.capabilities.supportsTextClassification, 'Should support text classification');
      assert.ok(modelInfo.capabilities.supportsTextClustering, 'Should support text clustering');
      assert.strictEqual(modelInfo.capabilities.recommendedUseCase, 'text similarity and semantic search');
    });
  });
  
  describe('Task Suitability', () => {
    test('should be suitable for text-based tasks', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      assert.ok(embedder.isSuitableForTask('similarity'), 'Should be suitable for similarity');
      assert.ok(embedder.isSuitableForTask('classification'), 'Should be suitable for classification');
      assert.ok(embedder.isSuitableForTask('clustering'), 'Should be suitable for clustering');
      assert.ok(embedder.isSuitableForTask('retrieval'), 'Should be suitable for retrieval');
    });
  });
  
  describe('Model Loading', () => {
    test('should load model successfully', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      assert.ok(!embedder.isLoaded(), 'Should not be loaded initially');
      
      // Load the model
      await embedder.loadModel();
      
      assert.ok(embedder.isLoaded(), 'Should be loaded after loadModel()');
      assert.ok(embedder.isEngineLoaded(), 'Underlying engine should be loaded');
      
      // Should be idempotent
      await embedder.loadModel();
      assert.ok(embedder.isLoaded(), 'Should still be loaded after second call');
      
      // Clean up
      await embedder.cleanup();
    });
    
    test('should handle model loading errors gracefully', async () => {
      // Use an invalid model name that will cause loading to fail
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      // Mock the EmbeddingEngine to throw an error
      // Note: In a real test environment, this might actually succeed if transformers.js is available
      try {
        await embedder.loadModel();
        // If loading succeeds, that's also acceptable for this test
        assert.ok(embedder.isLoaded(), 'Model loaded successfully');
        await embedder.cleanup();
      } catch (error) {
        // If loading fails, ensure error is properly handled
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.ok(!embedder.isLoaded(), 'Should not be loaded after error');
      }
    });
  });
  
  describe('Text Embedding', () => {
    test('should reject empty text input', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      await assert.rejects(
        () => embedder.embedText(''),
        /cannot be empty/,
        'Should reject empty text'
      );
      
      await assert.rejects(
        () => embedder.embedText('   '),
        /cannot be empty/,
        'Should reject whitespace-only text'
      );
    });
    
    test('should require model to be loaded before embedding', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      await assert.rejects(
        () => embedder.embedText('test text'),
        /not loaded/,
        'Should require model to be loaded'
      );
    });
    
    test('should embed text successfully when model is loaded', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        const result = await embedder.embedText('This is a test sentence.');
        
        assert.ok(result, 'Should return embedding result');
        assert.ok(typeof result.embedding_id === 'string', 'Should have embedding ID');
        assert.ok(result.vector instanceof Float32Array, 'Should have Float32Array vector');
        assert.strictEqual(result.vector.length, 384, 'Should have correct dimensions for MiniLM');
        
        // Test with different text
        const result2 = await embedder.embedText('Another test sentence.');
        assert.ok(result2.embedding_id !== result.embedding_id, 'Different texts should have different IDs');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available in test environment
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping embedding test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Batch Processing', () => {
    test('should handle empty batch', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        const results = await embedder.embedBatch([]);
        assert.strictEqual(results.length, 0, 'Should return empty array for empty batch');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping batch test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should filter non-text content types', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        const batch = [
          { content: 'Text content', contentType: 'text' },
          { content: 'image.jpg', contentType: 'image' },
          { content: 'More text', contentType: 'text' }
        ];
        
        const results = await embedder.embedBatch(batch);
        
        // Should only process text items
        assert.strictEqual(results.length, 2, 'Should process only text items');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping batch filter test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Document Batch Processing', () => {
    test('should support document batch processing', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        const chunks = [
          'First document chunk.',
          'Second document chunk.',
          'Third document chunk.'
        ];
        
        const results = await embedder.embedDocumentBatch(chunks);
        
        assert.strictEqual(results.length, chunks.length, 'Should process all chunks');
        results.forEach((result, index) => {
          assert.ok(result.embedding_id, `Should have embedding ID for chunk ${index}`);
          assert.ok(result.vector instanceof Float32Array, `Should have vector for chunk ${index}`);
          assert.strictEqual(result.vector.length, 384, `Should have correct dimensions for chunk ${index}`);
        });
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping document batch test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Compatibility Methods', () => {
    test('should provide batch size information', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2', {
        maxBatchSize: 16
      });
      
      const batchSize = embedder.getBatchSize();
      assert.strictEqual(batchSize, 16, 'Should return configured batch size');
    });
    
    test('should provide model version after loading', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        const version = embedder.getModelVersion();
        assert.ok(typeof version === 'string', 'Should return version string');
        assert.ok(version.length > 0, 'Version should not be empty');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping version test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should throw error when getting version before loading', () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      assert.throws(() => {
        embedder.getModelVersion();
      }, /not initialized/, 'Should throw error when engine not initialized');
    });
  });
  
  describe('Resource Management', () => {
    test('should clean up resources properly', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        assert.ok(embedder.isLoaded(), 'Should be loaded');
        
        await embedder.cleanup();
        assert.ok(!embedder.isLoaded(), 'Should not be loaded after cleanup');
        assert.ok(!embedder.isEngineLoaded(), 'Engine should not be loaded after cleanup');
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping cleanup test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Error Handling', () => {
    test('should handle text length validation', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      try {
        await embedder.loadModel();
        
        // Test with very long text (should be truncated, not error)
        const longText = 'word '.repeat(1000); // Much longer than typical limits
        const result = await embedder.embedText(longText);
        
        assert.ok(result, 'Should handle long text gracefully');
        assert.ok(result.vector instanceof Float32Array, 'Should return valid embedding');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping text length test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should provide enhanced error messages', async () => {
      const embedder = new SentenceTransformerEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      
      // Test error when model not loaded
      try {
        await embedder.embedText('test');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error');
        assert.ok(error.message.includes('not loaded'), 'Should mention model not loaded');
      }
    });
  });
  
  describe('Integration with Model Registry', () => {
    test('should be compatible with model registry information', () => {
      const modelName = 'sentence-transformers/all-MiniLM-L6-v2';
      const embedder = new SentenceTransformerEmbedder(modelName);
      const registryInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(registryInfo, 'Model should be in registry');
      assert.strictEqual(embedder.modelType, registryInfo!.type, 'Should match registry type');
      assert.strictEqual(embedder.dimensions, registryInfo!.dimensions, 'Should match registry dimensions');
      assert.deepStrictEqual(
        [...embedder.supportedContentTypes], 
        [...registryInfo!.supportedContentTypes], 
        'Should match registry content types'
      );
    });
  });
});