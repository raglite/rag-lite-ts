#!/usr/bin/env node

/**
 * Standalone search script for direct node execution
 * Usage: node search.js <query> [--top-k <number>] [--rerank|--no-rerank]
 */

import { runSearch } from './cli/search.js';
import { EXIT_CODES, ConfigurationError } from './config.js';

function parseArgs(): { query: string; options: Record<string, any> } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('RAG-lite TS Document Search');
    console.error('');
    console.error('Usage: node search.js <query> [options]');
    console.error('');
    console.error('Arguments:');
    console.error('  <query>    Search query (wrap in quotes if it contains spaces)');
    console.error('');
    console.error('Options:');
    console.error('  --top-k <number>    Number of results to return (default: 10, max: 100)');
    console.error('  --rerank           Enable reranking for better results');
    console.error('  --no-rerank        Disable reranking');
    console.error('');
    console.error('Examples:');
    console.error('  node search.js "machine learning"');
    console.error('  node search.js "API documentation" --top-k 10');
    console.error('  node search.js "tutorial" --rerank');
    console.error('  node search.js "how to install" --top-k 20 --rerank');
    console.error('');
    console.error('Note: Make sure you have ingested documents first using:');
    console.error('  node indexer.js <path>');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  
  const queryParts: string[] = [];
  const options: Record<string, any> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--top-k') {
      const nextArg = args[i + 1];
      if (!nextArg) {
        console.error('Error: --top-k requires a numeric value');
        console.error('');
        console.error('Examples:');
        console.error('  --top-k 5     # Return 5 results');
        console.error('  --top-k 20    # Return 20 results');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      const topK = parseInt(nextArg, 10);
      if (isNaN(topK) || topK <= 0) {
        console.error('Error: --top-k must be a positive number');
        console.error('');
        console.error('Examples:');
        console.error('  --top-k 5     # Return 5 results');
        console.error('  --top-k 20    # Return 20 results');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      if (topK > 100) {
        console.warn(`Warning: Large --top-k value (${topK}) may impact performance. Consider using a smaller value.`);
      }
      
      options['top-k'] = topK;
      i++; // Skip next argument
    } else if (arg === '--rerank') {
      options.rerank = true;
    } else if (arg === '--no-rerank') {
      options.rerank = false;
    } else if (arg === '--help' || arg === '-h') {
      // Re-show help and exit
      parseArgs();
    } else if (arg.startsWith('--')) {
      console.error(`Error: Unknown option '${arg}'`);
      console.error('');
      console.error('Available options:');
      console.error('  --top-k <number>    Number of results to return');
      console.error('  --rerank           Enable reranking');
      console.error('  --no-rerank        Disable reranking');
      console.error('  --help, -h         Show this help');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    } else {
      queryParts.push(arg);
    }
  }
  
  const query = queryParts.join(' ');
  if (!query.trim()) {
    console.error('Error: Query cannot be empty');
    console.error('');
    console.error('Please provide a search query:');
    console.error('  node search.js "your search terms"');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  
  if (query.trim().length > 500) {
    console.error('Error: Query is too long (maximum 500 characters)');
    console.error('');
    console.error('Please use a shorter, more specific query.');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  
  return { query, options };
}

async function main(): Promise<void> {
  const { query, options } = parseArgs();
  await runSearch(query, options);
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