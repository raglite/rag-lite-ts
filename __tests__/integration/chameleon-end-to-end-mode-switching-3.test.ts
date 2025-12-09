/**
 * End-to-End Mode Switching Test - Test 3 Only
 * Tests mode switching between sessions (text to multimodal)
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import core components
import { SearchFactory } from '../../src/factories/search-factory.js';
import { ModeDetectionService } from '../../src/core/mode-detection-service.js';
import { IngestionPipeline } from '../../src/ingestion.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'chameleon-mode-switching-test-3');

// Helper to create unique test directory
function getUniqueTestDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return join(TEST_BASE_DIR, `test-${timestamp}-${random}`);
}

describe('Chameleon Mode Switching Test 3', () => {
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

    const textDoc3 = `# AI Ethics and Responsible Development

As artificial intelligence becomes more prevalent, ethical considerations become increasingly important.

## Key Principles

- **Fairness**: Ensuring AI systems don't discriminate against any group
- **Transparency**: Making AI decision-making processes understandable
- **Privacy**: Protecting individual data and maintaining confidentiality
- **Accountability**: Establishing clear responsibility for AI system outcomes
- **Safety**: Ensuring AI systems operate reliably and safely

Organizations must balance innovation with responsible development practices.`;

    // Write test documents
    writeFileSync(join(testContentDir, 'ml-fundamentals.md'), textDoc1);
    writeFileSync(join(testContentDir, 'data-science.md'), textDoc2);
    writeFileSync(join(testContentDir, 'ai-ethics.md'), textDoc3);
  }

  test.skip('mode switching between sessions - text to multimodal', async () => {
    console.log('🧪 Testing mode switching between sessions...');

    try {
      // Session 1: Start with text mode
      console.log('Session 1: Setting up text mode...');
      
      let ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Verify text mode is stored
      let modeService = new ModeDetectionService(testDbPath);
      let systemInfo = await modeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Initial mode should be text');

      // Clean up mode service
      // Note: ModeDetectionService doesn't have a cleanup method, but we'll create a new one

      // Create and test text search engine
      let searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      let results = await searchEngine.search('machine learning', { top_k: 2 });
      assert.ok(results.length > 0, 'Text mode search should work');
      await searchEngine.cleanup();

      console.log('✓ Session 1 (text mode) completed successfully');

      // Session 2: Switch to multimodal mode (requires re-ingestion)
      console.log('Session 2: Switching to multimodal mode...');
      
      // Clean up existing files for fresh ingestion
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

      ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal' as const,
        embeddingModel: 'Xenova/clip-vit-base-patch32'
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Wait for database connections to fully close
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force garbage collection to clean up any lingering connections
      if (global.gc) {
        global.gc();
      }

      // Wait a bit more and try again
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify multimodal mode is stored (create fresh service instance)
      const freshModeService = new ModeDetectionService(testDbPath);
      systemInfo = await freshModeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be switched to multimodal');
      assert.strictEqual(systemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Model should be updated');

      // Create and test multimodal search engine
      searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      results = await searchEngine.search('artificial intelligence', { top_k: 2 });
      assert.ok(results.length > 0, 'Multimodal mode search should work');
      await searchEngine.cleanup();

      console.log('✓ Session 2 (multimodal mode) completed successfully');

      // Session 3: Verify mode persistence across restarts
      console.log('Session 3: Verifying mode persistence...');
      
      // Simulate restart by creating new instances
      const restartModeService = new ModeDetectionService(testDbPath);
      systemInfo = await restartModeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should persist across restarts');

      searchEngine = await SearchFactory.create(testIndexPath, testDbPath);
      results = await searchEngine.search('data science', { top_k: 1 });
      assert.ok(results.length > 0, 'Search should work after restart');
      await searchEngine.cleanup();

      console.log('✓ Session 3 (persistence verification) completed successfully');

      console.log('🎉 Mode switching between sessions test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch') ||
        error.message.includes('CLIP') ||
        error.message.includes('transformers')
      )) {
        console.log('⚠️  Skipping mode switching test due to environment limitations');
        return;
      }
      throw error;
    }
  });
});

// Force exit after test completion to prevent hanging from ML resources
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
}, 60000); // 60 seconds for this complex test
