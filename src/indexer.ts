#!/usr/bin/env node

/**
 * Standalone indexer script for direct node execution
 * Usage: node indexer.js <path>
 */

import { runIngest } from './cli/indexer.js';
import { EXIT_CODES, ConfigurationError } from './config.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('RAG-lite TS Document Indexer');
    console.error('');
    console.error('Usage: node indexer.js <path>');
    console.error('');
    console.error('Arguments:');
    console.error('  <path>    File or directory path to ingest (.md and .txt files)');
    console.error('');
    console.error('Examples:');
    console.error('  node indexer.js ./docs/           # Ingest all .md/.txt files in docs/');
    console.error('  node indexer.js ./readme.md       # Ingest single file');
    console.error('  node indexer.js ../project/docs/  # Ingest from parent directory');
    console.error('');
    console.error('Supported file types: .md (Markdown), .txt (Plain text)');
    console.error('');
    console.error('After ingestion, use: node search.js "your query"');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  
  if (args.length > 1) {
    console.error('Error: Too many arguments provided');
    console.error('');
    console.error('Usage: node indexer.js <path>');
    console.error('');
    console.error('If your path contains spaces, wrap it in quotes:');
    console.error('  node indexer.js "my documents folder"');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  
  const path = args[0];
  await runIngest(path);
}

main().catch((error) => {
  if (error instanceof ConfigurationError) {
    console.error('Configuration Error:');
    console.error(error.message);
    process.exit(error.exitCode);
  } else {
    console.error('Fatal Error:', error instanceof Error ? error.message : String(error));
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
});