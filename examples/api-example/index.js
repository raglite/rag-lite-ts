import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

async function main() {
    console.log('🚀 RAG-lite API Example');
    console.log('========================\n');

    try {
        // Ingest documents using the simple constructor pattern
        console.log('Ingesting documents...');
        const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin');
        await ingestion.ingestDirectory('./docs/');
        console.log('✅ Documents ingested successfully!\n');

        // Create search engine using the simple constructor pattern
        console.log('Initializing search engine...');
        const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
        console.log('✅ Search engine ready!\n');

        // Run sample searches
        const queries = [
            'How to install raglite?',
            'What embedding models are supported?',
            'TypeScript API usage examples',
            'MCP server integration'
        ];

        console.log('🔍 Running sample searches:');
        console.log('===========================\n');

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
                console.log(`   Content: ${result.content.substring(0, 120)}...`);
                console.log();
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

main();