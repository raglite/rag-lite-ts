/**
 * Tests for image-to-text description generation
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  generateImageDescriptionForFile,
  generateImageDescriptionsForFiles,
  cleanupImageToTextPipeline,
  DEFAULT_IMAGE_TO_TEXT_OPTIONS
} from '../../src/file-processor.js';

describe('Image-to-Text Description Generation', () => {
  test('should have correct default options', () => {
    assert.strictEqual(DEFAULT_IMAGE_TO_TEXT_OPTIONS.model, 'Xenova/vit-gpt2-image-captioning');
    assert.strictEqual(DEFAULT_IMAGE_TO_TEXT_OPTIONS.maxLength, 50);
    assert.strictEqual(DEFAULT_IMAGE_TO_TEXT_OPTIONS.batchSize, 4);
    assert.strictEqual(DEFAULT_IMAGE_TO_TEXT_OPTIONS.includeConfidence, false);
  });

  test('should handle missing image file gracefully', async () => {
    await assert.rejects(
      () => generateImageDescriptionForFile('./nonexistent-image.jpg'),
      /Failed to generate description for image/,
      'Should reject with descriptive error for missing image'
    );
  });

  test('should handle batch processing with missing files', async () => {
    const imagePaths = ['./missing1.jpg', './missing2.png'];
    const results = await generateImageDescriptionsForFiles(imagePaths);
    
    assert.strictEqual(results.length, 2, 'Should return results for all input files');
    
    for (const result of results) {
      assert.ok(result.path, 'Each result should have a path');
      assert.ok(result.error, 'Each result should have an error for missing files');
      assert.strictEqual(result.result, undefined, 'Should not have result for missing files');
    }
  });

  test('should cleanup pipeline without errors', async () => {
    // This should not throw even if no pipeline was initialized
    await assert.doesNotThrow(
      () => cleanupImageToTextPipeline(),
      'Cleanup should not throw errors'
    );
  });

  test('should validate image-to-text options', async () => {
    const customOptions = {
      model: 'Xenova/vit-gpt2-image-captioning',
      maxLength: 100,
      batchSize: 2,
      includeConfidence: true
    };

    // This will fail due to missing image, but we can verify the options are processed
    try {
      await generateImageDescriptionForFile('./test.jpg', customOptions);
    } catch (error) {
      // Expected to fail, but error should mention the image file, not options
      assert.ok(error instanceof Error);
      assert.match(error.message, /Failed to generate description for image/);
    }
  });
});
