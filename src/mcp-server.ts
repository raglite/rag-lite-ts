#!/usr/bin/env node

/**
 * MCP server entry point for rag-lite-ts
 * 
 * This is a thin wrapper around existing search and indexing functions
 * that exposes them as MCP tools without creating REST/GraphQL endpoints.
 * 
 * The MCP server lives in the same package as CLI with dual entry points
 * and provides proper MCP tool definitions for search and indexing capabilities.
 * 
 * Requirements addressed: 6.2, 6.4, 6.5, 6.6
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { TextSearchFactory, TextIngestionFactory } from './factories/text-factory.js';
import type { SearchEngine } from './core/search.js';

import { openDatabase } from './core/db.js';
import { config, validateCoreConfig, ConfigurationError } from './core/config.js';
import type { SearchOptions } from './core/types.js';

/**
 * MCP Server class that wraps RAG-lite TS functionality
 * Implements MCP protocol interface without creating REST/GraphQL endpoints
 */
class RagLiteMCPServer {
  private server: Server;
  private searchEngine: SearchEngine | null = null;
  private isSearchEngineInitialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'rag-lite-ts',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  /**
   * Set up MCP tool handlers for search and indexing capabilities
   * Add proper MCP tool definitions for search and indexing capabilities
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search',
            description: 'Search indexed documents using semantic similarity. Returns relevant document chunks with scores and metadata.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string to find relevant documents',
                  minLength: 1,
                  maxLength: 500
                },
                top_k: {
                  type: 'number',
                  description: 'Number of results to return (default: 10, max: 100)',
                  minimum: 1,
                  maximum: 100,
                  default: 10
                },
                rerank: {
                  type: 'boolean',
                  description: 'Enable reranking for better result quality (default: false)',
                  default: false
                }
              },
              required: ['query'],
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'ingest',
            description: 'Ingest documents from a file or directory path. Processes .md and .txt files, chunks them, generates embeddings, and stores in the search index.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'File or directory path to ingest. Can be a single .md/.txt file or directory containing such files.'
                },
                model: {
                  type: 'string',
                  description: 'Embedding model to use (default: sentence-transformers/all-MiniLM-L6-v2). Options: sentence-transformers/all-MiniLM-L6-v2, Xenova/all-mpnet-base-v2',
                  enum: ['sentence-transformers/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2']
                },
                force_rebuild: {
                  type: 'boolean',
                  description: 'Force rebuild of the entire index (default: false)',
                  default: false
                }
              },
              required: ['path'],
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'rebuild_index',
            description: 'Rebuild the entire vector index from scratch. Useful when model version changes or for maintenance. This will regenerate all embeddings.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'get_stats',
            description: 'Get statistics about the current search index including number of documents, chunks, and index status.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          } as Tool
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search':
            return await this.handleSearch(args);
          case 'ingest':
            return await this.handleIngest(args);
          case 'rebuild_index':
            return await this.handleRebuildIndex(args);
          case 'get_stats':
            return await this.handleGetStats(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  /**
   * Handle search tool calls
   * Wraps existing search functionality as MCP tool
   */
  private async handleSearch(args: any) {
    try {
      // Validate arguments
      if (!args.query || typeof args.query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      if (args.query.trim().length === 0) {
        throw new Error('Query cannot be empty');
      }

      if (args.query.length > 500) {
        throw new Error('Query is too long (maximum 500 characters)');
      }

      // Validate optional parameters
      if (args.top_k !== undefined) {
        if (typeof args.top_k !== 'number' || args.top_k < 1 || args.top_k > 100) {
          throw new Error('top_k must be a number between 1 and 100');
        }
      }

      if (args.rerank !== undefined && typeof args.rerank !== 'boolean') {
        throw new Error('rerank must be a boolean');
      }

      // Check if database and index exist
      if (!existsSync(config.db_file)) {
        throw new Error('No database found. You need to ingest documents first using the ingest tool.');
      }

      if (!existsSync(config.index_file)) {
        throw new Error('No vector index found. The ingestion may not have completed successfully. Try using the ingest tool or rebuild_index tool.');
      }

      // Initialize search engine if needed
      if (!this.isSearchEngineInitialized) {
        await this.initializeSearchEngine();
      }

      // Prepare search options
      const searchOptions: SearchOptions = {
        top_k: args.top_k || config.top_k || 10,
        rerank: args.rerank !== undefined ? args.rerank : config.rerank_enabled
      };

      // Perform search using existing search functionality
      const startTime = Date.now();
      const results = await this.searchEngine!.search(args.query, searchOptions);
      const searchTime = Date.now() - startTime;

      // Format results for MCP response
      const formattedResults = {
        query: args.query,
        results_count: results.length,
        search_time_ms: searchTime,
        results: results.map((result, index) => ({
          rank: index + 1,
          score: Math.round(result.score * 100) / 100, // Round to 2 decimal places
          document: {
            id: result.document.id,
            title: result.document.title,
            source: result.document.source
          },
          text: result.content
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2),
          },
        ],
      };

    } catch (error) {
      // Handle model mismatch errors specifically
      if (error instanceof Error && error.message.includes('Model mismatch detected')) {
        const modelMismatchError = {
          error: 'MODEL_MISMATCH',
          message: 'Cannot perform search due to model mismatch',
          details: error.message,
          resolution: {
            action: 'manual_intervention_required',
            explanation: 'The embedding model configuration does not match the indexed data. Please verify your setup before proceeding.',
            options: [
              'Check if the model mismatch is intentional',
              'If you want to use a different model, manually run the rebuild_index tool',
              'Verify your model configuration matches your indexing setup'
            ],
            warning: 'Rebuilding will regenerate all embeddings and may take significant time'
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(modelMismatchError, null, 2),
            },
          ],
        };
      }

      // Handle dimension mismatch errors
      if (error instanceof Error && error.message.includes('dimension mismatch')) {
        const dimensionMismatchError = {
          error: 'DIMENSION_MISMATCH',
          message: 'Cannot perform search due to vector dimension mismatch',
          details: error.message,
          resolution: {
            action: 'manual_intervention_required',
            explanation: 'The vector dimensions do not match between the current model and the indexed data. Please verify your setup before proceeding.',
            options: [
              'Check your model configuration',
              'If you want to change models, manually run the rebuild_index tool',
              'Ensure consistency between indexing and search models'
            ],
            warning: 'Rebuilding will regenerate all embeddings and may take significant time'
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dimensionMismatchError, null, 2),
            },
          ],
        };
      }

