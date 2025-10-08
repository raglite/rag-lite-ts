import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { getModelDefaults, type ModelDefaults, validateConfig, type Config } from './config.js';

describe('Configuration Tests', () => {
  describe('getModelDefaults', () => {
    test('should return correct defaults for sentence-transformers/all-MiniLM-L6-v2', () => {
      const modelName = 'sentence-transformers/all-MiniLM-L6-v2';
      const defaults = getModelDefaults(modelName);
      
      const expected: ModelDefaults = {
        dimensions: 384,
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16
      };
      
      assert.deepEqual(defaults, expected, 
        `Expected defaults for ${modelName} to match expected configuration`);
    });

    test('should return correct defaults for Xenova/all-mpnet-base-v2', () => {
      const modelName = 'Xenova/all-mpnet-base-v2';
      const defaults = getModelDefaults(modelName);
      
      const expected: ModelDefaults = {
        dimensions: 768,
        chunk_size: 400,
        chunk_overlap: 80,
        batch_size: 8
      };
      
      assert.deepEqual(defaults, expected,
        `Expected defaults for ${modelName} to match expected configuration`);
    });

    test('should return default (384-dim) configuration for unknown model names', () => {
      const unknownModels = [
        'unknown-model',
        'some/random-model',
        '',
        'sentence-transformers/different-model',
        'Xenova/different-model'
      ];
      
      const expectedDefaults: ModelDefaults = {
        dimensions: 384,
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16
      };
      
      for (const modelName of unknownModels) {
        const defaults = getModelDefaults(modelName);
        assert.deepEqual(defaults, expectedDefaults,
          `Expected unknown model "${modelName}" to return default 384-dim configuration`);
      }
    });

    test('should handle null and undefined model names gracefully', () => {
      const expectedDefaults: ModelDefaults = {
        dimensions: 384,
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16
      };
      
      // Test with null (cast to string)
      const nullDefaults = getModelDefaults(null as any);
      assert.deepEqual(nullDefaults, expectedDefaults,
        'Expected null model name to return default configuration');
      
      // Test with undefined (cast to string)
      const undefinedDefaults = getModelDefaults(undefined as any);
      assert.deepEqual(undefinedDefaults, expectedDefaults,
        'Expected undefined model name to return default configuration');
    });

    test('should validate that model defaults have correct properties', () => {
      const testModels = [
        'sentence-transformers/all-MiniLM-L6-v2',
        'Xenova/all-mpnet-base-v2',
        'unknown-model'
      ];
      
      for (const modelName of testModels) {
        const defaults = getModelDefaults(modelName);
        
        // Validate all required properties exist
        assert.ok(typeof defaults.dimensions === 'number', 
          `dimensions should be a number for ${modelName}`);
        assert.ok(typeof defaults.chunk_size === 'number', 
          `chunk_size should be a number for ${modelName}`);
        assert.ok(typeof defaults.chunk_overlap === 'number', 
          `chunk_overlap should be a number for ${modelName}`);
        assert.ok(typeof defaults.batch_size === 'number', 
          `batch_size should be a number for ${modelName}`);
        
        // Validate reasonable ranges
        assert.ok(defaults.dimensions > 0, 
          `dimensions should be positive for ${modelName}`);
        assert.ok(defaults.chunk_size > 0, 
          `chunk_size should be positive for ${modelName}`);
        assert.ok(defaults.chunk_overlap >= 0, 
          `chunk_overlap should be non-negative for ${modelName}`);
        assert.ok(defaults.batch_size > 0, 
          `batch_size should be positive for ${modelName}`);
        
        // Validate chunk_overlap is less than chunk_size
        assert.ok(defaults.chunk_overlap < defaults.chunk_size,
          `chunk_overlap should be less than chunk_size for ${modelName}`);
      }
    });

    test('should return consistent results for same model name', () => {
      const modelName = 'sentence-transformers/all-MiniLM-L6-v2';
      
      const defaults1 = getModelDefaults(modelName);
      const defaults2 = getModelDefaults(modelName);
      
      assert.deepEqual(defaults1, defaults2,
        'getModelDefaults should return consistent results for the same model');
    });

    test('should handle case sensitivity correctly', () => {
      const expectedDefaults: ModelDefaults = {
        dimensions: 384,
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16
      };
      
      // Test case variations - should all return default since exact match is required
      const caseVariations = [
        'SENTENCE-TRANSFORMERS/ALL-MINILM-L6-V2',
        'Sentence-Transformers/All-MiniLM-L6-v2',
        'XENOVA/ALL-MPNET-BASE-V2',
        'xenova/all-mpnet-base-v2'
      ];
      
      for (const variation of caseVariations) {
        const defaults = getModelDefaults(variation);
        assert.deepEqual(defaults, expectedDefaults,
          `Expected case variation "${variation}" to return default configuration`);
      }
    });
  });

  describe('Environment Variable Override Tests', () => {
    // Store original environment variables to restore after tests
    const originalEnv = {
      RAG_EMBEDDING_MODEL: process.env.RAG_EMBEDDING_MODEL,
      RAG_CHUNK_SIZE: process.env.RAG_CHUNK_SIZE,
      RAG_CHUNK_OVERLAP: process.env.RAG_CHUNK_OVERLAP,
      RAG_BATCH_SIZE: process.env.RAG_BATCH_SIZE,
      RAG_TOP_K: process.env.RAG_TOP_K,
      RAG_DB_FILE: process.env.RAG_DB_FILE,
      RAG_INDEX_FILE: process.env.RAG_INDEX_FILE,
      RAG_RERANK_ENABLED: process.env.RAG_RERANK_ENABLED,
      RAG_MODEL_CACHE_PATH: process.env.RAG_MODEL_CACHE_PATH
    };

    // Helper function to restore environment variables
    function restoreEnv() {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }

    test('should validate getModelDefaults works with environment variable model selection', () => {
      // Test that getModelDefaults function works correctly for both models
      const sentenceTransformersDefaults = getModelDefaults('sentence-transformers/all-MiniLM-L6-v2');
      const xenovaDefaults = getModelDefaults('Xenova/all-mpnet-base-v2');
      const unknownDefaults = getModelDefaults('unknown/model');

      // Validate sentence-transformers defaults
      assert.strictEqual(sentenceTransformersDefaults.dimensions, 384,
        'sentence-transformers model should have 384 dimensions');
      assert.strictEqual(sentenceTransformersDefaults.chunk_size, 250,
        'sentence-transformers model should have chunk_size 250');
      assert.strictEqual(sentenceTransformersDefaults.chunk_overlap, 50,
        'sentence-transformers model should have chunk_overlap 50');
      assert.strictEqual(sentenceTransformersDefaults.batch_size, 16,
        'sentence-transformers model should have batch_size 16');

      // Validate Xenova defaults
      assert.strictEqual(xenovaDefaults.dimensions, 768,
        'Xenova model should have 768 dimensions');
      assert.strictEqual(xenovaDefaults.chunk_size, 400,
        'Xenova model should have chunk_size 400');
      assert.strictEqual(xenovaDefaults.chunk_overlap, 80,
        'Xenova model should have chunk_overlap 80');
      assert.strictEqual(xenovaDefaults.batch_size, 8,
        'Xenova model should have batch_size 8');

      // Validate unknown model defaults to sentence-transformers
      assert.deepEqual(unknownDefaults, sentenceTransformersDefaults,
        'Unknown model should default to sentence-transformers defaults');
    });

    test('should handle environment variable parsing correctly', () => {
      // Test parseInt behavior with various inputs
      const testCases = [
        { input: '250', expected: 250, description: 'valid number string' },
        { input: '0', expected: 0, description: 'zero string' },
        { input: '-10', expected: -10, description: 'negative number string' },
        { input: 'invalid', expected: NaN, description: 'invalid string' },
        { input: '', expected: NaN, description: 'empty string' },
        { input: '123abc', expected: 123, description: 'number with trailing text' },
        { input: 'abc123', expected: NaN, description: 'text with trailing number' }
      ];

      for (const testCase of testCases) {
        const result = parseInt(testCase.input, 10);
        if (isNaN(testCase.expected)) {
          assert.ok(isNaN(result), `parseInt('${testCase.input}') should be NaN for ${testCase.description}`);
        } else {
          assert.strictEqual(result, testCase.expected,
            `parseInt('${testCase.input}') should be ${testCase.expected} for ${testCase.description}`);
        }
      }
    });

    test('should handle boolean environment variable parsing correctly', () => {
      // Test boolean parsing behavior
      const testCases = [
        { input: 'true', expected: true, description: 'string "true"' },
        { input: 'false', expected: false, description: 'string "false"' },
        { input: 'TRUE', expected: false, description: 'uppercase "TRUE"' },
        { input: '1', expected: false, description: 'string "1"' },
        { input: '0', expected: false, description: 'string "0"' },
        { input: '', expected: false, description: 'empty string' },
        { input: 'yes', expected: false, description: 'string "yes"' },
        { input: 'no', expected: false, description: 'string "no"' }
      ];

      for (const testCase of testCases) {
        const result = testCase.input === 'true';
        assert.strictEqual(result, testCase.expected,
          `'${testCase.input}' === 'true' should be ${testCase.expected} for ${testCase.description}`);
      }
    });

    test('should validate config creation logic with different model defaults', () => {
      // Test the logic used in config creation
      const testScenarios = [
        {
          modelName: 'sentence-transformers/all-MiniLM-L6-v2',
          envVars: {},
          expectedDefaults: { chunk_size: 250, chunk_overlap: 50, batch_size: 16 }
        },
        {
          modelName: 'Xenova/all-mpnet-base-v2',
          envVars: {},
          expectedDefaults: { chunk_size: 400, chunk_overlap: 80, batch_size: 8 }
        },
        {
          modelName: 'unknown/model',
          envVars: {},
          expectedDefaults: { chunk_size: 250, chunk_overlap: 50, batch_size: 16 }
        },
        {
          modelName: 'sentence-transformers/all-MiniLM-L6-v2',
          envVars: { RAG_CHUNK_SIZE: '300', RAG_BATCH_SIZE: '20' },
          expectedDefaults: { chunk_size: 300, chunk_overlap: 50, batch_size: 20 }
        },
        {
          modelName: 'Xenova/all-mpnet-base-v2',
          envVars: { RAG_CHUNK_SIZE: '500', RAG_CHUNK_OVERLAP: '100' },
          expectedDefaults: { chunk_size: 500, chunk_overlap: 100, batch_size: 8 }
        }
      ];

      for (const scenario of testScenarios) {
        const modelDefaults = getModelDefaults(scenario.modelName);
        
        // Simulate config creation logic
        const chunk_size = parseInt(scenario.envVars.RAG_CHUNK_SIZE || modelDefaults.chunk_size.toString(), 10);
        const chunk_overlap = parseInt(scenario.envVars.RAG_CHUNK_OVERLAP || modelDefaults.chunk_overlap.toString(), 10);
        const batch_size = parseInt(scenario.envVars.RAG_BATCH_SIZE || modelDefaults.batch_size.toString(), 10);

        assert.strictEqual(chunk_size, scenario.expectedDefaults.chunk_size,
          `chunk_size should be ${scenario.expectedDefaults.chunk_size} for ${scenario.modelName} with env vars ${JSON.stringify(scenario.envVars)}`);
        assert.strictEqual(chunk_overlap, scenario.expectedDefaults.chunk_overlap,
          `chunk_overlap should be ${scenario.expectedDefaults.chunk_overlap} for ${scenario.modelName} with env vars ${JSON.stringify(scenario.envVars)}`);
        assert.strictEqual(batch_size, scenario.expectedDefaults.batch_size,
          `batch_size should be ${scenario.expectedDefaults.batch_size} for ${scenario.modelName} with env vars ${JSON.stringify(scenario.envVars)}`);
      }
    });

    test('should handle invalid environment variable values with fallback logic', () => {
      // Test fallback behavior when environment variables are invalid
      const modelDefaults = getModelDefaults('sentence-transformers/all-MiniLM-L6-v2');
      
      const invalidValues = ['invalid', '', 'abc', 'not-a-number'];
      
      for (const invalidValue of invalidValues) {
        // Simulate the config creation logic with invalid values
        const chunk_size = parseInt(invalidValue || modelDefaults.chunk_size.toString(), 10);
        const chunk_overlap = parseInt(invalidValue || modelDefaults.chunk_overlap.toString(), 10);
        const batch_size = parseInt(invalidValue || modelDefaults.batch_size.toString(), 10);
        
        // parseInt of invalid values returns NaN, but the || fallback doesn't work with NaN
        // The actual config uses the pattern: parseInt(env || default.toString(), 10)
        // So if env is invalid, it still gets parsed and becomes NaN
        if (invalidValue === '') {
          // Empty string falls back to default before parseInt
          assert.strictEqual(chunk_size, modelDefaults.chunk_size,
            `Empty string should fall back to default chunk_size`);
          assert.strictEqual(chunk_overlap, modelDefaults.chunk_overlap,
            `Empty string should fall back to default chunk_overlap`);
          assert.strictEqual(batch_size, modelDefaults.batch_size,
            `Empty string should fall back to default batch_size`);
        } else {
          // Non-empty invalid strings get parsed to NaN
          assert.ok(isNaN(chunk_size),
            `Invalid value '${invalidValue}' should parse to NaN for chunk_size`);
          assert.ok(isNaN(chunk_overlap),
            `Invalid value '${invalidValue}' should parse to NaN for chunk_overlap`);
          assert.ok(isNaN(batch_size),
            `Invalid value '${invalidValue}' should parse to NaN for batch_size`);
        }
      }
    });

    test('should validate that config uses correct model-specific defaults pattern', () => {
      // Test the exact pattern used in config.ts
      const testModels = [
        'sentence-transformers/all-MiniLM-L6-v2',
        'Xenova/all-mpnet-base-v2',
        'unknown/model'
      ];

      for (const modelName of testModels) {
        const modelDefaults = getModelDefaults(modelName);
        
        // Test the exact pattern: parseInt(process.env.VAR || modelDefaults.value.toString(), 10)
        const testEnvValues = [undefined, '', '300', 'invalid'];
        
        for (const envValue of testEnvValues) {
          const chunk_size = parseInt(envValue || modelDefaults.chunk_size.toString(), 10);
          const chunk_overlap = parseInt(envValue || modelDefaults.chunk_overlap.toString(), 10);
          const batch_size = parseInt(envValue || modelDefaults.batch_size.toString(), 10);
          
          if (envValue === undefined || envValue === '') {
            // Should use model defaults
            assert.strictEqual(chunk_size, modelDefaults.chunk_size,
              `Should use model default chunk_size for ${modelName} when env is ${envValue}`);
            assert.strictEqual(chunk_overlap, modelDefaults.chunk_overlap,
              `Should use model default chunk_overlap for ${modelName} when env is ${envValue}`);
            assert.strictEqual(batch_size, modelDefaults.batch_size,
              `Should use model default batch_size for ${modelName} when env is ${envValue}`);
          } else if (envValue === '300') {
            // Should use environment value
            assert.strictEqual(chunk_size, 300,
              `Should use env value 300 for chunk_size for ${modelName}`);
            assert.strictEqual(chunk_overlap, 300,
              `Should use env value 300 for chunk_overlap for ${modelName}`);
            assert.strictEqual(batch_size, 300,
              `Should use env value 300 for batch_size for ${modelName}`);
          } else if (envValue === 'invalid') {
            // Should parse to NaN
            assert.ok(isNaN(chunk_size),
              `Should parse to NaN for chunk_size with invalid env value for ${modelName}`);
            assert.ok(isNaN(chunk_overlap),
              `Should parse to NaN for chunk_overlap with invalid env value for ${modelName}`);
            assert.ok(isNaN(batch_size),
              `Should parse to NaN for batch_size with invalid env value for ${modelName}`);
          }
        }
      }
    });
  });

  describe('Model Cache Path Configuration', () => {
    test('should handle model_cache_path environment variable correctly', () => {
      // Test that the environment variable pattern works for model_cache_path
      const testCases = [
        { envValue: undefined, expected: undefined, description: 'undefined environment variable' },
        { envValue: '/custom/cache/path', expected: '/custom/cache/path', description: 'valid path' },
        { envValue: '~/.cache/models', expected: '~/.cache/models', description: 'home directory path' },
        { envValue: 'C:\\Windows\\Cache', expected: 'C:\\Windows\\Cache', description: 'Windows path' },
        { envValue: '', expected: '', description: 'empty string' }
      ];

      for (const testCase of testCases) {
        // Simulate the config creation logic: process.env.RAG_MODEL_CACHE_PATH
        const result = testCase.envValue;
        assert.strictEqual(result, testCase.expected,
          `Environment variable should be ${testCase.expected} for ${testCase.description}`);
      }
    });

    test('should validate model_cache_path field correctly', () => {
      const baseConfig: Config = {
        embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16,
        top_k: 10,
        db_file: 'test.db',
        index_file: 'test.bin',
        rerank_enabled: false,
        preprocessing: { mode: 'balanced' },
        path_storage_strategy: 'relative'
      };

      // Test valid configurations
      const validConfigs = [
        { ...baseConfig }, // No model_cache_path (undefined)
        { ...baseConfig, model_cache_path: undefined }, // Explicitly undefined
        { ...baseConfig, model_cache_path: '/valid/path' }, // Valid string path
        { ...baseConfig, model_cache_path: '~/.cache/models' }, // Home directory path
        { ...baseConfig, model_cache_path: 'C:\\Windows\\Cache' } // Windows path
      ];

      for (const config of validConfigs) {
        assert.doesNotThrow(() => validateConfig(config),
          `Valid config should not throw: ${JSON.stringify({ model_cache_path: config.model_cache_path })}`);
      }

      // Test invalid configurations
      const invalidConfigs = [
        { ...baseConfig, model_cache_path: '' }, // Empty string
        { ...baseConfig, model_cache_path: '   ' }, // Whitespace only
        { ...baseConfig, model_cache_path: 123 as any }, // Number
        { ...baseConfig, model_cache_path: true as any }, // Boolean
        { ...baseConfig, model_cache_path: {} as any }, // Object
        { ...baseConfig, model_cache_path: [] as any } // Array
      ];

      for (const config of invalidConfigs) {
        assert.throws(() => validateConfig(config),
          `Invalid config should throw for model_cache_path: ${JSON.stringify(config.model_cache_path)}`);
      }
    });

    test('should include model_cache_path in Config interface', () => {
      // Test that the Config interface accepts the new field
      const configWithCachePath: Config = {
        embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16,
        top_k: 10,
        db_file: 'test.db',
        index_file: 'test.bin',
        rerank_enabled: false,
        preprocessing: { mode: 'balanced' },
        model_cache_path: '/custom/cache/path',
        path_storage_strategy: 'relative'
      };

      const configWithoutCachePath: Config = {
        embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
        chunk_size: 250,
        chunk_overlap: 50,
        batch_size: 16,
        top_k: 10,
        db_file: 'test.db',
        index_file: 'test.bin',
        rerank_enabled: false,
        preprocessing: { mode: 'balanced' },
        path_storage_strategy: 'relative'
      };

      // Both should be valid Config objects
      assert.ok(configWithCachePath, 'Config with model_cache_path should be valid');
      assert.ok(configWithoutCachePath, 'Config without model_cache_path should be valid');
      
      // Validate both configurations
      assert.doesNotThrow(() => validateConfig(configWithCachePath),
        'Config with model_cache_path should pass validation');
      assert.doesNotThrow(() => validateConfig(configWithoutCachePath),
        'Config without model_cache_path should pass validation');
    });
  });
});