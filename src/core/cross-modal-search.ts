/**
 * Cross-Modal Search Implementation
 * 
 * This module extends the core SearchEngine to provide cross-modal search capabilities
 * that enable text queries to find images and image queries to find text content.
 * 
 * Task 4.2: Implement cross-modal search functionality
 * - Update search logic to handle mixed content type results
 * - Ensure ranking works properly across text and image content
 * - Test text queries finding relevant images and vice versa
 * 
 * Requirements addressed:
 * - 6.1: Enable text queries to find relevant image content
 * - 6.2: Enable image queries to find relevant text content
 * - 6.3: Rank mixed content types by semantic similarity
 */

import { SearchEngine } from './search.js';
import type { SearchResult, SearchOptions, EmbeddingResult } from './types.js';
import type { EmbedFunction, RerankFunction } from './interfaces.js';
import { cosineSimilarity } from '../utils/vector-math.js';

/**
 * Extended search options for cross-modal search
 */
export interface CrossModalSearchOptions extends SearchOptions {
  /** Content types to include in search results */
  includeContentTypes?: string[];
  /** Whether to enable cross-modal ranking */
  enableCrossModalRanking?: boolean;
  /** Minimum similarity threshold for cross-modal results */
  crossModalThreshold?: number;
}

/**
 * Cross-modal search result with enhanced metadata
 */
export interface CrossModalSearchResult extends SearchResult {
  /** Whether this result is from a different modality than the query */
  isCrossModal?: boolean;
  /** Semantic similarity score for cross-modal ranking */
  semanticSimilarity?: number;
  /** Original vector search score before cross-modal adjustments */
  originalScore?: number;
}

/**
 * Cross-Modal Search Engine
 * 
 * Extends the core SearchEngine to provide cross-modal search capabilities.
 * This implementation enables:
 * - Text queries finding semantically similar images
 * - Image queries finding semantically similar text
 * - Mixed content type results ranked by semantic similarity
 * - Unified embedding space leveraging CLIP models
 */
export class CrossModalSearchEngine extends SearchEngine {
  private embedder?: any; // Reference to the embedder for cross-modal operations

  constructor(
    embedFn: EmbedFunction,
    indexManager: any,
    db: any,
    rerankFn?: RerankFunction,
    contentResolver?: any,
    embedder?: any
  ) {
    super(embedFn, indexManager, db, rerankFn, contentResolver);
    this.embedder = embedder;
  }

