/**
 * Tests for Simple Reranking Configuration System
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  validateRerankingStrategy,
  validateRerankingConfig,
  getDefaultRerankingConfig,
  isStrategySupported,
  getSupportedStrategies,
  RerankingConfigBuilder,
  DEFAULT_TEXT_RERANKING_CONFIG,
  DEFAULT_MULTIMODAL_RERANKING_CONFIG
} from '../../src/core/reranking-config.js';

describe('Reranking Configuration System', () => {
  
  describe('Strategy Validation', () => {
    test('should validate correct reranking strategies', () => {
      const validStrategies = ['cross-encoder', 'text-derived', 'disabled'];
      
      for (const strategy of validStrategies) {
        assert.ok(
          validateRerankingStrategy(strategy),
          `Strategy '${strategy}' should be valid`
        );
      }
    });
    
    test('should reject invalid reranking strategies', () => {
      const invalidStrategies = ['invalid', 'unknown', '', 'cross_encoder'];
      
      for (const strategy of invalidStrategies) {
        assert.ok(
          !validateRerankingStrategy(strategy),
          `Strategy '${strategy}' should be invalid`
        );
      }
    });
  });
  
  describe('Configuration Validation', () => {
    test('should validate basic configuration', () => {
      const config = {
        strategy: 'cross-encoder' as const,
        enabled: true
      };
      
      const validated = validateRerankingConfig(config);
      
      assert.strictEqual(validated.strategy, 'cross-encoder');
      assert.strictEqual(validated.enabled, true);
      assert.strictEqual(validated.fallback, 'disabled');
    });
    
    test('should require strategy field', () => {
      assert.throws(
        () => validateRerankingConfig({}),
        /Reranking strategy is required/,
        'Should require strategy field'
      );
    });
    
    test('should reject invalid strategy', () => {
      assert.throws(
        () => validateRerankingConfig({ strategy: 'invalid' as any }),
        /Invalid reranking strategy 'invalid'/,
        'Should reject invalid strategy'
      );
    });
    
    test('should validate text-derived strategy', () => {
      const config = {
        strategy: 'text-derived' as const
      };

      const validated = validateRerankingConfig(config);

      assert.strictEqual(validated.strategy, 'text-derived');
    });
    
    test('should validate disabled strategy', () => {
      const config = {
        strategy: 'disabled' as const
      };

      const validated = validateRerankingConfig(config);

      assert.strictEqual(validated.strategy, 'disabled');
      assert.strictEqual(validated.enabled, false);
      
    });
    
    test('should validate fallback strategy', () => {
      assert.throws(
        () => validateRerankingConfig({
          strategy: 'text-derived',
          fallback: 'invalid' as any
        }),
        /Invalid fallback strategy 'invalid'/,
        'Should reject invalid fallback strategy'
      );
    });
  });
  
  describe('Default Configurations', () => {
    test('should provide correct text mode defaults', () => {
      const config = getDefaultRerankingConfig('text');
      
      assert.strictEqual(config.strategy, 'cross-encoder');
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.fallback, 'disabled');
    });
    
    test('should provide correct multimodal mode defaults', () => {
      const config = getDefaultRerankingConfig('multimodal');
      
      assert.strictEqual(config.strategy, 'text-derived');
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.fallback, 'disabled');
      assert.deepStrictEqual(config.weights, { semantic: 0.7, metadata: 0.3 });
    });
    
    test('should throw for unknown mode', () => {
      assert.throws(
        () => getDefaultRerankingConfig('unknown' as any),
        /Unknown mode: unknown/,
        'Should reject unknown mode'
      );
    });
  });
  
  describe('Strategy Support by Mode', () => {
    test('should correctly identify supported strategies for text mode', () => {
      assert.ok(isStrategySupported('cross-encoder', 'text'));
      assert.ok(isStrategySupported('disabled', 'text'));
      assert.ok(!isStrategySupported('text-derived', 'text'));
    });
    
    test('should correctly identify supported strategies for multimodal mode', () => {
      assert.ok(!isStrategySupported('cross-encoder', 'multimodal'));
      assert.ok(isStrategySupported('text-derived', 'multimodal'));
      assert.ok(isStrategySupported('disabled', 'multimodal'));
    });
    
    test('should return correct supported strategies list', () => {
      const textStrategies = getSupportedStrategies('text');
      const multimodalStrategies = getSupportedStrategies('multimodal');
      
      assert.deepStrictEqual(textStrategies, ['cross-encoder', 'disabled']);
      assert.deepStrictEqual(multimodalStrategies, ['text-derived', 'disabled']);
    });
  });
  
  describe('Configuration Builder', () => {
    test('should build basic configuration', () => {
      const config = new RerankingConfigBuilder()
        .strategy('cross-encoder')
        .enabled(true)
        .model('test-model')
        .build();
      
      assert.strictEqual(config.strategy, 'cross-encoder');
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.model, 'test-model');
      assert.strictEqual(config.fallback, 'disabled');
    });
    
    test('should build text-derived configuration', () => {
      const config = new RerankingConfigBuilder()
        .strategy('text-derived')
        .fallback('disabled')
        .build();

      assert.strictEqual(config.strategy, 'text-derived');
      assert.strictEqual(config.fallback, 'disabled');
    });
    
    test('should provide text mode convenience method', () => {
      const config = RerankingConfigBuilder.textMode().build();
      
      assert.strictEqual(config.strategy, 'cross-encoder');
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.fallback, 'disabled');
    });
    
    test('should provide multimodal mode convenience method', () => {
      const config = RerankingConfigBuilder.multimodalMode().build();
      
      assert.strictEqual(config.strategy, 'text-derived');
      assert.strictEqual(config.enabled, true);
      assert.deepStrictEqual(config.weights, { semantic: 0.7, metadata: 0.3 });
      assert.strictEqual(config.fallback, 'disabled');
    });
    
    test('should provide disabled convenience method', () => {
      const config = RerankingConfigBuilder.disabled().build();
      
      assert.strictEqual(config.strategy, 'disabled');
      assert.strictEqual(config.enabled, false);
    });
    
    test('should validate configuration when building', () => {
      assert.throws(
        () => new RerankingConfigBuilder().build(),
        /Reranking strategy is required/,
        'Should validate when building'
      );
    });
  });
  
  describe('Default Configuration Constants', () => {
    test('should have correct default text configuration', () => {
      assert.strictEqual(DEFAULT_TEXT_RERANKING_CONFIG.strategy, 'cross-encoder');
      assert.strictEqual(DEFAULT_TEXT_RERANKING_CONFIG.enabled, true);
      assert.strictEqual(DEFAULT_TEXT_RERANKING_CONFIG.fallback, 'disabled');
    });
    
    test('should have correct default multimodal configuration', () => {
      assert.strictEqual(DEFAULT_MULTIMODAL_RERANKING_CONFIG.strategy, 'text-derived');
      assert.strictEqual(DEFAULT_MULTIMODAL_RERANKING_CONFIG.enabled, true);
      assert.strictEqual(DEFAULT_MULTIMODAL_RERANKING_CONFIG.fallback, 'disabled');
      assert.deepStrictEqual(DEFAULT_MULTIMODAL_RERANKING_CONFIG.weights, { semantic: 0.7, metadata: 0.3 });
    });
  });
});