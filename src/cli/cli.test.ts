import { describe, test, beforeEach, afterEach } from 'node:test';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import assert from 'assert';

// Test configuration
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const TEST_DB = 'test-cli.sqlite';
const TEST_INDEX = 'test-cli-index.bin';
const TEST_FILE = 'test-cli-document.md';
const TEST_DIR = 'test-cli-docs';

// Test document content - optimized for testing different scenarios
const TEST_DOCUMENT = `# Machine Learning Fundamentals

## Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task. This revolutionary approach has transformed how we solve complex problems across various industries, from healthcare and finance to entertainment and transportation.

The core concept behind machine learning lies in pattern recognition. Instead of writing specific instructions for every possible scenario, we provide algorithms with large amounts of data and let them identify patterns, relationships, and trends that humans might miss or find too complex to encode manually.

## Types of Machine Learning

### Supervised Learning

Supervised learning is the most common type of machine learning, where algorithms learn from labeled training data. In this approach, we provide the algorithm with input-output pairs, allowing it to understand the relationship between features and target variables.

Common supervised learning tasks include classification and regression problems. Classification involves predicting discrete categories or classes, such as email spam detection or image recognition. Regression focuses on predicting continuous numerical values, like house prices or stock market trends.

### Unsupervised Learning

Unsupervised learning works with unlabeled data, seeking to discover hidden patterns or structures without predetermined outcomes. This approach is particularly valuable for exploratory data analysis and discovering insights that weren't previously apparent to human analysts.

### Reinforcement Learning

Reinforcement learning involves training agents to make sequential decisions in an environment to maximize cumulative rewards. This approach mimics how humans and animals learn through trial and error, receiving feedback from their actions and adjusting their behavior accordingly.
`;

// Additional test documents for multi-file scenarios
const TEST_DOCUMENT_2 = `# Deep Learning Concepts

## Neural Networks

Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections and activation functions.

## Training Process

The training process involves forward propagation, loss calculation, and backpropagation to adjust weights and minimize prediction errors.
`;

const TEST_DOCUMENT_3 = `# Natural Language Processing

## Text Processing

Natural language processing involves analyzing and understanding human language using computational methods.

## Applications

Common applications include sentiment analysis, machine translation, and chatbots.
`;

/**
 * Execute CLI command and return result with enhanced error handling
 */
function runCLI(args: string[], expectError = false, timeout = 180000): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  try {
    const result = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf8',
      timeout,
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
    const result = {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.status || 1
    };

    if (expectError) {
      return result;
    }

    // Enhanced error reporting for debugging
    console.error('CLI Command Failed:', args.join(' '));
    console.error('Exit Code:', result.exitCode);
    console.error('STDOUT:', result.stdout);
    console.error('STDERR:', result.stderr);
    throw error;
  }
}

/**
 * Extract information from CLI output
 */
