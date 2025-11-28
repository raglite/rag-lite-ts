/**
 * Factory Pattern Example
 * 
 * Demonstrates the recommended factory pattern API for creating
 * search and ingestion instances with automatic setup.
 */

import { SearchFactory, IngestionFactory } from 'rag-lite-ts';

async function main() {
    console.log('🏭 Factory Pattern API Example');
    console.log('===============================\n');

    try {
        // 1. Create ingestion pipeline with factory
        console.log('Creating ingestion pipeline...');
        const ingestion = await IngestionFactory.create('./factory-db.sqlite', './factory-index.bin', {
            embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
            chunkSize: 512,
            chunkOverlap: 50,
            batchSize: 16
        });
        console.log('✅ Ingestion pipeline ready\n');

        // 2. Ingest sample documents
        console.log('Ingesting documents...');
        await ingestion.ingestDirectory('./docs/');
        console.log('✅ Documents ingested\n');

        // 3. Create search engine with factory (auto-detects mode and configuration)
        console.log('Creating search engine...');
        const search = await SearchFactory.create('./factory-index.bin', './factory-db.sqlite');
        console.log('✅ Search engine ready\n');

        // 4. Perform searches
        const queries = [
            'installation guide',
            'API documentation',
            'configuration options'
        ];

        console.log('🔍 Search Results:');
        console.log('==================\n');

        for (const query of queries) {
            console.log(`Query: "${query}"`);
            console.log('-'.repeat(40));

            const results = await search.search(query, { top_k: 3 });
            
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

        // 5. Cleanup
        await search.cleanup();
        await ingestion.cleanup();
        
        console.log('🎉 Factory pattern example completed successfully!');

    } catch (error) {
        console.error('❌ Factory example failed:', error.message);
        process.exit(1);
    }
}

main();