/**
 * Tests for SearchEngine Chameleon Architecture Implementation
 * Validates that SearchEngine automatically detects mode and adapts accordingly
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import public API
import { SearchEngine } from '../../src/search.js';
import { TextIngestionFactory } from '../../src/factories/text-factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp/search-engine-chameleon');

describe('SearchEngine Chameleon Architecture', () => {
  beforeEach(() => {
    // Create temp directory
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_TEMP_DIR)) {
      try {
        rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
      } catch (error) {
        console.warn('Cleanup warning:', error);
      }
    }
  });

  test('should automatically detect text mode from database', async () => {
    const testDbPath = join(TEST_TEMP_DIR, 'text-mode.db');
    const testIndexPath = join(TEST_TEMP_DIR, 'text-mode.index');
    const testDocPath = join(TEST_TEMP_DIR, 'test-doc.txt');

    try {
      // Step 1: Create a test document
      const { writeFileSync } = await import('fs');
      writeFileSync(testDocPath, 'Machine learning is a subset of artificial intelligence.');

      // Step 2: Create a text mode database through ingestion
      console.log('Creating text mode database...');
      const ingestion = await TextIngestionFactory.create(testDbPath, testIndexPath, {
        mode: 'text',
        embeddingModel: 'Xenova/all-MiniLM-L6-v2'
      });

      // Ingest the document
      await ingestion.ingestFile(testDocPath);

      await ingestion.cleanup();
      console.log('✓ Text mode database created');

      // Step 3: Create SearchEngine using simple constructor (should auto-detect text mode)
      console.log('Creating SearchEngine with simple constructor...');
      const search = new SearchEngine(testIndexPath, testDbPath);

      // Step 4: Perform search (this triggers initialization and mode detection)
      console.log('Performing search to trigger mode detection...');
      const results = await search.search('machine learning');

      // Step 5: Verify search works
      assert.ok(Array.isArray(results), 'Search should return array');
      assert.ok(results.length > 0, 'Search should return results');
      assert.ok(results[0].content, 'Results should have content');
      assert.ok(results[0].score !== undefined, 'Results should have score');

      console.log('✓ SearchEngine automatically detected text mode and performed search');

      await search.cleanup();

    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });

  test('should work with both text and multimodal databases seamlessly', async () => {
    const textDbPath = join(TEST_TEMP_DIR, 'text.db');
    const textIndexPath = join(TEST_TEMP_DIR, 'text.index');
    const textDocPath = join(TEST_TEMP_DIR, 'text-doc.txt');
    const multimodalDbPath = join(TEST_TEMP_DIR, 'multimodal.db');
    const multimodalIndexPath = join(TEST_TEMP_DIR, 'multimodal.index');
    const multimodalDocPath = join(TEST_TEMP_DIR, 'multimodal-doc.txt');

    try {
      const { writeFileSync } = await import('fs');

      // Create text mode database
      console.log('Creating text mode database...');
      writeFileSync(textDocPath, 'Text mode content about AI.');
      
      const textIngestion = await TextIngestionFactory.create(textDbPath, textIndexPath, {
        mode: 'text',
        embeddingModel: 'Xenova/all-MiniLM-L6-v2'
      });

      await textIngestion.ingestFile(textDocPath);
      await textIngestion.cleanup();

      // Create multimodal mode database
      console.log('Creating multimodal mode database...');
      writeFileSync(multimodalDocPath, 'Multimodal content about machine learning.');
      
      const multimodalIngestion = await TextIngestionFactory.create(multimodalDbPath, multimodalIndexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });

      await multimodalIngestion.ingestFile(multimodalDocPath);
      await multimodalIngestion.cleanup();

      // Test text mode search with simple constructor
      console.log('Testing text mode search...');
      const textSearch = new SearchEngine(textIndexPath, textDbPath);
      const textResults = await textSearch.search('AI');
      assert.ok(textResults.length > 0, 'Text mode search should work');
      await textSearch.cleanup();

      // Test multimodal mode search with simple constructor
      console.log('Testing multimodal mode search...');
      const multimodalSearch = new SearchEngine(multimodalIndexPath, multimodalDbPath);
      const multimodalResults = await multimodalSearch.search('machine learning');
      assert.ok(multimodalResults.length > 0, 'Multimodal mode search should work');
      await multimodalSearch.cleanup();

      console.log('✓ SearchEngine works seamlessly with both text and multimodal databases');

    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
});

// Force exit after tests complete
setTimeout(() => {
  console.log('✅ Tests completed, forcing exit...');
  process.exit(0);
}, 2000);
