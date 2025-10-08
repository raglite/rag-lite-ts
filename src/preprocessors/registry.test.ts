import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { PreprocessorRegistry, ContentTypeDetector } from './registry.js';
import { MdxPreprocessor } from './mdx.js';
import { MermaidPreprocessor } from './mermaid.js';

describe('PreprocessorRegistry', () => {
  test('should register and retrieve preprocessors', () => {
    const registry = new PreprocessorRegistry();
    const mdxPreprocessor = new MdxPreprocessor();
    registry.register('mdx', mdxPreprocessor);

    assert.equal(registry.get('mdx'), mdxPreprocessor);
    assert.equal(registry.get('nonexistent'), undefined);
  });

  test('should return applicable preprocessors', () => {
    const registry = new PreprocessorRegistry();
    const mdxPreprocessor = new MdxPreprocessor();
    const mermaidPreprocessor = new MermaidPreprocessor();
    
    registry.register('mdx', mdxPreprocessor);
    registry.register('mermaid', mermaidPreprocessor);

    const mdxApplicable = registry.getApplicable('mdx');
    assert.equal(mdxApplicable.length, 1);
    assert.equal(mdxApplicable[0], mdxPreprocessor);

    const mermaidApplicable = registry.getApplicable('mermaid');
    assert.equal(mermaidApplicable.length, 1);
    assert.equal(mermaidApplicable[0], mermaidPreprocessor);

    const noneApplicable = registry.getApplicable('unknown');
    assert.equal(noneApplicable.length, 0);
  });

  test('should validate preprocessor availability', () => {
    const registry = new PreprocessorRegistry();
    registry.register('mdx', new MdxPreprocessor());
    
    const validResult = registry.validatePreprocessors(['mdx']);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.missing.length, 0);

    const invalidResult = registry.validatePreprocessors(['mdx', 'nonexistent']);
    assert.equal(invalidResult.valid, false);
    assert.deepEqual(invalidResult.missing, ['nonexistent']);
  });

  test('should return registered preprocessor names', () => {
    const registry = new PreprocessorRegistry();
    registry.register('mdx', new MdxPreprocessor());
    registry.register('mermaid', new MermaidPreprocessor());

    const names = registry.getRegisteredNames();
    assert.ok(names.includes('mdx'));
    assert.ok(names.includes('mermaid'));
    assert.equal(names.length, 2);
  });
});

describe('ContentTypeDetector', () => {
  describe('detectFromExtension', () => {
    test('should detect common file extensions', () => {
      assert.equal(ContentTypeDetector.detectFromExtension('file.mdx'), 'mdx');
      assert.equal(ContentTypeDetector.detectFromExtension('file.md'), 'markdown');
      assert.equal(ContentTypeDetector.detectFromExtension('file.js'), 'javascript');
      assert.equal(ContentTypeDetector.detectFromExtension('file.ts'), 'typescript');
      assert.equal(ContentTypeDetector.detectFromExtension('file.py'), 'python');
      assert.equal(ContentTypeDetector.detectFromExtension('file.unknown'), null);
    });

    test('should handle case insensitive extensions', () => {
      assert.equal(ContentTypeDetector.detectFromExtension('FILE.MDX'), 'mdx');
      assert.equal(ContentTypeDetector.detectFromExtension('File.Js'), 'javascript');
    });
  });

  describe('detectFromCodeFence', () => {
    test('should normalize language identifiers', () => {
      assert.equal(ContentTypeDetector.detectFromCodeFence('js'), 'javascript');
      assert.equal(ContentTypeDetector.detectFromCodeFence('ts'), 'typescript');
      assert.equal(ContentTypeDetector.detectFromCodeFence('py'), 'python');
      assert.equal(ContentTypeDetector.detectFromCodeFence('mermaid'), 'mermaid');
    });

    test('should handle case and whitespace', () => {
      assert.equal(ContentTypeDetector.detectFromCodeFence(' JS '), 'javascript');
      assert.equal(ContentTypeDetector.detectFromCodeFence('PYTHON'), 'python');
    });
  });

  describe('hasJsxContent', () => {
    test('should detect JSX patterns', () => {
      assert.equal(ContentTypeDetector.hasJsxContent('<Component />'), true);
      assert.equal(ContentTypeDetector.hasJsxContent('<div className="test">'), true);
      assert.equal(ContentTypeDetector.hasJsxContent('{variable}'), true);
      assert.equal(ContentTypeDetector.hasJsxContent('import React from "react"'), true);
      assert.equal(ContentTypeDetector.hasJsxContent('export default Component'), true);
      assert.equal(ContentTypeDetector.hasJsxContent('regular markdown text'), false);
    });
  });

  describe('hasMermaidContent', () => {
    test('should detect Mermaid patterns', () => {
      assert.equal(ContentTypeDetector.hasMermaidContent('```mermaid'), true);
      assert.equal(ContentTypeDetector.hasMermaidContent('graph TD'), true);
      assert.equal(ContentTypeDetector.hasMermaidContent('sequenceDiagram'), true);
      assert.equal(ContentTypeDetector.hasMermaidContent('classDiagram'), true);
      assert.equal(ContentTypeDetector.hasMermaidContent('regular text'), false);
    });
  });

  describe('extractCodeFenceLanguage', () => {
    test('should extract language from code blocks', () => {
      assert.equal(ContentTypeDetector.extractCodeFenceLanguage('```javascript'), 'javascript');
      assert.equal(ContentTypeDetector.extractCodeFenceLanguage('```mermaid'), 'mermaid');
      assert.equal(ContentTypeDetector.extractCodeFenceLanguage('```py'), 'python');
      assert.equal(ContentTypeDetector.extractCodeFenceLanguage('```'), null);
    });
  });
});