import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  preprocessorRegistry, 
  validatePreprocessorConfiguration, 
  getAvailablePreprocessors,
  PreprocessorRegistry,
  ContentTypeDetector,
  MdxPreprocessor,
  MermaidPreprocessor
} from '../../src/preprocessors/index.js';

describe('Preprocessor Index', () => {
  test('should export all required classes and functions', () => {
    assert.ok(PreprocessorRegistry);
    assert.ok(ContentTypeDetector);
    assert.ok(MdxPreprocessor);
    assert.ok(MermaidPreprocessor);
    assert.ok(preprocessorRegistry);
    assert.ok(validatePreprocessorConfiguration);
    assert.ok(getAvailablePreprocessors);
  });

  test('should initialize registry with MDX and Mermaid preprocessors', () => {
    const availablePreprocessors = getAvailablePreprocessors();
    assert.ok(availablePreprocessors.includes('mdx'));
    assert.ok(availablePreprocessors.includes('mermaid'));
    assert.equal(availablePreprocessors.length, 2);
  });

  test('should validate preprocessor configuration successfully', () => {
    // Should not throw for available preprocessors
    assert.doesNotThrow(() => {
      validatePreprocessorConfiguration(['mdx', 'mermaid']);
    });

    // Should not throw for empty array
    assert.doesNotThrow(() => {
      validatePreprocessorConfiguration([]);
    });
  });

  test('should throw error for missing preprocessors', () => {
    assert.throws(() => {
      validatePreprocessorConfiguration(['nonexistent']);
    }, /Missing required preprocessors: nonexistent/);

    assert.throws(() => {
      validatePreprocessorConfiguration(['mdx', 'nonexistent', 'another']);
    }, /Missing required preprocessors: nonexistent, another/);
  });

  test('should have working preprocessors in registry', () => {
    const mdxPreprocessor = preprocessorRegistry.get('mdx');
    const mermaidPreprocessor = preprocessorRegistry.get('mermaid');

    assert.ok(mdxPreprocessor);
    assert.ok(mermaidPreprocessor);

    // Test that they implement the interface correctly
    assert.equal(typeof mdxPreprocessor.appliesTo, 'function');
    assert.equal(typeof mdxPreprocessor.process, 'function');
    assert.equal(typeof mermaidPreprocessor.appliesTo, 'function');
    assert.equal(typeof mermaidPreprocessor.process, 'function');

    // Test basic functionality
    assert.equal(mdxPreprocessor.appliesTo('mdx'), true);
    assert.equal(mdxPreprocessor.appliesTo('unknown'), false);
    assert.equal(mermaidPreprocessor.appliesTo('mermaid'), true);
    assert.equal(mermaidPreprocessor.appliesTo('unknown'), false);
  });
});
