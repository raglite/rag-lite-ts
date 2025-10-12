#!/usr/bin/env node

/**
 * PDF and DOCX Example: Ingest PDF and DOCX files, then search across them
 * Demonstrates RAG-lite's support for multiple document formats
 */

import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const docsDir = join(__dirname, 'example-docs');

  console.log('📄 RAG-lite PDF & DOCX Example');
  console.log('===============================\n');

  try {
    // 1. Ingest documents using simple constructor API
    console.log('📥 Ingesting PDF and DOCX documents...');
    const pipeline = new IngestionPipeline(
      join(docsDir, 'db.sqlite'),
      join(docsDir, 'vector-index.bin')
    );
    
    const results = await pipeline.ingestDirectory(docsDir);
    console.log(`✅ Processed ${results.documentsProcessed} documents, created ${results.chunksCreated} chunks\n`);

    // 2. Search documents using simple constructor API
    console.log('🔍 Initializing search engine...');
    const searchEngine = new SearchEngine(
      join(docsDir, 'vector-index.bin'),
      join(docsDir, 'db.sqlite')
    );
    console.log('✅ Search engine ready!\n');

    // Run multiple search queries to demonstrate functionality
    const queries = [
      'documentation and examples',
      'PDF processing capabilities',
      'text extraction methods',
      'file format support'
    ];

    console.log('🔍 Running sample searches:');
    console.log('============================\n');

    for (const query of queries) {
      console.log(`Query: "${query}"`);
      console.log('-'.repeat(40));

      const searchResults = await searchEngine.search(query, { top_k: 3 });

      if (searchResults.length === 0) {
        console.log('No results found.\n');
        continue;
      }

      searchResults.forEach((result, index) => {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   Source: ${result.document.source}`);
        console.log(`   Title: ${result.document.title}`);
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