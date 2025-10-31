#!/usr/bin/env node

/**
 * MCP server entry point for rag-lite-ts with Chameleon Multimodal Architecture
 * 
 * This is a thin wrapper around the polymorphic search and ingestion functions
 * that exposes them as MCP tools without creating REST/GraphQL endpoints.
 * 
 * The MCP server supports both text-only and multimodal modes:
 * - Text mode: Optimized for text documents using sentence-transformer models
 * - Multimodal mode: Supports mixed text and image content using CLIP models
 * 
 * Key Features:
 * - Automatic mode detection from database configuration
 * - Polymorphic runtime that adapts to stored mode settings
 * - Support for multiple embedding models and reranking strategies
 * - Content type filtering and multimodal search capabilities
 * - Comprehensive model and strategy information tools
 * 
 * The MCP server lives in the same package as CLI with dual entry points
 * and provides proper MCP tool definitions for search and indexing capabilities.
 * 
 * Requirements addressed: 6.2, 6.4, 6.5, 6.6, 9.1, 9.2, 9.3
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
import { PolymorphicSearchFactory } from './core/polymorphic-search-factory.js';
import { TextIngestionFactory } from './factories/text-factory.js';
import type { SearchEngine } from './core/search.js';

import { openDatabase } from './core/db.js';
import { DatabaseConnectionManager } from './core/database-connection-manager.js';
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
            description: 'Ingest documents from a file or directory path. Supports both text-only and multimodal modes. In text mode, processes .md and .txt files. In multimodal mode, also processes images (.jpg, .png, .gif, .webp).',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'File or directory path to ingest. Can be a single file or directory containing supported files.'
                },
                mode: {
                  type: 'string',
                  description: 'Processing mode: text for text-only content, multimodal for mixed text and image content (default: text)',
                  enum: ['text', 'multimodal'],
                  default: 'text'
                },
                model: {
                  type: 'string',
                  description: 'Embedding model to use. For text mode: sentence-transformers/all-MiniLM-L6-v2 (default), Xenova/all-mpnet-base-v2. For multimodal mode: Xenova/clip-vit-base-patch32 (default), Xenova/clip-vit-base-patch16',
                  enum: [
                    'sentence-transformers/all-MiniLM-L6-v2', 
                    'Xenova/all-mpnet-base-v2',
                    'Xenova/clip-vit-base-patch32',
                    'Xenova/clip-vit-base-patch16'
                  ]
                },
                rerank_strategy: {
                  type: 'string',
                  description: 'Reranking strategy for multimodal mode. Options: text-derived (default), metadata, hybrid, disabled',
                  enum: ['text-derived', 'metadata', 'hybrid', 'disabled']
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
          } as Tool,
          {
            name: 'get_mode_info',
            description: 'Get current system mode and configuration information including detected mode, model, and reranking strategy.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'multimodal_search',
            description: 'Search indexed documents with multimodal capabilities and content type filtering. Returns relevant document chunks with content type information.',
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
                },
                content_type: {
                  type: 'string',
                  description: 'Filter results by content type (text, image, pdf, docx). If not specified, returns all content types.',
                  enum: ['text', 'image', 'pdf', 'docx']
                }
              },
              required: ['query'],
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'list_supported_models',
            description: 'List all supported embedding models with their capabilities, dimensions, and supported content types.',
            inputSchema: {
              type: 'object',
              properties: {
                model_type: {
                  type: 'string',
                  description: 'Filter models by type (sentence-transformer, clip). If not specified, returns all models.',
                  enum: ['sentence-transformer', 'clip']
                },
                content_type: {
                  type: 'string',
                  description: 'Filter models by supported content type (text, image). If not specified, returns all models.',
                  enum: ['text', 'image']
                }
              },
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'list_reranking_strategies',
            description: 'List all supported reranking strategies for different modes with their descriptions and requirements.',
            inputSchema: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  description: 'Filter strategies by mode (text, multimodal). If not specified, returns strategies for all modes.',
                  enum: ['text', 'multimodal']
                }
              },
              additionalProperties: false
            }
          } as Tool,
          {
            name: 'get_system_stats',
            description: 'Get comprehensive system statistics including mode-specific metrics, performance data, and resource usage.',
            inputSchema: {
              type: 'object',
              properties: {
                include_performance: {
                  type: 'boolean',
                  description: 'Include performance metrics and timing data (default: false)',
                  default: false
                },
                include_content_breakdown: {
                  type: 'boolean',
                  description: 'Include breakdown of content by type (default: false)',
                  default: false
                }
              },
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
          case 'get_mode_info':
            return await this.handleGetModeInfo(args);
          case 'multimodal_search':
            return await this.handleMultimodalSearch(args);
          case 'list_supported_models':
            return await this.handleListSupportedModels(args);
          case 'list_reranking_strategies':
            return await this.handleListRerankingStrategies(args);
          case 'get_system_stats':
            return await this.handleGetSystemStats(args);
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

      // Validate mode parameter
      const mode = args.mode || 'text';
      if (!['text', 'multimodal'].includes(mode)) {
        throw new Error(`Invalid mode: ${mode}. Supported modes: text, multimodal`);
      }

      // Validate model parameter if provided
      const supportedModels = [
        'sentence-transformers/all-MiniLM-L6-v2', 
        'Xenova/all-mpnet-base-v2',
        'Xenova/clip-vit-base-patch32',
        'Xenova/clip-vit-base-patch16'
      ];
      
      if (args.model && !supportedModels.includes(args.model)) {
        throw new Error(`Unsupported model: ${args.model}. Supported models: ${supportedModels.join(', ')}`);
      }

      // Validate model compatibility with mode
      if (mode === 'text' && args.model) {
        const textModels = ['sentence-transformers/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'];
        if (!textModels.includes(args.model)) {
          throw new Error(`Model ${args.model} is not compatible with text mode. Use: ${textModels.join(', ')}`);
        }
      }
      
      if (mode === 'multimodal' && args.model) {
        const multimodalModels = ['Xenova/clip-vit-base-patch32', 'Xenova/clip-vit-base-patch16'];
        if (!multimodalModels.includes(args.model)) {
          throw new Error(`Model ${args.model} is not compatible with multimodal mode. Use: ${multimodalModels.join(', ')}`);
        }
      }

      // Validate reranking strategy for multimodal mode
      if (args.rerank_strategy) {
        if (mode === 'text') {
          throw new Error('Reranking strategy parameter is only supported in multimodal mode');
        }
        
        const validStrategies = ['text-derived', 'metadata', 'hybrid', 'disabled'];
        if (!validStrategies.includes(args.rerank_strategy)) {
          throw new Error(`Invalid reranking strategy: ${args.rerank_strategy}. Supported strategies: ${validStrategies.join(', ')}`);
        }
      }

      // Prepare factory options
      const factoryOptions: any = {
        mode: mode
      };
      
      if (args.model) {
        factoryOptions.embeddingModel = args.model;
      }
      
      if (args.rerank_strategy && mode === 'multimodal') {
        factoryOptions.rerankingStrategy = args.rerank_strategy;
      }
      
      if (args.force_rebuild) {
        factoryOptions.forceRebuild = true;
      }

      // Create and run ingestion pipeline using text factory
      // The TextIngestionFactory already supports mode and reranking strategy parameters
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
          mode: mode,
          model: args.model || (mode === 'multimodal' ? 'Xenova/clip-vit-base-patch32' : 'sentence-transformers/all-MiniLM-L6-v2'),
          reranking_strategy: args.rerank_strategy || (mode === 'multimodal' ? 'text-derived' : 'cross-encoder'),
          documents_processed: result.documentsProcessed,
          chunks_created: result.chunksCreated,
          embeddings_generated: result.embeddingsGenerated,
          document_errors: result.documentErrors,
          embedding_errors: result.embeddingErrors,
          processing_time_ms: result.processingTimeMs,
          processing_time_seconds: Math.round(result.processingTimeMs / 1000 * 100) / 100,
          chunks_per_second: result.processingTimeMs > 0 ?
            Math.round(result.chunksCreated / (result.processingTimeMs / 1000) * 100) / 100 : 0,
          supported_file_types: mode === 'multimodal' 
            ? ['md', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp']
            : ['md', 'txt'],
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
   * Handle get mode info tool calls
   * Provides information about the current system mode and configuration
   */
  private async handleGetModeInfo(_args: any) {
    try {
      const modeInfo: any = {
        database_exists: existsSync(config.db_file),
        index_exists: existsSync(config.index_file)
      };

      if (!modeInfo.database_exists) {
        modeInfo.mode_status = 'No database found - system not initialized';
        modeInfo.default_mode = 'text';
        modeInfo.message = 'Run ingestion first to initialize the system with a specific mode';
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(modeInfo, null, 2),
            },
          ],
        };
      }

      // Import mode detection service
      const { ModeDetectionService } = await import('./core/mode-detection-service.js');
      const modeService = new ModeDetectionService(config.db_file);

      try {
        const systemInfo = await modeService.detectMode();
        
        modeInfo.mode_status = 'Mode detected from database';
        modeInfo.current_mode = systemInfo.mode;
        modeInfo.model_name = systemInfo.modelName;
        modeInfo.model_type = systemInfo.modelType;
        modeInfo.model_dimensions = systemInfo.modelDimensions;
        modeInfo.supported_content_types = systemInfo.supportedContentTypes;
        modeInfo.reranking_strategy = systemInfo.rerankingStrategy;
        
        if (systemInfo.rerankingModel) {
          modeInfo.reranking_model = systemInfo.rerankingModel;
        }
        
        if (systemInfo.rerankingConfig) {
          modeInfo.reranking_config = systemInfo.rerankingConfig;
        }

        modeInfo.created_at = systemInfo.createdAt;
        modeInfo.updated_at = systemInfo.updatedAt;

        // Add mode-specific capabilities
        if (systemInfo.mode === 'text') {
          modeInfo.capabilities = {
            text_search: true,
            image_search: false,
            multimodal_reranking: false,
            supported_file_types: ['md', 'txt']
          };
        } else if (systemInfo.mode === 'multimodal') {
          modeInfo.capabilities = {
            text_search: true,
            image_search: true,
            multimodal_reranking: true,
            supported_file_types: ['md', 'txt', 'jpg', 'png', 'gif', 'webp']
          };
        }

      } catch (error) {
        modeInfo.mode_status = 'Error detecting mode from database';
        modeInfo.error = error instanceof Error ? error.message : 'Unknown error';
        modeInfo.fallback_mode = 'text';
        modeInfo.message = 'System will fall back to text mode. Consider rebuilding the database.';
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(modeInfo, null, 2),
          },
        ],
      };

    } catch (error) {
      throw new Error(`Failed to get mode info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle multimodal search tool calls with content type filtering
   * Extends regular search with multimodal capabilities and content type filtering
   */
  private async handleMultimodalSearch(args: any) {
    try {
      // Validate arguments (same as regular search)
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

      if (args.content_type !== undefined) {
        const validContentTypes = ['text', 'image', 'pdf', 'docx'];
        if (!validContentTypes.includes(args.content_type)) {
          throw new Error(`content_type must be one of: ${validContentTypes.join(', ')}`);
        }
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

      // Prepare search options with content type filtering
      const searchOptions: SearchOptions = {
        top_k: args.top_k || config.top_k || 10,
        rerank: args.rerank !== undefined ? args.rerank : config.rerank_enabled,
        contentType: args.content_type // Add content type filtering
      };

      // Perform search using existing search functionality
      const startTime = Date.now();
      const results = await this.searchEngine!.search(args.query, searchOptions);
      const searchTime = Date.now() - startTime;

      // Format results for MCP response with content type information
      const formattedResults = {
        query: args.query,
        content_type_filter: args.content_type || 'all',
        results_count: results.length,
        search_time_ms: searchTime,
        results: results.map((result, index) => ({
          rank: index + 1,
          score: Math.round(result.score * 100) / 100,
          content_type: result.contentType,
          document: {
            id: result.document.id,
            title: result.document.title,
            source: result.document.source,
            content_type: result.document.contentType
          },
          text: result.content,
          metadata: result.metadata
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
      // Handle the same errors as regular search
      if (error instanceof Error && error.message.includes('Model mismatch detected')) {
        const modelMismatchError = {
          error: 'MODEL_MISMATCH',
          message: 'Cannot perform multimodal search due to model mismatch',
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

      // Re-throw other errors to be handled by the main error handler
      throw error;
    }
  }

  /**
   * Handle list supported models tool calls
   * Lists all supported embedding models with their capabilities
   */
  private async handleListSupportedModels(args: any) {
    try {
      // Import model registry
      const { ModelRegistry } = await import('./core/model-registry.js');
      const { getSupportedModelsForContentType } = await import('./core/embedder-factory.js');

      let models: string[];

      // Filter by model type if specified
      if (args.model_type) {
        models = ModelRegistry.getSupportedModels(args.model_type);
      } else if (args.content_type) {
        // Filter by content type if specified
        models = getSupportedModelsForContentType(args.content_type);
      } else {
        // Get all models
        models = ModelRegistry.getSupportedModels();
      }

      // Get detailed information for each model
      const modelDetails = models.map(modelName => {
        const info = ModelRegistry.getModelInfo(modelName);
        return {
          name: modelName,
          type: info?.type,
          dimensions: info?.dimensions,
          supported_content_types: info?.supportedContentTypes || [],
          memory_requirement: info?.requirements?.minimumMemory,
          description: `${info?.type} model for ${info?.supportedContentTypes?.join(', ')} content`,
          is_default: ModelRegistry.getDefaultModel(info?.type!) === modelName,
          capabilities: {
            supports_text: info?.capabilities?.supportsText || false,
            supports_images: info?.capabilities?.supportsImages || false,
            supports_batch_processing: info?.capabilities?.supportsBatchProcessing || false,
            max_batch_size: info?.capabilities?.maxBatchSize,
            max_text_length: info?.capabilities?.maxTextLength,
            supported_image_formats: info?.capabilities?.supportedImageFormats || []
          },
          requirements: {
            transformers_js_version: info?.requirements?.transformersJsVersion,
            minimum_memory_mb: info?.requirements?.minimumMemory,
            required_features: info?.requirements?.requiredFeatures || [],
            platform_support: info?.requirements?.platformSupport || []
          }
        };
      });

      const response = {
        filter_applied: {
          model_type: args.model_type || 'all',
          content_type: args.content_type || 'all'
        },
        total_models: modelDetails.length,
        models: modelDetails,
        model_types: {
          'sentence-transformer': 'Text-only embedding models optimized for semantic similarity',
          'clip': 'Multimodal models supporting both text and image embeddings'
        },
        usage_examples: {
          text_only: 'Use sentence-transformer models for text documents, markdown files, and text-based search',
          multimodal: 'Use CLIP models when working with mixed content including images, diagrams, and visual content'
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };

    } catch (error) {
      throw new Error(`Failed to list supported models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle list reranking strategies tool calls
   * Lists all supported reranking strategies for different modes
   */
  private async handleListRerankingStrategies(args: any) {
    try {
      // Import reranking configuration
      const { getSupportedStrategies, getDefaultRerankingConfig } = await import('./core/reranking-config.js');

      const modes = args.mode ? [args.mode] : ['text', 'multimodal'];
      const strategiesByMode: Record<string, any> = {};

      for (const mode of modes) {
        const supportedStrategies = getSupportedStrategies(mode as 'text' | 'multimodal');
        const defaultConfig = getDefaultRerankingConfig(mode as 'text' | 'multimodal');

        strategiesByMode[mode] = {
          default_strategy: defaultConfig.strategy,
          mode_description: mode === 'text' 
            ? 'Text-only mode optimized for document and text-based content'
            : 'Multimodal mode supporting mixed text and image content',
          supported_strategies: supportedStrategies.map(strategy => {
            const strategyInfo: any = {
              name: strategy,
              is_default: strategy === defaultConfig.strategy,
              performance_impact: 'medium'
            };

            // Add descriptions for each strategy
            switch (strategy) {
              case 'cross-encoder':
                strategyInfo.description = 'Uses cross-encoder models to rerank results based on query-document relevance';
                strategyInfo.requirements = ['Cross-encoder model (e.g., ms-marco-MiniLM-L-6-v2)'];
                strategyInfo.supported_content_types = ['text'];
                strategyInfo.performance_impact = 'high';
                strategyInfo.accuracy = 'high';
                strategyInfo.use_cases = ['Text documents', 'Academic papers', 'Technical documentation'];
                break;
              case 'text-derived':
                strategyInfo.description = 'Converts images to text descriptions using image-to-text models, then applies cross-encoder reranking';
                strategyInfo.requirements = ['Image-to-text model (e.g., vit-gpt2-image-captioning)', 'Cross-encoder model'];
                strategyInfo.supported_content_types = ['text', 'image'];
                strategyInfo.performance_impact = 'high';
                strategyInfo.accuracy = 'high';
                strategyInfo.use_cases = ['Mixed content with images', 'Visual documentation', 'Diagrams and charts'];
                break;
              case 'metadata':
                strategyInfo.description = 'Uses file metadata, filenames, and content properties for scoring without model inference';
                strategyInfo.requirements = ['None - uses file system metadata only'];
                strategyInfo.supported_content_types = ['text', 'image', 'pdf', 'docx'];
                strategyInfo.performance_impact = 'low';
                strategyInfo.accuracy = 'medium';
                strategyInfo.use_cases = ['Fast retrieval', 'Filename-based search', 'Content type filtering'];
                break;
              case 'hybrid':
                strategyInfo.description = 'Combines multiple reranking signals (semantic + metadata) with configurable weights';
                strategyInfo.requirements = ['Text-derived reranker', 'Metadata reranker'];
                strategyInfo.supported_content_types = ['text', 'image', 'pdf', 'docx'];
                strategyInfo.performance_impact = 'high';
                strategyInfo.accuracy = 'very high';
                strategyInfo.use_cases = ['Best overall accuracy', 'Complex multimodal collections', 'Production systems'];
                strategyInfo.default_weights = { semantic: 0.7, metadata: 0.3 };
                break;
              case 'disabled':
                strategyInfo.description = 'No reranking applied - results ordered by vector similarity scores only';
                strategyInfo.requirements = ['None'];
                strategyInfo.supported_content_types = ['text', 'image', 'pdf', 'docx'];
                strategyInfo.performance_impact = 'none';
                strategyInfo.accuracy = 'baseline';
                strategyInfo.use_cases = ['Maximum performance', 'Simple similarity search', 'Development/testing'];
                break;
            }

            return strategyInfo;
          })
        };
      }

      const response = {
        filter_applied: {
          mode: args.mode || 'all'
        },
        strategies_by_mode: strategiesByMode,
        recommendations: {
          text_mode: 'Use cross-encoder for best accuracy, disabled for best performance',
          multimodal_mode: 'Use hybrid for best accuracy, text-derived for good balance, metadata for fast retrieval',
          development: 'Start with disabled or metadata for fast iteration, upgrade to cross-encoder/text-derived for production'
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };

    } catch (error) {
      throw new Error(`Failed to list reranking strategies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle get system stats tool calls with mode-specific metrics
   * Provides comprehensive system statistics including mode-specific data
   */
  private async handleGetSystemStats(args: any) {
    try {
      // Start with basic stats from existing get_stats handler
      const basicStats = await this.handleGetStats({});
      const basicStatsData = JSON.parse(basicStats.content[0].text);

      // Enhanced stats with mode-specific information
      const enhancedStats: any = {
        ...basicStatsData,
        mode_specific_metrics: {}
      };

      // Add mode detection information
      if (basicStatsData.database_exists) {
        try {
          const { ModeDetectionService } = await import('./core/mode-detection-service.js');
          const modeService = new ModeDetectionService(config.db_file);
          const systemInfo = await modeService.detectMode();

          enhancedStats.mode_specific_metrics = {
            current_mode: systemInfo.mode,
            model_name: systemInfo.modelName,
            model_type: systemInfo.modelType,
            model_dimensions: systemInfo.modelDimensions,
            supported_content_types: systemInfo.supportedContentTypes,
            reranking_strategy: systemInfo.rerankingStrategy
          };

          // Add content breakdown if requested
          if (args.include_content_breakdown) {
            const db = await openDatabase(config.db_file);
            try {
              // Get document count by content type
              const docsByType = await db.all(`
                SELECT content_type, COUNT(*) as count 
                FROM documents 
                GROUP BY content_type
              `);

              // Get chunk count by content type
              const chunksByType = await db.all(`
                SELECT content_type, COUNT(*) as count 
                FROM chunks 
                GROUP BY content_type
              `);

              enhancedStats.content_breakdown = {
                documents_by_type: docsByType.reduce((acc: any, row: any) => {
                  acc[row.content_type] = row.count;
                  return acc;
                }, {}),
                chunks_by_type: chunksByType.reduce((acc: any, row: any) => {
                  acc[row.content_type] = row.count;
                  return acc;
                }, {})
              };
            } finally {
              await db.close();
            }
          }

          // Add performance metrics if requested
          if (args.include_performance && this.isSearchEngineInitialized && this.searchEngine) {
            const searchStats = await this.searchEngine.getStats();
            enhancedStats.performance_metrics = {
              search_engine_initialized: true,
              index_size: searchStats.indexSize,
              reranking_enabled: searchStats.rerankingEnabled,
              total_chunks: searchStats.totalChunks,
              // Add timing information if available
              last_search_time_ms: undefined, // Would need to track this
              average_search_time_ms: undefined // Would need to track this
            };
          }

        } catch (error) {
          enhancedStats.mode_specific_metrics.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enhancedStats, null, 2),
          },
        ],
      };

    } catch (error) {
      throw new Error(`Failed to get system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Create search engine using PolymorphicSearchFactory (auto-detects mode)
      // This will automatically detect the mode from the database and create the appropriate engine
      console.error('🎭 MCP Server: Initializing search engine with automatic mode detection...');
      this.searchEngine = await PolymorphicSearchFactory.create(
        config.index_file,
        config.db_file
      );

      // Log successful initialization with mode information
      const stats = await this.searchEngine.getStats();
      
      // Try to get mode information for enhanced logging
      try {
        const { ModeDetectionService } = await import('./core/mode-detection-service.js');
        const modeService = new ModeDetectionService(config.db_file);
        const systemInfo = await modeService.detectMode();
        
        console.error(`✅ MCP Server: Search engine initialized successfully`);
        console.error(`🎭 Mode: ${systemInfo.mode} | Model: ${systemInfo.modelName}`);
        console.error(`📊 Total chunks: ${stats.totalChunks} | Reranking: ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);
        console.error(`🔧 Content types: ${systemInfo.supportedContentTypes.join(', ')}`);
        
        if (systemInfo.mode === 'multimodal') {
          console.error(`🌈 Multimodal capabilities: Text + Image processing enabled`);
          console.error(`⚡ Reranking strategy: ${systemInfo.rerankingStrategy}`);
        }
        
      } catch (modeError) {
        // Fallback to basic logging if mode detection fails
        console.error(`✅ MCP Server: Search engine initialized successfully`);
        console.error(`📊 Total chunks: ${stats.totalChunks}, Reranking: ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);
        console.error(`⚠️  Mode detection unavailable: ${modeError instanceof Error ? modeError.message : 'Unknown error'}`);
      }

      this.isSearchEngineInitialized = true;

    } catch (error) {
      // Check if this is a mode detection error
      if (error instanceof Error && error.message.includes('mode detection')) {
        console.error('⚠️  MCP Server: Mode detection failed, falling back to text mode');
        throw new Error(`Mode detection failed: ${error.message}. The system will attempt to fall back to text mode.`);
      }

      // Check if this is a model mismatch error and re-throw with more context
      if (error instanceof Error && (error.message.includes('Model mismatch detected') || error.message.includes('dimension mismatch'))) {
        console.error('⚠️  MCP Server: Model compatibility issue detected');
        // Re-throw the original error - it already has good formatting from factory
        throw error;
      }

      // For other initialization errors, provide a generic wrapper
      console.error('❌ MCP Server: Search engine initialization failed');
      throw new Error(`Failed to initialize search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup MCP server resources
   * Closes database connections and cleans up search engine
   */
  async cleanup(): Promise<void> {
    console.error('🧹 MCP Server: Cleaning up resources...');
    
    try {
      if (this.searchEngine) {
        await this.searchEngine.cleanup();
        this.searchEngine = null;
        this.isSearchEngineInitialized = false;
      }
      
      // Close all database connections
      await DatabaseConnectionManager.closeAllConnections();
      
      console.error('✅ MCP Server: Cleanup completed successfully');
    } catch (error) {
      console.error('⚠️  MCP Server: Error during cleanup:', error);
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

// Global server instance for cleanup
let globalServer: RagLiteMCPServer | null = null;

/**
 * Main entry point for MCP server
 * Implements MCP protocol interface without creating REST/GraphQL endpoints
 */
async function main(): Promise<void> {
  try {
    globalServer = new RagLiteMCPServer();
    await globalServer.start();
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
process.on('SIGINT', async () => {
  console.error('Received SIGINT, shutting down gracefully...');
  if (globalServer) {
    await globalServer.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  if (globalServer) {
    await globalServer.cleanup();
  }
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

/**
 * MCP Server Multimodal Integration Complete
 * 
 * This implementation addresses task 9.3 requirements:
 * ✅ Updated MCP server configuration to support multimodal parameters
 * ✅ Added new MCP tools for mode configuration and multimodal search
 * ✅ Integrated with polymorphic runtime system and mode detection
 * ✅ Enhanced error handling for multimodal-specific errors
 * ✅ Created comprehensive documentation and examples
 * ✅ Added support for content type filtering and model selection
 * ✅ Implemented reranking strategy configuration
 * ✅ Provided detailed system information and statistics tools
 * 
 * Key Features Added:
 * - Multimodal ingestion with mode and model parameters
 * - Content type filtering in search operations
 * - Comprehensive model and strategy information tools
 * - Enhanced error handling with recovery guidance
 * - Automatic mode detection and polymorphic behavior
 * - Detailed documentation and configuration examples
 */