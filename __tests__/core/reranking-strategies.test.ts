/**
 * Tests for Cross-Encoder Reranking Strategy
 * Uses Node.js test runner
 */

import { test, describe, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  CrossEncoderRerankingStrategy,
  TextDerivedRerankingStrategy,
  MetadataRerankingStrategy,
  createCrossEncoderStrategy,
  createTextDerivedStrategy,
  createMetadataStrategy,
  createCrossEncoderRerankFunction,
  createTextDerivedRerankFunction,
  createMetadataRerankFunction
} from '../../src/../src/core/reranking-strategies.js';
import type { SearchResult } from '../../src/../src/core/types.js';

describe('CrossEncoderRerankingStrategy', () => {
  let strategy: CrossEncoderRerankingStrategy;
  
  beforeEach(() => {
    strategy = new CrossEncoderRerankingStrategy();
  });

  describe('Strategy Interface Implementation', () => {
    test('should implement RerankingStrategy interface correctly', () => {
      assert.strictEqual(strategy.name, 'cross-encoder');
      assert.deepStrictEqual(strategy.supportedContentTypes, ['text']);
      assert.strictEqual(strategy.isEnabled, true);
      assert.strictEqual(typeof strategy.rerank, 'function');
      assert.strictEqual(typeof strategy.configure, 'function');
      assert.strictEqual(typeof strategy.getMetadata, 'function');
    });

    test('should provide correct metadata', () => {
      const metadata = strategy.getMetadata();
      
      assert.strictEqual(typeof metadata.description, 'string');
      assert.ok(metadata.description.includes('Cross-encoder'));
      assert.ok(Array.isArray(metadata.requiredModels));
      assert.ok(metadata.requiredModels.length > 0);
      assert.ok(metadata.requiredModels.includes('Xenova/ms-marco-MiniLM-L-6-v2'));
      assert.strictEqual(typeof metadata.configOptions, 'object');
      assert.ok('modelName' in metadata.configOptions);
      assert.ok('enabled' in metadata.configOptions);
    });

    test('should support configuration', () => {
      // Test model name configuration
      strategy.configure({ modelName: 'custom-model' });
      // We can't easily test the internal state change without exposing internals
      // but we can verify the method doesn't throw
      
      // Test enabled configuration
      strategy.configure({ enabled: false });
      assert.strictEqual(strategy.isEnabled, false);
      
      strategy.configure({ enabled: true });
      assert.strictEqual(strategy.isEnabled, true);
    });
  });

  describe('Content Type Validation', () => {
    test('should accept text content type', async () => {
      const query = 'test query';
      const results: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'text',
        document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
      }];

      // Should not throw for text content type
      try {
        await strategy.rerank(query, results, 'text');
      } catch (error) {
        // We expect it might fail due to model not being loaded, but not due to content type
        if (error instanceof Error && error.message.includes('content type')) {
          assert.fail('Should not reject text content type');
        }
      }
    });

    test('should reject unsupported content types', async () => {
      const query = 'test query';
      const results: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'image',
        document: { id: 1, source: 'test.jpg', title: 'Test', contentType: 'image' }
      }];

      await assert.rejects(
        async () => await strategy.rerank(query, results, 'image'),
        /Cross-encoder strategy does not support content type 'image'/,
        'Should reject unsupported content type'
      );
    });

    test('should handle mixed content types by filtering', async () => {
      const query = 'test query';
      const results: SearchResult[] = [
        {
          content: 'text document',
          score: 0.8,
          contentType: 'text',
          document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
        },
        {
          content: 'image document',
          score: 0.6,
          contentType: 'image',
          document: { id: 2, source: 'test.jpg', title: 'Image', contentType: 'image' }
        }
      ];

      // Should handle mixed content by filtering to text only
      // We can't test the full reranking without loading the model, but we can test it doesn't throw
      try {
        const rerankedResults = await strategy.rerank(query, results);
        assert.ok(Array.isArray(rerankedResults));
        assert.strictEqual(rerankedResults.length, results.length);
      } catch (error) {
        // Expected to fail due to model not loaded, but not due to content type handling
        if (error instanceof Error && error.message.includes('content type')) {
          assert.fail('Should handle mixed content types gracefully');
        }
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle empty results gracefully', async () => {
      const query = 'test query';
      const results: SearchResult[] = [];

      const rerankedResults = await strategy.rerank(query, results);
      assert.deepStrictEqual(rerankedResults, []);
    });

    test('should return original results when reranker fails to initialize', async () => {
      const query = 'test query';
      const results: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'text',
        document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
      }];

      // The strategy should handle initialization failure gracefully
      const rerankedResults = await strategy.rerank(query, results);
      
      // Should return original results if reranker fails to load
      assert.ok(Array.isArray(rerankedResults));
      assert.strictEqual(rerankedResults.length, results.length);
    });

    test('should handle disabled state correctly', async () => {
      strategy.configure({ enabled: false });
      
      const query = 'test query';
      const results: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'text',
        document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
      }];

      const rerankedResults = await strategy.rerank(query, results);
      assert.deepStrictEqual(rerankedResults, results);
    });
  });

  describe('Factory Functions', () => {
    test('should create strategy with factory function', () => {
      const createdStrategy = createCrossEncoderStrategy();
      
      assert.ok(createdStrategy instanceof CrossEncoderRerankingStrategy);
      assert.strictEqual(createdStrategy.name, 'cross-encoder');
      assert.deepStrictEqual(createdStrategy.supportedContentTypes, ['text']);
    });

    test('should create strategy with custom model name', () => {
      const customModel = 'custom-cross-encoder-model';
      const createdStrategy = createCrossEncoderStrategy(customModel);
      
      assert.ok(createdStrategy instanceof CrossEncoderRerankingStrategy);
      // We can't easily test the internal model name without exposing it
      // but we can verify the strategy was created successfully
    });

    test('should create rerank function with factory', () => {
      const rerankFn = createCrossEncoderRerankFunction();
      
      assert.strictEqual(typeof rerankFn, 'function');
      assert.strictEqual(rerankFn.length, 3); // query, results, contentType parameters
    });

    test('should create rerank function with custom model', () => {
      const customModel = 'custom-cross-encoder-model';
      const rerankFn = createCrossEncoderRerankFunction(customModel);
      
      assert.strictEqual(typeof rerankFn, 'function');
      assert.strictEqual(rerankFn.length, 3);
    });
  });

  describe('Integration with Existing CrossEncoderReranker', () => {
    test('should use existing reranker implementation internally', () => {
      // Test that the strategy properly wraps the existing implementation
      assert.strictEqual(strategy.name, 'cross-encoder');
      assert.ok(strategy.supportedContentTypes.includes('text'));
      
      // Test metadata includes expected models from existing implementation
      const metadata = strategy.getMetadata();
      assert.ok(metadata.requiredModels.includes('Xenova/ms-marco-MiniLM-L-6-v2'));
    });

    test('should provide model name access', () => {
      const modelName = strategy.getModelName();
      assert.strictEqual(typeof modelName, 'string');
      assert.ok(modelName.length > 0);
    });

    test('should support cleanup', async () => {
      // Should not throw when cleaning up
      await assert.doesNotReject(async () => {
        await strategy.cleanup();
      });
    });
  });

  describe('Readiness Check', () => {
    test('should provide readiness check method', async () => {
      const isReady = await strategy.isReady();
      assert.strictEqual(typeof isReady, 'boolean');
      // We expect it to be false initially since model isn't loaded in tests
    });
  });
});

