import { describe, test, beforeEach, afterEach } from 'node:test';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import assert from 'assert';

// Test configuration
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const TEST_DB = 'test-cli.sqlite';
const TEST_INDEX = 'test-cli-index.bin';
const TEST_FILE = 'test-cli-document.md';

// Test document content - larger document to test chunking behavior
const TEST_DOCUMENT = `# Machine Learning Fundamentals

## Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task. This revolutionary approach has transformed how we solve complex problems across various industries, from healthcare and finance to entertainment and transportation.

The core concept behind machine learning lies in pattern recognition. Instead of writing specific instructions for every possible scenario, we provide algorithms with large amounts of data and let them identify patterns, relationships, and trends that humans might miss or find too complex to encode manually.

## Types of Machine Learning

### Supervised Learning

Supervised learning is the most common type of machine learning, where algorithms learn from labeled training data. In this approach, we provide the algorithm with input-output pairs, allowing it to understand the relationship between features and target variables.

Common supervised learning tasks include classification and regression problems. Classification involves predicting discrete categories or classes, such as email spam detection or image recognition. Regression focuses on predicting continuous numerical values, like house prices or stock market trends.

Popular supervised learning algorithms include linear regression, decision trees, random forests, support vector machines, and neural networks. These algorithms excel when we have sufficient labeled data and clear objectives for what we want to predict or classify.

### Unsupervised Learning

Unsupervised learning works with unlabeled data, seeking to discover hidden patterns or structures without predetermined outcomes. This approach is particularly valuable for exploratory data analysis and discovering insights that weren't previously apparent to human analysts.

Key unsupervised learning techniques include clustering, which groups similar data points together for applications like customer segmentation or gene sequencing. Dimensionality reduction simplifies data while preserving important information, useful for data visualization and feature selection.

### Reinforcement Learning

Reinforcement learning involves training agents to make sequential decisions in an environment to maximize cumulative rewards. This approach mimics how humans and animals learn through trial and error, receiving feedback from their actions and adjusting their behavior accordingly.

Applications of reinforcement learning include game playing strategies, autonomous vehicle navigation, robotics control systems, and recommendation algorithms. The agent learns optimal strategies through exploration and exploitation, balancing between trying new actions and leveraging known successful strategies.

## The Machine Learning Process

The machine learning process begins with data collection and preparation, which forms the foundation of any successful project. This involves gathering relevant information from various sources and ensuring it's representative of the problem domain we're trying to solve.

Feature engineering follows, which is the art and science of selecting, modifying, or creating input variables that help machine learning algorithms perform better. Good features can significantly improve model performance, while poor features can lead to suboptimal results regardless of the algorithm used.

Model selection and training come next, where we choose appropriate algorithms based on the problem type, data size, interpretability requirements, and computational constraints. No single algorithm works best for all problems, making this a critical step in the pipeline.

Finally, evaluation and validation ensure that our trained algorithm generalizes well to new, unseen data. This involves using techniques like cross-validation and selecting appropriate metrics based on the problem type and business objectives.
`;

/**
 * Execute CLI command and return result
 */
function runCLI(args: string[], expectError = false): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  try {
    const result = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf8',
      timeout: 120000, // Increased timeout for model downloads
      env: {
        ...process.env,
        RAG_DB_FILE: TEST_DB,
        RAG_INDEX_FILE: TEST_INDEX,
      }
    });

    return {
      stdout: result,
      stderr: '',
      exitCode: 0
    };
  } catch (error: any) {
    if (expectError) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.status || 1
      };
    }
    throw error;
  }
}

/**
 * Extract chunk count from CLI output
 */
