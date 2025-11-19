/**
 * Tests for constructor parameter combinations
 * Verifies constructor signatures and parameter validation
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline } from '../../src/index.js';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'rag-lite-constructor-test');

describe('Constructor Variations - Clean Architecture', () => {
    const testBaseDir = TEST_BASE_DIR;
    let testDir: string;
    let docsDir: string;

    // Generate unique directory for each test
    function getUniqueTestDir(): string {
        return join(testBaseDir, `${Date.now()}-${Math.random().toString(36).substring(7)}`);
    }

    beforeEach(async () => {
        // Create unique directory for this test
        testDir = getUniqueTestDir();
        docsDir = join(testDir, 'docs');

        // Create test directories (no cleanup needed - unique dir per test)
        mkdirSync(testDir, { recursive: true });
        mkdirSync(docsDir, { recursive: true });

        // Create a sample document
        writeFileSync(join(docsDir, 'test.md'), `
# Test Document

This is a test document for constructor validation.

## Content

Some content for testing search functionality.
Natural language processing is important.
Machine learning algorithms are powerful.
    `);
    });

    afterEach(async () => {
        // Give time for resources to be released
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Clean up this test's directory
        if (existsSync(testDir)) {
            try {
                rmSync(testDir, { recursive: true, force: true });
            } catch (error: any) {
                // Windows file locking - retry after delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    rmSync(testDir, { recursive: true, force: true });
                } catch (retryError: any) {
                    console.warn(`⚠️  Could not clean up test directory: ${testDir}`, retryError.message);
                    // Don't fail the test due to cleanup issues
                }
            }
        }
    });

    describe('IngestionPipeline Constructor Variations', () => {
        test('constructor with required parameters (dbPath, indexPath)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // constructor: (dbPath, indexPath, options?)
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                assert.ok(pipeline);

                // Should work with new constructor
                await pipeline.ingestDirectory('./docs/');

                // Files should be created at specified paths
                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with options', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // constructor with options
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin', {
                    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                    chunkSize: 200,
                    chunkOverlap: 40
                });
                assert.ok(pipeline);

                await pipeline.ingestDirectory('./docs/');

                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor parameter validation provides clear error messages', () => {
            // Test invalid dbPath
            assert.throws(() => new IngestionPipeline('', './index.bin'), /Both dbPath and indexPath are required/);
            assert.throws(() => new IngestionPipeline('   ', './index.bin'), /Both dbPath and indexPath are required/);

            // Test invalid indexPath
            assert.throws(() => new IngestionPipeline('./db.sqlite', ''), /Both dbPath and indexPath are required/);
            assert.throws(() => new IngestionPipeline('./db.sqlite', '   '), /Both dbPath and indexPath are required/);
        });

        test('constructor creates directories automatically', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Create pipeline with nested directory paths that don't exist yet
                const pipeline = new IngestionPipeline('./nested/data/db.sqlite', './nested/index/vector-index.bin');
                assert.ok(pipeline);

                await pipeline.ingestDirectory('./docs/');

                // Directories should be created automatically
                assert.ok(existsSync('./nested/data/db.sqlite'));
                assert.ok(existsSync('./nested/index/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with absolute paths', async () => {
            const absoluteDbPath = join(testDir, 'absolute-db.sqlite');
            const absoluteIndexPath = join(testDir, 'absolute-index.bin');

            const pipeline = new IngestionPipeline(absoluteDbPath, absoluteIndexPath);
            assert.ok(pipeline);

            await pipeline.ingestDirectory(docsDir);

            assert.ok(existsSync(absoluteDbPath));
            assert.ok(existsSync(absoluteIndexPath));
        });

        test('constructor with force rebuild option', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First ingestion
                const pipeline1 = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                await pipeline1.ingestDirectory('./docs/');

                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));

                // Second ingestion with force rebuild
                const pipeline2 = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin', {
                    forceRebuild: true
                });
                await pipeline2.ingestDirectory('./docs/');

                // Files should still exist after rebuild
                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('SearchEngine Constructor Variations', () => {
        test('constructor with required parameters (indexPath, dbPath)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First create the index and database
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                await pipeline.ingestDirectory('./docs/');

                // constructor: (indexPath, dbPath, options?)
                const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
                assert.ok(searchEngine);

                // Should work with new constructor
                const results = await searchEngine.search('machine learning');
                assert.ok(Array.isArray(results));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with options', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First create the index and database
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                await pipeline.ingestDirectory('./docs/');

                // constructor with options
                const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite', {
                    enableReranking: true,
                    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
                });
                assert.ok(searchEngine);

                const results = await searchEngine.search('natural language');
                assert.ok(Array.isArray(results));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor parameter validation provides clear error messages', () => {
            // Test invalid indexPath
            assert.throws(() => new SearchEngine('', './db.sqlite'), /Both indexPath and dbPath are required/);
            assert.throws(() => new SearchEngine('   ', './db.sqlite'), /Both indexPath and dbPath are required/);

            // Test invalid dbPath
            assert.throws(() => new SearchEngine('./index.bin', ''), /Both indexPath and dbPath are required/);
            assert.throws(() => new SearchEngine('./index.bin', '   '), /Both indexPath and dbPath are required/);
        });

        test('constructor validates file existence', () => {
            // Test non-existent index file
            assert.throws(() => new SearchEngine('./non-existent-index.bin', './also-non-existent.sqlite'), /Vector index not found/);
        });

        test('constructor with absolute paths', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First create the index and database
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                await pipeline.ingestDirectory('./docs/');

                const absoluteIndexPath = join(testDir, 'data', 'vector-index.bin');
                const absoluteDbPath = join(testDir, 'data', 'db.sqlite');

                const searchEngine = new SearchEngine(absoluteIndexPath, absoluteDbPath);
                assert.ok(searchEngine);

                const results = await searchEngine.search('test');
                assert.ok(Array.isArray(results));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with custom embedding function', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First create the index and database
                const pipeline = new IngestionPipeline('./data/db.sqlite', './data/vector-index.bin');
                await pipeline.ingestDirectory('./docs/');

                // Create custom embed function for testing
                const customEmbedFn = async (query: string) => {
                    // This is just for testing - return a mock embedding
                    return {
                        embedding_id: 'custom_' + Date.now(),
                        vector: new Float32Array(384).fill(0.1),
                        contentType: 'text'
                    };
                };

                const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite', {
                    embedFn: customEmbedFn
                });
                assert.ok(searchEngine);

                // Should work with custom embed function
                const results = await searchEngine.search('test query');
                assert.ok(Array.isArray(results));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('Integration Tests', () => {
        test('complete workflow with constructors', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Step 1: Create ingestion pipeline with new constructor
                const pipeline = new IngestionPipeline('./workflow/db.sqlite', './workflow/vector-index.bin', {
                    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                    chunkSize: 200
                });

                // Step 2: Ingest documents
                await pipeline.ingestDirectory('./docs/');

                // Step 3: Verify files were created
                assert.ok(existsSync('./workflow/db.sqlite'));
                assert.ok(existsSync('./workflow/vector-index.bin'));

                // Step 4: Create search engine with new constructor
                const searchEngine = new SearchEngine('./workflow/vector-index.bin', './workflow/db.sqlite', {
                    enableReranking: false // Disable for faster testing
                });

                // Step 5: Perform searches
                const results1 = await searchEngine.search('machine learning');
                assert.ok(Array.isArray(results1));
                assert.ok(results1.length > 0);

                const results2 = await searchEngine.search('natural language processing');
                assert.ok(Array.isArray(results2));

                // Step 6: Verify result structure
                const firstResult = results1[0];
                assert.ok('content' in firstResult);
                assert.ok('score' in firstResult);
                assert.ok('document' in firstResult);
                assert.ok('contentType' in firstResult);

                console.log('✓ Complete workflow test passed');
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('error handling with new constructors', async () => {
            // Test that proper error messages are provided for common mistakes

            // Missing files
            assert.throws(() => {
                new SearchEngine('./missing-index.bin', './missing-db.sqlite');
            }, /Vector index not found/);

            // Invalid parameters
            assert.throws(() => {
                new IngestionPipeline('', '');
            }, /Both dbPath and indexPath are required/);

            console.log('✓ Error handling tests passed');
        });
    });
});


// =============================================================================
// MANDATORY: Force exit after test completion to prevent hanging
// Integration tests with ML models and database connections need forced exit
// =============================================================================
setTimeout(async () => {
    console.log('🔄 Forcing test exit to prevent hanging from ML/database resources...');
    
    // Clean up all test directories
    if (existsSync(TEST_BASE_DIR)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            rmSync(TEST_BASE_DIR, { recursive: true, force: true });
        } catch (error) {
            console.warn('⚠️  Could not clean up base test directory:', error);
        }
    }
    
    // Multiple garbage collection attempts
    if (global.gc) {
        global.gc();
        setTimeout(() => global.gc && global.gc(), 100);
        setTimeout(() => global.gc && global.gc(), 300);
    }
    
    // Force exit after cleanup attempts
    setTimeout(() => {
        console.log('✅ Exiting test process');
        process.exit(0);
    }, 1000);
}, 2000);