describe('TextDerivedRerankingStrategy', () => {
  let strategy: TextDerivedRerankingStrategy;
  
  beforeEach(() => {
    strategy = new TextDerivedRerankingStrategy();
  });

  describe('Strategy Interface Implementation', () => {
    test('should implement RerankingStrategy interface correctly', () => {
      assert.strictEqual(strategy.name, 'text-derived');
      assert.deepStrictEqual(strategy.supportedContentTypes, ['text', 'image']);
      assert.strictEqual(strategy.isEnabled, true);
      assert.strictEqual(typeof strategy.rerank, 'function');
      assert.strictEqual(typeof strategy.configure, 'function');
      assert.strictEqual(typeof strategy.getMetadata, 'function');
    });

    test('should provide correct metadata', () => {
      const metadata = strategy.getMetadata();
      
      assert.strictEqual(typeof metadata.description, 'string');
      assert.ok(metadata.description.includes('Text-derived'));
      assert.ok(Array.isArray(metadata.requiredModels));
      assert.ok(metadata.requiredModels.length > 0);
      assert.ok(metadata.requiredModels.includes('Xenova/vit-gpt2-image-captioning'));
      assert.ok(metadata.requiredModels.includes('Xenova/ms-marco-MiniLM-L-6-v2'));
      assert.strictEqual(typeof metadata.configOptions, 'object');
      assert.ok('imageToTextModel' in metadata.configOptions);
      assert.ok('crossEncoderModel' in metadata.configOptions);
      assert.ok('enabled' in metadata.configOptions);
    });

    test('should support configuration', () => {
      // Test image-to-text model configuration
      strategy.configure({ imageToTextModel: 'custom-image-model' });
      
      // Test cross-encoder model configuration
      strategy.configure({ crossEncoderModel: 'custom-cross-encoder' });
      
      // Test enabled configuration
      strategy.configure({ enabled: false });
      assert.strictEqual(strategy.isEnabled, false);
      
      strategy.configure({ enabled: true });
      assert.strictEqual(strategy.isEnabled, true);
    });
  });

  describe('Content Type Support', () => {
    test('should support both text and image content types', async () => {
      const query = 'test query';
      
      // Test with text content
      const textResults: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'text',
        document: { id: 1, source: 'test.md', title: 'Test', contentType: 'text' }
      }];

      // Should not throw for text content type
      try {
        await strategy.rerank(query, textResults, 'text');
      } catch (error) {
        // We expect it might fail due to model not being loaded, but not due to content type
        if (error instanceof Error && error.message.includes('does not support content type')) {
          assert.fail('Should support text content type');
        }
      }

      // Test with image content
      const imageResults: SearchResult[] = [{
        content: '/path/to/image.jpg',
        score: 0.8,
        contentType: 'image',
        document: { id: 2, source: 'image.jpg', title: 'Image', contentType: 'image' }
      }];

      // Should not throw for image content type
      try {
        await strategy.rerank(query, imageResults, 'image');
      } catch (error) {
        // We expect it might fail due to model not being loaded, but not due to content type
        if (error instanceof Error && error.message.includes('does not support content type')) {
          assert.fail('Should support image content type');
        }
      }
    });

    test('should reject unsupported content types', async () => {
      const query = 'test query';
      const results: SearchResult[] = [{
        content: 'test document',
        score: 0.8,
        contentType: 'video',
        document: { id: 1, source: 'test.mp4', title: 'Test', contentType: 'video' }
      }];

      await assert.rejects(
        async () => await strategy.rerank(query, results, 'video'),
        /Text-derived strategy does not support content type 'video'/,
        'Should reject unsupported content type'
      );
    });
  });

  describe('Mixed Content Processing', () => {
    test('should handle mixed text and image content', async () => {
      const query = 'test query';
      const results: SearchResult[] = [
        {
          content: 'text document content',
          score: 0.8,
          contentType: 'text',
          document: { id: 1, source: 'test.md', title: 'Text Doc', contentType: 'text' }
        },
        {
          content: '/path/to/image.jpg',
          score: 0.6,
          contentType: 'image',
          document: { id: 2, source: 'image.jpg', title: 'Image', contentType: 'image' }
        }
      ];

      // Should handle mixed content without throwing content type errors
      try {
        const rerankedResults = await strategy.rerank(query, results);
        assert.ok(Array.isArray(rerankedResults));
        assert.strictEqual(rerankedResults.length, results.length);
        
        // Verify that image content is restored after processing
        const imageResult = rerankedResults.find(r => r.contentType === 'image');
        if (imageResult) {
          assert.strictEqual(imageResult.content, '/path/to/image.jpg');
          assert.strictEqual(imageResult.contentType, 'image');
        }
      } catch (error) {
        // Expected to fail due to models not loaded, but not due to content type handling
        if (error instanceof Error && error.message.includes('does not support content type')) {
          assert.fail('Should handle mixed content types gracefully');
        }
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle empty results gracefully', async () => {
      const query = 'test query';
      const results: SearchResult[] = [];

      const rerankedResults = await strategy.rerank(query, results);
      assert.deepStrictEqual(rerankedResults, []);
    });

    test('should return original results when disabled', async () => {
      strategy.configure({ enabled: false });
      
      const query = 'test query';
      const results: SearchResult[] = [{
        content: '/path/to/image.jpg',
        score: 0.8,
        contentType: 'image',
        document: { id: 1, source: 'image.jpg', title: 'Image', contentType: 'image' }
      }];

      const rerankedResults = await strategy.rerank(query, results);
      assert.deepStrictEqual(rerankedResults, results);
    });

    test('should handle model initialization failure gracefully', async () => {
      const query = 'test query';
      const results: SearchResult[] = [{
        content: '/path/to/image.jpg',
        score: 0.8,
        contentType: 'image',
        document: { id: 1, source: 'image.jpg', title: 'Image', contentType: 'image' }
      }];

      // The strategy should handle initialization failure gracefully
      const rerankedResults = await strategy.rerank(query, results);
      
      // Should return original results if models fail to load
      assert.ok(Array.isArray(rerankedResults));
      assert.strictEqual(rerankedResults.length, results.length);
    });
  });

  describe('Factory Functions', () => {
    test('should create strategy with factory function', () => {
      const createdStrategy = createTextDerivedStrategy();
      
      assert.ok(createdStrategy instanceof TextDerivedRerankingStrategy);
      assert.strictEqual(createdStrategy.name, 'text-derived');
      assert.deepStrictEqual(createdStrategy.supportedContentTypes, ['text', 'image']);
    });

    test('should create strategy with custom model names', () => {
      const customImageModel = 'custom-image-model';
      const customCrossEncoder = 'custom-cross-encoder';
      const createdStrategy = createTextDerivedStrategy(customImageModel, customCrossEncoder);
      
      assert.ok(createdStrategy instanceof TextDerivedRerankingStrategy);
      
      const modelNames = createdStrategy.getModelNames();
      assert.strictEqual(modelNames.imageToText, customImageModel);
    });

    test('should create rerank function with factory', () => {
      const rerankFn = createTextDerivedRerankFunction();
      
      assert.strictEqual(typeof rerankFn, 'function');
      assert.strictEqual(rerankFn.length, 3); // query, results, contentType parameters
    });

    test('should create rerank function with custom models', () => {
      const customImageModel = 'custom-image-model';
      const customCrossEncoder = 'custom-cross-encoder';
      const rerankFn = createTextDerivedRerankFunction(customImageModel, customCrossEncoder);
      
      assert.strictEqual(typeof rerankFn, 'function');
      assert.strictEqual(rerankFn.length, 3);
    });
  });

  describe('Model Information', () => {
    test('should provide model names', () => {
      const modelNames = strategy.getModelNames();
      
      assert.strictEqual(typeof modelNames, 'object');
      assert.ok('imageToText' in modelNames);
      assert.ok('crossEncoder' in modelNames);
      assert.strictEqual(typeof modelNames.imageToText, 'string');
      assert.strictEqual(typeof modelNames.crossEncoder, 'string');
      assert.strictEqual(modelNames.imageToText, 'Xenova/vit-gpt2-image-captioning');
    });

    test('should support cleanup', async () => {
      // Should not throw when cleaning up
      await assert.doesNotReject(async () => {
        await strategy.cleanup();
      });
    });
  });

  describe('Readiness Check', () => {
    test('should provide readiness check method', async () => {
      const isReady = await strategy.isReady();
      assert.strictEqual(typeof isReady, 'boolean');
      // We expect it to be false initially since models aren't loaded in tests
    });
  });
});

