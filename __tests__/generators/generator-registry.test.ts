/**
 * Tests for Generator Registry
 * @experimental Testing the experimental response generation feature
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  GeneratorRegistry,
  SUPPORTED_GENERATORS,
  DEFAULT_GENERATOR_MODEL,
  getGeneratorType,
  isInstructionTunedModel,
  getMaxContextLength,
  getRecommendedSettings
} from '../../src/core/generator-registry.js';

describe('Generator Registry', () => {
  describe('SUPPORTED_GENERATORS', () => {
    it('should contain the two supported models', () => {
      const modelNames = Object.keys(SUPPORTED_GENERATORS);
      assert.strictEqual(modelNames.length, 2);
      assert.ok(modelNames.includes('HuggingFaceTB/SmolLM2-135M-Instruct'), 'Should include SmolLM2-135M');
      assert.ok(modelNames.includes('HuggingFaceTB/SmolLM2-360M-Instruct'), 'Should include SmolLM2-360M');
    });

    it('should have correct model types (all instruct)', () => {
      assert.strictEqual(SUPPORTED_GENERATORS['HuggingFaceTB/SmolLM2-135M-Instruct'].type, 'instruct');
      assert.strictEqual(SUPPORTED_GENERATORS['HuggingFaceTB/SmolLM2-360M-Instruct'].type, 'instruct');
    });

    it('should have SmolLM2-135M as default', () => {
      assert.strictEqual(DEFAULT_GENERATOR_MODEL, 'HuggingFaceTB/SmolLM2-135M-Instruct');
      assert.strictEqual(SUPPORTED_GENERATORS[DEFAULT_GENERATOR_MODEL].isDefault, true);
    });

    it('should have correct defaultMaxChunksForContext', () => {
      assert.strictEqual(SUPPORTED_GENERATORS['HuggingFaceTB/SmolLM2-135M-Instruct'].capabilities.defaultMaxChunksForContext, 3);
      assert.strictEqual(SUPPORTED_GENERATORS['HuggingFaceTB/SmolLM2-360M-Instruct'].capabilities.defaultMaxChunksForContext, 5);
    });
  });

  describe('GeneratorRegistry.getGeneratorInfo', () => {
    it('should return model info for supported models', () => {
      const info = GeneratorRegistry.getGeneratorInfo('HuggingFaceTB/SmolLM2-135M-Instruct');
      assert.ok(info !== null);
      assert.strictEqual(info?.name, 'HuggingFaceTB/SmolLM2-135M-Instruct');
      assert.strictEqual(info?.type, 'instruct');
      assert.ok(info?.capabilities.supportsSystemPrompt);
    });

    it('should return null for unsupported models', () => {
      const info = GeneratorRegistry.getGeneratorInfo('nonexistent/model');
      assert.strictEqual(info, null);
    });
  });

  describe('GeneratorRegistry.validateGenerator', () => {
    it('should validate supported models', () => {
      const result = GeneratorRegistry.validateGenerator('HuggingFaceTB/SmolLM2-135M-Instruct');
      assert.strictEqual(result.isValid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('should fail validation for unsupported models', () => {
      const result = GeneratorRegistry.validateGenerator('nonexistent/model');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should provide suggestions for unsupported models', () => {
      const result = GeneratorRegistry.validateGenerator('gpt2-large');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.suggestions.length > 0);
    });
  });

  describe('GeneratorRegistry.getSupportedGenerators', () => {
    it('should list all generators', () => {
      const all = GeneratorRegistry.getSupportedGenerators();
      assert.strictEqual(all.length, 2);
    });

    it('should filter by type', () => {
      const instruct = GeneratorRegistry.getSupportedGenerators('instruct');
      assert.strictEqual(instruct.length, 2);
      
      const causalLm = GeneratorRegistry.getSupportedGenerators('causal-lm');
      assert.strictEqual(causalLm.length, 0);
    });
  });

  describe('Utility functions', () => {
    it('getGeneratorType should return correct type', () => {
      assert.strictEqual(getGeneratorType('HuggingFaceTB/SmolLM2-135M-Instruct'), 'instruct');
      assert.strictEqual(getGeneratorType('HuggingFaceTB/SmolLM2-360M-Instruct'), 'instruct');
      assert.strictEqual(getGeneratorType('nonexistent'), null);
    });

    it('isInstructionTunedModel should identify instruct models', () => {
      assert.strictEqual(isInstructionTunedModel('HuggingFaceTB/SmolLM2-135M-Instruct'), true);
      assert.strictEqual(isInstructionTunedModel('HuggingFaceTB/SmolLM2-360M-Instruct'), true);
      assert.strictEqual(isInstructionTunedModel('nonexistent'), false);
    });

    it('getMaxContextLength should return context length', () => {
      assert.strictEqual(getMaxContextLength('HuggingFaceTB/SmolLM2-135M-Instruct'), 2048);
      assert.strictEqual(getMaxContextLength('HuggingFaceTB/SmolLM2-360M-Instruct'), 2048);
      assert.strictEqual(getMaxContextLength('nonexistent'), null);
    });

    it('getRecommendedSettings should return settings with maxChunksForContext', () => {
      const settings135 = getRecommendedSettings('HuggingFaceTB/SmolLM2-135M-Instruct');
      assert.ok(settings135 !== null);
      assert.strictEqual(settings135?.temperature, 0.1);
      assert.strictEqual(settings135?.maxTokens, 512);
      assert.strictEqual(settings135?.maxChunksForContext, 3);

      const settings360 = getRecommendedSettings('HuggingFaceTB/SmolLM2-360M-Instruct');
      assert.ok(settings360 !== null);
      assert.strictEqual(settings360?.maxChunksForContext, 5);
    });
  });
});
