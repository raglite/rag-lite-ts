import { SearchFactory, IngestionFactory, RAGFactory, SearchEngine, IngestionPipeline } from 'rag-lite-ts';
import { existsSync } from 'fs';

async function runFactoryPatternExample() {
    console.log('🏭 Factory Pattern Example');
    console.log('==========================\n');

    try {
        // Factory pattern - recommended for most use cases
        console.log('Creating ingestion pipeline with factory...');
        const ingestion = await IngestionFactory.create('./factory-db.sqlite', './factory-index.bin', {
            embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
            chunkSize: 512,
            chunkOverlap: 50
        });
        
        // Ingest sample documents
        await ingestion.ingestDirectory('./docs/');
        console.log('✅ Documents ingested successfully!\n');

        // Create search engine with factory
        console.log('Creating search engine with factory...');
        const search = await SearchFactory.create('./factory-index.bin', './factory-db.sqlite', {
            enableReranking: true,
            topK: 5
        });
        console.log('✅ Search engine ready!\n');

        // Sample queries
        const queries = [
            'How to install rag-lite?',
            'TypeScript API usage',
            'What embedding models are supported?'
        ];

        console.log('🔍 Factory pattern searches:');
        console.log('=============================\n');

        for (const query of queries) {
            console.log(`Query: "${query}"`);
            console.log('-'.repeat(50));

            const results = await search.search(query, { top_k: 3 });

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

        // Cleanup
        await search.cleanup();
        await ingestion.cleanup();

    } catch (error) {
        console.error('❌ Factory pattern error:', error.message);
        throw error;
    }
}

async function runSimpleAPIExample() {
    console.log('🎯 Simple Constructor API Example');
    console.log('==================================\n');

    try {
        // Simple constructor API - lazy initialization
        console.log('Creating ingestion pipeline with constructor...');
        const pipeline = new IngestionPipeline('./simple-db.sqlite', './simple-index.bin', {
            embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
            chunkSize: 256
        });
        
        // Ingest documents (initialization happens automatically)
        await pipeline.ingestDirectory('./docs/');
        console.log('✅ Documents ingested with simple API!\n');

        // Simple search engine constructor
        console.log('Creating search engine with constructor...');
        const searchEngine = new SearchEngine('./simple-index.bin', './simple-db.sqlite', {
            enableReranking: false // Fast mode
        });
        console.log('✅ Search engine ready with simple API!\n');

        // Simple queries
        const simpleQueries = [
            'getting started guide',
            'configuration options',
            'performance optimization'
        ];

        console.log('🔍 Simple API searches:');
        console.log('=======================\n');

        for (const query of simpleQueries) {
            console.log(`Query: "${query}"`);
            console.log('-'.repeat(50));

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

        // Cleanup
        await searchEngine.cleanup();
        await pipeline.cleanup();

    } catch (error) {
        console.error('❌ Simple API error:', error.message);
        throw error;
    }
}

async function runRAGFactoryExample() {
    console.log('🚀 RAG Factory Example');
    console.log('=======================\n');

    try {
        // RAG Factory - create both ingestion and search together
        console.log('Creating complete RAG system with RAGFactory...');
        const { searchEngine, ingestionPipeline } = await RAGFactory.createBoth(
            './rag-index.bin',
            './rag-db.sqlite',
            {
                embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
                enableReranking: true
            }
        );
        console.log('✅ Complete RAG system ready!\n');

        // Ingest documents
        console.log('Ingesting documents with RAG system...');
        await ingestionPipeline.ingestDirectory('./docs/');
        console.log('✅ Documents ingested!\n');

        // Search with the same system
        console.log('Searching with RAG system...');
        const results = await searchEngine.search('RAG system architecture', { top_k: 3 });
        
        console.log('🔍 RAG Factory search results:');
        console.log('===============================\n');

        if (results.length === 0) {
            console.log('No results found.\n');
        } else {
            results.forEach((result, index) => {
                console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
                console.log(`   Source: ${result.document.source}`);
                console.log(`   Content: ${result.content.substring(0, 120)}...`);
                console.log();
            });
        }

        // Get system statistics
        const stats = await searchEngine.getStats();
        console.log(`📊 System stats: ${stats.totalChunks} chunks, reranking ${stats.rerankingEnabled ? 'enabled' : 'disabled'}\n`);

        // Cleanup
        await searchEngine.cleanup();
        await ingestionPipeline.cleanup();

    } catch (error) {
        console.error('❌ RAG Factory error:', error.message);
        throw error;
    }
}

async function main() {
    console.log('🚀 RAG-lite Factory Pattern API Example');
    console.log('========================================\n');
    
    console.log('This example demonstrates the new clean architecture with:');
    console.log('- Factory pattern for easy setup and configuration');
    console.log('- Simple constructor API with lazy initialization');
    console.log('- Unified content system with automatic type detection\n');

    try {
        // Run all examples
        await runFactoryPatternExample();
        console.log('\n' + '='.repeat(60) + '\n');
        
        await runSimpleAPIExample();
        console.log('\n' + '='.repeat(60) + '\n');
        
        await runRAGFactoryExample();
        
        console.log('🎉 All examples completed successfully!');
        console.log('\nNext steps:');
        console.log('- Try the individual example scripts (npm run factory-example, etc.)');
        console.log('- Experiment with different embedding models and configurations');
        console.log('- Explore the unified content system features');
        console.log('- Check out the CLI commands and MCP server integration');

    } catch (error) {
        console.error('❌ Example failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

main();