      // Re-throw other errors to be handled by the main error handler
      throw error;
    }
  }

  /**
   * Handle ingest tool calls
   * Wraps existing ingestion functionality as MCP tool
   */
  private async handleIngest(args: any) {
    try {
      // Validate arguments
      if (!args.path || typeof args.path !== 'string') {
        throw new Error('Path parameter is required and must be a string');
      }

      // Validate path exists
      const resolvedPath = resolve(args.path);
      if (!existsSync(resolvedPath)) {
        throw new Error(`Path does not exist: ${args.path}`);
      }

      // Check if it's a file or directory and validate
      let stats;
      try {
        stats = statSync(resolvedPath);
      } catch (error) {
        throw new Error(`Cannot access path: ${args.path}. Check permissions.`);
      }

      // Validate file type for single files
      if (stats.isFile()) {
        const validExtensions = ['.md', '.txt'];
        const hasValidExtension = validExtensions.some(ext =>
          args.path.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          throw new Error(`Unsupported file type: ${args.path}. Supported types: .md, .txt`);
        }
      }

      // Validate model parameter if provided
      if (args.model && !['sentence-transformers/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'].includes(args.model)) {
        throw new Error(`Unsupported model: ${args.model}. Supported models: sentence-transformers/all-MiniLM-L6-v2, Xenova/all-mpnet-base-v2`);
      }

      // Prepare factory options
      const factoryOptions: any = {};
      if (args.model) {
        factoryOptions.embeddingModel = args.model;
      }
      if (args.force_rebuild) {
        factoryOptions.forceRebuild = true;
      }

      // Create and run ingestion pipeline using factory
      const pipeline = await TextIngestionFactory.create(
        config.db_file,
        config.index_file,
        factoryOptions
      );

      try {
        const result = await pipeline.ingestPath(resolvedPath);

        // Reset search engine initialization flag since index may have changed
        this.isSearchEngineInitialized = false;
        this.searchEngine = null;

        // Format results for MCP response
        const ingestionSummary = {
          path: resolvedPath,
          path_type: stats.isDirectory() ? 'directory' : 'file',
          documents_processed: result.documentsProcessed,
          chunks_created: result.chunksCreated,
          embeddings_generated: result.embeddingsGenerated,
          document_errors: result.documentErrors,
          embedding_errors: result.embeddingErrors,
          processing_time_ms: result.processingTimeMs,
          processing_time_seconds: Math.round(result.processingTimeMs / 1000 * 100) / 100,
          chunks_per_second: result.processingTimeMs > 0 ?
            Math.round(result.chunksCreated / (result.processingTimeMs / 1000) * 100) / 100 : 0,
          success: true
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ingestionSummary, null, 2),
            },
          ],
        };

      } finally {
        await pipeline.cleanup();
      }

    } catch (error) {
      // Handle model mismatch errors specifically
      if (error instanceof Error && error.message.includes('Model mismatch detected')) {
        const modelMismatchError = {
          error: 'MODEL_MISMATCH',
          message: 'Cannot perform ingestion due to model mismatch',
          details: error.message,
          resolution: {
            action: 'manual_intervention_required',
            explanation: 'The embedding model configuration does not match the indexed data. Please verify your setup before proceeding.',
            options: [
              'Check if the model mismatch is intentional',
              'If you want to use a different model, manually run the rebuild_index tool',
              'Use force_rebuild: true parameter if you want to rebuild during ingestion',
              'Verify your model configuration matches your indexing setup'
            ],
            warning: 'Rebuilding will regenerate all embeddings and may take significant time'
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(modelMismatchError, null, 2),
            },
          ],
        };
      }

      // Handle dimension mismatch errors
      if (error instanceof Error && error.message.includes('dimension mismatch')) {
        const dimensionMismatchError = {
          error: 'DIMENSION_MISMATCH',
          message: 'Cannot perform ingestion due to vector dimension mismatch',
          details: error.message,
          resolution: {
            action: 'manual_intervention_required',
            explanation: 'The vector dimensions do not match between the current model and the indexed data. Please verify your setup before proceeding.',
            options: [
              'Check your model configuration',
              'If you want to change models, manually run the rebuild_index tool',
              'Use force_rebuild: true parameter if you want to rebuild during ingestion',
              'Ensure consistency between indexing and search models'
            ],
            warning: 'Rebuilding will regenerate all embeddings and may take significant time'
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dimensionMismatchError, null, 2),
            },
          ],
        };
      }

      // Handle initialization errors that might contain model mismatch information
      if (error instanceof Error && error.message.includes('Failed to initialize')) {
        // Check if the underlying error is a model mismatch
        if (error.message.includes('Model mismatch') || error.message.includes('dimension mismatch')) {
          const initializationError = {
            error: 'INITIALIZATION_FAILED',
            message: 'Cannot initialize ingestion due to model compatibility issues',
            details: error.message,
            resolution: {
              action: 'manual_intervention_required',
              explanation: 'The system cannot initialize due to model compatibility issues. Please verify your setup before proceeding.',
              options: [
                'Check your model configuration',
                'If you want to change models, manually run the rebuild_index tool',
                'Verify consistency between your indexing and search setup'
              ],
              warning: 'Rebuilding will regenerate all embeddings and may take significant time'
            }
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(initializationError, null, 2),
              },
            ],
          };
        }
      }

      // Re-throw other errors to be handled by the main error handler
      throw error;
    }
  }

  /**
   * Handle rebuild index tool calls
   * Wraps existing rebuild functionality as MCP tool
   */
  private async handleRebuildIndex(_args: any) {
    try {
      // Create ingestion pipeline with force rebuild using factory
      const pipeline = await TextIngestionFactory.create(
        config.db_file,
        config.index_file,
        { forceRebuild: true }
      );

      try {
        // Get all documents from database and re-ingest them
        const db = await openDatabase(config.db_file);
        
        try {
          const documents = await db.all('SELECT DISTINCT source FROM documents ORDER BY source');
          
          if (documents.length === 0) {
            throw new Error('No documents found in database. Nothing to rebuild.');
          }

          let totalResult = {
            documentsProcessed: 0,
            chunksCreated: 0,
            embeddingsGenerated: 0,
            documentErrors: 0,
            embeddingErrors: 0,
            processingTimeMs: 0
          };

          // Re-ingest each document
          for (const doc of documents) {
            if (existsSync(doc.source)) {
              const result = await pipeline.ingestFile(doc.source);
              
              totalResult.documentsProcessed += result.documentsProcessed;
              totalResult.chunksCreated += result.chunksCreated;
              totalResult.embeddingsGenerated += result.embeddingsGenerated;
              totalResult.documentErrors += result.documentErrors;
              totalResult.embeddingErrors += result.embeddingErrors;
              totalResult.processingTimeMs += result.processingTimeMs;
            } else {
              totalResult.documentErrors++;
            }
          }

          // Reset search engine initialization flag since index was rebuilt
          this.isSearchEngineInitialized = false;
          this.searchEngine = null;

          const rebuildSummary = {
            operation: 'rebuild_index',
            success: true,
            message: 'Vector index has been successfully rebuilt. All embeddings have been regenerated with the current model.',
            documents_processed: totalResult.documentsProcessed,
            chunks_created: totalResult.chunksCreated,
            embeddings_generated: totalResult.embeddingsGenerated,
            document_errors: totalResult.documentErrors,
            embedding_errors: totalResult.embeddingErrors,
            processing_time_ms: totalResult.processingTimeMs,
            processing_time_seconds: Math.round(totalResult.processingTimeMs / 1000 * 100) / 100
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(rebuildSummary, null, 2),
              },
            ],
          };

        } finally {
          await db.close();
        }
      } finally {
        await pipeline.cleanup();
      }

    } catch (error) {
      throw new Error(`Index rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle get stats tool calls
   * Provides statistics about the current search index
   */
  private async handleGetStats(_args: any) {
    try {
      const stats: any = {
        database_exists: existsSync(config.db_file),
        index_exists: existsSync(config.index_file),
        search_engine_initialized: this.isSearchEngineInitialized
      };

      // Get model information and compatibility status
      const { getModelDefaults } = await import('./config.js');
      const { getStoredModelInfo } = await import('./core/db.js');
      
      const currentModel = config.embedding_model;
      const currentDefaults = getModelDefaults(currentModel);
      
      stats.model_info = {
        current_model: currentModel,
        current_dimensions: currentDefaults.dimensions,
        model_specific_config: {
          chunk_size: currentDefaults.chunk_size,
          chunk_overlap: currentDefaults.chunk_overlap,
          batch_size: currentDefaults.batch_size
        }
      };

      // Check model compatibility if database exists
      if (stats.database_exists) {
        try {
          const db = await openDatabase(config.db_file);
          try {
            const storedModel = await getStoredModelInfo(db);
            
            if (storedModel) {
              stats.model_info.stored_model = storedModel.modelName;
              stats.model_info.stored_dimensions = storedModel.dimensions;
              
              // Check for compatibility issues
              const modelMatch = storedModel.modelName === currentModel;
              const dimensionMatch = storedModel.dimensions === currentDefaults.dimensions;
              
              stats.model_info.compatibility = {
                model_matches: modelMatch,
                dimensions_match: dimensionMatch,
                compatible: modelMatch && dimensionMatch
              };
              
              if (!stats.model_info.compatibility.compatible) {
                stats.model_info.compatibility.issue = 'Model mismatch detected - rebuild required';
                stats.model_info.compatibility.resolution = 'Run "npm run rebuild" to rebuild the index with the new model';
              }
            } else {
              stats.model_info.compatibility = {
                status: 'No stored model info - first run or needs rebuild'
              };
            }

            // Get basic database stats
            const docCount = await db.get('SELECT COUNT(*) as count FROM documents');
            const chunkCount = await db.get('SELECT COUNT(*) as count FROM chunks');
            stats.total_documents = docCount?.count || 0;
            stats.total_chunks = chunkCount?.count || 0;
          } finally {
            await db.close();
          }
        } catch (error) {
          stats.database_error = error instanceof Error ? error.message : 'Unknown error';
          stats.model_info.compatibility = {
            status: 'Error checking model compatibility',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        // No database exists - indicate this is a fresh setup
        stats.model_info.compatibility = {
          status: 'No database exists - fresh setup, no compatibility issues'
        };
      }

      // If search engine is initialized, get detailed stats
      if (this.isSearchEngineInitialized && this.searchEngine) {
        const searchStats = await this.searchEngine.getStats();
        stats.total_chunks = searchStats.totalChunks;
        stats.index_size = searchStats.indexSize;
        stats.reranking_enabled = searchStats.rerankingEnabled;
      }

      // Show effective configuration (with model-specific defaults applied)
      const effectiveConfig = {
        db_file: config.db_file,
        index_file: config.index_file,
        embedding_model: config.embedding_model,
        chunk_size: currentDefaults.chunk_size, // Use model-specific default
        chunk_overlap: currentDefaults.chunk_overlap, // Use model-specific default
        batch_size: currentDefaults.batch_size, // Use model-specific default
        top_k: config.top_k,
        rerank_enabled: config.rerank_enabled
      };

      stats.config = effectiveConfig;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };

    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize search engine components using factory
   * Lazy initialization to avoid startup overhead when not needed
   */
  private async initializeSearchEngine(): Promise<void> {
    if (this.isSearchEngineInitialized) {
      return;
    }

    try {
      // Validate configuration
      validateCoreConfig(config);

      // Create search engine using factory
      // Disable reranking by default in MCP server to avoid model loading issues
      this.searchEngine = await TextSearchFactory.create(
        config.index_file,
        config.db_file,
        { enableReranking: false }
      );

      this.isSearchEngineInitialized = true;

    } catch (error) {
      // Check if this is a model mismatch error and re-throw with more context
      if (error instanceof Error && (error.message.includes('Model mismatch detected') || error.message.includes('dimension mismatch'))) {
        // Re-throw the original error - it already has good formatting from factory
        throw error;
      }

      // For other initialization errors, provide a generic wrapper
      throw new Error(`Failed to initialize search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start the MCP server
   * Ensures MCP server lives in same package as CLI with dual entry points
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Server will run until the transport is closed
    console.error('RAG-lite TS MCP Server started successfully');
  }
}

/**
 * Main entry point for MCP server
 * Implements MCP protocol interface without creating REST/GraphQL endpoints
 */
async function main(): Promise<void> {
  try {
    const server = new RagLiteMCPServer();
    await server.start();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:', error.message);
      process.exit(error.exitCode);
    } else {
      console.error('Failed to start MCP server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});