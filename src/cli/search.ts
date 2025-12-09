import { existsSync, statSync } from 'fs';
import { extname } from 'path';
import { SearchFactory } from '../factories/search-factory.js';
import { withCLIDatabaseAccess, setupCLICleanup } from '../core/cli-database-utils.js';
import { config, EXIT_CODES, ConfigurationError } from '../core/config.js';
import type { SearchOptions } from '../core/types.js';

/**
 * Detect if query is an image file path
 * @param query - Query string to check
 * @returns True if query is a valid image file path
 */
function isImageFile(query: string): boolean {
  // Check if file exists
  if (!existsSync(query)) {
    return false;
  }
  
  // Check if it's a file (not a directory)
  try {
    const stats = statSync(query);
    if (!stats.isFile()) {
      return false;
    }
  } catch {
    return false;
  }
  
  // Check file extension
  const ext = extname(query).toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  return imageExtensions.includes(ext);
}

/**
 * Run search from CLI
 * @param query - Search query string or image file path
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
      console.error('       raglite search <image-path>');
      console.error('');
      console.error('Examples:');
      console.error('  raglite search "machine learning"');
      console.error('  raglite search "how to install"');
      console.error('  raglite search ./photo.jpg');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    // Detect if query is an image file
    const isImage = isImageFile(query);
    
    // Validate query length for text queries
    if (!isImage && query.trim().length > 500) {
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

    // Display search type
    if (isImage) {
      console.log(`Searching with image: "${query}"`);
    } else {
      console.log(`Searching for: "${query}"`);
    }
    console.log('');

    // Setup graceful cleanup
    setupCLICleanup(effectiveConfig.db_file);

    // Initialize search engine using polymorphic factory with database protection
    let searchEngine;
    let embedder;
    
    try {
      // Create search engine using SearchFactory (auto-detects mode)
      searchEngine = await withCLIDatabaseAccess(
        effectiveConfig.db_file,
        () => SearchFactory.create(
          effectiveConfig.index_file,
          effectiveConfig.db_file
        ),
        {
          commandName: 'Search command',
          showProgress: true
        }
      );
      
      // For image queries, we need to check if the mode supports images
      if (isImage) {
        // Get system info to check mode
        const { ModeDetectionService } = await import('../core/mode-detection-service.js');
        const modeService = new ModeDetectionService(effectiveConfig.db_file);
        const systemInfo = await modeService.detectMode();
        
        if (systemInfo.mode !== 'multimodal') {
          console.error('Error: Image search is only supported in multimodal mode');
          console.error('');
          console.error('Your database is configured for text-only mode.');
          console.error('To enable image search:');
          console.error('1. Re-ingest your documents with multimodal mode:');
          console.error('   raglite ingest <path> --mode multimodal');
          console.error('2. Then search with images:');
          console.error('   raglite search ./photo.jpg');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        // Create embedder for image embedding
        const { createEmbedder } = await import('../core/embedder-factory.js');
        embedder = await createEmbedder(systemInfo.modelName);
        
        // Check if embedder supports images
        const { supportsImages } = await import('../core/universal-embedder.js');
        if (!supportsImages(embedder)) {
          console.error('Error: The current model does not support image embedding');
          console.error('');
          console.error(`Model: ${systemInfo.modelName}`);
          console.error('Image search requires a multimodal model like CLIP.');
          process.exit(EXIT_CODES.MODEL_ERROR);
        }
      }
      
      // Prepare search options
      const searchOptions: SearchOptions = {};

      if (options['top-k'] !== undefined) {
        searchOptions.top_k = options['top-k'];
      }

      // Phase 2: Disable reranking for image-to-image searches to preserve visual similarity
      let rerankingForciblyDisabled = false;
      if (isImage && embedder) {
        // Force disable reranking for image searches, regardless of user setting
        searchOptions.rerank = false;
        rerankingForciblyDisabled = true;

        // Warn user if they tried to enable reranking for image search
        if (options.rerank === true) {
          console.warn('⚠️  Reranking is disabled for image-to-image search to preserve visual similarity.');
          console.warn('   Image-to-image search uses CLIP embeddings for direct visual matching.');
          console.warn('   For text-to-image search, use: raglite search "description" --rerank');
          console.warn('');
        }
      } else {
        // For text searches, use user setting (defaults to false from Phase 1)
        if (options.rerank !== undefined) {
          searchOptions.rerank = options.rerank;
        }
      }

      // Track whether reranking will actually be used in this search
      const rerankingUsed = searchOptions.rerank === true;
      
      // Perform search
      const startTime = Date.now();
      let results;

      if (isImage && embedder) {
        // Image-based search: embed the image and search with the vector
        console.log('Embedding image...');
        const imageEmbedding = await embedder.embedImage!(query);
        console.log('Searching with image embedding...');
        results = await searchEngine.searchWithVector(imageEmbedding.vector, searchOptions);
      } else {
        // Text-based search
        results = await searchEngine.search(query, searchOptions);
      }
      
      const searchTime = Date.now() - startTime;
      
      // Apply content type filter if specified
      const contentTypeFilter = options['content-type'];
      if (contentTypeFilter && contentTypeFilter !== 'all') {
        const originalCount = results.length;
        results = results.filter(r => r.contentType === contentTypeFilter);
        
        if (results.length < originalCount) {
          console.log(`Filtered to ${results.length} ${contentTypeFilter} result${results.length === 1 ? '' : 's'} (from ${originalCount} total)`);
          console.log('');
        }
      }
      
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
          // Add content type icon for visual distinction
          const contentTypeIcon = result.contentType === 'image' ? '🖼️ ' : '📄 ';
          const contentTypeLabel = result.contentType === 'image' ? '[IMAGE]' : '[TEXT]';
          
          console.log(`${index + 1}. ${contentTypeIcon}${result.document.title}`);
          console.log(`   Source: ${result.document.source}`);
          console.log(`   Type: ${contentTypeLabel}`);
          console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
          
          // Display content differently based on type
          if (result.contentType === 'image') {
            // For images, show metadata if available
            if (result.metadata?.description) {
              console.log(`   Description: ${truncateText(result.metadata.description, 200)}`);
            }
            if (result.metadata?.dimensions) {
              console.log(`   Dimensions: ${result.metadata.dimensions}`);
            }
            if (result.metadata?.format) {
              console.log(`   Format: ${result.metadata.format}`);
            }
          } else {
            // For text, show content preview
            console.log(`   Text: ${truncateText(result.content, 200)}`);
          }
          console.log('');
        });
        
        // Show search statistics
        const stats = await searchEngine.getStats();
        console.log('─'.repeat(50));
        console.log(`Search completed in ${searchTime}ms`);
        console.log(`Searched ${stats.totalChunks} chunks`);
        if (rerankingUsed) {
          console.log('Reranking: enabled');
        } else if (rerankingForciblyDisabled) {
          console.log('Reranking: disabled');
        } else if (stats.rerankingEnabled) {
          console.log('Reranking: available (not used)');
        } else {
          console.log('Reranking: disabled');
        }
      }
      
    } finally {
      // Cleanup resources
      if (embedder) {
        await embedder.cleanup();
      }
      if (searchEngine) {
        await searchEngine.cleanup();
      }
      
      // Ensure clean exit for CLI commands
      const { DatabaseConnectionManager } = await import('../core/database-connection-manager.js');
      await DatabaseConnectionManager.closeAllConnections();
      
      // Force exit for CLI commands to prevent hanging
      setTimeout(() => {
        process.exit(0);
      }, 100);
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