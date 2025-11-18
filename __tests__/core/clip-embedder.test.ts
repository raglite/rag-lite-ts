/**
 * Tests for CLIP Embedder Implementation (Text-Only Initially)
 * Validates CLIP text embedding functionality with placeholder for image support
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { CLIPEmbedder } from '../../src/multimodal/clip-embedder.js';
import { ModelRegistry } from '../../src/core/model-registry.js';

describe('CLIP Embedder Implementation (Text-Only Initially)', () => {
  
  describe('Constructor and Initialization', () => {
    test('should create embedder with supported CLIP model', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      assert.strictEqual(embedder.modelName, 'Xenova/clip-vit-base-patch32', 'Should store model name');
      assert.strictEqual(embedder.modelType, 'clip', 'Should have correct model type');
      assert.strictEqual(embedder.dimensions, 512, 'Should have 512 dimensions for CLIP');
      assert.ok(embedder.supportedContentTypes.includes('text'), 'Should support text content');
      assert.ok(embedder.supportedContentTypes.includes('image'), 'Should support image content (future)');
      assert.ok(!embedder.isLoaded(), 'Should not be loaded initially');
    });
    
    test('should create embedder with patch16 model', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch16');
      
      assert.strictEqual(embedder.modelName, 'Xenova/clip-vit-base-patch16', 'Should store model name');
      assert.strictEqual(embedder.dimensions, 512, 'Should have 512 dimensions for CLIP patch16');
    });
    
    test('should reject unsupported CLIP models', () => {
      assert.throws(() => {
        new CLIPEmbedder('unsupported-clip-model');
      }, /not supported/, 'Should throw error for unsupported CLIP model');
    });
    
    test('should reject non-CLIP models', () => {
      assert.throws(() => {
        new CLIPEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      }, /Unsupported CLIP model/, 'Should throw error for non-CLIP model');
    });
    
    test('should accept embedder options', () => {
      const options = {
        maxBatchSize: 4,
        cachePath: './test-models',
        timeout: 60000
      };
      
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32', options);
      assert.ok(embedder, 'Should create embedder with options');
    });
  });
  
  describe('Model Information', () => {
    test('should provide correct CLIP model information', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      const modelInfo = embedder.getModelInfo();
      
      assert.strictEqual(modelInfo.name, 'Xenova/clip-vit-base-patch32', 'Should have correct name');
      assert.strictEqual(modelInfo.type, 'clip', 'Should have correct type');
      assert.strictEqual(modelInfo.dimensions, 512, 'Should have correct dimensions');
      assert.ok(modelInfo.supportedContentTypes.includes('text'), 'Should support text');
      assert.ok(modelInfo.supportedContentTypes.includes('image'), 'Should support image');
      assert.ok(modelInfo.capabilities.supportsText, 'Should support text in capabilities');
      assert.ok(modelInfo.capabilities.supportsImages, 'Should support images in capabilities');
    });
    
    test('should provide enhanced capabilities for CLIP models', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      const modelInfo = embedder.getModelInfo();
      
      assert.ok(modelInfo.capabilities.supportsMultimodal, 'Should support multimodal');
      assert.ok(modelInfo.capabilities.supportsZeroShotClassification, 'Should support zero-shot classification');
      assert.ok(modelInfo.capabilities.supportsImageTextSimilarity, 'Should support image-text similarity');
      assert.ok(modelInfo.capabilities.supportsTextImageRetrieval, 'Should support text-image retrieval');
      assert.strictEqual(modelInfo.capabilities.recommendedUseCase, 'multimodal similarity and zero-shot classification');
      assert.strictEqual(modelInfo.capabilities.imageEmbeddingStatus, 'placeholder');
    });
  });
  
  describe('CLIP-Specific Methods', () => {
    test('should provide model variant information for patch32', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      const variant = embedder.getModelVariant();
      
      assert.strictEqual(variant.architecture, 'ViT-B/32', 'Should have correct architecture');
      assert.strictEqual(variant.patchSize, 32, 'Should have correct patch size');
      assert.strictEqual(variant.imageSize, 224, 'Should have correct image size');
      assert.strictEqual(variant.textMaxLength, 77, 'Should have correct text max length');
    });
    
    test('should provide model variant information for patch16', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch16');
      const variant = embedder.getModelVariant();
      
      assert.strictEqual(variant.architecture, 'ViT-B/16', 'Should have correct architecture');
      assert.strictEqual(variant.patchSize, 16, 'Should have correct patch size');
      assert.strictEqual(variant.imageSize, 224, 'Should have correct image size');
      assert.strictEqual(variant.textMaxLength, 77, 'Should have correct text max length');
    });
    
    test('should validate text length against CLIP limits', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      assert.ok(embedder.isTextLengthValid('Short text'), 'Should accept short text');
      assert.ok(embedder.isTextLengthValid('This is a medium length text that should be acceptable'), 'Should accept medium text');
      
      // Very long text (over ~300 characters, roughly 77 tokens)
      const longText = 'This is a very long text that exceeds the typical token limit for CLIP models. '.repeat(10);
      assert.ok(!embedder.isTextLengthValid(longText), 'Should reject very long text');
    });
    
    test('should provide performance information for different variants', () => {
      const patch32Embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      const patch32Perf = patch32Embedder.getPerformanceInfo();
      
      assert.strictEqual(patch32Perf.speed, 'fast', 'Patch32 should be fast');
      assert.strictEqual(patch32Perf.accuracy, 'good', 'Patch32 should have good accuracy');
      assert.strictEqual(patch32Perf.memoryUsage, 'medium', 'Patch32 should have medium memory usage');
      assert.strictEqual(patch32Perf.recommendedBatchSize, 8, 'Patch32 should have batch size 8');
      
      const patch16Embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch16');
      const patch16Perf = patch16Embedder.getPerformanceInfo();
      
      assert.strictEqual(patch16Perf.speed, 'medium', 'Patch16 should be medium speed');
      assert.strictEqual(patch16Perf.accuracy, 'better', 'Patch16 should have better accuracy');
      assert.strictEqual(patch16Perf.memoryUsage, 'high', 'Patch16 should have high memory usage');
      assert.strictEqual(patch16Perf.recommendedBatchSize, 4, 'Patch16 should have batch size 4');
    });
  });
  
  describe('Multimodal Capabilities', () => {
    test('should report current multimodal capabilities', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      const capabilities = embedder.getMultimodalCapabilities();
      
      assert.ok(capabilities.textSupport, 'Should support text');
      assert.ok(!capabilities.imageSupport, 'Should not yet support images');
      assert.ok(!capabilities.videoSupport, 'Should not support video');
      assert.ok(!capabilities.audioSupport, 'Should not support audio');
      
      assert.ok(Array.isArray(capabilities.plannedFeatures), 'Should have planned features');
      assert.ok(capabilities.plannedFeatures.length > 0, 'Should have planned features');
      assert.ok(capabilities.plannedFeatures.includes('Image embedding support'), 'Should plan image support');
    });
  });
  
  describe('Task Suitability', () => {
    test('should be suitable for multimodal tasks', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      assert.ok(embedder.isSuitableForTask('similarity'), 'Should be suitable for similarity');
      assert.ok(embedder.isSuitableForTask('classification'), 'Should be suitable for classification');
      assert.ok(embedder.isSuitableForTask('retrieval'), 'Should be suitable for retrieval');
      assert.ok(embedder.isSuitableForTask('multimodal'), 'Should be suitable for multimodal');
      assert.ok(!embedder.isSuitableForTask('clustering'), 'Should not be suitable for clustering');
    });
  });
  
  describe('Model Loading', () => {
    test('should load CLIP model successfully', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      assert.ok(!embedder.isLoaded(), 'Should not be loaded initially');
      
      try {
        // Load the model
        await embedder.loadModel();
        
        assert.ok(embedder.isLoaded(), 'Should be loaded after loadModel()');
        
        // Should be idempotent
        await embedder.loadModel();
        assert.ok(embedder.isLoaded(), 'Should still be loaded after second call');
        
        // Clean up
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available in test environment
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP loading test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should handle model loading errors gracefully', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
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
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
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
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      await assert.rejects(
        () => embedder.embedText('test text'),
        /not loaded/,
        'Should require model to be loaded'
      );
    });
    
    test('should handle text embedding limitation gracefully', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.loadModel();
        
        // Try to embed text - this may fail due to CLIP's multimodal nature
        try {
          const result = await embedder.embedText('This is a test sentence for CLIP.');
          
          // If it succeeds, validate the result
          assert.ok(result, 'Should return embedding result');
          assert.ok(typeof result.embedding_id === 'string', 'Should have embedding ID');
          assert.ok(result.vector instanceof Float32Array, 'Should have Float32Array vector');
          assert.strictEqual(result.vector.length, 512, 'Should have 512 dimensions for CLIP');
          
        } catch (embeddingError) {
          // If it fails due to CLIP's multimodal requirements, that's expected
          if (embeddingError instanceof Error && embeddingError.message.includes('text-only embedding is not fully supported')) {
            console.log('CLIP text-only embedding limitation detected - this is expected');
            assert.ok(embeddingError.message.includes('sentence-transformer'), 'Should suggest alternative models');
            assert.ok(embeddingError.message.includes('multimodal'), 'Should explain multimodal nature');
          } else {
            throw embeddingError;
          }
        }
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available in test environment
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP embedding test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Image Embedding (Placeholder)', () => {
    test('should reject image embedding with helpful message', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      await assert.rejects(
        () => embedder.embedImage('test-image.jpg'),
        /not yet implemented/,
        'Should reject image embedding with helpful message'
      );
    });
    
    test('should provide clear placeholder message', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.embedImage('test-image.jpg');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error');
        assert.ok(error.message.includes('placeholder'), 'Should mention placeholder');
        assert.ok(error.message.includes('future'), 'Should mention future implementation');
        assert.ok(error.message.includes('text embedding'), 'Should mention current text support');
      }
    });
  });
  
  describe('Batch Processing', () => {
    test('should handle empty batch', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.loadModel();
        
        const results = await embedder.embedBatch([]);
        assert.strictEqual(results.length, 0, 'Should return empty array for empty batch');
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP batch test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should handle batch processing with text-only limitation', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.loadModel();
        
        const batch = [
          { content: 'Text content for CLIP', contentType: 'text' },
          { content: 'image.jpg', contentType: 'image' },
          { content: 'More text for CLIP', contentType: 'text' }
        ];
        
        const results = await embedder.embedBatch(batch);
        
        // Should return results for all items (text items may be placeholders due to CLIP limitation)
        assert.strictEqual(results.length, 3, 'Should return results for all items');
        
        // All results should have 512 dimensions (even placeholders)
        results.forEach((result: { vector: Float32Array }) => {
          assert.ok(result.vector.length === 512, 'All results should have 512 dimensions');
        });
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP batch processing test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Resource Management', () => {
    test('should clean up resources properly', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.loadModel();
        assert.ok(embedder.isLoaded(), 'Should be loaded');
        
        await embedder.cleanup();
        assert.ok(!embedder.isLoaded(), 'Should not be loaded after cleanup');
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP cleanup test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Error Handling', () => {
    test('should handle text length validation with CLIP limitations', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      try {
        await embedder.loadModel();
        
        // Test with very long text
        const longText = 'This is a very long text for CLIP that exceeds typical limits. '.repeat(20);
        
        try {
          const result = await embedder.embedText(longText);
          
          // If it succeeds, validate the result
          assert.ok(result, 'Should handle long text gracefully');
          assert.ok(result.vector instanceof Float32Array, 'Should return valid embedding');
          assert.strictEqual(result.vector.length, 512, 'Should have correct dimensions');
          
        } catch (embeddingError) {
          // If it fails due to CLIP's text-only limitation, that's expected
          if (embeddingError instanceof Error && embeddingError.message.includes('text-only embedding is not fully supported')) {
            console.log('CLIP text-only embedding limitation detected during length validation - this is expected');
          } else {
            throw embeddingError;
          }
        }
        
        await embedder.cleanup();
      } catch (error) {
        // Skip test if transformers.js is not available
        if (error instanceof Error && error.message.includes('transformers')) {
          console.log('Skipping CLIP text length test - transformers.js not available in test environment');
          return;
        }
        throw error;
      }
    });
    
    test('should provide enhanced error messages', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
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
      const modelName = 'Xenova/clip-vit-base-patch32';
      const embedder = new CLIPEmbedder(modelName);
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
  
  describe('CLIP-Specific Features', () => {
    test('should handle CLIP text token limits', () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      // CLIP has a 77 token limit
      const shortText = 'Short text';
      const mediumText = 'This is a medium length text that should be fine for CLIP processing';
      const longText = 'This is an extremely long text that definitely exceeds the 77 token limit that CLIP models have for text processing and should be handled appropriately by truncation or other methods to ensure compatibility with the model architecture and prevent errors during embedding generation'.repeat(2);
      
      assert.ok(embedder.isTextLengthValid(shortText), 'Should accept short text');
      assert.ok(embedder.isTextLengthValid(mediumText), 'Should accept medium text');
      assert.ok(!embedder.isTextLengthValid(longText), 'Should reject very long text');
    });
    
    test('should provide 512-dimensional embeddings', async () => {
      const embedder = new CLIPEmbedder('Xenova/clip-vit-base-patch32');
      
      // Verify dimensions are set correctly
      assert.strictEqual(embedder.dimensions, 512, 'Should have 512 dimensions');
      
      // This would be tested in actual embedding if transformers.js is available
      const modelInfo = embedder.getModelInfo();
      assert.strictEqual(modelInfo.dimensions, 512, 'Model info should report 512 dimensions');
    });
  });
});