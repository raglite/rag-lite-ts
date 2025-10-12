/**
 * CORE MODULE — Example usage of the SearchPipelineCoordinator
 * Demonstrates model-agnostic search pipeline coordination
 */

import type { EmbedFunction, RerankFunction } from './interfaces.js';
import type { SearchResult, EmbeddingResult } from './types.js';
import { SearchPipelineCoordinator, SearchPipelineFactory } from './search-pipeline.js';
import { SearchEngine } from './search.js';

/**
 * Example demonstrating direct use of SearchPipelineCoordinator
 */
export async function demonstrateSearchPipelineCoordination() {
  console.log('=== Search Pipeline Coordination Example ===');

  // Create mock dependencies (in real usage, these would be actual implementations)
  const mockEmbedFunction: EmbedFunction = async (query: string, contentType?: string): Promise<EmbeddingResult> => {
    console.log(`[Pipeline] Embedding query: "${query}" (${contentType || 'text'})`);
    return {
      embedding_id: 'mock_' + Date.now(),
      vector: new Float32Array(384).fill(0.1),
      contentType: contentType || 'text'
    };
  };

  const mockRerankFunction: RerankFunction = async (
    query: string, 
    results: SearchResult[], 
    contentType?: string
  ): Promise<SearchResult[]> => {
    console.log(`[Pipeline] Reranking ${results.length} results for: "${query}"`);
    // Simple mock reranking - boost scores slightly
    return results.map(r => ({ ...r, score: Math.min(1.0, r.score * 1.1) }));
  };

  const mockIndexManager = {
    search: async (vector: Float32Array, topK: number) => {
      console.log(`[Pipeline] Vector search with ${vector.length}D vector, topK=${topK}`);
      return {
        embeddingIds: ['id1', 'id2', 'id3'],
        distances: [0.1, 0.2, 0.3]
      };
    }
  };

  const mockDbConnection = {}; // Mock database connection

  // Method 1: Create coordinator using factory
  console.log('\n--- Method 1: Using SearchPipelineFactory ---');
  const coordinator1 = SearchPipelineFactory.create(
    mockEmbedFunction,
    mockIndexManager,
    mockDbConnection,
    mockRerankFunction,
    'text'
  );

  console.log('Pipeline status:', coordinator1.getStatus());
  console.log('Pipeline ready:', coordinator1.isReady());

  // Method 2: Create coordinator manually
  console.log('\n--- Method 2: Manual Configuration ---');
  const coordinator2 = SearchPipelineFactory.createEmpty();
  coordinator2.setEmbedFunction(mockEmbedFunction);
  coordinator2.setIndexManager(mockIndexManager);
  coordinator2.setDatabaseConnection(mockDbConnection);
  coordinator2.setRerankFunction(mockRerankFunction);
  coordinator2.setDefaultContentType('text');

  console.log('Manual coordinator status:', coordinator2.getStatus());

  // Method 3: SearchEngine with pipeline coordination
  console.log('\n--- Method 3: SearchEngine with Pipeline Coordination ---');
  const searchEngine = new SearchEngine(
    mockEmbedFunction,
    mockIndexManager as any,
    mockDbConnection as any,
    mockRerankFunction
  );

  const stats = await searchEngine.getStats();
  console.log('SearchEngine stats:', stats);

  console.log('\nSearch pipeline coordination examples completed successfully');
}

/**
 * Example demonstrating pipeline step-by-step execution
 */
