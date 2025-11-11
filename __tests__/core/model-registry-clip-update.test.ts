/**
 * Tests for model registry CLIP updates (Task 6.3)
 * Verifies that CLIP models now reflect fixed capabilities without fallback mechanisms
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { ModelRegistry, SUPPORTED_MODELS } from '../../src/core/model-registry.js';

describe('Model Registry - CLIP Fixed Implementation (Task 6.3)', () => {
  const clipModels = ['Xenova/clip-vit-base-patch32', 'Xenova/clip-vit-base-patch16'];

  test('CLIP models should have supportsMultimodal capability', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.strictEqual(
        modelInfo.capabilities.supportsMultimodal,
        true,
        `${modelName} should have supportsMultimodal capability`
      );
    }
  });

  test('CLIP models should support both text and images', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.strictEqual(
        modelInfo.capabilities.supportsText,
        true,
        `${modelName} should support text`
      );
      assert.strictEqual(
        modelInfo.capabilities.supportsImages,
        true,
        `${modelName} should support images`
      );
    }
  });

  test('CLIP models should have correct content types', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.ok(
        modelInfo.supportedContentTypes.includes('text'),
        `${modelName} should support text content type`
      );
      assert.ok(
        modelInfo.supportedContentTypes.includes('image'),
        `${modelName} should support image content type`
      );
    }
  });

  test('CLIP models should have correct dimensions (512)', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.strictEqual(
        modelInfo.dimensions,
        512,
        `${modelName} should have 512 dimensions`
      );
    }
  });

  test('CLIP models should have correct text length limit (77)', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.strictEqual(
        modelInfo.capabilities.maxTextLength,
        77,
        `${modelName} should have maxTextLength of 77 (CLIP's text sequence length limit)`
      );
    }
  });

  test('CLIP models should have correct type', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.strictEqual(
        modelInfo.type,
        'clip',
        `${modelName} should have type 'clip'`
      );
    }
  });

  test('CLIP model validation should provide cross-modal capability suggestions', () => {
    for (const modelName of clipModels) {
      const validation = ModelRegistry.validateModel(modelName);
      
      assert.strictEqual(
        validation.isValid,
        true,
        `${modelName} validation should be valid`
      );
      
      const hasMultimodalSuggestion = validation.suggestions.some(s => 
        s.includes('cross-modal') || s.includes('multimodal')
      );
      
      assert.ok(
        hasMultimodalSuggestion,
        `${modelName} validation should include cross-modal capability suggestion`
      );
    }
  });

  test('CLIP models should have required features for vision and tokenizers', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      assert.ok(
        modelInfo.requirements.requiredFeatures?.includes('vision'),
        `${modelName} should require vision feature`
      );
      assert.ok(
        modelInfo.requirements.requiredFeatures?.includes('tokenizers'),
        `${modelName} should require tokenizers feature`
      );
    }
  });

  test('CLIP models should have appropriate memory requirements', () => {
    const modelInfo32 = ModelRegistry.getModelInfo('Xenova/clip-vit-base-patch32');
    const modelInfo16 = ModelRegistry.getModelInfo('Xenova/clip-vit-base-patch16');
    
    assert.ok(modelInfo32, 'clip-vit-base-patch32 should exist');
    assert.ok(modelInfo16, 'clip-vit-base-patch16 should exist');
    
    assert.strictEqual(
      modelInfo32.requirements.minimumMemory,
      1024,
      'clip-vit-base-patch32 should require 1024MB memory'
    );
    assert.strictEqual(
      modelInfo16.requirements.minimumMemory,
      1536,
      'clip-vit-base-patch16 should require 1536MB memory'
    );
  });

  test('CLIP models should support common image formats', () => {
    for (const modelName of clipModels) {
      const modelInfo = ModelRegistry.getModelInfo(modelName);
      
      assert.ok(modelInfo, `Model ${modelName} should exist in registry`);
      
      const supportedFormats = modelInfo.capabilities.supportedImageFormats || [];
      const commonFormats = ['jpg', 'jpeg', 'png'];
      
      for (const format of commonFormats) {
        assert.ok(
          supportedFormats.includes(format),
          `${modelName} should support ${format} format`
        );
      }
    }
  });
});
