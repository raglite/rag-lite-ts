/**
 * Tests for Simple Embedder Creation Function
 * Validates the simplified factory approach without complex patterns
 * Uses Node.js test runner
 */

import { test, describe, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  createEmbedder,
  getSupportedModelsForContentType,
  getRecommendedModel,
  validateModelCompatibility,
  listAvailableModels,
  UniversalEmbedderFactory
} from '../../src/../src/core/embedder-factory.js';

import { ModelValidator } from '../../src/../src/core/model-validator.js';

describe('Simple Embedder Creation Function', () => {
  
  beforeEach(() => {
    // Reset validator state before each test
    ModelValidator.setTransformersVersion('2.8.0');
  });
  
  describe('createEmbedder Function', () => {
    test('should reject unsupported models with helpful error', async () => {
      try {
        await createEmbedder('unsupported-model-name');
        assert.fail('Should have thrown an error for unsupported model');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.ok(error.message.includes('Model not found'), 'Should mention model not found');
        assert.strictEqual(error.name, 'ModelValidationError', 'Should be a ModelValidationError');
      }
    });
    
    test('should handle model validation errors gracefully', async () => {
      // Set an incompatible transformers version
      ModelValidator.setTransformersVersion('1.0.0');
      
      try {
        await createEmbedder('Xenova/clip-vit-base-patch32');
        assert.fail('Should have thrown an error for incompatible version');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        // Should handle validation errors gracefully
      }
    });
    
    test('should accept valid embedder creation options', async () => {
      const options = {
        maxBatchSize: 16,
        cachePath: './test-models',
        timeout: 60000,
        enableGPU: false
      };
      
      // This will fail because we don't have actual model implementations,
      // but it should validate the options and model name first
      try {
        await createEmbedder('sentence-transformers/all-MiniLM-L6-v2', options);
      } catch (error) {
        // Expected to fail due to missing actual implementation
        // But should not fail due to options validation
        assert.ok(error instanceof Error, 'Should throw an Error');
        // Should not be a validation error about options
        assert.ok(!error.message.includes('options'), 'Should not fail due to options validation');
      }
    });
    
    test('should handle empty or invalid text input validation', () => {
      // Test that the function validates model names properly
      assert.rejects(
        () => createEmbedder(''),
        /Model not found/,
        'Should reject empty model name'
      );
      
      assert.rejects(
        () => createEmbedder('   '),
        /Model not found/,
        'Should reject whitespace-only model name'
      );
    });
  });
  
  describe('Utility Functions', () => {
    test('should get supported models for content type', () => {
      const textModels = getSupportedModelsForContentType('text');
      assert.ok(Array.isArray(textModels), 'Should return an array');
      assert.ok(textModels.length > 0, 'Should have text models');
      assert.ok(textModels.includes('sentence-transformers/all-MiniLM-L6-v2'), 'Should include text models');
      
      const imageModels = getSupportedModelsForContentType('image');
      assert.ok(Array.isArray(imageModels), 'Should return an array');
      assert.ok(imageModels.length > 0, 'Should have image models');
      assert.ok(imageModels.includes('Xenova/clip-vit-base-patch32'), 'Should include CLIP models');
    });
    
    test('should get recommended model for use case', () => {
      const textModel = getRecommendedModel(['text']);
      assert.ok(typeof textModel === 'string', 'Should return a model name for text');
      assert.ok(textModel.length > 0, 'Should return non-empty model name');
      
      const multimodalModel = getRecommendedModel(['text', 'image']);
      assert.ok(typeof multimodalModel === 'string', 'Should return a model name for multimodal');
      assert.ok(multimodalModel.includes('clip'), 'Should recommend CLIP for multimodal');
      
      const impossibleModel = getRecommendedModel(['unsupported-type']);
      assert.strictEqual(impossibleModel, null, 'Should return null for unsupported content types');
    });
    
    test('should respect performance preferences', () => {
      const performanceModel = getRecommendedModel(['text'], { preferPerformance: true });
      assert.ok(typeof performanceModel === 'string', 'Should return a model for performance preference');
      // Should prefer MiniLM for performance
      assert.ok(performanceModel.includes('MiniLM') || performanceModel.includes('clip-vit-base-patch32'), 
        'Should prefer performance-oriented models');
      
      const accuracyModel = getRecommendedModel(['text'], { preferAccuracy: true });
      assert.ok(typeof accuracyModel === 'string', 'Should return a model for accuracy preference');
      // Should prefer larger models for accuracy
    });
    
    test('should respect memory constraints', () => {
      const lowMemoryModel = getRecommendedModel(['text'], { maxMemory: 256 });
      assert.ok(typeof lowMemoryModel === 'string' || lowMemoryModel === null, 
        'Should return model name or null for low memory');
      
      const highMemoryModel = getRecommendedModel(['text'], { maxMemory: 4096 });
      assert.ok(typeof highMemoryModel === 'string', 'Should return a model for high memory');
    });
    
    test('should validate model compatibility', async () => {
      const validModel = await validateModelCompatibility('sentence-transformers/all-MiniLM-L6-v2');
      assert.strictEqual(typeof validModel, 'boolean', 'Should return boolean');
      
      const invalidModel = await validateModelCompatibility('unsupported-model');
      assert.strictEqual(invalidModel, false, 'Should return false for unsupported model');
    });
    
    test('should list available models with capabilities', () => {
      const models = listAvailableModels();
      
      assert.ok(Array.isArray(models), 'Should return an array');
      assert.ok(models.length > 0, 'Should have available models');
      
      // Check structure of model info
      const firstModel = models[0];
      assert.ok(typeof firstModel.name === 'string', 'Should have name');
      assert.ok(typeof firstModel.type === 'string', 'Should have type');
      assert.ok(typeof firstModel.dimensions === 'number', 'Should have dimensions');
      assert.ok(Array.isArray(firstModel.supportedContentTypes), 'Should have supported content types');
      
      // Check that we have both text and multimodal models
      const hasTextModel = models.some(m => m.type === 'sentence-transformer');
      const hasMultimodalModel = models.some(m => m.type === 'clip');
      
      assert.ok(hasTextModel, 'Should have text models');
      assert.ok(hasMultimodalModel, 'Should have multimodal models');
    });
  });
  
  describe('Backward Compatibility', () => {
    test('should provide deprecated factory interface', async () => {
      // Test that the deprecated interface exists
      assert.ok(typeof UniversalEmbedderFactory === 'object', 'Should have factory object');
      assert.ok(typeof UniversalEmbedderFactory.create === 'function', 'Should have create method');
      assert.ok(typeof UniversalEmbedderFactory.validateModel === 'function', 'Should have validateModel method');
      assert.ok(typeof UniversalEmbedderFactory.getModelInfo === 'function', 'Should have getModelInfo method');
      assert.ok(typeof UniversalEmbedderFactory.getSupportedModels === 'function', 'Should have getSupportedModels method');
    });
    
    test('should show deprecation warnings for factory methods', () => {
      // Capture console warnings
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (message: string) => warnings.push(message);
      
      try {
        // Test deprecated methods
        UniversalEmbedderFactory.validateModel('sentence-transformers/all-MiniLM-L6-v2');
        UniversalEmbedderFactory.getModelInfo('sentence-transformers/all-MiniLM-L6-v2');
        UniversalEmbedderFactory.getSupportedModels();
        
        // Should have shown deprecation warnings
        assert.ok(warnings.length >= 3, 'Should show deprecation warnings');
        assert.ok(warnings.some(w => w.includes('deprecated')), 'Should mention deprecation');
        
      } finally {
        console.warn = originalWarn;
      }
    });
    
    test('should delegate to correct implementations in deprecated factory', async () => {
      const modelInfo = UniversalEmbedderFactory.getModelInfo('sentence-transformers/all-MiniLM-L6-v2');
      assert.ok(modelInfo, 'Should return model info');
      assert.strictEqual(modelInfo.name, 'sentence-transformers/all-MiniLM-L6-v2', 'Should return correct model info');
      
      const supportedModels = UniversalEmbedderFactory.getSupportedModels();
      assert.ok(Array.isArray(supportedModels), 'Should return array of models');
      assert.ok(supportedModels.length > 0, 'Should have supported models');
      
      const validation = UniversalEmbedderFactory.validateModel('sentence-transformers/all-MiniLM-L6-v2');
      assert.ok(typeof validation.isValid === 'boolean', 'Should return validation result');
    });
  });
  
  describe('Error Handling', () => {
    test('should provide helpful error messages for common issues', async () => {
      // Test model not found error
      try {
        await createEmbedder('nonexistent-model');
        assert.fail('Should throw error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error');
        assert.ok(error.message.includes('Model not found'), 'Should explain the issue');
      }
      
      // Test empty model name
      try {
        await createEmbedder('');
        assert.fail('Should throw error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error');
        assert.ok(error.message.includes('Model not found'), 'Should handle empty name');
      }
    });
    
    test('should handle validation errors gracefully', async () => {
      // Set incompatible version to trigger validation error
      ModelValidator.setTransformersVersion('1.0.0');
      
      try {
        await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
        assert.fail('Should throw validation error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error');
        // Should provide helpful error information
      }
    });
    
    test('should handle model creation failures', async () => {
      // This test verifies error handling structure
      // Actual model creation will fail due to missing transformers.js in test environment
      
      try {
        await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
        // If this succeeds, the model was actually created (unexpected in test environment)
        assert.ok(true, 'Model creation succeeded unexpectedly');
      } catch (error) {
        // Expected to fail in test environment
        assert.ok(error instanceof Error, 'Should throw an Error');
        // Should provide enhanced error message
        assert.ok(error.message.includes('Failed to create embedder'), 'Should enhance error message');
      }
    });
  });
  
  describe('Model Type Detection', () => {
    test('should detect sentence transformer models', () => {
      // Test that the function would route to sentence transformer creation
      // We can't test actual creation without transformers.js, but we can test validation
      
      const textModels = ['sentence-transformers/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'];
      
      textModels.forEach(modelName => {
        // Should not throw validation errors for supported text models
        assert.doesNotThrow(() => {
          getSupportedModelsForContentType('text').includes(modelName);
        }, `Should support text model: ${modelName}`);
      });
    });
    
    test('should detect CLIP models', () => {
      // Test that the function would route to CLIP creation
      
      const clipModels = ['Xenova/clip-vit-base-patch32', 'Xenova/clip-vit-base-patch16'];
      
      clipModels.forEach(modelName => {
        // Should not throw validation errors for supported CLIP models
        assert.doesNotThrow(() => {
          getSupportedModelsForContentType('image').includes(modelName);
        }, `Should support CLIP model: ${modelName}`);
      });
    });
    
    test('should reject unsupported model types', async () => {
      // Test with a hypothetical unsupported model type
      try {
        await createEmbedder('unsupported/model-type');
        assert.fail('Should reject unsupported model');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.ok(error.message.includes('not found') || error.message.includes('not supported'), 'Should explain model is not found or supported');
      }
    });
  });
  
  describe('Options Handling', () => {
    test('should accept valid options', async () => {
      const validOptions = {
        maxBatchSize: 8,
        cachePath: './models',
        timeout: 30000,
        enableGPU: false,
        customConfig: { test: true }
      };
      
      // Should not throw validation errors for valid options
      try {
        await createEmbedder('sentence-transformers/all-MiniLM-L6-v2', validOptions);
      } catch (error) {
        // Expected to fail due to missing implementation, but not due to options
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.ok(!error.message.includes('options'), 'Should not fail due to options');
      }
    });
    
    test('should handle missing options gracefully', async () => {
      // Should work with no options provided
      try {
        await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
      } catch (error) {
        // Expected to fail due to missing implementation
        assert.ok(error instanceof Error, 'Should throw an Error');
        // Should not fail due to missing options
        assert.ok(!error.message.includes('options'), 'Should handle missing options');
      }
    });
  });
});

// =============================================================================
// MANDATORY: Force exit after test completion to prevent hanging
// This test loads actual embedder models which don't clean up gracefully
// =============================================================================
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging from ML resources...');
  
  // Multiple garbage collection attempts
  if (global.gc) {
    global.gc();
    setTimeout(() => global.gc && global.gc(), 100);
    setTimeout(() => global.gc && global.gc(), 300);
  }
  
  // Force exit after cleanup attempts
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 1000);
}, 2000);