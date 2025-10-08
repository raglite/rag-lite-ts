#!/usr/bin/env node

/**
 * Basic example: Ingest PDF and DOCX files, then search across them
 */

import { IngestionPipeline, SearchEngine } from '../../dist/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const docsDir = join(__dirname, 'example-docs');

  try {
    // 1. Ingest documents
    const pipeline = new IngestionPipeline(docsDir);
    const results = await pipeline.ingestDirectory(docsDir);

    console.log(`Processed ${results.documentsProcessed} documents, created ${results.chunksCreated} chunks`);

    // 2. Search documents
    const searchEngine = new SearchEngine(
      join(docsDir, 'vector-index.bin'),
      join(docsDir, 'db.sqlite')
    );

    const query = 'documentation';
    const searchResults = await searchEngine.search(query, { top_k: 3 });

    console.log(`\nSearch results for "${query}":`);
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.document.title} (${result.document.source})`);
      console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
      console.log(`   Preview: ${result.text.substring(0, 80)}...\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();