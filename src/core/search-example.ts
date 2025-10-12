/**
 * CORE MODULE — Example usage of the new SearchEngine with dependency injection
 * This file demonstrates how the refactored SearchEngine works with injected dependencies
 */

import type { EmbedFunction, RerankFunction } from './interfaces.js';
import type { SearchResult, EmbeddingResult } from './types.js';
import { SearchEngine } from './search.js';

/**
 * Example embedding function that could be injected
 * In practice, this would be created from a text embedder or multimodal embedder
 */
const exampleEmbedFunction: EmbedFunction = async (query: string, contentType?: string): Promise<EmbeddingResult> => {
  // This is just a mock - in real usage, this would call an actual embedding model
  console.log(`Embedding query: "${query}" for content type: ${contentType || 'text'}`);
  
  // Return a mock embedding result
  return {
    embedding_id: 'mock_' + Date.now(),
    vector: new Float32Array(384).fill(0.1), // Mock 384-dimensional vector
    contentType: contentType || 'text'
  };
};

/**
 * Example reranking function that could be injected
 * In practice, this would be created from a cross-encoder reranker
 */
const exampleRerankFunction: RerankFunction = async (
  query: string, 
  results: SearchResult[], 
  contentType?: string
): Promise<SearchResult[]> => {
  console.log(`Reranking ${results.length} results for query: "${query}"`);
  
  // Simple mock reranking - just reverse the order
  return [...results].reverse();
};

/**
 * Example usage of the new SearchEngine with dependency injection
 */
export async function exampleUsage() {
  console.log('=== SearchEngine Dependency Injection Example ===');
  
  // Mock dependencies that would normally be created by factories
  const mockIndexManager = {
    search: (vector: Float32Array, k: number) => ({
      embeddingIds: ['mock1', 'mock2'],
      distances: [0.1, 0.2]
    }),
    getStats: () => ({ totalVectors: 100 })
  } as any;
  
  const mockDb = {
    all: async (query: string, params?: any[]) => [
      { id: 1, content: 'Mock content 1', document_id: 1, source: 'mock1.md', title: 'Mock 1' },
      { id: 2, content: 'Mock content 2', document_id: 2, source: 'mock2.md', title: 'Mock 2' }
    ],
    close: async () => {}
  } as any;
  
  // Create SearchEngine with injected dependencies (correct signature)
  const searchEngine = new SearchEngine(
    exampleEmbedFunction,
    mockIndexManager,
    mockDb,
    exampleRerankFunction
  );
  
  console.log('SearchEngine created with injected dependencies');
  
  // Note: The core SearchEngine doesn't have setter methods - dependencies are injected via constructor
  
  console.log('SearchEngine created and dependencies injected separately');
  
  // Get stats before initialization
  const statsBeforeInit = await searchEngine.getStats();
  console.log('Stats before initialization:', statsBeforeInit);
  
  // Note: In a real scenario, you would initialize and search like this:
  // await searchEngine.initialize();
  // const results = await searchEngine.search('example query');
  // console.log('Search results:', results);
  
  console.log('Example completed successfully');
}

/**
 * Example of how to create embedding and reranking functions from existing components
 */
export function createAdapterExample() {
  console.log('=== Adapter Example ===');
  
  // Mock embedder
  const mockEmbedder = {
    async embedSingle(query: string) {
      return {
        embedding_id: 'emb_' + Date.now(),
        vector: new Float32Array(384).fill(0.2)
      };
    }
  };
  
  // Mock reranker
  const mockReranker = {
    isLoaded: () => true,
    async rerank(query: string, results: any[]) {
      return results.map(r => ({ ...r, score: r.score * 1.1 }));
    }
  };
  
  // Create adapter functions
  const embedFn: EmbedFunction = async (query, contentType) => {
    const result = await mockEmbedder.embedSingle(query);
    return {
      ...result,
      contentType: contentType || 'text'
    };
  };
  
  const rerankFn: RerankFunction = async (query, results, contentType) => {
    // Convert to reranker format
    const rerankResults = results.map(r => ({
      text: r.content,
      score: r.score,
      document: {
        id: r.document.id,
        source: r.document.source,
        title: r.document.title
      }
    }));
    
    // Call reranker
    const reranked = await mockReranker.rerank(query, rerankResults);
    
    // Convert back to core format
    return reranked.map((r: any, i: number) => ({
      content: r.text,
      score: r.score,
      contentType: results[i].contentType,
      document: {
        ...r.document,
        contentType: results[i].document.contentType
      },
      metadata: results[i].metadata
    }));
  };
  
  // Mock dependencies for the example
  const mockIndexManager = {
    search: (vector: Float32Array, k: number) => ({
      embeddingIds: ['emb1', 'emb2'],
      distances: [0.15, 0.25]
    }),
    getStats: () => ({ totalVectors: 50 })
  } as any;
  
  const mockDb = {
    all: async (query: string, params?: any[]) => [
      { id: 1, content: 'Example content 1', document_id: 1, source: 'doc1.md', title: 'Document 1' }
    ],
    close: async () => {}
  } as any;
  
  // Create SearchEngine with adapted functions (correct signature)
  const searchEngine = new SearchEngine(
    embedFn,
    mockIndexManager,
    mockDb,
    rerankFn
  );
  
  console.log('SearchEngine created with adapters');
  console.log('Adapter example completed');
}

// Export for testing purposes
export { exampleEmbedFunction, exampleRerankFunction };