/**
 * Tests for all documented constructor parameter combinations
 * Verifies default parameter handling and parameter validation
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine, EmbeddingEngine, ResourceManager } from './index.js';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Constructor Variations', () => {
    const testBaseDir = join(tmpdir(), 'rag-lite-constructor-test');
    const testDir = join(testBaseDir, Date.now().toString());
    const docsDir = join(testDir, 'docs');
    let embedder: EmbeddingEngine;

    beforeEach(async () => {
        // Clean up any existing test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }

        // Create test directories
        mkdirSync(testDir, { recursive: true });
        mkdirSync(docsDir, { recursive: true });

        // Create a sample document
        writeFileSync(join(docsDir, 'test.md'), `
# Test Document

This is a test document for constructor validation.

## Content

Some content for testing search functionality.
    `);

        // Initialize embedder once for all tests
        embedder = await initializeEmbeddingEngine();
    });

    afterEach(async () => {
        // Clean up resources first
        await ResourceManager.cleanupAll();

        // Add a small delay for Windows file handles to close
        await new Promise(resolve => setTimeout(resolve, 100));

        // Then clean up test directory with retry logic for Windows
        if (existsSync(testDir)) {
            let retries = 3;
            while (retries > 0) {
                try {
                    rmSync(testDir, { recursive: true, force: true });
                    break;
                } catch (error: any) {
                    if (error.code === 'EBUSY' && retries > 1) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                        retries--;
                    } else {
                        // If it's the last retry or not a busy error, just log and continue
                        console.warn('Failed to clean up test directory:', error.message);
                        break;
                    }
                }
            }
        }
    });

    describe('IngestionPipeline Constructor Variations', () => {
        test('constructor with both basePath and embedder', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline('./data/', embedder);
                assert.ok(pipeline);

                // Should work immediately
                await pipeline.ingestDirectory('./docs/');

                // Files should be created in the specified basePath
                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with only basePath (embedder auto-initialized)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline('./data/');
                assert.ok(pipeline);

                // Should work with auto-initialized embedder
                await pipeline.ingestDirectory('./docs/');

                // Files should be created in the specified basePath
                assert.ok(existsSync('./data/db.sqlite'));
                assert.ok(existsSync('./data/vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with only embedder (basePath defaults to current directory)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline(undefined, embedder);
                assert.ok(pipeline);

                // Should work with default basePath (current directory)
                await pipeline.ingestDirectory('./docs/');

                // Files should be created in current directory
                assert.ok(existsSync('./db.sqlite'));
                assert.ok(existsSync('./vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with no parameters (all defaults)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline();
                assert.ok(pipeline);

                // Should work with all defaults
                await pipeline.ingestDirectory('./docs/');

                // Files should be created in current directory with default names
                assert.ok(existsSync('./db.sqlite'));
                assert.ok(existsSync('./vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor parameter validation provides clear error messages', () => {
            // Test invalid basePath
            assert.throws(() => new IngestionPipeline(''));
            assert.throws(() => new IngestionPipeline('   '));

            try {
                new IngestionPipeline('');
                assert.fail('Expected constructor to throw');
            } catch (error: any) {
                assert.ok(error.message.match(/basePath.*empty/i));
            }

            try {
                new IngestionPipeline('   ');
                assert.fail('Expected constructor to throw');
            } catch (error: any) {
                assert.ok(error.message.match(/basePath.*empty/i));
            }
        });

        test('constructor handles relative and absolute paths correctly', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Test relative path
                const pipeline1 = new IngestionPipeline('./data/', embedder);
                await pipeline1.ingestDirectory('./docs/');
                assert.ok(existsSync('./data/db.sqlite'));

                // Test absolute path
                const absolutePath = join(process.cwd(), 'absolute-data');
                mkdirSync(absolutePath, { recursive: true });
                const pipeline2 = new IngestionPipeline(absolutePath, embedder);
                await pipeline2.ingestDirectory('./docs/');
                assert.ok(existsSync(join(absolutePath, 'db.sqlite')));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('SearchEngine Constructor Variations', () => {
        beforeEach(async () => {
            // Setup some ingested data for search tests
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline('./data/', embedder);
                await pipeline.ingestDirectory('./docs/');
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with both indexPath and dbPath', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const searchEngine = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
                assert.ok(searchEngine);

                // Should work immediately
                const results = await searchEngine.search('test document');
                assert.ok(results);
                assert.ok(results.length > 0);
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with only indexPath (dbPath auto-resolved)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Copy db to expected location for auto-resolution
                const { copyFileSync } = await import('fs');
                copyFileSync('./data/db.sqlite', './db.sqlite');

                const searchEngine = new SearchEngine('./data/vector-index.bin');
                assert.ok(searchEngine);

                const results = await searchEngine.search('test document');
                assert.ok(results);
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with only dbPath (indexPath auto-resolved)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Copy index to expected location for auto-resolution
                const { copyFileSync } = await import('fs');
                copyFileSync('./data/vector-index.bin', './vector-index.bin');

                const searchEngine = new SearchEngine(undefined, './data/db.sqlite');
                assert.ok(searchEngine);

                const results = await searchEngine.search('test document');
                assert.ok(results);
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor with no parameters (all defaults)', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Copy files to default locations
                const { copyFileSync } = await import('fs');
                copyFileSync('./data/db.sqlite', './db.sqlite');
                copyFileSync('./data/vector-index.bin', './vector-index.bin');

                const searchEngine = new SearchEngine();
                assert.ok(searchEngine);

                const results = await searchEngine.search('test document');
                assert.ok(results);
                assert.ok(results.length > 0);
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('constructor parameter validation provides clear error messages', () => {
            // Test invalid paths
            assert.throws(() => new SearchEngine(''));
            assert.throws(() => new SearchEngine('   '));
            assert.throws(() => new SearchEngine('./valid-path', ''));
            assert.throws(() => new SearchEngine('./valid-path', '   '));

            try {
                new SearchEngine('');
                assert.fail('Expected constructor to throw');
            } catch (error: any) {
                assert.ok(error.message.match(/indexPath.*empty/i));
            }

            try {
                new SearchEngine('./valid-path', '');
                assert.fail('Expected constructor to throw');
            } catch (error: any) {
                assert.ok(error.message.match(/dbPath.*empty/i));
            }
        });

        test('constructor handles relative and absolute paths correctly', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Test relative paths
                const searchEngine1 = new SearchEngine('./data/vector-index.bin', './data/db.sqlite');
                const results1 = await searchEngine1.search('test');
                assert.ok(results1);

                // Test absolute paths
                const absoluteIndexPath = join(process.cwd(), 'data', 'vector-index.bin');
                const absoluteDbPath = join(process.cwd(), 'data', 'db.sqlite');
                const searchEngine2 = new SearchEngine(absoluteIndexPath, absoluteDbPath);
                const results2 = await searchEngine2.search('test');
                assert.ok(results2);
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('Default Parameter Handling', () => {
        test('IngestionPipeline uses sensible defaults', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                const pipeline = new IngestionPipeline();

                // Should use current directory as basePath
                await pipeline.ingestDirectory('./docs/');

                // Files should be created with default names in current directory
                assert.ok(existsSync('./db.sqlite'));
                assert.ok(existsSync('./vector-index.bin'));
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('SearchEngine uses sensible defaults', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // First create files with default names
                const pipeline = new IngestionPipeline();
                await pipeline.ingestDirectory('./docs/');

                // SearchEngine should find them automatically
                const searchEngine = new SearchEngine();
                const results = await searchEngine.search('test');

                assert.ok(results);
                assert.ok(results.length > 0);
            } finally {
                process.chdir(originalCwd);
            }
        });

        test('parameters override defaults correctly', async () => {
            const originalCwd = process.cwd();
            process.chdir(testDir);

            try {
                // Create with custom paths
                const customPath = './custom-location';
                mkdirSync(customPath, { recursive: true });

                const pipeline = new IngestionPipeline(customPath, embedder);
                await pipeline.ingestDirectory('./docs/');

                // Files should be in custom location, not defaults
                assert.ok(!existsSync('./db.sqlite'));
                assert.ok(!existsSync('./vector-index.bin'));
                assert.ok(existsSync(join(customPath, 'db.sqlite')));
                assert.ok(existsSync(join(customPath, 'vector-index.bin')));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});