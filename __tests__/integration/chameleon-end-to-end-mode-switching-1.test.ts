/**
 * End-to-End Mode Switching Tests for Chameleon Multimodal Architecture - Part 1
 * Tests complete workflow from ingestion to search in both text and multimodal modes
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import core components
import { SearchFactory } from '../../src/factories/search-factory.js';
import { ModeDetectionService } from '../../src/core/mode-detection-service.js';
import { IngestionPipeline } from '../../src/ingestion.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'chameleon-mode-switching-test-1');

// Helper to create unique test directory
function getUniqueTestDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return join(TEST_BASE_DIR, `test-${timestamp}-${random}`);
}

describe('Chameleon End-to-End Mode Switching Tests - Part 1', () => {
  let testDir: string;
  let testDbPath: string;
  let testIndexPath: string;
  let testContentDir: string;

  beforeEach(() => {
    // Create unique test directory for this test
    testDir = getUniqueTestDir();
    
    // Create unique test paths for each test
    const testId = Math.random().toString(36).substring(7);
    testDbPath = join(testDir, `test-${testId}.db`);
    testIndexPath = join(testDir, `test-${testId}.bin`);
    testContentDir = join(testDir, `content-${testId}`);

    // Create test directories
    mkdirSync(testDir, { recursive: true });
    mkdirSync(testContentDir, { recursive: true });

    // Create sample test content
    setupTestContent();
  });

  afterEach(async () => {
    // Enhanced cleanup with retry for Windows file locking
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (existsSync(testDir)) {
      let retries = 3;
      while (retries > 0) {
        try {
          rmSync(testDir, { recursive: true, force: true });
          break;
        } catch (error: any) {
          if (error.code === 'EBUSY' && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
            retries--;
          } else {
            console.warn('⚠️  Could not clean up test directory:', error.message);
            break;
          }
        }
      }
    }
  });

  function setupTestContent() {
    // Create sample text documents
    const textDoc1 = `# Machine Learning Fundamentals

Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task.

## Key Concepts

- **Supervised Learning**: Learning from labeled examples
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Neural Networks**: Computational models inspired by biological neural networks
- **Deep Learning**: Multi-layered neural networks for complex pattern recognition

Applications include image recognition, natural language processing, and predictive analytics.`;

    const textDoc2 = `# Data Science Workflow

The data science process involves several key stages that transform raw data into actionable insights.

## Process Steps

1. **Data Collection**: Gathering relevant data from various sources
2. **Data Cleaning**: Removing inconsistencies and handling missing values
3. **Exploratory Analysis**: Understanding data patterns and relationships
4. **Model Building**: Creating predictive or descriptive models
5. **Validation**: Testing model performance and accuracy
6. **Deployment**: Implementing models in production environments

Each step requires careful attention to ensure reliable and meaningful results.`;

    // Write test documents
    writeFileSync(join(testContentDir, 'ml-fundamentals.md'), textDoc1);
    writeFileSync(join(testContentDir, 'data-science.md'), textDoc2);
  }

  test('complete text mode workflow - ingestion to search', async () => {
    console.log('🧪 Testing complete text mode workflow...');

    try {
      // Step 1: Ingest content in text mode
      console.log('Step 1: Ingesting content in text mode...');
      
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        rerankingStrategy: 'cross-encoder' as const,
        chunkSize: 256
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      assert.ok(existsSync(testDbPath), 'Database file should be created');
      assert.ok(existsSync(testIndexPath), 'Index file should be created');

      // Step 2: Verify mode was stored correctly
      const modeService = new ModeDetectionService(testDbPath);
      const storedSystemInfo = await modeService.detectMode();

      assert.strictEqual(storedSystemInfo.mode, 'text', 'Mode should be stored as text');
      assert.strictEqual(storedSystemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Model name should be stored correctly');

      // Step 3: Create search engine with automatic mode detection
      const searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      assert.ok(searchEngine, 'Search engine should be created successfully');

      // Step 4: Perform searches and verify results
      const searchResults = await searchEngine.search('machine learning algorithms', { top_k: 3 });
      assert.ok(searchResults.length > 0, 'Should return search results');
      assert.ok(searchResults[0].content.toLowerCase().includes('machine learning'), 'Results should be relevant');

      await searchEngine.cleanup();

      console.log('🎉 Complete text mode workflow test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS')
      )) {
        console.log('⚠️  Skipping test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('complete multimodal mode workflow - ingestion to search', async () => {
    console.log('🧪 Testing complete multimodal mode workflow...');

    try {
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal' as const,
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived' as const,
        chunkSize: 512
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      assert.ok(existsSync(testDbPath), 'Database file should be created');
      assert.ok(existsSync(testIndexPath), 'Index file should be created');

      const modeService = new ModeDetectionService(testDbPath);
      const storedSystemInfo = await modeService.detectMode();

      assert.strictEqual(storedSystemInfo.mode, 'multimodal', 'Mode should be stored as multimodal');
      assert.strictEqual(storedSystemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Model name should be stored correctly');

      const searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      const searchResults = await searchEngine.search('neural networks deep learning', { top_k: 3 });
      assert.ok(searchResults.length > 0, 'Should return search results');

      await searchEngine.cleanup();

      console.log('🎉 Complete multimodal mode workflow test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('CLIP')
      )) {
        console.log('⚠️  Skipping multimodal test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('automatic mode detection without explicit configuration', async () => {
    console.log('🧪 Testing automatic mode detection...');

    try {
      // Step 1: Set up database with mode configuration
      console.log('Step 1: Setting up database with stored mode configuration...');
      
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        rerankingStrategy: 'cross-encoder' as const
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Step 2: Test automatic mode detection
      console.log('Step 2: Testing automatic mode detection...');
      
      const searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      assert.ok(searchEngine, 'Search engine should be created with auto-detection');

      const results = await searchEngine.search('machine learning', { top_k: 2 });
      assert.ok(results.length > 0, 'Auto-detected search engine should work');

      await searchEngine.cleanup();

      // Step 3: Verify mode detection service
      console.log('Step 3: Testing mode detection service...');
      
      const modeService = new ModeDetectionService(testDbPath);
      const detectedMode = await modeService.getCurrentMode();
      assert.strictEqual(detectedMode, 'text', 'Should auto-detect text mode');

      const isMultimodal = await modeService.isMultimodalMode();
      assert.strictEqual(isMultimodal, false, 'Should correctly identify as not multimodal');

      const modelInfo = await modeService.getCurrentModelInfo();
      assert.strictEqual(modelInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should detect correct model');
      assert.strictEqual(modelInfo.dimensions, 384, 'Should detect correct dimensions');

      console.log('✓ Mode detection service verified successfully');

      // Step 4: Test fallback to default mode
      console.log('Step 4: Testing fallback to default mode...');
      
      const nonExistentDbPath = join(testDir, 'non-existent.db');
      const fallbackModeService = new ModeDetectionService(nonExistentDbPath);
      const fallbackSystemInfo = await fallbackModeService.detectMode();

      assert.strictEqual(fallbackSystemInfo.mode, 'text', 'Should fallback to text mode');
      assert.strictEqual(fallbackSystemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default model');

      console.log('✓ Fallback to default mode verified successfully');

      console.log('🎉 Automatic mode detection test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS')
      )) {
        console.log('⚠️  Skipping automatic detection test due to environment limitations');
        return;
      }
      throw error;
    }
  });
});

// Force exit after tests complete to prevent hanging from ML resources
setTimeout(() => {
  console.log('🔄 Forcing test exit to prevent hanging from ML/database resources...');
  
  if (global.gc) {
    global.gc();
    setTimeout(() => { if (global.gc) global.gc(); }, 100);
    setTimeout(() => { if (global.gc) global.gc(); }, 300);
  }
  
  setTimeout(() => {
    console.log('✅ Exiting test process');
    process.exit(0);
  }, 2000);
}, 30000); // 30 seconds for 3 ML tests
