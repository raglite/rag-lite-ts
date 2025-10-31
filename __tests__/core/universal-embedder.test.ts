/**
 * Tests for Universal Embedder Interface Design
 * Validates the core interfaces and model registry functionality
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { 
  ModelRegistry, 
  SUPPORTED_MODELS,
  getModelType,
  getModelDimensions,
  isTextOnlyModel,
  isMultimodalModel,
  DEFAULT_MODELS
} from '../../src/../src/core/model-registry.js';

import {
  validateContentType,
  createEnhancedEmbeddingResult,
  supportsContentType,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_CAPABILITIES,
  ModelValidationError,
  TransformersCompatibilityError,
  ContentTypeError
} from '../../src/../src/core/universal-embedder.js';

import type {
  UniversalEmbedder,
  ModelInfo,
  ModelType,
  EmbeddingBatchItem
} from '../../src/../src/core/universal-embedder.js';

describe('Universal Embedder Interface Design', () => {
  
  describe('Model Registry', () => {
    test('should have supported models defined', () => {
      assert.ok(Object.keys(SUPPORTED_MODELS).length > 0, 'Should have at least one supported model');
      
      // Verify text models
      assert.ok(SUPPORTED_MODELS['sentence-transformers/all-MiniLM-L6-v2'], 'Should support all-MiniLM-L6-v2');
      assert.ok(SUPPORTED_MODELS['Xenova/all-mpnet-base-v2'], 'Should support all-mpnet-base-v2');
      
      // Verify multimodal models
      assert.ok(SUPPORTED_MODELS['Xenova/clip-vit-base-patch32'], 'Should support CLIP model');
    });
    
    test('should validate supported models correctly', () => {
      const validResult = ModelRegistry.validateModel('sentence-transformers/all-MiniLM-L6-v2');
      assert.strictEqual(validResult.isValid, true, 'Should validate supported model as valid');
      assert.strictEqual(validResult.errors.length, 0, 'Should have no errors for valid model');
      
      const invalidResult = ModelRegistry.validateModel('unsupported-model');
      assert.strictEqual(invalidResult.isValid, false, 'Should validate unsupported model as invalid');
      assert.ok(invalidResult.errors.length > 0, 'Should have errors for invalid model');
    });
    
    test('should get model info correctly', () => {
      const modelInfo = ModelRegistry.getModelInfo('sentence-transformers/all-MiniLM-L6-v2');
      assert.ok(modelInfo, 'Should return model info for supported model');
      assert.strictEqual(modelInfo!.type, 'sentence-transformer', 'Should have correct model type');
      assert.strictEqual(modelInfo!.dimensions, 384, 'Should have correct dimensions');
      assert.ok(modelInfo!.supportedContentTypes.includes('text'), 'Should support text content');
      
      const nullInfo = ModelRegistry.getModelInfo('unsupported-model');
      assert.strictEqual(nullInfo, null, 'Should return null for unsupported model');
    });
    
    test('should list supported models by type', () => {
      const textModels = ModelRegistry.getSupportedModels('sentence-transformer');
      assert.ok(textModels.length > 0, 'Should have text models');
      assert.ok(textModels.includes('sentence-transformers/all-MiniLM-L6-v2'), 'Should include all-MiniLM-L6-v2');
      
      const clipModels = ModelRegistry.getSupportedModels('clip');
      assert.ok(clipModels.length > 0, 'Should have CLIP models');
      assert.ok(clipModels.includes('Xenova/clip-vit-base-patch32'), 'Should include CLIP model');
      
      const allModels = ModelRegistry.getSupportedModels();
      assert.ok(allModels.length >= textModels.length + clipModels.length, 'Should include all models when no filter');
    });
    
    test('should get models by content type', () => {
      const textModels = ModelRegistry.getModelsByContentType('text');
      assert.ok(textModels.length > 0, 'Should have models supporting text');
      
      const imageModels = ModelRegistry.getModelsByContentType('image');
      assert.ok(imageModels.length > 0, 'Should have models supporting images');
      assert.ok(imageModels.includes('Xenova/clip-vit-base-patch32'), 'Should include CLIP model for images');
    });
    
    test('should get default models', () => {
      const defaultText = ModelRegistry.getDefaultModel('sentence-transformer');
      assert.strictEqual(defaultText, 'sentence-transformers/all-MiniLM-L6-v2', 'Should have correct default text model');
      
      const defaultClip = ModelRegistry.getDefaultModel('clip');
      assert.strictEqual(defaultClip, 'Xenova/clip-vit-base-patch32', 'Should have correct default CLIP model');
    });
    
    test('should check content type support', () => {
      assert.ok(ModelRegistry.supportsContentType('sentence-transformers/all-MiniLM-L6-v2', 'text'), 'Text model should support text');
      assert.ok(!ModelRegistry.supportsContentType('sentence-transformers/all-MiniLM-L6-v2', 'image'), 'Text model should not support images');
      
      assert.ok(ModelRegistry.supportsContentType('Xenova/clip-vit-base-patch32', 'text'), 'CLIP model should support text');
      assert.ok(ModelRegistry.supportsContentType('Xenova/clip-vit-base-patch32', 'image'), 'CLIP model should support images');
    });
  });
  
  describe('Model Registry Utility Functions', () => {
    test('should get model type correctly', () => {
      assert.strictEqual(getModelType('sentence-transformers/all-MiniLM-L6-v2'), 'sentence-transformer');
      assert.strictEqual(getModelType('Xenova/clip-vit-base-patch32'), 'clip');
      assert.strictEqual(getModelType('unsupported-model'), null);
    });
    
    test('should get model dimensions correctly', () => {
      assert.strictEqual(getModelDimensions('sentence-transformers/all-MiniLM-L6-v2'), 384);
      assert.strictEqual(getModelDimensions('Xenova/clip-vit-base-patch32'), 512);
      assert.strictEqual(getModelDimensions('unsupported-model'), null);
    });
    
    test('should identify text-only models', () => {
      assert.ok(isTextOnlyModel('sentence-transformers/all-MiniLM-L6-v2'), 'Should identify text-only model');
      assert.ok(!isTextOnlyModel('Xenova/clip-vit-base-patch32'), 'Should not identify multimodal model as text-only');
    });
    
    test('should identify multimodal models', () => {
      assert.ok(!isMultimodalModel('sentence-transformers/all-MiniLM-L6-v2'), 'Should not identify text-only model as multimodal');
      assert.ok(isMultimodalModel('Xenova/clip-vit-base-patch32'), 'Should identify multimodal model');
    });
  });
  
  describe('Universal Embedder Interface Utilities', () => {
    test('should validate content types correctly', () => {
      const supportedTypes = ['text', 'image'];
      
      assert.doesNotThrow(() => {
        validateContentType('text', supportedTypes);
      }, 'Should not throw for supported content type');
      
      assert.throws(() => {
        validateContentType('unsupported', supportedTypes);
      }, ContentTypeError, 'Should throw ContentTypeError for unsupported content type');
    });
    
    test('should create enhanced embedding results', () => {
      const vector = new Float32Array([0.1, 0.2, 0.3]);
      const result = createEnhancedEmbeddingResult('test_id', vector, 'text', { source: 'test' });
      
      assert.strictEqual(result.embedding_id, 'test_id', 'Should have correct embedding ID');
      assert.strictEqual(result.vector, vector, 'Should have correct vector');
      assert.strictEqual(result.contentType, 'text', 'Should have correct content type');
      assert.deepStrictEqual(result.metadata, { source: 'test' }, 'Should have correct metadata');
    });
    
    test('should check content type support for embedders', () => {
      const mockEmbedder: UniversalEmbedder = {
        modelName: 'test-model',
        modelType: 'sentence-transformer',
        dimensions: 384,
        supportedContentTypes: ['text'],
        embedText: async () => ({ embedding_id: 'test', vector: new Float32Array() }),
        embedBatch: async () => [],
        loadModel: async () => {},
        isLoaded: () => true,
        getModelInfo: () => ({
          name: 'test-model',
          type: 'sentence-transformer',
          dimensions: 384,
          version: '1.0.0',
          supportedContentTypes: ['text'],
          capabilities: DEFAULT_CAPABILITIES['sentence-transformer'],
          requirements: { transformersJsVersion: '>=2.6.0' }
        }),
        cleanup: async () => {}
      };
      
      assert.ok(supportsContentType(mockEmbedder, 'text'), 'Should support text content type');
      assert.ok(!supportsContentType(mockEmbedder, 'image'), 'Should not support image content type');
    });
  });
  
  describe('Error Classes', () => {
    test('should create ModelValidationError correctly', () => {
      const availableModels = ['model1', 'model2'];
      const error = new ModelValidationError('invalid-model', availableModels, 'Test error');
      
      assert.strictEqual(error.name, 'ModelValidationError', 'Should have correct error name');
      assert.strictEqual(error.modelName, 'invalid-model', 'Should have correct model name');
      assert.deepStrictEqual(error.availableModels, availableModels, 'Should have correct available models');
      assert.strictEqual(error.message, 'Test error', 'Should have correct message');
    });
    
    test('should create TransformersCompatibilityError correctly', () => {
      const error = new TransformersCompatibilityError('test-model', '>=2.8.0', '2.6.0', 'Version mismatch');
      
      assert.strictEqual(error.name, 'TransformersCompatibilityError', 'Should have correct error name');
      assert.strictEqual(error.modelName, 'test-model', 'Should have correct model name');
      assert.strictEqual(error.requiredVersion, '>=2.8.0', 'Should have correct required version');
      assert.strictEqual(error.currentVersion, '2.6.0', 'Should have correct current version');
    });
    
    test('should create ContentTypeError correctly', () => {
      const supportedTypes = ['text', 'image'];
      const error = new ContentTypeError('unsupported', supportedTypes, 'Unsupported content type');
      
      assert.strictEqual(error.name, 'ContentTypeError', 'Should have correct error name');
      assert.strictEqual(error.contentType, 'unsupported', 'Should have correct content type');
      assert.deepStrictEqual(error.supportedTypes, supportedTypes, 'Should have correct supported types');
    });
  });
  
  describe('Constants and Defaults', () => {
    test('should have correct default content types', () => {
      assert.deepStrictEqual(DEFAULT_CONTENT_TYPES['sentence-transformer'], ['text'], 'Text models should default to text content');
      assert.deepStrictEqual(DEFAULT_CONTENT_TYPES['clip'], ['text', 'image'], 'CLIP models should default to text and image content');
    });
    
    test('should have correct default capabilities', () => {
      const textCapabilities = DEFAULT_CAPABILITIES['sentence-transformer'];
      assert.ok(textCapabilities.supportsText, 'Text models should support text');
      assert.ok(!textCapabilities.supportsImages, 'Text models should not support images');
      
      const clipCapabilities = DEFAULT_CAPABILITIES['clip'];
      assert.ok(clipCapabilities.supportsText, 'CLIP models should support text');
      assert.ok(clipCapabilities.supportsImages, 'CLIP models should support images');
    });
    
    test('should have correct default models', () => {
      assert.strictEqual(DEFAULT_MODELS['sentence-transformer'], 'sentence-transformers/all-MiniLM-L6-v2');
      assert.strictEqual(DEFAULT_MODELS['clip'], 'Xenova/clip-vit-base-patch32');
    });
  });
  
  describe('System Compatibility Validation', () => {
    test('should validate system compatibility correctly', () => {
      const systemCapabilities = {
        availableMemory: 512,
        platform: 'node',
        transformersJsVersion: '2.8.0'
      };
      
      // Test with a model that fits system capabilities
      const validResult = ModelRegistry.validateSystemCompatibility(
        'sentence-transformers/all-MiniLM-L6-v2',
        systemCapabilities
      );
      assert.ok(validResult.isValid, 'Should validate compatible model as valid');
      
      // Test with a model that requires more memory
      const invalidResult = ModelRegistry.validateSystemCompatibility(
        'Xenova/clip-vit-base-patch16',
        { ...systemCapabilities, availableMemory: 256 }
      );
      assert.ok(!invalidResult.isValid, 'Should validate incompatible model as invalid');
      assert.ok(invalidResult.errors.some(error => error.includes('memory')), 'Should have memory-related error');
    });
  });
});