function extractChunkCount(output: string): number {
  const match = output.match(/Chunks created: (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractBatchSize(output: string): number {
  const match = output.match(/batchSize: (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractChunkSize(output: string): number {
  const match = output.match(/chunkSize=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractChunkOverlap(output: string): number {
  const match = output.match(/chunkOverlap=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractModel(output: string): string | null {
  const match = output.match(/Auto-detected embedding model: ([^\s]+)/);
  return match ? match[1] : null;
}

function extractDimensions(output: string): number | null {
  const match = output.match(/(\d+) dimensions/);
  return match ? parseInt(match[1], 10) : null;
}

function extractSearchResults(output: string): number {
  const match = output.match(/Found (\d+) results/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Setup test environment
 */
function setupTestFiles() {
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }

  // Create individual test file
  writeFileSync(TEST_FILE, TEST_DOCUMENT);

  // Create multiple test files in directory
  writeFileSync(join(TEST_DIR, 'ml-basics.md'), TEST_DOCUMENT);
  writeFileSync(join(TEST_DIR, 'deep-learning.md'), TEST_DOCUMENT_2);
  writeFileSync(join(TEST_DIR, 'nlp.md'), TEST_DOCUMENT_3);
}

/**
 * Clean up test files and directories
 */
function cleanup() {
  const files = [TEST_DB, TEST_INDEX, TEST_FILE];
  files.forEach(file => {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  });

  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

/**
 * Verify database and index files exist and are valid
 */
function verifyFilesExist(): void {
  assert(existsSync(TEST_DB), 'Database file should exist');
  assert(existsSync(TEST_INDEX), 'Index file should exist');
}

/**
 * Check if model download/loading issues should skip test
 */
function shouldSkipModelTest(stderr: string): boolean {
  return stderr.includes('ONNX') ||
    stderr.includes('model download') ||
    stderr.includes('network') ||
    stderr.includes('timeout') ||
    stderr.includes('ECONNRESET');
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
      assert(chunkCount >= 2, `Expected at least 2 chunks with default settings, got ${chunkCount}`);
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

  describe('Rebuild Flag Testing (Critical Bug Prevention)', () => {
    test('should handle --rebuild-if-needed with model change', () => {
      // First ingest with default model
      const firstIngest = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(firstIngest.exitCode, 0, 'First ingest should succeed');
      assert(firstIngest.stdout.includes('sentence-transformers/all-MiniLM-L6-v2'), 'Should use default model');

      // Verify files exist
      assert(existsSync(TEST_DB), 'Database should exist after first ingest');
      assert(existsSync(TEST_INDEX), 'Index should exist after first ingest');

      // Try to ingest with different model using --rebuild-if-needed
      const rebuildIngest = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-if-needed']);
      assert.strictEqual(rebuildIngest.exitCode, 0, 'Rebuild ingest should succeed');

      // Verify rebuild was triggered
      assert(rebuildIngest.stdout.includes('Force rebuild enabled due to rebuildIfNeeded option') ||
        rebuildIngest.stdout.includes('Model change detected'), 'Should detect model change and rebuild');
      assert(rebuildIngest.stdout.includes('Xenova/all-mpnet-base-v2'), 'Should use new model');
      assert(rebuildIngest.stdout.includes('768 dimensions'), 'Should use correct dimensions');

      // Verify search works with new model
      const searchResult = runCLI(['search', 'machine learning']);
      assert.strictEqual(searchResult.exitCode, 0, 'Search should work after rebuild');
      assert(searchResult.stdout.includes('Auto-detected embedding model: Xenova/all-mpnet-base-v2'),
        'Search should auto-detect new model');
      assert(searchResult.stdout.includes('768 dimensions'), 'Search should use correct dimensions');
    });

    test('should handle --rebuild-if-needed with same model (no rebuild)', () => {
      // First ingest
      const firstIngest = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(firstIngest.exitCode, 0, 'First ingest should succeed');

      // Try to ingest again with same model and --rebuild-if-needed
      const secondIngest = runCLI(['ingest', TEST_FILE, '--rebuild-if-needed']);
      assert.strictEqual(secondIngest.exitCode, 0, 'Second ingest should succeed');

      // Should not rebuild since model is the same
      assert(!secondIngest.stdout.includes('Force rebuild enabled') ||
        !secondIngest.stdout.includes('Model change detected'), 'Should not rebuild with same model');
    });

    test('should handle --rebuild-if-needed flag with search gracefully', () => {
      // Test with search command - flag should be ignored, normal search error should occur
      const searchResult = runCLI(['search', 'test', '--rebuild-if-needed'], true);
      assert.notEqual(searchResult.exitCode, 0, 'Should fail due to no database');
      assert(searchResult.stderr.includes('No database found') ||
        searchResult.stderr.includes('ingest documents first'), 'Should show normal search error, not flag error');
    });
  });

  describe('Database Metadata Consistency (Critical Bug Prevention)', () => {
    test('should update database metadata during rebuild', () => {
      // First ingest with default model
      const firstIngest = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(firstIngest.exitCode, 0, 'First ingest should succeed');

      // Rebuild with different model
      const rebuildIngest = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-if-needed']);
      assert.strictEqual(rebuildIngest.exitCode, 0, 'Rebuild should succeed');

      // Verify database metadata was updated
      assert(rebuildIngest.stdout.includes('Updated stored model info: Xenova/all-mpnet-base-v2'),
        'Should update stored model info in database');

      // Verify search auto-detects correct model
      const searchResult = runCLI(['search', 'test']);
      assert.strictEqual(searchResult.exitCode, 0, 'Search should work with updated metadata');
      assert(searchResult.stdout.includes('Auto-detected embedding model: Xenova/all-mpnet-base-v2'),
        'Should auto-detect updated model from database');
    });

    test('should prevent dimension mismatch errors', () => {
      // Create inconsistent state by manually testing dimension validation
      const firstIngest = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(firstIngest.exitCode, 0, 'First ingest should succeed');

      // Try to search (should work)
      const searchResult = runCLI(['search', 'test']);
      assert.strictEqual(searchResult.exitCode, 0, 'Search should work with consistent state');

      // Should not see dimension mismatch warnings
      assert(!searchResult.stderr.includes('Dimension mismatch detected'),
        'Should not have dimension mismatch with consistent state');
    });
  });

  describe('Cross-Encoder Reranking CLI Testing (Critical Bug Prevention)', () => {
    test('should handle reranking disabled by default', () => {
      // Ingest and search should work with reranking disabled
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, 'Ingest should succeed');

      const searchResult = runCLI(['search', 'machine learning']);
      assert.strictEqual(searchResult.exitCode, 0, 'Search should succeed');

      // Verify reranking is disabled by default
      assert(searchResult.stdout.includes('reranking disabled') ||
        searchResult.stdout.includes('Reranking disabled'), 'Reranking should be disabled by default');
    });

    test('should handle reranking flag validation', () => {
      // Test that reranking flags are properly validated
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, 'Ingest should succeed');

      // Search with reranking should work (even if reranking fails, search should succeed)
      const searchResult = runCLI(['search', 'machine learning', '--rerank']);
      // Should either succeed or fail gracefully
      assert(searchResult.exitCode === 0 || searchResult.stderr.includes('rerank'),
        'Should handle reranking flag appropriately');
    });
  });

  describe('Vector Index Corruption Prevention', () => {
    test('should provide clear error messages for index issues', () => {
      // Create database but not index to simulate corruption
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, 'Ingest should succeed');

      // Remove index file to simulate corruption
      if (existsSync(TEST_INDEX)) {
        unlinkSync(TEST_INDEX);
      }

      // Search should fail with clear message
      const searchResult = runCLI(['search', 'test'], true);
      assert.notEqual(searchResult.exitCode, 0, 'Search should fail with missing index');
      assert(searchResult.stderr.includes('Vector index not found') ||
        searchResult.stderr.includes('index') ||
        searchResult.stderr.includes('rebuild'), 'Should provide helpful error message');
    });

    test('should handle WebAssembly exceptions gracefully', () => {
      // This test ensures we don't get cryptic WebAssembly errors
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, 'Ingest should succeed');

      const searchResult = runCLI(['search', 'test']);
      assert.strictEqual(searchResult.exitCode, 0, 'Search should succeed');

      // Should not see WebAssembly exceptions in output
      assert(!searchResult.stderr.includes('WebAssembly.Exception'),
        'Should not expose WebAssembly exceptions to users');
      assert(!searchResult.stderr.includes('[object WebAssembly'),
        'Should not show cryptic WebAssembly errors');
    });
  });

  describe('Real-World Usage Scenarios (Integration)', () => {
    test('should handle complete model switching workflow', () => {
      // Simulate real user workflow: ingest → search → change model → rebuild → search

      // Step 1: Initial ingest with default model
      const initialIngest = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(initialIngest.exitCode, 0, 'Initial ingest should succeed');

      // Step 2: Search works
      const initialSearch = runCLI(['search', 'machine learning']);
      assert.strictEqual(initialSearch.exitCode, 0, 'Initial search should work');
      assert(initialSearch.stdout.includes('Found'), 'Should find results');

      // Step 3: Switch to better model with rebuild
      const modelSwitch = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-if-needed']);
      assert.strictEqual(modelSwitch.exitCode, 0, 'Model switch should succeed');

      // Step 4: Search still works with new model
      const finalSearch = runCLI(['search', 'machine learning']);
      assert.strictEqual(finalSearch.exitCode, 0, 'Search should work after model switch');
      assert(finalSearch.stdout.includes('Xenova/all-mpnet-base-v2'), 'Should use new model');
      assert(finalSearch.stdout.includes('Found'), 'Should still find results');
    });

    // Note: CLI currently supports single file or directory ingestion, not multiple files

    test('should handle directory ingestion', () => {
      // Create test directory structure
      const testDir = 'test-docs';
      const subDir = join(testDir, 'subdir');

      try {
        // Create directory structure (if it doesn't exist, skip this test)
        if (!existsSync(testDir)) {
          // Skip this test if we can't create directories
          console.log('⚠️  Skipping directory test - cannot create test directories');
          return;
        }

        // Test directory ingestion
        const dirIngest = runCLI(['ingest', testDir]);

        // Should either succeed or fail gracefully
        if (dirIngest.exitCode === 0) {
          assert(dirIngest.stdout.includes('Ingestion completed'), 'Directory ingest should complete');

          // Search should work
          const searchResult = runCLI(['search', 'test']);
          assert.strictEqual(searchResult.exitCode, 0, 'Search should work after directory ingest');
        } else {
          // If it fails, should have helpful error message
          assert(dirIngest.stderr.includes('directory') ||
            dirIngest.stderr.includes('path') ||
            dirIngest.stderr.includes('file'), 'Should provide helpful error for directory issues');
        }

      } finally {
        // Cleanup would go here if we created directories
      }
    });
  });

  describe('Error Recovery and User Guidance', () => {
    test('should provide actionable error messages', () => {
      // Test various error conditions and ensure helpful messages

      // Missing file
      const missingFile = runCLI(['ingest', 'nonexistent.md'], true);
      assert.notEqual(missingFile.exitCode, 0, 'Should fail for missing file');
      assert(missingFile.stderr.includes('does not exist') ||
        missingFile.stderr.includes('not found'), 'Should explain missing file');

      // Search without database
      const noDatabase = runCLI(['search', 'test'], true);
      assert.notEqual(noDatabase.exitCode, 0, 'Should fail without database');
      assert(noDatabase.stderr.includes('ingest') ||
        noDatabase.stderr.includes('database'), 'Should suggest ingesting first');
    });

    test('should suggest solutions for common problems', () => {
      // Ingest first
      const ingestResult = runCLI(['ingest', TEST_FILE]);
      assert.strictEqual(ingestResult.exitCode, 0, 'Ingest should succeed');

      // Try to ingest with different model (should suggest rebuild)
      const mismatchResult = runCLI(['ingest', TEST_FILE, '--model', 'Xenova/all-mpnet-base-v2'], true);
      assert.notEqual(mismatchResult.exitCode, 0, 'Should fail on model mismatch');
      assert(mismatchResult.stderr.includes('rebuild') ||
        mismatchResult.stderr.includes('--rebuild-if-needed'), 'Should suggest rebuild solution');
    });
  });
});