  /**
   * Perform cross-modal search that can find content across different modalities
   * 
   * This method extends the base search functionality to:
   * 1. Detect query content type (text or image path)
   * 2. Generate appropriate embeddings for the query
   * 3. Search across all content types in the unified embedding space
   * 4. Rank results by semantic similarity regardless of content type
   * 5. Apply cross-modal ranking adjustments
   * 
   * @param query - Search query (text string or image path)
   * @param options - Cross-modal search options
   * @returns Promise resolving to cross-modal search results
   */
  async crossModalSearch(
    query: string, 
    options: CrossModalSearchOptions = {}
  ): Promise<CrossModalSearchResult[]> {
    console.log(`🔍 Cross-modal search: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

    // Step 1: Detect query content type
    const queryContentType = this.detectQueryContentType(query);
    console.log(`📝 Query content type: ${queryContentType}`);

    // Step 2: Perform base search with detected content type
    const baseResults = await this.search(query, {
      ...options,
      contentType: queryContentType as 'text' | 'image' | 'combined'
    });

    // Step 3: Convert to cross-modal results with enhanced metadata
    const crossModalResults = await this.enhanceResultsWithCrossModalInfo(
      baseResults,
      query,
      queryContentType,
      options
    );

    // Step 4: Apply cross-modal ranking if enabled
    if (options.enableCrossModalRanking !== false) {
      return this.applyCrossModalRanking(crossModalResults, query, queryContentType, options);
    }

    return crossModalResults;
  }

  /**
   * Search for images using text queries
   * 
   * @param textQuery - Text description to search for
   * @param options - Search options
   * @returns Promise resolving to image search results
   */
  async searchImagesWithText(
    textQuery: string,
    options: CrossModalSearchOptions = {}
  ): Promise<CrossModalSearchResult[]> {
    console.log(`🖼️ Text-to-image search: "${textQuery}"`);

    const searchOptions: CrossModalSearchOptions = {
      ...options,
      includeContentTypes: ['image'],
      enableCrossModalRanking: true
    };

    return this.crossModalSearch(textQuery, searchOptions);
  }

  /**
   * Search for text using image queries
   * 
   * @param imagePath - Path to image file to search with
   * @param options - Search options
   * @returns Promise resolving to text search results
   */
  async searchTextWithImage(
    imagePath: string,
    options: CrossModalSearchOptions = {}
  ): Promise<CrossModalSearchResult[]> {
    console.log(`📝 Image-to-text search: "${imagePath}"`);

    const searchOptions: CrossModalSearchOptions = {
      ...options,
      includeContentTypes: ['text'],
      enableCrossModalRanking: true
    };

    return this.crossModalSearch(imagePath, searchOptions);
  }

  /**
   * Search across all content types with unified ranking
   * 
   * @param query - Search query (text or image path)
   * @param options - Search options
   * @returns Promise resolving to mixed content type results
   */
  async searchUnified(
    query: string,
    options: CrossModalSearchOptions = {}
  ): Promise<CrossModalSearchResult[]> {
    console.log(`🌐 Unified cross-modal search: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

    const searchOptions: CrossModalSearchOptions = {
      ...options,
      includeContentTypes: ['text', 'image'],
      enableCrossModalRanking: true
    };

    return this.crossModalSearch(query, searchOptions);
  }

  /**
   * Detect the content type of a query
   * @private
   */
  private detectQueryContentType(query: string): string {
    // Simple heuristic: if query looks like a file path with image extension, treat as image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerQuery = query.toLowerCase();
    
    if (imageExtensions.some(ext => lowerQuery.endsWith(ext))) {
      return 'image';
    }
    
    // Default to text for all other queries
    return 'text';
  }

  /**
   * Enhance search results with cross-modal information
   * @private
   */
  private async enhanceResultsWithCrossModalInfo(
    results: SearchResult[],
    query: string,
    queryContentType: string,
    options: CrossModalSearchOptions
  ): Promise<CrossModalSearchResult[]> {
    const enhancedResults: CrossModalSearchResult[] = [];

    for (const result of results) {
      const resultContentType = result.contentType || 'text';
      const isCrossModal = queryContentType !== resultContentType;

      // Filter by content type if specified
      if (options.includeContentTypes && 
          !options.includeContentTypes.includes(resultContentType)) {
        continue;
      }

      // Calculate semantic similarity for cross-modal results
      let semanticSimilarity: number | undefined;
      if (isCrossModal && this.embedder) {
        try {
          semanticSimilarity = await this.calculateSemanticSimilarity(
            query, 
            result.content, 
            queryContentType, 
            resultContentType
          );
        } catch (error) {
          console.warn(`Failed to calculate semantic similarity: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Apply cross-modal threshold if specified
      if (options.crossModalThreshold && 
          isCrossModal && 
          semanticSimilarity !== undefined && 
          semanticSimilarity < options.crossModalThreshold) {
        continue;
      }

      enhancedResults.push({
        ...result,
        isCrossModal,
        semanticSimilarity,
        originalScore: result.score
      });
    }

    return enhancedResults;
  }

  /**
   * Apply cross-modal ranking to results
   * @private
   */
  private applyCrossModalRanking(
    results: CrossModalSearchResult[],
    query: string,
    queryContentType: string,
    options: CrossModalSearchOptions
  ): CrossModalSearchResult[] {
    console.log(`🎯 Applying cross-modal ranking to ${results.length} results`);

    // Sort results by a combination of original score and semantic similarity
    const rankedResults = results.sort((a, b) => {
      // For cross-modal results, use semantic similarity if available
      if (a.isCrossModal && a.semanticSimilarity !== undefined) {
        const aScore = a.semanticSimilarity;
        const bScore = b.isCrossModal && b.semanticSimilarity !== undefined 
          ? b.semanticSimilarity 
          : b.score;
        return bScore - aScore;
      }

      if (b.isCrossModal && b.semanticSimilarity !== undefined) {
        const aScore = a.isCrossModal && a.semanticSimilarity !== undefined 
          ? a.semanticSimilarity 
          : a.score;
        const bScore = b.semanticSimilarity;
        return bScore - aScore;
      }

      // For same-modal results, use original score
      return b.score - a.score;
    });

    // Update scores based on ranking
    rankedResults.forEach((result, index) => {
      if (result.isCrossModal && result.semanticSimilarity !== undefined) {
        // Use semantic similarity as the primary score for cross-modal results
        result.score = result.semanticSimilarity;
      }
    });

    console.log(`✅ Cross-modal ranking applied: ${rankedResults.length} results ranked`);
    return rankedResults;
  }

  /**
   * Calculate semantic similarity between query and result content
   * @private
   */
  private async calculateSemanticSimilarity(
    query: string,
    resultContent: string,
    queryContentType: string,
    resultContentType: string
  ): Promise<number> {
    if (!this.embedder) {
      throw new Error('Embedder not available for semantic similarity calculation');
    }

    try {
      // Generate embeddings for both query and result
      let queryEmbedding: EmbeddingResult;
      let resultEmbedding: EmbeddingResult;

      if (queryContentType === 'image') {
        queryEmbedding = await this.embedder.embedImage(query);
      } else {
        queryEmbedding = await this.embedder.embedText(query);
      }

      if (resultContentType === 'image') {
        // For image results, we need the image path from metadata
        // This is a simplified approach - in practice, you'd need proper image path resolution
        resultEmbedding = await this.embedder.embedText(resultContent); // Fallback to text
      } else {
        resultEmbedding = await this.embedder.embedText(resultContent);
      }

      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryEmbedding.vector, resultEmbedding.vector);
      return Math.max(0, similarity); // Ensure non-negative similarity

    } catch (error) {
      console.warn(`Semantic similarity calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  /**
   * Get cross-modal search statistics
   */
  async getCrossModalStats(): Promise<{
    totalChunks: number;
    textChunks: number;
    imageChunks: number;
    crossModalCapable: boolean;
    supportedContentTypes: string[];
  }> {
    const baseStats = await this.getStats();
    
    // This would need to be implemented with actual database queries
    // For now, return basic stats with cross-modal indicators
    return {
      totalChunks: baseStats.totalChunks,
      textChunks: baseStats.totalChunks, // Placeholder
      imageChunks: 0, // Placeholder
      crossModalCapable: this.embedder !== undefined,
      supportedContentTypes: this.embedder?.supportedContentTypes || ['text']
    };
  }
}

/**
 * Factory function to create a cross-modal search engine
 * 
 * @param embedFn - Embedding function that supports multiple content types
 * @param indexManager - Vector index manager
 * @param db - Database connection
 * @param rerankFn - Optional reranking function
 * @param contentResolver - Content resolver for unified content system
 * @param embedder - Reference to the embedder for cross-modal operations
 * @returns CrossModalSearchEngine instance
 */
export function createCrossModalSearchEngine(
  embedFn: EmbedFunction,
  indexManager: any,
  db: any,
  rerankFn?: RerankFunction,
  contentResolver?: any,
  embedder?: any
): CrossModalSearchEngine {
  return new CrossModalSearchEngine(
    embedFn,
    indexManager,
    db,
    rerankFn,
    contentResolver,
    embedder
  );
}

/**
 * Utility function to check if a search engine supports cross-modal search
 * 
 * @param searchEngine - Search engine to check
 * @returns True if the engine supports cross-modal search
 */
export function supportsCrossModalSearch(searchEngine: any): searchEngine is CrossModalSearchEngine {
  return searchEngine instanceof CrossModalSearchEngine;
}

/**
 * Cross-modal search result analyzer
 * Provides utilities for analyzing cross-modal search results
 */
export class CrossModalResultAnalyzer {
  /**
   * Analyze cross-modal search results
   */
  static analyzeResults(results: CrossModalSearchResult[]): {
    totalResults: number;
    crossModalResults: number;
    sameModalResults: number;
    averageSemanticSimilarity: number;
    contentTypeDistribution: Record<string, number>;
  } {
    const analysis = {
      totalResults: results.length,
      crossModalResults: 0,
      sameModalResults: 0,
      averageSemanticSimilarity: 0,
      contentTypeDistribution: {} as Record<string, number>
    };

    let totalSimilarity = 0;
    let similarityCount = 0;

    for (const result of results) {
      // Count cross-modal vs same-modal results
      if (result.isCrossModal) {
        analysis.crossModalResults++;
      } else {
        analysis.sameModalResults++;
      }

      // Track semantic similarity
      if (result.semanticSimilarity !== undefined) {
        totalSimilarity += result.semanticSimilarity;
        similarityCount++;
      }

      // Track content type distribution
      const contentType = result.contentType || 'unknown';
      analysis.contentTypeDistribution[contentType] = 
        (analysis.contentTypeDistribution[contentType] || 0) + 1;
    }

    // Calculate average semantic similarity
    if (similarityCount > 0) {
      analysis.averageSemanticSimilarity = totalSimilarity / similarityCount;
    }

    return analysis;
  }

  /**
   * Generate a summary report of cross-modal search results
   */
  static generateReport(results: CrossModalSearchResult[], query: string): string {
    const analysis = this.analyzeResults(results);
    
    let report = `Cross-Modal Search Report\n`;
    report += `========================\n`;
    report += `Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"\n`;
    report += `Total Results: ${analysis.totalResults}\n`;
    report += `Cross-Modal Results: ${analysis.crossModalResults}\n`;
    report += `Same-Modal Results: ${analysis.sameModalResults}\n`;
    
    if (analysis.averageSemanticSimilarity > 0) {
      report += `Average Semantic Similarity: ${analysis.averageSemanticSimilarity.toFixed(4)}\n`;
    }
    
    report += `\nContent Type Distribution:\n`;
    for (const [type, count] of Object.entries(analysis.contentTypeDistribution)) {
      report += `  ${type}: ${count}\n`;
    }

    return report;
  }
}