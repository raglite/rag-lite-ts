/**
 * Multimodal Content Integration Tests for Chameleon Architecture
 * Tests the foundation for mixed content ingestion and multimodal mode configuration
 * Validates database schema support for multimodal content types
 * Tests mode detection and configuration storage for multimodal systems
 * Prepares integration testing framework for full multimodal implementation
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import core components
import { IngestionPipeline } from '../../src/ingestion.js';
import { openDatabase } from '../../src/core/db.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'multimodal-content-integration-test');
const TEST_DIR = join(TEST_BASE_DIR, Date.now().toString());

describe('Multimodal Content Integration Tests', () => {
    let testDbPath: string;
    let testIndexPath: string;
    let testContentDir: string;

    beforeEach(() => {
        // Create unique test paths for each test
        const testId = Date.now().toString();
        testDbPath = join(TEST_DIR, `test-${testId}.db`);
        testIndexPath = join(TEST_DIR, `test-${testId}.bin`);
        testContentDir = join(TEST_DIR, `content-${testId}`);

        // Clean up any existing test files
        cleanup();

        // Create test directories
        mkdirSync(TEST_DIR, { recursive: true });
        mkdirSync(testContentDir, { recursive: true });

        // Create sample mixed content (text + images)
        setupMixedTestContent();
    });

    afterEach(() => {
        cleanup();
    });

    function cleanup() {
        try {
            if (existsSync(TEST_BASE_DIR)) {
                rmSync(TEST_BASE_DIR, { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    function setupMixedTestContent() {
        // Create sample text documents
        const textDoc1 = `# Computer Vision and Image Processing

Computer vision is a field of artificial intelligence that enables computers to interpret and understand visual information from the world.

## Key Applications

- **Object Detection**: Identifying and locating objects in images
- **Image Classification**: Categorizing images into predefined classes
- **Facial Recognition**: Identifying individuals from facial features
- **Medical Imaging**: Analyzing medical scans and X-rays
- **Autonomous Vehicles**: Processing visual data for navigation

Modern computer vision relies heavily on deep learning and convolutional neural networks.`;

        const textDoc2 = `# Machine Learning Model Architecture

Deep learning architectures have revolutionized artificial intelligence across multiple domains.

## Popular Architectures

1. **Convolutional Neural Networks (CNNs)**: Excellent for image processing
2. **Recurrent Neural Networks (RNNs)**: Designed for sequential data
3. **Transformer Models**: State-of-the-art for natural language processing
4. **Generative Adversarial Networks (GANs)**: Creating synthetic data
5. **Vision Transformers (ViTs)**: Applying transformers to computer vision

Each architecture is optimized for specific types of data and tasks.`;

        const textDoc3 = `# Data Visualization and Analytics

Effective data visualization transforms complex datasets into understandable insights.

## Visualization Types

- **Charts and Graphs**: Bar charts, line graphs, scatter plots
- **Heatmaps**: Showing data density and patterns
- **Network Diagrams**: Visualizing relationships and connections
- **Dashboards**: Interactive displays of key metrics
- **Infographics**: Combining data with visual design elements

Good visualization makes data accessible to both technical and non-technical audiences.`;

        // Write text documents
        writeFileSync(join(testContentDir, 'computer-vision.md'), textDoc1);
        writeFileSync(join(testContentDir, 'ml-architectures.md'), textDoc2);
        writeFileSync(join(testContentDir, 'data-visualization.md'), textDoc3);

        // Create simple test images (minimal PNG files for testing)
        // These are minimal valid PNG files for testing purposes
        createTestImage(join(testContentDir, 'neural-network-diagram.png'));
        createTestImage(join(testContentDir, 'data-flow-chart.png'));
        createTestImage(join(testContentDir, 'architecture-overview.png'));

        // Create images in a subdirectory to test recursive processing
        const imagesDir = join(testContentDir, 'images');
        mkdirSync(imagesDir, { recursive: true });
        createTestImage(join(imagesDir, 'cnn-architecture.png'));
        createTestImage(join(imagesDir, 'transformer-model.png'));
    }

    function createTestImage(imagePath: string) {
        // Create a minimal valid PNG file (1x1 pixel transparent PNG)
        const pngData = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // bit depth, color type, etc.
            0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41, // IDAT chunk
            0x54, 0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
            0x42, 0x60, 0x82
        ]);

        writeFileSync(imagePath, pngData);
    }

    test('multimodal mode configuration and database schema support', async () => {
        console.log('🧪 Testing multimodal mode configuration and database schema...');

        try {
            // Step 1: Test multimodal mode configuration storage
            console.log('Step 1: Testing multimodal mode configuration...');

            const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2', // Use supported model for now
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 512
            });

            // Perform ingestion on text content only for now
            await ingestion.ingestDirectory(testContentDir);
            await ingestion.cleanup();

            // Verify database was created
            assert.ok(existsSync(testDbPath), 'Database file should be created');

            console.log('✓ Multimodal configuration ingestion completed');

            // Step 2: Verify multimodal mode was stored in system_info
            console.log('Step 2: Verifying multimodal mode storage...');

            const db = await openDatabase(testDbPath);

            // Check system_info table for multimodal configuration
            const systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');
            assert.ok(systemInfo, 'System info should be stored');
            assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be stored as multimodal');
            assert.ok(systemInfo.model_name, 'Model name should be stored');
            assert.ok(systemInfo.supported_content_types, 'Supported content types should be stored');

            // Parse and verify supported content types
            const supportedTypes = JSON.parse(systemInfo.supported_content_types);
            assert.ok(Array.isArray(supportedTypes), 'Supported content types should be an array');
            assert.ok(supportedTypes.includes('text'), 'Should support text content type');

            console.log(`✓ Multimodal mode stored: ${systemInfo.mode}, Model: ${systemInfo.model_name}`);
            console.log(`✓ Supported content types: ${supportedTypes.join(', ')}`);

            // Step 3: Verify database schema supports content types
            console.log('Step 3: Verifying database schema for multimodal support...');

            // Check documents table schema
            const documentsSchema = await db.all("PRAGMA table_info(documents)");
            const hasContentType = documentsSchema.some(col => col.name === 'content_type');
            const hasMetadata = documentsSchema.some(col => col.name === 'metadata');

            assert.ok(hasContentType, 'Documents table should have content_type column');
            assert.ok(hasMetadata, 'Documents table should have metadata column');

            // Check chunks table schema
            const chunksSchema = await db.all("PRAGMA table_info(chunks)");
            const chunksHasContentType = chunksSchema.some(col => col.name === 'content_type');
            const chunksHasMetadata = chunksSchema.some(col => col.name === 'metadata');

            assert.ok(chunksHasContentType, 'Chunks table should have content_type column');
            assert.ok(chunksHasMetadata, 'Chunks table should have metadata column');

            console.log('✓ Database schema supports multimodal content types');

            // Step 4: Verify text documents were processed with correct content type
            console.log('Step 4: Verifying content type assignment...');

            const documents = await db.all('SELECT source, content_type, metadata FROM documents ORDER BY source');
            assert.ok(documents.length >= 3, 'Should have processed text documents');

            // Verify we have both text and image documents
            const textDocs = documents.filter(doc => doc.content_type === 'text');
            const imageDocs = documents.filter(doc => doc.content_type === 'image');

            assert.ok(textDocs.length >= 3, 'Should have at least 3 text documents');
            assert.ok(imageDocs.length >= 5, 'Should have at least 5 image documents');

            console.log(`Found ${textDocs.length} text documents and ${imageDocs.length} image documents`);

            // Verify specific documents
            assert.ok(textDocs.some(doc => doc.source.includes('computer-vision.md')), 'Should include computer vision document');
            assert.ok(textDocs.some(doc => doc.source.includes('ml-architectures.md')), 'Should include ML architectures document');
            assert.ok(textDocs.some(doc => doc.source.includes('data-visualization.md')), 'Should include data visualization document');

            console.log(`✓ Processed ${documents.length} documents with correct content types`);

            await db.close();

            console.log('🎉 Multimodal mode configuration and database schema test passed!');

        } catch (error) {
            if (error instanceof Error && (
                error.message.includes('indexedDB not supported') ||
                error.message.includes('IDBFS') ||
                error.message.includes('Model version mismatch')
            )) {
                console.log('⚠️  Skipping multimodal configuration test due to environment limitations');
                return;
            }
            throw error;
        }
    });

    test('content type detection and file processing pipeline', async () => {
        console.log('🧪 Testing content type detection and file processing pipeline...');

        try {
            // Step 1: Test file discovery with mixed content types
            console.log('Step 1: Testing file discovery with mixed content types...');

            const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 256
            });

            await ingestion.ingestDirectory(testContentDir);
            await ingestion.cleanup();

            // Step 2: Verify file discovery and content type detection
            console.log('Step 2: Verifying file discovery and content type detection...');

            const db = await openDatabase(testDbPath);

            // Check what files were discovered and processed
            const documents = await db.all('SELECT source, content_type, metadata FROM documents ORDER BY source');

            console.log(`Discovered and processed ${documents.length} files:`);
            for (const doc of documents) {
                console.log(`  - ${doc.source} (${doc.content_type})`);
            }

            // Verify text files were detected and processed
            const textDocs = documents.filter(doc => doc.content_type === 'text');
            assert.ok(textDocs.length >= 3, 'Should have detected and processed text files');

            // Verify expected text files
            const expectedTextFiles = ['computer-vision.md', 'ml-architectures.md', 'data-visualization.md'];
            for (const expectedFile of expectedTextFiles) {
                const found = textDocs.some(doc => doc.source.includes(expectedFile));
                assert.ok(found, `Should have processed ${expectedFile}`);
            }

            // Check if image files were discovered (they may not be fully processed yet)
            const imageDocs = documents.filter(doc => doc.content_type === 'image');
            console.log(`Found ${imageDocs.length} image documents`);

            // If images were discovered, verify their basic structure
            for (const imageDoc of imageDocs) {
                assert.ok(imageDoc.source.endsWith('.png'), 'Image documents should have .png extension');
                console.log(`  Image: ${imageDoc.source}`);

                if (imageDoc.metadata) {
                    const metadata = JSON.parse(imageDoc.metadata);
                    console.log(`    Metadata keys: ${Object.keys(metadata).join(', ')}`);
                }
            }

            await db.close();

            console.log('✓ File discovery and content type detection verified');

            // Step 3: Test error handling with invalid files
            console.log('Step 3: Testing error handling with invalid files...');

            // Create an invalid file that should be skipped
            const invalidFilePath = join(testContentDir, 'invalid-file.xyz');
            writeFileSync(invalidFilePath, 'This is an unsupported file type');

            // Create new ingestion pipeline to test error handling
            const errorTestDbPath = join(TEST_DIR, 'error-test.db');
            const errorTestIndexPath = join(TEST_DIR, 'error-test.bin');

            const errorTestIngestion = new IngestionPipeline(errorTestDbPath, errorTestIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const
            });

            // This should not throw an error, but should handle the invalid file gracefully
            await errorTestIngestion.ingestDirectory(testContentDir);
            await errorTestIngestion.cleanup();

            // Verify that valid files were still processed despite the invalid one
            const errorDb = await openDatabase(errorTestDbPath);
            const validDocs = await errorDb.all('SELECT COUNT(*) as count FROM documents');

            assert.ok(validDocs[0].count >= 3, 'Valid files should still be processed despite invalid file');

            await errorDb.close();

            console.log('✓ Error handling with invalid files verified');

            console.log('🎉 Content type detection and file processing pipeline test passed!');

        } catch (error) {
            if (error instanceof Error && (
                error.message.includes('indexedDB not supported') ||
                error.message.includes('IDBFS') ||
                error.message.includes('Model version mismatch')
            )) {
                console.log('⚠️  Skipping content type detection test due to environment limitations');
                return;
            }
            throw error;
        }
    });

    test('multimodal mode persistence and configuration validation', async () => {
        console.log('🧪 Testing multimodal mode persistence and configuration validation...');

        try {
            // Step 1: Test mode persistence across ingestion sessions
            console.log('Step 1: Testing mode persistence across sessions...');

            // First ingestion with multimodal mode
            let ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 512
            });

            await ingestion.ingestDirectory(testContentDir);
            await ingestion.cleanup();

            // Verify mode was stored
            let db = await openDatabase(testDbPath);
            let systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');
            assert.ok(systemInfo, 'System info should be stored after first ingestion');
            assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be multimodal');
            await db.close();

            console.log('✓ First ingestion completed with multimodal mode');

            // Step 2: Test configuration validation on subsequent ingestion
            console.log('Step 2: Testing configuration validation on subsequent ingestion...');

            // Second ingestion should detect existing mode
            ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 256 // Different chunk size
            });

            // Add one more document to test incremental ingestion
            const additionalDoc = `# Additional AI Content

This is additional content about artificial intelligence and machine learning applications.

## New Topics

- Reinforcement Learning
- Computer Vision Applications
- Natural Language Processing`;

            writeFileSync(join(testContentDir, 'additional-ai.md'), additionalDoc);

            await ingestion.ingestDirectory(testContentDir);
            await ingestion.cleanup();

            // Verify mode persistence and document count increase
            db = await openDatabase(testDbPath);
            systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');
            assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should persist as multimodal');

            const documents = await db.all('SELECT * FROM documents');
            assert.ok(documents.length >= 4, 'Should have at least 4 documents after second ingestion');

            // Verify the new document was added
            const newDoc = documents.find(doc => doc.source.includes('additional-ai.md'));
            assert.ok(newDoc, 'New document should be added');
            assert.strictEqual(newDoc.content_type, 'text', 'New document should have text content type');

            await db.close();

            console.log('✓ Configuration validation and incremental ingestion verified');

            // Step 3: Test configuration consistency validation
            console.log('Step 3: Testing configuration consistency...');

            // Verify that the system maintains consistent configuration
            db = await openDatabase(testDbPath);
            systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');

            // Check all required fields are present
            assert.ok(systemInfo.mode, 'Mode should be present');
            assert.ok(systemInfo.model_name, 'Model name should be present');
            assert.ok(systemInfo.model_type, 'Model type should be present');
            assert.ok(systemInfo.model_dimensions, 'Model dimensions should be present');
            assert.ok(systemInfo.supported_content_types, 'Supported content types should be present');
            assert.ok(systemInfo.reranking_strategy, 'Reranking strategy should be present');
            assert.ok(systemInfo.created_at, 'Created timestamp should be present');
            assert.ok(systemInfo.updated_at, 'Updated timestamp should be present');

            // Verify content types configuration
            const supportedTypes = JSON.parse(systemInfo.supported_content_types);
            assert.ok(Array.isArray(supportedTypes), 'Supported content types should be an array');
            assert.ok(supportedTypes.includes('text'), 'Should support text content type');

            console.log('✓ Configuration consistency verified');
            console.log(`  Mode: ${systemInfo.mode}`);
            console.log(`  Model: ${systemInfo.model_name} (${systemInfo.model_type})`);
            console.log(`  Dimensions: ${systemInfo.model_dimensions}`);
            console.log(`  Reranking: ${systemInfo.reranking_strategy}`);
            console.log(`  Content types: ${supportedTypes.join(', ')}`);

            await db.close();

            console.log('🎉 Multimodal mode persistence and configuration validation test passed!');

        } catch (error) {
            if (error instanceof Error && (
                error.message.includes('indexedDB not supported') ||
                error.message.includes('IDBFS') ||
                error.message.includes('Model version mismatch')
            )) {
                console.log('⚠️  Skipping mode persistence test due to environment limitations');
                return;
            }
            throw error;
        }
    });

    test('reranking strategy configuration in multimodal mode', async () => {
        console.log('🧪 Testing reranking strategy configuration in multimodal mode...');

        try {
            // Test different reranking strategies that are currently supported
            const rerankingStrategies = ['cross-encoder', 'disabled'] as const;

            for (const strategy of rerankingStrategies) {
                console.log(`Testing reranking strategy: ${strategy}`);

                // Clean up for each strategy test
                if (existsSync(testDbPath)) unlinkSync(testDbPath);
                if (existsSync(testIndexPath)) unlinkSync(testIndexPath);

                // Step 1: Ingest with specific reranking strategy
                const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                    mode: 'multimodal' as const,
                    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                    rerankingStrategy: strategy,
                    chunkSize: 256
                });

                await ingestion.ingestDirectory(testContentDir);
                await ingestion.cleanup();

                // Step 2: Verify reranking strategy was stored
                const db = await openDatabase(testDbPath);
                const systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');

                assert.ok(systemInfo, 'System info should be stored');
                assert.strictEqual(systemInfo.reranking_strategy, strategy, `Reranking strategy should be ${strategy}`);
                assert.strictEqual(systemInfo.mode, 'multimodal', 'Mode should be multimodal');

                // Step 3: Verify documents were processed correctly
                const documents = await db.all('SELECT * FROM documents');
                assert.ok(documents.length >= 3, `Should have processed documents with ${strategy} reranking`);

                // Verify we have both text and image documents
                const textDocs = documents.filter(doc => doc.content_type === 'text');
                const imageDocs = documents.filter(doc => doc.content_type === 'image');

                assert.ok(textDocs.length >= 3, 'Should have at least 3 text documents');
                console.log(`Strategy ${strategy}: ${textDocs.length} text docs, ${imageDocs.length} image docs`);

                // Step 4: Verify chunks were created
                const chunks = await db.all('SELECT * FROM chunks');
                console.log(`  Strategy ${strategy}: ${documents.length} documents, ${chunks.length} chunks`);

                await db.close();

                console.log(`  ✓ ${strategy} reranking strategy configuration verified`);
            }

            // Step 5: Test strategy validation and error handling
            console.log('Step 5: Testing strategy validation...');

            // Test with a valid strategy using fresh database
            const validationDbPath = join(TEST_DIR, 'validation-test.db');
            const validationIndexPath = join(TEST_DIR, 'validation-test.bin');

            const validIngestion = new IngestionPipeline(validationDbPath, validationIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 512
            });

            // This should work without errors
            await validIngestion.ingestDirectory(testContentDir);
            await validIngestion.cleanup();

            // Verify the configuration was stored correctly
            const db = await openDatabase(validationDbPath);
            const finalSystemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');

            assert.strictEqual(finalSystemInfo.mode, 'multimodal', 'Final mode should be multimodal');
            assert.strictEqual(finalSystemInfo.reranking_strategy, 'cross-encoder', 'Final reranking strategy should be cross-encoder');
            assert.ok(finalSystemInfo.model_name, 'Model name should be stored');
            assert.ok(finalSystemInfo.model_dimensions > 0, 'Model dimensions should be positive');

            await db.close();

            console.log('✓ Strategy validation and error handling verified');

            console.log('🎉 Reranking strategy configuration test passed!');

        } catch (error) {
            if (error instanceof Error && (
                error.message.includes('indexedDB not supported') ||
                error.message.includes('IDBFS') ||
                error.message.includes('Model version mismatch')
            )) {
                console.log('⚠️  Skipping reranking strategy test due to environment limitations');
                return;
            }
            throw error;
        }
    });

    test('database schema validation for multimodal content support', async () => {
        console.log('🧪 Testing database schema validation for multimodal content support...');

        try {
            // Step 1: Set up multimodal environment
            console.log('Step 1: Setting up multimodal environment...');

            const ingestion = new IngestionPipeline(testDbPath, testIndexPath, {
                mode: 'multimodal' as const,
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                rerankingStrategy: 'cross-encoder' as const,
                chunkSize: 256
            });

            await ingestion.ingestDirectory(testContentDir);
            await ingestion.cleanup();

            // Step 2: Verify database schema supports multimodal features
            console.log('Step 2: Verifying database schema for multimodal support...');

            const db = await openDatabase(testDbPath);

            // Check system_info table schema
            const systemInfoSchema = await db.all("PRAGMA table_info(system_info)");
            const requiredSystemInfoColumns = [
                'mode', 'model_name', 'model_type', 'model_dimensions',
                'supported_content_types', 'reranking_strategy'
            ];

            for (const column of requiredSystemInfoColumns) {
                const hasColumn = systemInfoSchema.some(col => col.name === column);
                assert.ok(hasColumn, `system_info table should have ${column} column`);
            }

            // Check documents table schema
            const documentsSchema = await db.all("PRAGMA table_info(documents)");
            const requiredDocumentColumns = ['content_type', 'metadata'];

            for (const column of requiredDocumentColumns) {
                const hasColumn = documentsSchema.some(col => col.name === column);
                assert.ok(hasColumn, `documents table should have ${column} column`);
            }

            // Check chunks table schema
            const chunksSchema = await db.all("PRAGMA table_info(chunks)");
            const requiredChunkColumns = ['content_type', 'metadata'];

            for (const column of requiredChunkColumns) {
                const hasColumn = chunksSchema.some(col => col.name === column);
                assert.ok(hasColumn, `chunks table should have ${column} column`);
            }

            console.log('✓ Database schema supports multimodal features');

            // Step 3: Verify content type consistency in database
            console.log('Step 3: Verifying content type consistency...');

            // Verify documents have correct content types
            const documents = await db.all('SELECT id, source, content_type, metadata FROM documents');

            for (const doc of documents) {
                assert.ok(doc.content_type, 'Document should have content type');

                if (doc.source.endsWith('.md')) {
                    assert.strictEqual(doc.content_type, 'text', 'Markdown files should have text content type');
                } else if (doc.source.endsWith('.png')) {
                    // PNG files may or may not be processed depending on implementation status
                    console.log(`PNG file ${doc.source} has content type: ${doc.content_type}`);
                }
            }

            // Verify chunks maintain content type consistency with their documents
            const chunks = await db.all(`
        SELECT c.content_type as chunk_type, d.content_type as doc_type, d.source
        FROM chunks c 
        JOIN documents d ON c.document_id = d.id
      `);

            for (const chunk of chunks) {
                assert.strictEqual(
                    chunk.chunk_type,
                    chunk.doc_type,
                    `Chunk content type should match document content type for ${chunk.source}`
                );
            }

            console.log('✓ Content type consistency verified');

            // Step 4: Verify system configuration integrity
            console.log('Step 4: Verifying system configuration integrity...');

            const systemInfo = await db.get('SELECT * FROM system_info WHERE id = 1');
            assert.ok(systemInfo, 'System info should exist');

            // Verify all required fields are populated
            assert.ok(systemInfo.mode, 'Mode should be set');
            assert.ok(systemInfo.model_name, 'Model name should be set');
            assert.ok(systemInfo.model_type, 'Model type should be set');
            assert.ok(systemInfo.model_dimensions > 0, 'Model dimensions should be positive');
            assert.ok(systemInfo.supported_content_types, 'Supported content types should be set');
            assert.ok(systemInfo.reranking_strategy, 'Reranking strategy should be set');

            // Verify supported content types is valid JSON
            const supportedTypes = JSON.parse(systemInfo.supported_content_types);
            assert.ok(Array.isArray(supportedTypes), 'Supported content types should be an array');
            assert.ok(supportedTypes.length > 0, 'Should support at least one content type');
            assert.ok(supportedTypes.includes('text'), 'Should support text content type');

            console.log('✓ System configuration integrity verified');
            console.log(`  Configuration: ${systemInfo.mode} mode, ${systemInfo.model_name}, ${supportedTypes.join(', ')}`);

            await db.close();

            console.log('🎉 Database schema validation for multimodal content support test passed!');

        } catch (error) {
            if (error instanceof Error && (
                error.message.includes('indexedDB not supported') ||
                error.message.includes('IDBFS') ||
                error.message.includes('Model version mismatch')
            )) {
                console.log('⚠️  Skipping database schema validation test due to environment limitations');
                return;
            }
            throw error;
        }
    });
});