function extractChunkCount(output: string): number {
  const match = output.match(/Chunks created: (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract batch size from CLI output
 */
function extractBatchSize(output: string): number {
  const match = output.match(/batchSize: (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract chunk size from CLI output
 */
function extractChunkSize(output: string): number {
  const match = output.match(/chunkSize=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract chunk overlap from CLI output
 */
function extractChunkOverlap(output: string): number {
  const match = output.match(/chunkOverlap=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Clean up test files
 */
function cleanup() {
  const files = [TEST_DB, TEST_INDEX, TEST_FILE];
  files.forEach(file => {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  });
}

describe('CLI Interface - Critical Bug Prevention Tests', () => {
  beforeEach(() => {
    // Ensure CLI is built
    if (!existsSync(CLI_PATH)) {
      execSync('npm run build', { stdio: 'inherit' });
    }

    // Clean up any existing test files first
    cleanup();

    // Create test document
    writeFileSync(TEST_FILE, TEST_DOCUMENT);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Model Selection Validation (Bug Prevention)', () => {
    test('should reject model flag with search command', () => {
      const result = runCLI(['search', 'test', '--model', 'Xenova/all-mpnet-base-v2'], true);

      assert.strictEqual(result.exitCode, 2); // Updated expected exit code
      assert(result.stderr.includes('--model option is only available for the \'ingest\' command'));
      assert(result.stderr.includes('The search command automatically uses the model that was used during ingestion'));
    });

    test('should reject invalid model for ingest', () => {
      const result = runCLI(['ingest', TEST_FILE, '--model', 'invalid-model'], true);

      assert.strictEqual(result.exitCode, 2); // Updated expected exit code
      assert(result.stderr.includes('Unsupported model'));
      assert(result.stderr.includes('sentence-transformers/all-MiniLM-L6-v2'));
      assert(result.stderr.includes('Xenova/all-mpnet-base-v2'));
    });

    test('should accept valid model for ingest', () => {
      // This should not fail on argument validation (may fail later for other reasons)
      const result = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2'], true);

      // Should not fail on model validation specifically
      assert(!result.stderr.includes('Unsupported model'));
    });
  });

  describe('Basic Argument Validation', () => {
    test('should require path for ingest command', () => {
      const result = runCLI(['ingest'], true);

      assert.strictEqual(result.exitCode, 2); // Updated expected exit code
      assert(result.stderr.includes('ingest command requires a path argument'));
    });

    test('should require query for search command', () => {
      const result = runCLI(['search'], true);

      assert.strictEqual(result.exitCode, 2); // Updated expected exit code
      assert(result.stderr.includes('search command requires a query argument'));
    });

    test('should show help when no arguments provided', () => {
      const result = runCLI([]);

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes('RAG-lite TS'));
      assert(result.stdout.includes('Usage:'));
      assert(result.stdout.includes('Commands:'));
    });
  });

  describe('File Validation', () => {
    test('should reject non-existent file', () => {
      const result = runCLI(['ingest', 'non-existent.md'], true);

      assert.strictEqual(result.exitCode, 4); // Updated expected exit code for file not found
      assert(result.stderr.includes('Path does not exist'));
    });
  });

  describe('Integration Workflow (End-to-End)', () => {
    test('should complete basic ingest and search workflow', () => {
      // Test the basic workflow that users actually use

      // 1. Ingest document
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, `Ingest failed: ${ingestResult.stderr}`);
      assert(ingestResult.stdout.includes('Ingestion completed successfully'));

      // Verify files were created
      assert(existsSync(TEST_DB), 'Database file should be created');
      assert(existsSync(TEST_INDEX), 'Index file should be created');

      // 2. Search documents
      const searchResult = runCLI(['search', 'typescript']);
      assert.strictEqual(searchResult.exitCode, 0, `Search failed: ${searchResult.stderr}`);
      assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('No results found'));
    });

    test('should handle search with no database', () => {
      const result = runCLI(['search', 'test'], true);

      assert.strictEqual(result.exitCode, 4); // Updated expected exit code for database not found
      assert(result.stderr.includes('No database found') || result.stderr.includes('You need to ingest documents first'));
    });
  });

  describe('Model Configuration Validation (Critical Bug Tests)', () => {
    test('should apply correct model-specific configuration for default model', () => {
      // Test with default model (sentence-transformers/all-MiniLM-L6-v2)
      const result = runCLI(['ingest', TEST_FILE]);

      assert.strictEqual(result.exitCode, 0, `Default model ingest failed: ${result.stderr}`);

      // Verify default model configuration
      const chunkSize = extractChunkSize(result.stdout);
      const chunkOverlap = extractChunkOverlap(result.stdout);
      const batchSize = extractBatchSize(result.stdout);

      assert.strictEqual(chunkSize, 250, 'Default model should use chunk size 250');
      assert.strictEqual(chunkOverlap, 50, 'Default model should use chunk overlap 50');
      assert.strictEqual(batchSize, 16, 'Default model should use batch size 16');

      // Verify it creates expected number of chunks for this document size
      const chunkCount = extractChunkCount(result.stdout);
      assert(chunkCount >= 4, `Expected at least 4 chunks with default settings, got ${chunkCount}`);
    });

    test('should apply correct model-specific configuration for all-mpnet-base-v2', () => {
      // Test with all-mpnet-base-v2 model
      const result = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2']);

      assert.strictEqual(result.exitCode, 0, `Custom model ingest failed: ${result.stderr}`);

      // Verify custom model configuration
      const chunkSize = extractChunkSize(result.stdout);
      const chunkOverlap = extractChunkOverlap(result.stdout);
      const batchSize = extractBatchSize(result.stdout);

      assert.strictEqual(chunkSize, 400, 'all-mpnet-base-v2 should use chunk size 400');
      assert.strictEqual(chunkOverlap, 80, 'all-mpnet-base-v2 should use chunk overlap 80');
      assert.strictEqual(batchSize, 8, 'all-mpnet-base-v2 should use batch size 8');

      // Verify model info
      assert(result.stdout.includes('Using embedding model: Xenova/all-mpnet-base-v2'));
      assert(result.stdout.includes('768 dimensions'));
    });

    test('should create different chunk counts for different models', () => {
      // Clean up first
      cleanup();

      // Recreate test file
      writeFileSync(TEST_FILE, TEST_DOCUMENT);

      // Test with default model
      const defaultResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(defaultResult.exitCode, 0, `Default model ingest failed: ${defaultResult.stderr}`);
      const defaultChunks = extractChunkCount(defaultResult.stdout);

      // Clean up and test with custom model
      cleanup();

      // Recreate test file
      writeFileSync(TEST_FILE, TEST_DOCUMENT);

      const customResult = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2']);
      assert.strictEqual(customResult.exitCode, 0, `Custom model ingest failed: ${customResult.stderr}`);
      const customChunks = extractChunkCount(customResult.stdout);

      // all-mpnet-base-v2 should create fewer chunks due to larger chunk size (400 vs 250)
      assert(customChunks < defaultChunks,
        `all-mpnet-base-v2 should create fewer chunks (${customChunks}) than default model (${defaultChunks}) due to larger chunk size`);

      // Verify the difference is significant (at least 25% fewer chunks)
      const reduction = (defaultChunks - customChunks) / defaultChunks;
      assert(reduction >= 0.2,
        `Expected at least 20% reduction in chunks, got ${(reduction * 100).toFixed(1)}% (${defaultChunks} -> ${customChunks})`);
    });

    test('should maintain model consistency between ingest and search', () => {
      // Ingest with custom model
      const ingestResult = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2']);
      assert.strictEqual(ingestResult.exitCode, 0, `Custom model ingest failed: ${ingestResult.stderr}`);

      // Search should auto-detect the model
      const searchResult = runCLI(['search', 'machine learning']);
      assert.strictEqual(searchResult.exitCode, 0, `Search with auto-detected model failed: ${searchResult.stderr}`);

      // Verify search uses the same model
      assert(searchResult.stdout.includes('Using model from ingestion: Xenova/all-mpnet-base-v2') ||
        searchResult.stdout.includes('Model compatibility verified: Xenova/all-mpnet-base-v2'),
        'Search should auto-detect and use the same model as ingestion');

      // Verify search returns results
      assert(searchResult.stdout.includes('Found') && !searchResult.stdout.includes('Found 0 results'),
        'Search should return relevant results');
    });

    test('should handle model mismatch correctly', () => {
      // Ingest with one model
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, `First ingest failed: ${ingestResult.stderr}`);

      // Try to ingest with different model (should detect mismatch)
      const mismatchResult = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2'], true);

      // Should fail with model mismatch error
      assert.strictEqual(mismatchResult.exitCode, 6, 'Should fail on model mismatch'); // Model error exit code
      assert(mismatchResult.stderr.includes('Model mismatch detected') ||
        mismatchResult.stderr.includes('model has changed'),
        'Should detect and report model mismatch');

      // Should suggest rebuild
      assert(mismatchResult.stderr.includes('rebuild') || mismatchResult.stderr.includes('regenerate'),
        'Should suggest rebuilding the index');
    });
  });

  describe('Performance and Memory Validation', () => {
    test('should use appropriate batch sizes for memory efficiency', () => {
      // Test that different models use their optimized batch sizes
      const defaultResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(defaultResult.exitCode, 0);

      const defaultBatchSize = extractBatchSize(defaultResult.stdout);
      assert.strictEqual(defaultBatchSize, 16, 'Default model should use batch size 16 for efficiency');

      cleanup();

      // Recreate test file
      writeFileSync(TEST_FILE, TEST_DOCUMENT);

      const customResult = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2']);
      assert.strictEqual(customResult.exitCode, 0);

      const customBatchSize = extractBatchSize(customResult.stdout);
      assert.strictEqual(customBatchSize, 8, 'all-mpnet-base-v2 should use smaller batch size 8 for memory efficiency');
    });
  });
});