export async function demonstrateStepByStepPipeline() {
  console.log('\n=== Step-by-Step Pipeline Execution ===');

  const coordinator = SearchPipelineFactory.createEmpty();

  // Step 1: Set up embedding function
  const embedFn: EmbedFunction = async (query, contentType) => {
    console.log(`Step 1: Embedding "${query}"`);
    return {
      embedding_id: 'step_' + Date.now(),
      vector: new Float32Array(384).fill(0.2),
      contentType: contentType || 'text'
    };
  };
  coordinator.setEmbedFunction(embedFn);

  // Step 2: Set up index manager
  const indexManager = {
    search: async (vector: Float32Array, topK: number) => {
      console.log(`Step 2: Vector search with topK=${topK}`);
      return {
        embeddingIds: ['step_id1', 'step_id2'],
        distances: [0.15, 0.25]
      };
    }
  };
  coordinator.setIndexManager(indexManager);

  // Step 3: Set up database connection (mock)
  coordinator.setDatabaseConnection({});

  // Step 4: Set up reranking function
  const rerankFn: RerankFunction = async (query, results) => {
    console.log(`Step 5: Reranking ${results.length} results`);
    return results.reverse(); // Simple reranking
  };
  coordinator.setRerankFunction(rerankFn);

  // Execute individual steps
  try {
    console.log('\n--- Executing Individual Pipeline Steps ---');
    
    // Step 1: Embed query
    const embedding = await coordinator.embedQuery('test query', 'text');
    console.log('Embedding result:', { id: embedding.embedding_id, dimensions: embedding.vector.length });

    // Step 2: Vector search
    const searchResult = await coordinator.vectorSearch(embedding.vector, 5);
    console.log('Search result:', searchResult);

    // Step 3: Retrieve metadata (mock)
    const mockChunks = [
      {
        embedding_id: 'step_id1',
        text: 'Mock chunk 1',
        document_id: 1,
        document_source: 'doc1.txt',
        document_title: 'Document 1',
        content_type: 'text'
      },
      {
        embedding_id: 'step_id2',
        text: 'Mock chunk 2',
        document_id: 2,
        document_source: 'doc2.txt',
        document_title: 'Document 2',
        content_type: 'text'
      }
    ];

    // Step 4: Format results
    const formattedResults = coordinator.formatResults(mockChunks, searchResult.distances, searchResult.embeddingIds);
    console.log('Formatted results:', formattedResults.map(r => ({ content: r.content, score: r.score })));

    // Step 5: Rerank results
    const rerankedResults = await coordinator.rerankResults('test query', formattedResults);
    console.log('Reranked results:', rerankedResults.map(r => ({ content: r.content, score: r.score })));

  } catch (error) {
    console.error('Pipeline step failed:', error);
  }

  console.log('\nStep-by-step pipeline execution completed');
}

/**
 * Example demonstrating error handling in pipeline coordination
 */
export async function demonstrateErrorHandling() {
  console.log('\n=== Pipeline Error Handling ===');

  const coordinator = SearchPipelineFactory.createEmpty();

  // Test 1: Missing dependencies
  try {
    await coordinator.executeSearchPipeline('test query');
  } catch (error) {
    console.log('Expected error for missing dependencies:', error instanceof Error ? error.message : error);
  }

  // Test 2: Embedding function error
  const failingEmbedFn: EmbedFunction = async () => {
    throw new Error('Embedding model failed');
  };
  coordinator.setEmbedFunction(failingEmbedFn);
  coordinator.setIndexManager({ search: async () => ({ embeddingIds: [], distances: [] }) });
  coordinator.setDatabaseConnection({});

  try {
    await coordinator.executeSearchPipeline('test query');
  } catch (error) {
    console.log('Expected error for embedding failure:', error instanceof Error ? error.message : error);
  }

  // Test 3: Reranking failure (should not break pipeline)
  const workingEmbedFn: EmbedFunction = async (query) => ({
    embedding_id: 'working',
    vector: new Float32Array(384).fill(0.1),
    contentType: 'text'
  });

  const failingRerankFn: RerankFunction = async () => {
    throw new Error('Reranking failed');
  };

  coordinator.setEmbedFunction(workingEmbedFn);
  coordinator.setRerankFunction(failingRerankFn);

  // This should work despite reranking failure
  try {
    const results = await coordinator.executeSearchPipeline('test query', { rerank: true });
    console.log('Pipeline succeeded despite reranking failure, results:', results.length);
  } catch (error) {
    console.log('Unexpected error:', error);
  }

  console.log('Error handling demonstration completed');
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  await demonstrateSearchPipelineCoordination();
  await demonstrateStepByStepPipeline();
  await demonstrateErrorHandling();
  console.log('\n=== All Search Pipeline Examples Completed ===');
}