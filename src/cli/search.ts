import { existsSync } from 'fs';
import { TextSearchFactory } from '../factories/text-factory.js';
import { config, EXIT_CODES, ConfigurationError } from '../core/config.js';
import type { SearchOptions } from '../core/types.js';

/**
 * Run search from CLI
 * @param query - Search query string
 * @param options - CLI options including top-k and rerank settings
 */
export async function runSearch(query: string, options: Record<string, any> = {}): Promise<void> {
  try {
    // Search uses the model that was used during ingestion (stored in database)
    const effectiveConfig = config;
    
    // Validate query
    if (!query || query.trim().length === 0) {
      console.error('Error: Search query cannot be empty');
      console.error('');
      console.error('Usage: raglite search <query>');
      console.error('');
      console.error('Examples:');
      console.error('  raglite search "machine learning"');
      console.error('  raglite search "how to install"');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    // Validate query length
    if (query.trim().length > 500) {
      console.error('Error: Search query is too long (maximum 500 characters)');
      console.error('');
      console.error('Please use a shorter, more specific query.');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    // Check if database exists
    if (!existsSync(effectiveConfig.db_file)) {
      console.error('Error: No database found. You need to ingest documents first.');
      console.error('');
      console.error('To get started:');
      console.error('1. First ingest your documents: raglite ingest <path>');
      console.error('2. Then search: raglite search "your query"');
      console.error('');
      console.error('Examples:');
      console.error('  raglite ingest ./docs/           # Ingest all .md/.txt files');
      console.error('  raglite search "machine learning" # Search your documents');
      process.exit(EXIT_CODES.FILE_NOT_FOUND);
    }

    // Check if vector index exists
    if (!existsSync(effectiveConfig.index_file)) {
      console.error('Error: No vector index found. The ingestion may not have completed successfully.');
      console.error('');
      console.error('To fix this:');
      console.error('1. Try re-ingesting: raglite ingest <path>');
      console.error('2. Or rebuild the index: raglite rebuild');
      console.error('');
      console.error('If the problem persists, check that your documents were processed correctly.');
      process.exit(EXIT_CODES.INDEX_ERROR);
    }

    console.log(`Searching for: "${query}"`);
    console.log('');

    // Initialize search engine using factory
    let searchEngine;
    
    try {
      // Prepare factory options
      const factoryOptions = {
        enableReranking: options.rerank !== undefined ? options.rerank : effectiveConfig.rerank_enabled
      };

      // Create search engine using TextSearchFactory
      searchEngine = await TextSearchFactory.create(
        effectiveConfig.index_file,
        effectiveConfig.db_file,
        factoryOptions
      );
      
      // Prepare search options
      const searchOptions: SearchOptions = {};
      
      if (options['top-k'] !== undefined) {
        searchOptions.top_k = options['top-k'];
      }
      
      if (options.rerank !== undefined) {
        searchOptions.rerank = options.rerank;
      }
      
      // Perform search
      const startTime = Date.now();
      const results = await searchEngine.search(query, searchOptions);
      const searchTime = Date.now() - startTime;
      
      // Display results
      if (results.length === 0) {
        console.log('No results found.');
        console.log('\nTips:');
        console.log('- Try different keywords or phrases');
        console.log('- Make sure you have ingested relevant documents');
        console.log('- Check if your query matches the content of your documents');
      } else {
        console.log(`Found ${results.length} result${results.length === 1 ? '' : 's'} in ${searchTime}ms:\n`);
        
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.document.title}`);
          console.log(`   Source: ${result.document.source}`);
          console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
          console.log(`   Text: ${truncateText(result.content, 200)}`);
          console.log('');
        });
        
        // Show search statistics
        const stats = await searchEngine.getStats();
        console.log('─'.repeat(50));
        console.log(`Search completed in ${searchTime}ms`);
        console.log(`Searched ${stats.totalChunks} chunks`);
        if (stats.rerankingEnabled) {
          console.log('Reranking: enabled');
        }
      }
      
    } finally {
      // Cleanup resources
      if (searchEngine) {
        await searchEngine.cleanup();
      }
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('SEARCH FAILED');
    console.error('='.repeat(50));
    
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:');
      console.error(error.message);
      process.exit(error.exitCode);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('');
      
      if (error.message.includes('SQLITE') || error.message.includes('database')) {
        console.error('Database Error:');
        console.error('- The database may be corrupted or inaccessible');
        console.error('- Try rebuilding the index: raglite rebuild');
        console.error('- Ensure the database file is not locked by another process');
        console.error('- Check file permissions and available disk space');
        process.exit(EXIT_CODES.DATABASE_ERROR);
      } else if (error.message.includes('model') || error.message.includes('ONNX')) {
        console.error('Model Error:');
        console.error('- The embedding model failed to load');
        console.error('- Try restarting the search command');
        console.error('- Ensure you have internet connection for model download');
        console.error('- Check available disk space in the models directory');
        process.exit(EXIT_CODES.MODEL_ERROR);
      } else if (error.message.includes('index') || error.message.includes('vector')) {
        console.error('Vector Index Error:');
        console.error('- The vector index may be corrupted or incompatible');
        console.error('- Try rebuilding the index: raglite rebuild');
        console.error('- Ensure the index file is not corrupted');
        console.error('- Check available disk space');
        process.exit(EXIT_CODES.INDEX_ERROR);
      } else if (error.message.includes('not initialized') || error.message.includes('empty')) {
        console.error('No Data Found:');
        console.error('- Make sure you have ingested documents first');
        console.error('- Run: raglite ingest <path>');
        console.error('- Check that your documents contain searchable text');
        console.error('- Verify documents are in supported formats (.md, .txt)');
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      } else {
        console.error('General Error:');
        console.error('- An unexpected error occurred during search');
        console.error('- Try running the search again');
        console.error('- If the problem persists, try: raglite rebuild');
        console.error('- Check that your query is valid and not too complex');
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    } else {
      console.error('Unknown error:', String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}

/**
 * Truncate text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to break at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
}