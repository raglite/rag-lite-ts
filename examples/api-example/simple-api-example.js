/**
 * Simple Constructor API Example
 * 
 * Demonstrates the simple constructor API with lazy initialization
 * for basic usage patterns.
 */

import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

async function main() {
    console.log('🎯 Simple Constructor API Example');
    console.log('==================================\n');

    try {
        // 1. Create ingestion pipeline with simple constructor
        console.log('Creating ingestion pipeline with constructor...');
        const pipeline = new IngestionPipeline('./simple-db.sqlite', './simple-index.bin', {
            embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
            chunkSize: 256,
            chunkOverlap: 25
        });
        console.log('✅ Pipeline created (initialization will happen on first use)\n');

        // 2. Ingest documents (lazy initialization happens here)
        console.log('Ingesting documents...');
        await pipeline.ingestDirectory('./docs/');
        console.log('✅ Documents ingested\n');

        // 3. Create search engine with simple constructor
        console.log('Creating search engine with constructor...');
        const searchEngine = new SearchEngine('./simple-index.bin', './simple-db.sqlite', {
            enableReranking: false // Fast mode for this example
        });
        console.log('✅ Search engine created (initialization will happen on first search)\n');

        // 4. Perform searches (lazy initialization happens here)
        const queries = [
            'getting started',
            'TypeScript usage',
            'embedding models'
        ];

        console.log('🔍 Search Results:');
        console.log('==================\n');

        for (const query of queries) {
            console.log(`Query: "${query}"`);
            console.log('-'.repeat(40));

            const results = await searchEngine.search(query, { top_k: 3 });
            
            if (results.length === 0) {
                console.log('No results found.\n');
                continue;
            }

            results.forEach((result, index) => {
                console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
                console.log(`   Source: ${result.document.source}`);
                console.log(`   Content: ${result.content.substring(0, 100)}...`);
                console.log();
            });
        }

        // 5. Get system statistics
        const stats = await searchEngine.getStats();
        console.log(`📊 System Statistics:`);
        console.log(`   Total chunks: ${stats.totalChunks}`);
        console.log(`   Reranking: ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);
        console.log();

        // 6. Cleanup
        await searchEngine.cleanup();
        await pipeline.cleanup();
        
        console.log('🎉 Simple API example completed successfully!');

    } catch (error) {
        console.error('❌ Simple API example failed:', error.message);
        process.exit(1);
    }
}

main();