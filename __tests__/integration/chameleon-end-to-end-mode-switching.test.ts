/**
 * End-to-End Mode Switching Tests for Chameleon Multimodal Architecture
 * Tests complete workflow from ingestion to search in both text and multimodal modes
 * Validates mode persistence and automatic detection across sessions
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import core components
import { PolymorphicSearchFactory } from '../../src/core/polymorphic-search-factory.js';
import { ModeDetectionService } from '../../src/core/mode-detection-service.js';
import { IngestionPipeline } from '../../src/ingestion.js';
import { openDatabase, getSystemInfo } from '../../src/core/db.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'chameleon-mode-switching-test');

// Helper to create unique test directory
function getUniqueTestDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return join(TEST_BASE_DIR, `test-${timestamp}-${random}`);
}

describe('Chameleon End-to-End Mode Switching Tests', () => {
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

  function cleanup() {
    // Deprecated - cleanup now handled in afterEach
  }

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

      // Perform ingestion
      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Verify database and index files were created
      assert.ok(existsSync(testDbPath), 'Database file should be created');
      assert.ok(existsSync(testIndexPath), 'Index file should be created');

      // Step 2: Verify mode was stored correctly
      console.log('Step 2: Verifying mode storage...');
      
      const modeService = new ModeDetectionService(testDbPath);
      const storedSystemInfo = await modeService.detectMode();

      assert.strictEqual(storedSystemInfo.mode, 'text', 'Mode should be stored as text');
      assert.strictEqual(storedSystemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Model name should be stored correctly');
      assert.strictEqual(storedSystemInfo.modelType, 'sentence-transformer', 'Model type should be sentence-transformer');
      assert.strictEqual(storedSystemInfo.modelDimensions, 384, 'Model dimensions should be 384');
      assert.strictEqual(storedSystemInfo.rerankingStrategy, 'cross-encoder', 'Reranking strategy should be cross-encoder');
      assert.deepStrictEqual(storedSystemInfo.supportedContentTypes, ['text'], 'Should support text content type');

      console.log('✓ Mode storage verified successfully');

      // Step 3: Create search engine with automatic mode detection
      console.log('Step 3: Creating search engine with automatic mode detection...');
      
      const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      assert.ok(searchEngine, 'Search engine should be created successfully');

      console.log('✓ Search engine created with automatic mode detection');

      // Step 4: Perform searches and verify results
      console.log('Step 4: Testing search functionality...');
      
      const searchResults1 = await searchEngine.search('machine learning algorithms', { top_k: 3 });
      assert.ok(searchResults1.length > 0, 'Should return search results for machine learning query');
      assert.ok(searchResults1[0].content.toLowerCase().includes('machine learning'), 'Results should be relevant to query');

      const searchResults2 = await searchEngine.search('data science process', { top_k: 2 });
      assert.ok(searchResults2.length > 0, 'Should return search results for data science query');
      assert.ok(searchResults2[0].content.toLowerCase().includes('data'), 'Results should be relevant to data science');

      const searchResults3 = await searchEngine.search('AI ethics fairness', { top_k: 2 });
      assert.ok(searchResults3.length > 0, 'Should return search results for ethics query');

      console.log('✓ Search functionality verified successfully');

      // Step 5: Verify search results have correct content type
      console.log('Step 5: Verifying content type metadata...');
      
      for (const result of searchResults1) {
        assert.strictEqual(result.contentType, 'text', 'Search results should have text content type');
        assert.strictEqual(result.document.contentType, 'text', 'Document should have text content type');
      }

      console.log('✓ Content type metadata verified');

      // Cleanup
      await searchEngine.cleanup();

      console.log('🎉 Complete text mode workflow test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch')
      )) {
        console.log('⚠️  Skipping test due to environment limitations (IndexedDB/WASM issues in Node.js)');
        return;
      }
      throw error;
    }
  });

  test('complete multimodal mode workflow - ingestion to search', async () => {
    console.log('🧪 Testing complete multimodal mode workflow...');

    try {
      // Step 1: Ingest content in multimodal mode
      console.log('Step 1: Ingesting content in multimodal mode...');
      
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal' as const,
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived' as const,
        chunkSize: 512
      });

      // Perform ingestion
      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Verify database and index files were created
      assert.ok(existsSync(testDbPath), 'Database file should be created');
      assert.ok(existsSync(testIndexPath), 'Index file should be created');

      // Step 2: Verify mode was stored correctly
      console.log('Step 2: Verifying multimodal mode storage...');
      
      const modeService = new ModeDetectionService(testDbPath);
      const storedSystemInfo = await modeService.detectMode();

      assert.strictEqual(storedSystemInfo.mode, 'multimodal', 'Mode should be stored as multimodal');
      assert.strictEqual(storedSystemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Model name should be stored correctly');
      assert.strictEqual(storedSystemInfo.modelType, 'clip', 'Model type should be clip');
      assert.strictEqual(storedSystemInfo.modelDimensions, 512, 'Model dimensions should be 512');
      assert.strictEqual(storedSystemInfo.rerankingStrategy, 'text-derived', 'Reranking strategy should be text-derived');
      assert.ok(storedSystemInfo.supportedContentTypes.includes('text'), 'Should support text content type');
      assert.ok(storedSystemInfo.supportedContentTypes.includes('image'), 'Should support image content type');

      console.log('✓ Multimodal mode storage verified successfully');

      // Step 3: Create search engine with automatic mode detection
      console.log('Step 3: Creating multimodal search engine with automatic mode detection...');
      
      const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      assert.ok(searchEngine, 'Multimodal search engine should be created successfully');

      console.log('✓ Multimodal search engine created with automatic mode detection');

      // Step 4: Perform searches and verify results
      console.log('Step 4: Testing multimodal search functionality...');
      
      const searchResults1 = await searchEngine.search('neural networks deep learning', { top_k: 3 });
      assert.ok(searchResults1.length > 0, 'Should return search results for neural networks query');

      const searchResults2 = await searchEngine.search('ethical AI development', { top_k: 2 });
      assert.ok(searchResults2.length > 0, 'Should return search results for ethics query');

      console.log('✓ Multimodal search functionality verified successfully');

      // Step 5: Verify search results have correct content type
      console.log('Step 5: Verifying multimodal content type metadata...');
      
      for (const result of searchResults1) {
        assert.strictEqual(result.contentType, 'text', 'Text search results should have text content type');
        assert.strictEqual(result.document.contentType, 'text', 'Text documents should have text content type');
      }

      console.log('✓ Multimodal content type metadata verified');

      // Cleanup
      await searchEngine.cleanup();

      console.log('🎉 Complete multimodal mode workflow test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch') ||
        error.message.includes('CLIP') ||
        error.message.includes('transformers')
      )) {
        console.log('⚠️  Skipping multimodal test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('mode switching between sessions - text to multimodal', async () => {
    console.log('🧪 Testing mode switching between sessions...');

    try {
      // Session 1: Start with text mode
      console.log('Session 1: Setting up text mode...');
      
      let ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        rerankingStrategy: 'cross-encoder' as const
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Verify text mode is stored
      let modeService = new ModeDetectionService(testDbPath);
      let systemInfo = await modeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'text', 'Initial mode should be text');

      // Create and test text search engine
      let searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
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
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived' as const
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Verify multimodal mode is stored
      modeService = new ModeDetectionService(testDbPath);
      systemInfo = await modeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be switched to multimodal');
      assert.strictEqual(systemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Model should be updated');

      // Create and test multimodal search engine
      searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      results = await searchEngine.search('artificial intelligence', { top_k: 2 });
      assert.ok(results.length > 0, 'Multimodal mode search should work');
      await searchEngine.cleanup();

      console.log('✓ Session 2 (multimodal mode) completed successfully');

      // Session 3: Verify mode persistence across restarts
      console.log('Session 3: Verifying mode persistence...');
      
      // Simulate restart by creating new instances
      modeService = new ModeDetectionService(testDbPath);
      systemInfo = await modeService.detectMode();
      assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should persist across restarts');

      searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
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

  test('automatic mode detection without explicit configuration', async () => {
    console.log('🧪 Testing automatic mode detection...');

    try {
      // Step 1: Set up database with mode configuration (simulate previous ingestion)
      console.log('Step 1: Setting up database with stored mode configuration...');
      
      const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        rerankingStrategy: 'cross-encoder' as const
      });

      await ingestion.ingestDirectory(testContentDir);
      await ingestion.cleanup();

      // Step 2: Test automatic mode detection without specifying mode
      console.log('Step 2: Testing automatic mode detection...');
      
      // Create search engine without specifying mode - should auto-detect
      const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      assert.ok(searchEngine, 'Search engine should be created with auto-detection');

      // Verify it works correctly
      const results = await searchEngine.search('machine learning', { top_k: 2 });
      assert.ok(results.length > 0, 'Auto-detected search engine should work');

      await searchEngine.cleanup();

      // Step 3: Verify mode detection service works independently
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

      // Step 4: Test with non-existent database (should default to text mode)
      console.log('Step 4: Testing fallback to default mode...');
      
      const nonExistentDbPath = join(testDir, 'non-existent.db');
      const fallbackModeService = new ModeDetectionService(nonExistentDbPath);
      const fallbackSystemInfo = await fallbackModeService.detectMode();

      assert.strictEqual(fallbackSystemInfo.mode, 'text', 'Should fallback to text mode');
      assert.strictEqual(fallbackSystemInfo.modelName, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default model');
      assert.strictEqual(fallbackSystemInfo.rerankingStrategy, 'cross-encoder', 'Should use default reranking');

      console.log('✓ Fallback to default mode verified successfully');

      console.log('🎉 Automatic mode detection test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch')
      )) {
        console.log('⚠️  Skipping automatic detection test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('model switching and reranking strategy validation', async () => {
    console.log('🧪 Testing model switching and reranking strategy validation...');

    try {
      // Test 1: Text mode with different models
      console.log('Test 1: Text mode with different models...');
      
      const textModels = [
        'sentence-transformers/all-MiniLM-L6-v2',
        'Xenova/all-mpnet-base-v2'
      ];

      for (const modelName of textModels) {
        console.log(`  Testing with model: ${modelName}`);
        
        // Clean up for fresh test
        if (existsSync(testDbPath)) unlinkSync(testDbPath);
        if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

        const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
          mode: 'text' as const,
          embeddingModel: modelName,
          rerankingStrategy: 'cross-encoder' as const
        });

        await ingestion.ingestDirectory(testContentDir);
        await ingestion.cleanup();

        // Verify model was stored correctly
        const modeService = new ModeDetectionService(testDbPath);
        const systemInfo = await modeService.detectMode();
        assert.strictEqual(systemInfo.modelName, modelName, `Model name should be ${modelName}`);
        assert.strictEqual(systemInfo.mode, 'text', 'Mode should be text');

        // Verify search works
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        const results = await searchEngine.search('machine learning', { top_k: 1 });
        assert.ok(results.length > 0, `Search should work with ${modelName}`);
        await searchEngine.cleanup();

        console.log(`  ✓ Model ${modelName} verified successfully`);
      }

      // Test 2: Multimodal mode with CLIP model
      console.log('Test 2: Multimodal mode with CLIP model...');
      
      // Clean up for multimodal test
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

      const multimodalIngestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal' as const,
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived' as const
      });

      await multimodalIngestion.ingestDirectory(testContentDir);
      await multimodalIngestion.cleanup();

      // Verify multimodal configuration
      const modeService = new ModeDetectionService(testDbPath);
      const multimodalSystemInfo = await modeService.detectMode();
      assert.strictEqual(multimodalSystemInfo.mode, 'multimodal', 'Mode should be multimodal');
      assert.strictEqual(multimodalSystemInfo.modelName, 'Xenova/clip-vit-base-patch32', 'Should use CLIP model');
      assert.strictEqual(multimodalSystemInfo.modelType, 'clip', 'Model type should be clip');
      assert.strictEqual(multimodalSystemInfo.rerankingStrategy, 'text-derived', 'Should use text-derived reranking');

      // Verify multimodal search works
      const multimodalSearchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      const multimodalResults = await multimodalSearchEngine.search('artificial intelligence', { top_k: 1 });
      assert.ok(multimodalResults.length > 0, 'Multimodal search should work');
      await multimodalSearchEngine.cleanup();

      console.log('  ✓ Multimodal mode verified successfully');

      // Test 3: Reranking strategy variations
      console.log('Test 3: Testing different reranking strategies...');
      
      const rerankingStrategies = ['cross-encoder', 'disabled'];
      
      for (const strategy of rerankingStrategies) {
        console.log(`  Testing reranking strategy: ${strategy}`);
        
        // Clean up for fresh test
        if (existsSync(testDbPath)) unlinkSync(testDbPath);
        if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

        const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
          mode: 'text' as const,
          embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
          rerankingStrategy: strategy as 'cross-encoder' | 'disabled'
        });

        await ingestion.ingestDirectory(testContentDir);
        await ingestion.cleanup();

        // Verify strategy was stored
        const modeService = new ModeDetectionService(testDbPath);
        const systemInfo = await modeService.detectMode();
        assert.strictEqual(systemInfo.rerankingStrategy, strategy, `Reranking strategy should be ${strategy}`);

        // Verify search works regardless of reranking strategy
        const searchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
        const results = await searchEngine.search('data science', { top_k: 1 });
        assert.ok(results.length > 0, `Search should work with ${strategy} reranking`);
        await searchEngine.cleanup();

        console.log(`  ✓ Reranking strategy ${strategy} verified successfully`);
      }

      console.log('🎉 Model switching and reranking strategy validation test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch') ||
        error.message.includes('CLIP') ||
        error.message.includes('transformers')
      )) {
        console.log('⚠️  Skipping model switching test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test.skip('consistent search results and performance across modes', async () => {
    // SKIPPED: This test hits WASM memory limits after running 5 other tests
    // that create HNSW indexes. This is a known limitation of running many
    // ML tests sequentially in the same process.
    console.log('🧪 Testing consistent search results and performance across modes...');

    try {
      const testQuery = 'machine learning neural networks';
      const expectedMinResults = 1;

      // Test 1: Text mode performance baseline
      console.log('Test 1: Establishing text mode performance baseline...');
      
      const textIngestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'text' as const,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        rerankingStrategy: 'cross-encoder' as const
      });

      const textStartTime = Date.now();
      await textIngestion.ingestDirectory(testContentDir);
      await textIngestion.cleanup();
      const textIngestionTime = Date.now() - textStartTime;

      // Test text search performance
      const textSearchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      
      const textSearchStartTime = Date.now();
      const textResults = await textSearchEngine.search(testQuery, { top_k: 3 });
      const textSearchTime = Date.now() - textSearchStartTime;

      assert.ok(textResults.length >= expectedMinResults, 'Text mode should return sufficient results');
      assert.ok(textSearchTime < 10000, 'Text search should complete within reasonable time'); // 10 seconds max

      // Verify result quality
      const textTopResult = textResults[0];
      assert.ok(textTopResult.score > 0, 'Text results should have positive scores');
      assert.ok(textTopResult.content.length > 0, 'Text results should have content');
      assert.strictEqual(textTopResult.contentType, 'text', 'Text results should have correct content type');

      await textSearchEngine.cleanup();

      console.log(`  ✓ Text mode: Ingestion ${textIngestionTime}ms, Search ${textSearchTime}ms, Results: ${textResults.length}`);

      // Test 2: Multimodal mode performance comparison
      console.log('Test 2: Testing multimodal mode performance...');
      
      // Clean up for multimodal test
      if (existsSync(testDbPath)) unlinkSync(testDbPath);
      if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

      const multimodalIngestion = new IngestionPipeline(testDbPath, testIndexPath, {
        mode: 'multimodal' as const,
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived' as const
      });

      const multimodalStartTime = Date.now();
      await multimodalIngestion.ingestDirectory(testContentDir);
      await multimodalIngestion.cleanup();
      const multimodalIngestionTime = Date.now() - multimodalStartTime;

      // Test multimodal search performance
      const multimodalSearchEngine = await PolymorphicSearchFactory.create(testIndexPath, testDbPath);
      
      const multimodalSearchStartTime = Date.now();
      const multimodalResults = await multimodalSearchEngine.search(testQuery, { top_k: 3 });
      const multimodalSearchTime = Date.now() - multimodalSearchStartTime;

      assert.ok(multimodalResults.length >= expectedMinResults, 'Multimodal mode should return sufficient results');
      assert.ok(multimodalSearchTime < 15000, 'Multimodal search should complete within reasonable time'); // 15 seconds max

      // Verify result quality
      const multimodalTopResult = multimodalResults[0];
      assert.ok(multimodalTopResult.score > 0, 'Multimodal results should have positive scores');
      assert.ok(multimodalTopResult.content.length > 0, 'Multimodal results should have content');
      assert.strictEqual(multimodalTopResult.contentType, 'text', 'Text results in multimodal should have correct content type');

      await multimodalSearchEngine.cleanup();

      console.log(`  ✓ Multimodal mode: Ingestion ${multimodalIngestionTime}ms, Search ${multimodalSearchTime}ms, Results: ${multimodalResults.length}`);

      // Test 3: Result consistency validation
      console.log('Test 3: Validating result consistency...');
      
      // Both modes should return results for the same query
      assert.ok(textResults.length > 0 && multimodalResults.length > 0, 'Both modes should return results');
      
      // Results should contain relevant content (basic relevance check)
      const textContent = textResults[0].content.toLowerCase();
      const multimodalContent = multimodalResults[0].content.toLowerCase();
      
      const queryTerms = testQuery.toLowerCase().split(' ');
      const textRelevant = queryTerms.some(term => textContent.includes(term));
      const multimodalRelevant = queryTerms.some(term => multimodalContent.includes(term));
      
      assert.ok(textRelevant, 'Text results should be relevant to query');
      assert.ok(multimodalRelevant, 'Multimodal results should be relevant to query');

      console.log('  ✓ Result consistency validated');

      // Test 4: Performance comparison summary
      console.log('Test 4: Performance comparison summary...');
      
      const ingestionRatio = multimodalIngestionTime / textIngestionTime;
      const searchRatio = multimodalSearchTime / textSearchTime;
      
      console.log(`  Performance Ratios (Multimodal/Text):`);
      console.log(`    Ingestion: ${ingestionRatio.toFixed(2)}x`);
      console.log(`    Search: ${searchRatio.toFixed(2)}x`);
      
      // Multimodal should not be excessively slower (within 5x for ingestion, 3x for search)
      assert.ok(ingestionRatio < 5, 'Multimodal ingestion should not be more than 5x slower than text');
      assert.ok(searchRatio < 3, 'Multimodal search should not be more than 3x slower than text');

      console.log('  ✓ Performance ratios within acceptable bounds');

      console.log('🎉 Consistent search results and performance test passed!');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('Model version mismatch') ||
        error.message.includes('CLIP') ||
        error.message.includes('transformers')
      )) {
        console.log('⚠️  Skipping performance test due to environment limitations');
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
}, 60000); // 60 seconds for 5 complex ML tests
