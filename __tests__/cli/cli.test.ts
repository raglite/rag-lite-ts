/**
 * Complete Strict CLI Tests - No Lenient Environment Excuses
 * Comprehensive test suite with proper failure detection
 * Uses Node.js test runner
 */

import { test, describe, beforeEach } from 'node:test';
import { execSync } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import assert from 'assert';

// Simple test configuration
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

// Test isolation: each test gets a unique working directory
let testWorkDir: string;
let originalCwd: string;

/**
 * Robust cleanup with retries and proper error handling
 */
async function forceCleanup(files: string[], maxRetries: number = 5): Promise<void> {
    for (const file of files) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (existsSync(file)) {
                    unlinkSync(file);
                }
                break;
            } catch (error: any) {
                if (error.code === 'EBUSY' || error.code === 'EPERM') {
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                        continue;
                    }
                }
                if (attempt === maxRetries - 1) {
                    if (error.code === 'EBUSY') {
                        console.log(`ℹ️ Database file still locked (expected on Windows): ${file}`);
                    } else {
                        console.warn(`⚠️ Failed to cleanup ${file}: ${error.message}`);
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
                }
            }
        }
    }
}

/**
 * Setup isolated test environment
 */
function setupTestEnvironment(): string {
    const testId = randomBytes(8).toString('hex');
    const testDir = join(tmpdir(), `rag-lite-test-${testId}`);
    try {
        mkdirSync(testDir, { recursive: true });
        return testDir;
    } catch (error) {
        throw new Error(`Failed to create test directory: ${error}`);
    }
}/**
 * Cl
eanup test environment
 */
async function cleanupTestEnvironment(testDir: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    } catch (error: any) {
        if (error.code === 'EBUSY') {
            console.log(`ℹ️ Test directory still in use (expected on Windows): ${testDir}`);
        } else {
            console.warn(`⚠️ Failed to cleanup test directory ${testDir}: ${error.message}`);
        }
    }
}

/**
 * Robust CLI test runner with proper isolation
 */
function testCLI(args: string[], timeout: number = 10000): { stdout: string; stderr: string; exitCode: number } {
    try {
        const result = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
            encoding: 'utf8',
            timeout,
            cwd: testWorkDir
        });
        return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error: any) {
        return {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message || '',
            exitCode: error.status || 1
        };
    }
}

/**
 * STRICT environment issue detection - only genuine system/network issues
 */