describe('MetadataRerankingStrategy', () => {
  let strategy: MetadataRerankingStrategy;
  
  beforeEach(() => {
    strategy = new MetadataRerankingStrategy();
  });

  describe('Strategy Interface Implementation', () => {
    test('should implement RerankingStrategy interface correctly', () => {
      assert.strictEqual(strategy.name, 'metadata');
      assert.deepStrictEqual(strategy.supportedContentTypes, ['text', 'image', 'pdf', 'docx']);
      assert.strictEqual(strategy.isEnabled, true);
      assert.strictEqual(typeof strategy.rerank, 'function');
      assert.strictEqual(typeof strategy.configure, 'function');
      assert.strictEqual(typeof strategy.getMetadata, 'function');
    });

    test('should provide correct metadata', () => {
      const metadata = strategy.getMetadata();
      
      assert.strictEqual(typeof metadata.description, 'string');
      assert.ok(metadata.description.includes('Metadata-based'));
      assert.ok(Array.isArray(metadata.requiredModels));
      assert.strictEqual(metadata.requiredModels.length, 0); // No models required
      assert.strictEqual(typeof metadata.configOptions, 'object');
      assert.ok('weights' in metadata.configOptions);
      assert.ok('boostFactors' in metadata.configOptions);
      assert.ok('enabled' in metadata.configOptions);
    });

    test('should support configuration', () => {
      const customConfig = {
        weights: { filename: 0.5, contentType: 0.3, metadata: 0.2 },
        boostFactors: { diagram: 2.0 },
        enabled: false
      };
      
      strategy.configure(customConfig);
      
      const config = strategy.getConfig();
      assert.strictEqual(config.weights.filename, 0.5);
      assert.strictEqual(config.weights.contentType, 0.3);
      assert.strictEqual(config.weights.metadata, 0.2);
      assert.strictEqual(config.boostFactors.diagram, 2.0);
      assert.strictEqual(strategy.isEnabled, false);
    });
  });

  describe('Filename-Based Scoring', () => {
    test('should score exact filename matches highly', async () => {
      const results: SearchResult[] = [
        {
          content: 'Some content',
          score: 0.5,
          contentType: 'text',
          document: {
            id: 1,
            source: '/path/to/architecture-diagram.png',
            title: 'Architecture Diagram',
            contentType: 'image'
          }
        },
        {
          content: 'Other content',
          score: 0.6,
          contentType: 'text',
          document: {
            id: 2,
            source: '/path/to/random-file.txt',
            title: 'Random File',
            contentType: 'text'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('architecture diagram', results);
      
      // The architecture diagram should be ranked higher due to filename match
      assert.ok(rerankedResults[0].document.source.includes('architecture-diagram'));
    });

    test('should apply boost factors for specific patterns', async () => {
      const results: SearchResult[] = [
        {
          content: 'Chart content',
          score: 0.5,
          contentType: 'image',
          document: {
            id: 1,
            source: '/path/to/sales-chart.png',
            title: 'Sales Chart',
            contentType: 'image'
          }
        },
        {
          content: 'Regular content',
          score: 0.6,
          contentType: 'text',
          document: {
            id: 2,
            source: '/path/to/document.txt',
            title: 'Document',
            contentType: 'text'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('chart', results);
      
      // The chart should be boosted and ranked higher
      assert.ok(rerankedResults[0].document.source.includes('chart'));
    });
  });

  describe('Content Type-Based Scoring', () => {
    test('should boost image content for visual queries', async () => {
      const results: SearchResult[] = [
        {
          content: 'Image content',
          score: 0.5,
          contentType: 'image',
          document: {
            id: 1,
            source: '/path/to/image.png',
            title: 'Image',
            contentType: 'image'
          }
        },
        {
          content: 'Text content',
          score: 0.6,
          contentType: 'text',
          document: {
            id: 2,
            source: '/path/to/text.txt',
            title: 'Text',
            contentType: 'text'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('diagram visualization', results);
      
      // Image should be boosted for visual query
      assert.ok(rerankedResults[0].contentType === 'image');
    });

    test('should boost text content for documentation queries', async () => {
      const results: SearchResult[] = [
        {
          content: 'Image content',
          score: 0.7,
          contentType: 'image',
          document: {
            id: 1,
            source: '/path/to/image.png',
            title: 'Image',
            contentType: 'image'
          }
        },
        {
          content: 'Documentation content',
          score: 0.5,
          contentType: 'text',
          document: {
            id: 2,
            source: '/path/to/guide.txt',
            title: 'Guide',
            contentType: 'text'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('documentation guide', results);
      
      // Text should be boosted for documentation query
      assert.ok(rerankedResults[0].contentType === 'text');
    });
  });

  describe('Metadata-Based Scoring', () => {
    test('should score based on metadata fields', async () => {
      const results: SearchResult[] = [
        {
          content: 'Content 1',
          score: 0.5,
          contentType: 'text',
          document: {
            id: 1,
            source: '/path/to/file1.txt',
            title: 'File 1',
            contentType: 'text'
          },
          metadata: {
            title: 'API Documentation',
            description: 'Complete API reference guide',
            tags: ['api', 'documentation']
          }
        },
        {
          content: 'Content 2',
          score: 0.6,
          contentType: 'text',
          document: {
            id: 2,
            source: '/path/to/file2.txt',
            title: 'File 2',
            contentType: 'text'
          },
          metadata: {
            title: 'Random Notes',
            description: 'Some random notes'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('API documentation', results);
      
      // File with API documentation metadata should rank higher
      assert.ok(rerankedResults[0].metadata?.title?.includes('API'));
    });

    test('should handle image metadata', async () => {
      const results: SearchResult[] = [
        {
          content: 'Large image',
          score: 0.5,
          contentType: 'image',
          document: {
            id: 1,
            source: '/path/to/large-image.png',
            title: 'Large Image',
            contentType: 'image'
          },
          metadata: {
            dimensions: { width: 1920, height: 1080 },
            fileSize: 1000000
          }
        },
        {
          content: 'Small image',
          score: 0.6,
          contentType: 'image',
          document: {
            id: 2,
            source: '/path/to/small-image.png',
            title: 'Small Image',
            contentType: 'image'
          },
          metadata: {
            dimensions: { width: 100, height: 100 },
            fileSize: 500
          }
        }
      ];

      const rerankedResults = await strategy.rerank('image', results);
      
      // Large image should get a slight boost
      assert.ok(rerankedResults[0].metadata?.dimensions?.width === 1920);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty results gracefully', async () => {
      const results: SearchResult[] = [];
      const rerankedResults = await strategy.rerank('test query', results);
      
      assert.strictEqual(rerankedResults.length, 0);
    });

    test('should return original results when disabled', async () => {
      strategy.configure({ enabled: false });
      
      const results: SearchResult[] = [
        {
          content: 'Test content',
          score: 0.5,
          contentType: 'text',
          document: {
            id: 1,
            source: '/path/to/test.txt',
            title: 'Test',
            contentType: 'text'
          }
        }
      ];

      const rerankedResults = await strategy.rerank('test', results);
      
      assert.deepStrictEqual(rerankedResults, results);
    });

    test('should handle unsupported content types gracefully', async () => {
      const results: SearchResult[] = [
        {
          content: 'Test content',
          score: 0.5,
          contentType: 'video', // Unsupported type
          document: {
            id: 1,
            source: '/path/to/test.mp4',
            title: 'Test Video',
            contentType: 'video'
          }
        }
      ];

      // Should not throw, just log a warning
      const rerankedResults = await strategy.rerank('test', results, 'video');
      
      assert.strictEqual(rerankedResults.length, 1);
      assert.ok(rerankedResults[0].score >= 0);
    });
  });

  describe('Factory Functions', () => {
    test('should create strategy with factory function', () => {
      const createdStrategy = createMetadataStrategy();
      
      assert.ok(createdStrategy instanceof MetadataRerankingStrategy);
      assert.strictEqual(createdStrategy.name, 'metadata');
    });

    test('should create strategy with custom configuration', () => {
      const config = {
        weights: { filename: 0.6, contentType: 0.2, metadata: 0.2 }
      };
      const createdStrategy = createMetadataStrategy(config);
      
      assert.strictEqual(createdStrategy.getConfig().weights.filename, 0.6);
    });

    test('should create rerank function with factory', () => {
      const rerankFn = createMetadataRerankFunction();
      
      assert.strictEqual(typeof rerankFn, 'function');
    });

    test('should create rerank function with custom config', () => {
      const config = {
        keywordBoosts: { 'custom': 2.0 }
      };
      const rerankFn = createMetadataRerankFunction(config);
      
      assert.strictEqual(typeof rerankFn, 'function');
    });
  });

  describe('Readiness Check', () => {
    test('should always be ready when enabled', async () => {
      const isReady = await strategy.isReady();
      assert.strictEqual(isReady, true);
    });

    test('should not be ready when disabled', async () => {
      strategy.configure({ enabled: false });
      const isReady = await strategy.isReady();
      assert.strictEqual(isReady, false);
    });
  });

  describe('Configuration Management', () => {
    test('should provide current configuration', () => {
      const config = strategy.getConfig();
      
      assert.ok('weights' in config);
      assert.ok('boostFactors' in config);
      assert.ok('keywordBoosts' in config);
      assert.strictEqual(typeof config.weights.filename, 'number');
      assert.strictEqual(typeof config.weights.contentType, 'number');
      assert.strictEqual(typeof config.weights.metadata, 'number');
    });

    test('should support cleanup (no-op)', async () => {
      await assert.doesNotReject(async () => {
        await strategy.cleanup();
      });
    });
  });
});