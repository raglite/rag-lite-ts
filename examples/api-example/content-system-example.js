/**
 * Unified Content System Example
 * 
 * Demonstrates the unified content system features including
 * memory-based ingestion, content deduplication, and format adaptation.
 */

import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import { readFileSync } from 'fs';

async function main() {
    console.log('📁 Unified Content System Example');
    console.log('==================================\n');

    try {
        // 1. Create pipeline with content system configuration
        console.log('Creating pipeline with content system config...');
        const pipeline = new IngestionPipeline('./content-db.sqlite', './content-index.bin', {
            embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
            contentSystemConfig: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                enableDeduplication: true,
                enableStorageTracking: true
            }
        });
        console.log('✅ Pipeline with content system ready\n');

        // 2. Demonstrate memory-based ingestion
        console.log('Ingesting content from memory...');
        
        const memoryContent = [
            {
                content: 'RAG-lite is a local-first retrieval system for TypeScript applications.',
                metadata: { title: 'Introduction', source: 'memory://intro' }
            },
            {
                content: 'The factory pattern provides clean APIs for creating search and ingestion instances.',
                metadata: { title: 'Factory Pattern', source: 'memory://factory' }
            },
            {
                content: 'The unified content system handles both file-based and memory-based content seamlessly.',
                metadata: { title: 'Content System', source: 'memory://content' }
            }
        ];

        for (const item of memoryContent) {
            await pipeline.ingestMemoryContent(item.content, item.metadata);
        }
        console.log('✅ Memory content ingested\n');

        // 3. Also ingest file-based content
        console.log('Ingesting file-based content...');
        await pipeline.ingestDirectory('./docs/');
        console.log('✅ File content ingested\n');

        // 4. Create search engine
        console.log('Creating search engine...');
        const searchEngine = new SearchEngine('./content-index.bin', './content-db.sqlite');
        console.log('✅ Search engine ready\n');

        // 5. Search across mixed content types
        const queries = [
            'factory pattern',
            'local-first system',
            'content system features'
        ];

        console.log('🔍 Mixed Content Search Results:');
        console.log('=================================\n');

        for (const query of queries) {
            console.log(`Query: "${query}"`);
            console.log('-'.repeat(40));

            const results = await searchEngine.search(query, { top_k: 3 });
            
            if (results.length === 0) {
                console.log('No results found.\n');
                continue;
            }

            results.forEach((result, index) => {
                const isMemoryContent = result.document.source.startsWith('memory://');
                console.log(`${index + 1}. Score: ${result.score.toFixed(3)} | ${isMemoryContent ? 'Memory' : 'File'}`);
                console.log(`   Source: ${result.document.source}`);
                console.log(`   Content: ${result.content.substring(0, 100)}...`);
                console.log();
            });
        }

        // 6. Demonstrate content retrieval with format adaptation
        console.log('📄 Content Retrieval Examples:');
        console.log('===============================\n');

        const allResults = await searchEngine.search('RAG-lite', { top_k: 5 });
        
        for (const result of allResults.slice(0, 2)) {
            console.log(`Content ID: ${result.document.id}`);
            console.log(`Source: ${result.document.source}`);
            console.log(`Type: ${result.contentType}`);
            
            // Content is automatically formatted based on type
            if (result.document.source.startsWith('memory://')) {
                console.log('Format: Memory content (direct text)');
            } else {
                console.log('Format: File reference (path-based)');
            }
            console.log();
        }

        // 7. Get content system statistics
        const stats = await searchEngine.getStats();
        console.log(`📊 Content System Statistics:`);
        console.log(`   Total chunks: ${stats.totalChunks}`);
        console.log(`   Mixed content types: File + Memory`);
        console.log(`   Deduplication: Enabled`);
        console.log();

        // 8. Cleanup
        await searchEngine.cleanup();
        await pipeline.cleanup();
        
        console.log('🎉 Content system example completed successfully!');

    } catch (error) {
        console.error('❌ Content system example failed:', error.message);
        process.exit(1);
    }
}

main();