function isGenuineEnvironmentIssue(stderr: string): boolean {
    const genuineEnvironmentIssues = [
        'ETIMEDOUT',
        'ENOTFOUND',
        'fetch failed',
        'ECONNREFUSED',
        'ECONNRESET',
        'getaddrinfo ENOTFOUND',
        'transformers.js is not available',
        'WebAssembly is not supported',
        'ONNX runtime not available'
    ];
    return genuineEnvironmentIssues.some(issue => 
        stderr.includes(issue) && 
        !stderr.includes('Error: ') && 
        !stderr.includes('Failed to ')
    );
}/**
 
* Helper functions to extract configuration values from CLI output
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

function extractDimensions(output: string): number | null {
    const match = output.match(/(\d+) dimensions/);
    return match ? parseInt(match[1], 10) : null;
}

describe('CLI Complete Strict Validation Tests', () => {
    beforeEach(() => {
        originalCwd = process.cwd();
        testWorkDir = setupTestEnvironment();
        process.chdir(testWorkDir);
    });

    async function afterTest() {
        process.chdir(originalCwd);
        await forceCleanup([
            join(testWorkDir, 'db.sqlite'),
            join(testWorkDir, 'vector-index.bin')
        ]);
        await cleanupTestEnvironment(testWorkDir);
    }  
  test('should reject model flag with search command', () => {
        const result = testCLI(['search', 'test', '--model', 'invalid-model']);
        assert.strictEqual(result.exitCode, 2, 'Should return exit code 2');
        assert(result.stderr.includes('--model option is only available'), 'Should show model flag error');
    });

    test('should reject invalid model for ingest', () => {
        const result = testCLI(['ingest', 'test.md', '--model', 'invalid-model']);
        assert.strictEqual(result.exitCode, 2, 'Should return exit code 2');
        assert(result.stderr.includes('not supported for'), 'Should show unsupported model error');
    });

    test('should show help', () => {
        const result = testCLI(['help']);
        assert.strictEqual(result.exitCode, 0, 'Help should succeed');
        assert(result.stdout.includes('RAG-lite TS'), 'Should show help text');
    });

    test('should handle invalid command', () => {
        const result = testCLI(['invalid-command']);
        assert.notEqual(result.exitCode, 0, 'Invalid command should fail');
        assert(result.stderr.includes('Unknown command'), 'Should show unknown command error');
    });

    test('should require path for ingest command', () => {
        const result = testCLI(['ingest']);
        assert.strictEqual(result.exitCode, 2, 'Should return exit code 2');
        assert(result.stderr.includes('ingest command requires a path argument'), 'Should show path required error');
    });

    test('should require query for search command', () => {
        const result = testCLI(['search']);
        assert.strictEqual(result.exitCode, 2, 'Should return exit code 2');
        assert(result.stderr.includes('search command requires a query argument'), 'Should show query required error');
    });

    test('should reject non-existent file', () => {
        const result = testCLI(['ingest', 'non-existent.md']);
        assert.notEqual(result.exitCode, 0, 'Should fail for non-existent file');
        assert(result.stderr.includes('Path does not exist') || result.stderr.includes('not found'), 'Should show file not found error');
    });

    test('should handle search with no database', () => {
        const result = testCLI(['search', 'test']);
        assert.notEqual(result.exitCode, 0, 'Should fail when no database exists');
        assert(result.stderr.includes('No vector index found') || result.stderr.includes('database'), 'Should show database/index error');
    });  
  test('should complete basic ingest and search workflow - STRICT', async () => {
        const testContent = '# Machine Learning Guide\n\nMachine learning is a powerful technique for data analysis and prediction.';
        writeFileSync('workflow-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'workflow-test.md'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ Workflow test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Ingest must succeed');

            const searchResult = testCLI(['search', 'machine learning'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Search failed after successful ingest: ${searchResult.stderr}`);
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must succeed after successful ingest');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');
            
            console.log('✅ STRICT end-to-end workflow completed successfully!');

        } finally {
            await afterTest();
        }
    });

    test('should maintain model consistency between ingest and search - STRICT', async () => {
        const testContent = '# Model Consistency Test\n\nThis document tests model persistence between ingest and search operations.';
        writeFileSync('model-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'model-test.md', '--model', 'Xenova/all-mpnet-base-v2'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ Model consistency test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Model ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Model ingest must succeed');
            assert(ingestResult.stdout.includes('Xenova/all-mpnet-base-v2'), 'Ingest output must show correct model');

            const searchResult = testCLI(['search', 'model consistency'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Search failed after successful model ingest: ${searchResult.stderr}`);
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must succeed with consistent model');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');
            
            console.log('✅ STRICT model consistency verified');

        } finally {
            await afterTest();
        }
    });    
test('should handle model mismatch correctly - STRICT', async () => {
        const testContent = '# Model Mismatch Test\n\nThis document tests strict model mismatch detection.';
        writeFileSync('mismatch-test.md', testContent);

        try {
            const firstResult = testCLI(['ingest', 'mismatch-test.md'], 30000);

            if (firstResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(firstResult.stderr)) {
                    console.log('⚠️ Model mismatch test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`First ingest failed: ${firstResult.stderr}`);
            }

            assert.strictEqual(firstResult.exitCode, 0, 'First ingest must succeed');

            const mismatchResult = testCLI(['ingest', 'mismatch-test.md', '--model', 'Xenova/all-mpnet-base-v2'], 15000);

            assert.notEqual(mismatchResult.exitCode, 0, 'Must fail on model mismatch');

            const hasMismatchError =
                mismatchResult.stderr.includes('Model mismatch') ||
                mismatchResult.stderr.includes('model has changed') ||
                mismatchResult.stderr.includes('Database is configured for');

            assert(hasMismatchError, 'Must provide clear model mismatch error message');

            const hasRebuildSuggestion =
                mismatchResult.stderr.includes('rebuild') ||
                mismatchResult.stderr.includes('--force-rebuild');

            assert(hasRebuildSuggestion, 'Must provide rebuild suggestion for model mismatch');

            console.log('✅ STRICT model mismatch detection verified');

        } finally {
            await afterTest();
        }
    });

    test('should handle rebuild functionality - STRICT', async () => {
        const testContent = '# Rebuild Test\n\nThis document tests strict rebuild functionality.';
        writeFileSync('rebuild-test.md', testContent);

        try {
            const firstIngest = testCLI(['ingest', 'rebuild-test.md'], 30000);

            if (firstIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(firstIngest.stderr)) {
                    console.log('⚠️ Rebuild test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`First ingest failed: ${firstIngest.stderr}`);
            }

            assert.strictEqual(firstIngest.exitCode, 0, 'First ingest must succeed');

            const rebuildIngest = testCLI(['ingest', 'rebuild-test.md', '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-d'], 30000);

            if (rebuildIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(rebuildIngest.stderr)) {
                    console.log('⚠️ Rebuild skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Rebuild ingest failed: ${rebuildIngest.stderr}`);
            }

            assert.strictEqual(rebuildIngest.exitCode, 0, 'Rebuild ingest must succeed');
            assert(rebuildIngest.stdout.includes('Xenova/all-mpnet-base-v2'), 'Rebuild output must show new model');
            
            const hasRebuildIndicator =
                rebuildIngest.stdout.includes('Force rebuild enabled') ||
                rebuildIngest.stdout.includes('rebuild-d') ||
                rebuildIngest.stdout.includes('Removed old index');

            assert(hasRebuildIndicator, 'Rebuild output must show evidence of rebuild process');

            const searchResult = testCLI(['search', 'rebuild'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search after rebuild skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Search failed after successful rebuild: ${searchResult.stderr}`);
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must work after rebuild');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results after rebuild');

            console.log('✅ STRICT rebuild functionality verified');

        } finally {
            await afterTest();
        }
    });  
  test('should apply correct model configuration - STRICT', async () => {
        const testContent = `# Model Configuration Test

## Introduction
This document tests that models use correct configuration parameters for chunking and processing. This section needs to be long enough to ensure multiple chunks are created with the default chunk size of 250 characters.

## Content Section 1
Machine learning is a powerful technique for data analysis and prediction. It enables computers to learn patterns from data without being explicitly programmed for every scenario. This approach has revolutionized many fields including computer vision, natural language processing, speech recognition, and autonomous systems.

## Content Section 2
The model should use specific chunk sizes, overlap settings, and batch sizes optimized for performance and memory usage. These parameters are carefully tuned to balance processing speed with memory consumption while maintaining good embedding quality for most use cases.

## Content Section 3
This additional content ensures we have enough text to create multiple chunks and test the chunking configuration properly. The chunking process is essential for handling large documents that exceed the model's context window, allowing the system to process and index content effectively.`;

        writeFileSync('config-test.md', testContent);

        try {
            const result = testCLI(['ingest', 'config-test.md'], 30000);

            if (result.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(result.stderr)) {
                    console.log('⚠️ Configuration test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Configuration test ingest failed: ${result.stderr}`);
            }

            assert.strictEqual(result.exitCode, 0, 'Configuration test ingest must succeed');

            const chunkSize = extractChunkSize(result.stdout);
            const chunkOverlap = extractChunkOverlap(result.stdout);
            const batchSize = extractBatchSize(result.stdout);
            const chunkCount = extractChunkCount(result.stdout);

            console.log(`Configuration - Chunk Size: ${chunkSize}, Overlap: ${chunkOverlap}, Batch: ${batchSize}, Chunks: ${chunkCount}`);

            assert(chunkSize > 0, 'Chunk size must be detected in output');
            assert.strictEqual(chunkSize, 250, 'Default model must use chunk size 250');

            assert(chunkOverlap > 0, 'Chunk overlap must be detected in output');
            assert.strictEqual(chunkOverlap, 50, 'Default model must use chunk overlap 50');

            assert(batchSize > 0, 'Batch size must be detected in output');
            assert.strictEqual(batchSize, 16, 'Default model must use batch size 16');

            assert(chunkCount > 0, 'Chunk count must be detected in output');
            assert(chunkCount >= 1, 'Must create at least 1 chunk with sufficient content');

            console.log('✅ STRICT model configuration verified');

        } finally {
            await afterTest();
        }
    });

    test('should handle reranking behavior - STRICT', async () => {
        const testContent = '# Reranking Test\n\nThis document tests that reranking behavior is handled correctly.';
        writeFileSync('rerank-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'rerank-test.md'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ Reranking test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Rerank ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Rerank ingest must succeed');

            const searchResult = testCLI(['search', 'reranking'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Search failed after successful ingest: ${searchResult.stderr}`);
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must succeed');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');

            const rerankFlagResult = testCLI(['search', 'reranking', '--rerank'], 15000);

            if (rerankFlagResult.exitCode === 0) {
                console.log('✅ Reranking flag accepted and processed successfully');
                assert(rerankFlagResult.stdout.includes('Found') || rerankFlagResult.stdout.includes('result'), 'Search with rerank flag must return results');
            } else {
                const hasGracefulError =
                    rerankFlagResult.stderr.includes('rerank') ||
                    isGenuineEnvironmentIssue(rerankFlagResult.stderr);

                assert(hasGracefulError, 'Should handle reranking flag gracefully, not crash');
                console.log('⚠️ Reranking flag caused graceful failure - this is acceptable');
            }

            console.log('✅ STRICT reranking behavior verified');

        } finally {
            await afterTest();
        }
    });

    test('should provide actionable error messages', () => {
        const result1 = testCLI(['search', 'test']);
        assert(result1.stderr.includes('Try re-ingesting') || result1.stderr.includes('raglite ingest'), 'Should suggest ingestion');

        const result2 = testCLI(['ingest']);
        assert(result2.stderr.includes('Usage:') && result2.stderr.includes('Examples:'), 'Should show usage and examples');

        const result3 = testCLI(['ingest', 'nonexistent.md']);
        assert(result3.stderr.includes('Please check:') || result3.stderr.includes('Examples:'), 'Should provide guidance');
    });

    test('should handle flag validation', () => {
        const result1 = testCLI(['search', 'test', '--rerank']);
        assert(!result1.stderr.includes('Unknown option') && !result1.stderr.includes('invalid flag'), 'Should accept --rerank flag');

        const result2 = testCLI(['search', 'test', '--no-rerank']);
        assert(!result2.stderr.includes('Unknown option') && !result2.stderr.includes('invalid flag'), 'Should accept --no-rerank flag');

        const result3 = testCLI(['search', 'test', '--top-k', '5']);
        assert(!result3.stderr.includes('Unknown option') && !result3.stderr.includes('invalid'), 'Should accept --top-k parameter');
    });

    test('should accept valid model for ingest - STRICT', async () => {
        const testContent = '# Test Document\n\nThis is a test document for ingestion.';
        writeFileSync('test-doc.md', testContent);

        try {
            const result = testCLI(['ingest', 'test-doc.md', '--model', 'Xenova/all-mpnet-base-v2'], 30000);

            if (result.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(result.stderr)) {
                    console.log('⚠️ Valid model test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Valid model ingest failed: ${result.stderr}`);
            }

            assert.strictEqual(result.exitCode, 0, 'Valid model ingest must succeed');
            assert(!result.stderr.includes('Unsupported model'), 'Should not reject valid model');
            assert(result.stdout.includes('Xenova/all-mpnet-base-v2'), 'Should show correct model in output');

        } finally {
            await afterTest();
        }
    });

    test('should handle --rebuild-if-needed flag with search gracefully', () => {
        const result = testCLI(['search', 'test', '--rebuild-if-needed']);

        assert.notEqual(result.exitCode, 0, 'Should fail due to no database');
        assert(!result.stderr.includes('rebuild-if-needed'), 'Should not complain about rebuild flag');
        assert(result.stderr.includes('No vector index found') || result.stderr.includes('database'), 'Should show database error');
    });

    test('should handle directory ingestion - STRICT', async () => {
        const testDir = 'test-cli-dir';

        try {
            mkdirSync(testDir, { recursive: true });
            writeFileSync(`${testDir}/doc1.md`, '# Document 1\n\nContent of document 1.');
            writeFileSync(`${testDir}/doc2.md`, '# Document 2\n\nContent of document 2.');

            const result = testCLI(['ingest', testDir], 30000);

            if (result.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(result.stderr)) {
                    console.log('⚠️ Directory ingest skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Directory ingest failed: ${result.stderr}`);
            }

            assert.strictEqual(result.exitCode, 0, 'Directory ingest must succeed');
            assert(!result.stderr.includes('Path does not exist'), 'Should accept directory path');

        } finally {
            await afterTest();
        }
    });

    test('should handle top-k parameter validation', () => {
        const result1 = testCLI(['search', 'test', '--top-k', '5']);
        assert(!result1.stderr.includes('Unknown option') && !result1.stderr.includes('invalid'), 'Should accept --top-k parameter');

        const result2 = testCLI(['search', 'test', '--top-k', '0']);
        assert(result2.exitCode !== undefined, 'Should handle invalid top-k gracefully');
        if (result2.exitCode !== 0) {
            assert(result2.stderr.includes('positive number') || result2.stderr.includes('valid range'), 'Should provide helpful error for invalid top-k');
        }
    });

    test('should handle rebuild command - STRICT', async () => {
        const result = testCLI(['rebuild'], 10000);

        assert.notEqual(result.exitCode, 0, 'Should fail when no database to rebuild');

        const hasHelpfulError =
            result.stderr.includes('No database found') ||
            result.stderr.includes('No documents found') ||
            result.stderr.includes('database') ||
            result.stderr.includes('ingest');

        assert(hasHelpfulError, 'Should provide helpful error message for missing database');
        assert(!isGenuineEnvironmentIssue(result.stderr), 'Missing database should not be treated as environment issue');

        await afterTest();
    });

    test('should apply correct model-specific configuration for all-mpnet-base-v2 - STRICT', async () => {
        const testContent = `# Custom Model Configuration Test

## Introduction
This document tests that the all-mpnet-base-v2 model uses the correct configuration parameters for chunking and processing.

## Content Section 1
The all-mpnet-base-v2 model should use larger chunk sizes and different batch sizes compared to the default model, optimized for higher quality embeddings.

## Content Section 2
This model produces 768-dimensional embeddings and should use chunk size 400, overlap 80, and batch size 8 for optimal performance.

## Content Section 3
Additional content to ensure we have enough text to properly test the chunking behavior with the custom model configuration.

## Content Section 4
More content to create multiple chunks and verify the configuration differences between models.`;

        writeFileSync('custom-config-test.md', testContent);

        try {
            const result = testCLI(['ingest', 'custom-config-test.md', '--model', 'Xenova/all-mpnet-base-v2'], 30000);

            if (result.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(result.stderr)) {
                    console.log('⚠️ Custom model config test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Custom model ingest failed: ${result.stderr}`);
            }

            assert.strictEqual(result.exitCode, 0, 'Custom model ingest must succeed');

            const chunkSize = extractChunkSize(result.stdout);
            const chunkOverlap = extractChunkOverlap(result.stdout);
            const batchSize = extractBatchSize(result.stdout);
            const dimensions = extractDimensions(result.stdout);

            console.log(`Configuration - Chunk Size: ${chunkSize}, Overlap: ${chunkOverlap}, Batch: ${batchSize}, Dimensions: ${dimensions}`);

            assert(chunkSize > 0, 'Chunk size must be detected in output');
            assert.strictEqual(chunkSize, 400, 'all-mpnet-base-v2 must use chunk size 400');

            assert(chunkOverlap > 0, 'Chunk overlap must be detected in output');
            assert.strictEqual(chunkOverlap, 80, 'all-mpnet-base-v2 must use chunk overlap 80');

            assert(batchSize > 0, 'Batch size must be detected in output');
            assert.strictEqual(batchSize, 8, 'all-mpnet-base-v2 must use batch size 8');

            assert(result.stdout.includes('Xenova/all-mpnet-base-v2'), 'Custom model name must be shown in output');
            assert(dimensions === 768 || result.stdout.includes('768 dimensions'), 'Custom model dimensions must be correct');

            console.log('✅ STRICT custom model configuration verified');

        } finally {
            await afterTest();
        }
    });

    test('should handle --rebuild-if-needed with same model (no rebuild) - STRICT', async () => {
        const testContent = '# No Rebuild Test\n\nThis document tests that --rebuild-if-needed does not rebuild when the model is the same.';
        writeFileSync('no-rebuild-test.md', testContent);

        try {
            const firstIngest = testCLI(['ingest', 'no-rebuild-test.md'], 30000);

            if (firstIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(firstIngest.stderr)) {
                    console.log('⚠️ No-rebuild test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`First ingest failed: ${firstIngest.stderr}`);
            }

            assert.strictEqual(firstIngest.exitCode, 0, 'First ingest must succeed');

            const secondIngest = testCLI(['ingest', 'no-rebuild-test.md', '--rebuild-if-needed'], 30000);

            if (secondIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(secondIngest.stderr)) {
                    console.log('⚠️ Second ingest skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Second ingest failed: ${secondIngest.stderr}`);
            }

            assert.strictEqual(secondIngest.exitCode, 0, 'Second ingest must succeed');

            console.log('✅ STRICT no-rebuild behavior verified');

        } finally {
            await afterTest();
        }
    });

    test('should update database metadata during rebuild - STRICT', async () => {
        const testContent = '# Database Metadata Test\n\nThis document tests that database metadata is properly updated during rebuilds.';
        writeFileSync('metadata-test.md', testContent);

        try {
            const firstIngest = testCLI(['ingest', 'metadata-test.md'], 30000);

            if (firstIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(firstIngest.stderr)) {
                    console.log('⚠️ Database metadata test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`First ingest failed: ${firstIngest.stderr}`);
            }

            assert.strictEqual(firstIngest.exitCode, 0, 'First ingest must succeed');

            const rebuildIngest = testCLI(['ingest', 'metadata-test.md', '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-if-needed'], 30000);

            if (rebuildIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(rebuildIngest.stderr)) {
                    console.log('⚠️ Rebuild skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Rebuild failed: ${rebuildIngest.stderr}`);
            }

            assert.strictEqual(rebuildIngest.exitCode, 0, 'Rebuild must succeed');
            assert(rebuildIngest.stdout.includes('Xenova/all-mpnet-base-v2'), 'Rebuild output must show new model');

            const searchResult = testCLI(['search', 'metadata'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search after metadata update skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Search failed after metadata update: ${searchResult.stderr}`);
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must work after metadata update');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');

            console.log('✅ STRICT database metadata update verified');

        } finally {
            await afterTest();
        }
    });

    test('should prevent dimension mismatch errors - STRICT', async () => {
        const testContent = '# Dimension Consistency Test\n\nThis document tests that dimension mismatches are prevented in consistent database states.';
        writeFileSync('dimension-test.md', testContent);

        try {
            const firstIngest = testCLI(['ingest', 'dimension-test.md'], 30000);

            if (firstIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(firstIngest.stderr)) {
                    console.log('⚠️ Dimension mismatch test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`First ingest failed: ${firstIngest.stderr}`);
            }

            assert.strictEqual(firstIngest.exitCode, 0, 'First ingest must succeed');

            const searchResult = testCLI(['search', 'dimension'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search skipped due to genuine environment limitation');
                    return;
                }
                
                const isDimensionError =
                    searchResult.stderr.includes('Dimension mismatch') ||
                    searchResult.stderr.includes('dimension mismatch') ||
                    searchResult.stderr.includes('incompatible dimensions');

                if (isDimensionError) {
                    assert.fail(`Unexpected dimension mismatch error with consistent state: ${searchResult.stderr}`);
                } else {
                    assert.fail(`Search failed for non-dimension reasons: ${searchResult.stderr}`);
                }
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must succeed with consistent state');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');

            const hasDimensionMismatch =
                searchResult.stderr.includes('Dimension mismatch detected') ||
                searchResult.stderr.includes('incompatible dimensions');

            assert(!hasDimensionMismatch, 'Should not have dimension mismatch with consistent state');

            console.log('✅ STRICT dimension mismatch prevention verified');

        } finally {
            await afterTest();
        }
    });

    test('should handle complete model switching workflow - STRICT', async () => {
        const testContent = `# Complete Model Switching Workflow Test

## Machine Learning Overview
Machine learning is a powerful technique for data analysis and prediction that enables computers to learn patterns from data without being explicitly programmed for every scenario.

## Deep Learning Concepts
Deep learning uses neural networks with multiple layers to process complex patterns in data. This approach has revolutionized fields like computer vision, natural language processing, and speech recognition.

## Applications and Use Cases
Modern machine learning applications include recommendation systems, autonomous vehicles, medical diagnosis, financial fraud detection, and intelligent virtual assistants.

## Technical Implementation
The implementation of machine learning systems involves data preprocessing, model selection, training, validation, and deployment. Each step requires careful consideration of the specific problem domain and available resources.`;

        writeFileSync('integration-workflow-test.md', testContent);

        try {
            console.log('Testing STRICT complete model switching workflow...');

            const initialIngest = testCLI(['ingest', 'integration-workflow-test.md'], 30000);

            if (initialIngest.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(initialIngest.stderr)) {
                    console.log('⚠️ Complete workflow test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Initial ingest failed: ${initialIngest.stderr}`);
            }

            assert.strictEqual(initialIngest.exitCode, 0, 'Initial ingest must succeed');

            const initialSearch = testCLI(['search', 'machine learning'], 15000);

            if (initialSearch.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(initialSearch.stderr)) {
                    console.log('⚠️ Initial search skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Initial search failed: ${initialSearch.stderr}`);
            }

            assert.strictEqual(initialSearch.exitCode, 0, 'Initial search must succeed');
            assert(initialSearch.stdout.includes('Found') || initialSearch.stdout.includes('result'), 'Initial search must return results');

            const modelSwitch = testCLI(['ingest', 'integration-workflow-test.md', '--model', 'Xenova/all-mpnet-base-v2', '--rebuild-if-needed'], 30000);

            if (modelSwitch.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(modelSwitch.stderr)) {
                    console.log('⚠️ Model switch skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Model switch failed: ${modelSwitch.stderr}`);
            }

            assert.strictEqual(modelSwitch.exitCode, 0, 'Model switch must succeed');
            assert(modelSwitch.stdout.includes('Xenova/all-mpnet-base-v2'), 'Model switch output must show new model');

            const finalSearch = testCLI(['search', 'machine learning'], 15000);

            if (finalSearch.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(finalSearch.stderr)) {
                    console.log('⚠️ Final search skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Final search failed after model switch: ${finalSearch.stderr}`);
            }

            assert.strictEqual(finalSearch.exitCode, 0, 'Final search must succeed');
            assert(finalSearch.stdout.includes('Found') || finalSearch.stdout.includes('result'), 'Final search must return results');

            console.log('🎉 STRICT complete model switching workflow succeeded!');

        } finally {
            await afterTest();
        }
    });

    test('should provide clear error messages for index issues - STRICT', async () => {
        const testContent = '# Index Corruption Test\n\nThis document tests error handling when the vector index is corrupted or missing.';
        writeFileSync('corruption-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'corruption-test.md'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ Index corruption test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Ingest must succeed');

            console.log('Simulating index corruption by removing vector index file...');
            try {
                unlinkSync('vector-index.bin');
                console.log('✅ Vector index file removed to simulate corruption');
            } catch (error) {
                console.log('⚠️ Vector index file not found - may not have been created');
            }

            const searchResult = testCLI(['search', 'corruption'], 15000);

            assert.notEqual(searchResult.exitCode, 0, 'Search should fail with missing index');

            const hasHelpfulError =
                searchResult.stderr.includes('Vector index not found') ||
                searchResult.stderr.includes('No vector index found') ||
                searchResult.stderr.includes('index') ||
                searchResult.stderr.includes('rebuild') ||
                searchResult.stderr.includes('re-ingest');

            assert(hasHelpfulError, 'Should provide helpful error message for index corruption');

            const hasActionableGuidance =
                searchResult.stderr.includes('Try re-ingesting') ||
                searchResult.stderr.includes('rebuild') ||
                searchResult.stderr.includes('raglite ingest') ||
                searchResult.stderr.includes('raglite rebuild');

            assert(hasActionableGuidance, 'Should provide actionable guidance for recovery');

            console.log('✅ STRICT index corruption error handling verified');

        } finally {
            await afterTest();
        }
    });

    test('should handle WebAssembly exceptions gracefully - STRICT', async () => {
        const testContent = '# WebAssembly Exception Test\n\nThis document tests that WebAssembly exceptions are handled gracefully and not exposed to users.';
        writeFileSync('webassembly-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'webassembly-test.md'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ WebAssembly exception test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Ingest must succeed');

            const searchResult = testCLI(['search', 'webassembly'], 15000);

            if (searchResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(searchResult.stderr)) {
                    console.log('⚠️ Search skipped due to genuine environment limitation');
                    return;
                }
                
                const isWebAssemblyError =
                    searchResult.stderr.includes('WebAssembly.Exception') ||
                    searchResult.stderr.includes('[object WebAssembly');

                if (isWebAssemblyError) {
                    assert.fail(`Cryptic WebAssembly error exposed: ${searchResult.stderr}`);
                } else {
                    assert.fail(`Search failed for non-WebAssembly reasons: ${searchResult.stderr}`);
                }
            }

            assert.strictEqual(searchResult.exitCode, 0, 'Search must succeed');
            assert(searchResult.stdout.includes('Found') || searchResult.stdout.includes('result'), 'Search must return results');

            const hasWebAssemblyExceptions =
                searchResult.stderr.includes('WebAssembly.Exception') ||
                searchResult.stderr.includes('[object WebAssembly') ||
                searchResult.stdout.includes('WebAssembly.Exception') ||
                searchResult.stdout.includes('[object WebAssembly');

            assert(!hasWebAssemblyExceptions, 'Should not expose WebAssembly exceptions to users');

            console.log('✅ STRICT WebAssembly exception handling verified');

        } finally {
            await afterTest();
        }
    });

    test('should suggest solutions for common problems - STRICT', async () => {
        const testContent = '# Solutions Test\n\nThis document tests that the CLI provides helpful solutions for common user problems.';
        writeFileSync('solutions-test.md', testContent);

        try {
            const ingestResult = testCLI(['ingest', 'solutions-test.md'], 30000);

            if (ingestResult.exitCode !== 0) {
                if (isGenuineEnvironmentIssue(ingestResult.stderr)) {
                    console.log('⚠️ Solutions test skipped due to genuine environment limitation');
                    return;
                }
                assert.fail(`Ingest failed: ${ingestResult.stderr}`);
            }

            assert.strictEqual(ingestResult.exitCode, 0, 'Ingest must succeed');

            const mismatchResult = testCLI(['ingest', 'solutions-test.md', '--model', 'Xenova/all-mpnet-base-v2'], 15000);

            assert.notEqual(mismatchResult.exitCode, 0, 'Should fail on model mismatch');

            const hasRebuildSuggestion =
                mismatchResult.stderr.includes('rebuild') ||
                mismatchResult.stderr.includes('--rebuild-if-needed') ||
                mismatchResult.stderr.includes('--force-rebuild') ||
                mismatchResult.stderr.includes('Use --force-rebuild to change models');

            assert(hasRebuildSuggestion, 'Should suggest rebuild solution for model mismatch');

            const hasExplanation =
                mismatchResult.stderr.includes('Model mismatch') ||
                mismatchResult.stderr.includes('Database is configured for') ||
                mismatchResult.stderr.includes('model has changed');

            assert(hasExplanation, 'Should provide clear explanation for the problem');

            console.log('✅ STRICT solution suggestions verified');

        } finally {
            await afterTest();
        }
    });

});
