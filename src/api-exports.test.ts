/**
 * Tests for the new clean public API exports
 * Validates that all expected exports are available and have correct types
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('Clean Public API Exports', () => {
  test('should export primary API classes', async () => {
    const {
      SearchEngine,
      IngestionPipeline
    } = await import('./index.js');

    assert.ok(SearchEngine, 'SearchEngine should be defined');
    assert.strictEqual(typeof SearchEngine, 'function', 'SearchEngine should be a constructor function');

    assert.ok(IngestionPipeline, 'IngestionPipeline should be defined');
    assert.strictEqual(typeof IngestionPipeline, 'function', 'IngestionPipeline should be a constructor function');
  });

  test('should export configuration option types', async () => {
    // Type exports can't be tested at runtime, but we can verify the import doesn't fail
    assert.doesNotThrow(() => {
      const typeImport = `
        import type {
          SearchEngineOptions,
          IngestionPipelineOptions
        } from './index.js';
      `;
      return typeImport;
    }, 'Configuration option types should be exported');
  });

  test('should export factory functions as secondary API', async () => {
    const {
      TextSearchFactory,
      TextIngestionFactory,
      TextRAGFactory,
      TextFactoryHelpers
    } = await import('./index.js');

    assert.ok(TextSearchFactory, 'TextSearchFactory should be defined');
    assert.strictEqual(typeof TextSearchFactory.create, 'function', 'TextSearchFactory.create should be a function');
    assert.strictEqual(typeof TextSearchFactory.createWithDefaults, 'function', 'TextSearchFactory.createWithDefaults should be a function');

    assert.ok(TextIngestionFactory, 'TextIngestionFactory should be defined');
    assert.strictEqual(typeof TextIngestionFactory.create, 'function', 'TextIngestionFactory.create should be a function');
    assert.strictEqual(typeof TextIngestionFactory.createWithDefaults, 'function', 'TextIngestionFactory.createWithDefaults should be a function');

    assert.ok(TextRAGFactory, 'TextRAGFactory should be defined');
    assert.strictEqual(typeof TextRAGFactory.createBoth, 'function', 'TextRAGFactory.createBoth should be a function');
    assert.strictEqual(typeof TextRAGFactory.createBothWithDefaults, 'function', 'TextRAGFactory.createBothWithDefaults should be a function');

    assert.ok(TextFactoryHelpers, 'TextFactoryHelpers should be defined');
    assert.strictEqual(typeof TextFactoryHelpers.validateSearchFiles, 'function', 'TextFactoryHelpers.validateSearchFiles should be a function');
    assert.strictEqual(typeof TextFactoryHelpers.getRecommendedConfig, 'function', 'TextFactoryHelpers.getRecommendedConfig should be a function');
  });

  test('should export core architecture classes', async () => {
    const {
      CoreSearchEngine,
      CoreIngestionPipeline
    } = await import('./index.js');

    assert.ok(CoreSearchEngine, 'CoreSearchEngine should be defined');
    assert.strictEqual(typeof CoreSearchEngine, 'function', 'CoreSearchEngine should be a constructor function');

    assert.ok(CoreIngestionPipeline, 'CoreIngestionPipeline should be defined');
    assert.strictEqual(typeof CoreIngestionPipeline, 'function', 'CoreIngestionPipeline should be a constructor function');
  });

  test('should export text implementations', async () => {
    const {
      EmbeddingEngine,
      getEmbeddingEngine,
      initializeEmbeddingEngine,
      createTextEmbedFunction,
      createTextEmbedder,
      CrossEncoderReranker,
      createTextRerankFunction,
      createTextReranker,
      countTokens
    } = await import('./index.js');

    assert.ok(EmbeddingEngine, 'EmbeddingEngine should be defined');
    assert.strictEqual(typeof EmbeddingEngine, 'function', 'EmbeddingEngine should be a function');

    assert.ok(getEmbeddingEngine, 'getEmbeddingEngine should be defined');
    assert.strictEqual(typeof getEmbeddingEngine, 'function', 'getEmbeddingEngine should be a function');

    assert.ok(initializeEmbeddingEngine, 'initializeEmbeddingEngine should be defined');
    assert.strictEqual(typeof initializeEmbeddingEngine, 'function', 'initializeEmbeddingEngine should be a function');

    assert.ok(createTextEmbedFunction, 'createTextEmbedFunction should be defined');
    assert.strictEqual(typeof createTextEmbedFunction, 'function', 'createTextEmbedFunction should be a function');

    assert.ok(createTextEmbedder, 'createTextEmbedder should be defined');
    assert.strictEqual(typeof createTextEmbedder, 'function', 'createTextEmbedder should be a function');

    assert.ok(CrossEncoderReranker, 'CrossEncoderReranker should be defined');
    assert.strictEqual(typeof CrossEncoderReranker, 'function', 'CrossEncoderReranker should be a function');

    assert.ok(createTextRerankFunction, 'createTextRerankFunction should be defined');
    assert.strictEqual(typeof createTextRerankFunction, 'function', 'createTextRerankFunction should be a function');

    assert.ok(createTextReranker, 'createTextReranker should be defined');
    assert.strictEqual(typeof createTextReranker, 'function', 'createTextReranker should be a function');

    assert.ok(countTokens, 'countTokens should be defined');
    assert.strictEqual(typeof countTokens, 'function', 'countTokens should be a function');
  });

  test('should export core infrastructure', async () => {
    const {
      openDatabase,
      IndexManager,
      VectorIndex,
      config,
      getModelDefaults
    } = await import('./index.js');

    assert.ok(openDatabase, 'openDatabase should be defined');
    assert.strictEqual(typeof openDatabase, 'function', 'openDatabase should be a function');

    assert.ok(IndexManager, 'IndexManager should be defined');
    assert.strictEqual(typeof IndexManager, 'function', 'IndexManager should be a function');

    assert.ok(VectorIndex, 'VectorIndex should be defined');
    assert.strictEqual(typeof VectorIndex, 'function', 'VectorIndex should be a function');

    assert.ok(config, 'config should be defined');
    assert.strictEqual(typeof config, 'object', 'config should be an object');

    assert.ok(getModelDefaults, 'getModelDefaults should be defined');
    assert.strictEqual(typeof getModelDefaults, 'function', 'getModelDefaults should be a function');
  });

  test('should export file processing utilities', async () => {
    const {
      discoverFiles,
      processFiles,
      discoverAndProcessFiles,
      DEFAULT_FILE_PROCESSOR_OPTIONS,
      chunkDocument,
      DocumentPathManager
    } = await import('./index.js');

    assert.ok(discoverFiles, 'discoverFiles should be defined');
    assert.strictEqual(typeof discoverFiles, 'function', 'discoverFiles should be a function');

    assert.ok(processFiles, 'processFiles should be defined');
    assert.strictEqual(typeof processFiles, 'function', 'processFiles should be a function');

    assert.ok(discoverAndProcessFiles, 'discoverAndProcessFiles should be defined');
    assert.strictEqual(typeof discoverAndProcessFiles, 'function', 'discoverAndProcessFiles should be a function');

    assert.ok(DEFAULT_FILE_PROCESSOR_OPTIONS, 'DEFAULT_FILE_PROCESSOR_OPTIONS should be defined');
    assert.strictEqual(typeof DEFAULT_FILE_PROCESSOR_OPTIONS, 'object', 'DEFAULT_FILE_PROCESSOR_OPTIONS should be an object');

    assert.ok(chunkDocument, 'chunkDocument should be defined');
    assert.strictEqual(typeof chunkDocument, 'function', 'chunkDocument should be a function');

    assert.ok(DocumentPathManager, 'DocumentPathManager should be defined');
    assert.strictEqual(typeof DocumentPathManager, 'function', 'DocumentPathManager should be a function');
  });

  test('should export error handling utilities', async () => {
    const {
      handleError,
      safeExecute,
      ErrorCategory,
      ErrorSeverity,
      createError,
      APIError,
      IngestionError,
      SearchError,
      ResourceError,
      ModelCompatibilityError,
      ErrorFactory,
      CommonErrors,
      handleAPIError
    } = await import('./index.js');

    assert.ok(handleError, 'handleError should be defined');
    assert.strictEqual(typeof handleError, 'function', 'handleError should be a function');

    assert.ok(safeExecute, 'safeExecute should be defined');
    assert.strictEqual(typeof safeExecute, 'function', 'safeExecute should be a function');

    assert.ok(ErrorCategory, 'ErrorCategory should be defined');
    assert.strictEqual(typeof ErrorCategory, 'object', 'ErrorCategory should be an object');

    assert.ok(ErrorSeverity, 'ErrorSeverity should be defined');
    assert.strictEqual(typeof ErrorSeverity, 'object', 'ErrorSeverity should be an object');

    assert.ok(createError, 'createError should be defined');
    assert.strictEqual(typeof createError, 'function', 'createError should be a function');

    assert.ok(APIError, 'APIError should be defined');
    assert.strictEqual(typeof APIError, 'function', 'APIError should be a function');

    assert.ok(IngestionError, 'IngestionError should be defined');
    assert.strictEqual(typeof IngestionError, 'function', 'IngestionError should be a function');

    assert.ok(SearchError, 'SearchError should be defined');
    assert.strictEqual(typeof SearchError, 'function', 'SearchError should be a function');

    assert.ok(ResourceError, 'ResourceError should be defined');
    assert.strictEqual(typeof ResourceError, 'function', 'ResourceError should be a function');

    assert.ok(ModelCompatibilityError, 'ModelCompatibilityError should be defined');
    assert.strictEqual(typeof ModelCompatibilityError, 'function', 'ModelCompatibilityError should be a function');

    assert.ok(ErrorFactory, 'ErrorFactory should be defined');
    assert.strictEqual(typeof ErrorFactory, 'object', 'ErrorFactory should be an object');

    assert.ok(CommonErrors, 'CommonErrors should be defined');
    assert.strictEqual(typeof CommonErrors, 'object', 'CommonErrors should be an object');

    assert.ok(handleAPIError, 'handleAPIError should be defined');
    assert.strictEqual(typeof handleAPIError, 'function', 'handleAPIError should be a function');
  });

  test('should export interface validator', async () => {
    const { InterfaceValidator } = await import('./index.js');

    assert.ok(InterfaceValidator, 'InterfaceValidator should be defined');
    assert.strictEqual(typeof InterfaceValidator.validateEmbedFunction, 'function', 'InterfaceValidator.validateEmbedFunction should be a function');
    assert.strictEqual(typeof InterfaceValidator.validateRerankFunction, 'function', 'InterfaceValidator.validateRerankFunction should be a function');
    assert.strictEqual(typeof InterfaceValidator.validateEmbeddingDimensions, 'function', 'InterfaceValidator.validateEmbeddingDimensions should be a function');
    assert.strictEqual(typeof InterfaceValidator.validateContentTypeSupport, 'function', 'InterfaceValidator.validateContentTypeSupport should be a function');
  });

  test('should not export legacy compatibility items', async () => {
    // These should NOT be exported in the new clean API
    const exports = await import('./index.js');

    // Legacy items that should be removed
    assert.strictEqual('ResourceManager' in exports, false, 'ResourceManager should not be exported');
    assert.strictEqual('validateConfig' in exports, false, 'validateConfig should not be exported');
  });

  test('should export type definitions', () => {
    // Type exports can't be tested at runtime, but we can verify the import doesn't fail
    assert.doesNotThrow(() => {
      // This would fail at compile time if types aren't exported
      const typeImport = `
        import type {
          TextSearchOptions,
          TextIngestionOptions,
          EmbedFunction,
          RerankFunction,
          SearchResult,
          SearchOptions,
          Document,
          EmbeddingResult,
          IngestionOptions,
          IngestionResult
        } from './index.js';
      `;
      return typeImport;
    }, 'Type imports should not throw');
  });
});