import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

async function main() {
    console.log('🚀 RAG-lite API Example');
    console.log('========================\n');

    try {
        // Initialize the embedding engine
        const embedder = await initializeEmbeddingEngine();

        // Ingest documents (supports .md, .txt, .mdx)
        console.log('Ingesting documents...');
        const pipeline = new IngestionPipeline('./', embedder);
        await pipeline.ingestDirectory('./docs/');

        // Search
        const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');

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
                console.log(`   Text: ${result.text.substring(0, 120)}...`);
                console.log();
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();