// Set up polyfills immediately before any other imports
// Force polyfills in Node.js environment regardless of window state
if (typeof globalThis !== 'undefined') {
  if (typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
  }
  if (typeof (global as any).self === 'undefined') {
    (global as any).self = global;
  }
}

import '../dom-polyfills.js';
import type { SearchResult, RerankFunction } from '../core/types.js';
import { config } from '../core/config.js';

/**
 * Embedding-based reranker for improving search result quality
 * Uses embedding similarity to rerank initial vector search results
 */
export class CrossEncoderReranker {
  private model: any = null; // Use any to avoid complex transformers.js typing issues
  private tokenizer: any = null;
  private modelName: string = 'Xenova/ms-marco-MiniLM-L-6-v2'; // Use working cross-encoder model
  // Alternative models in case the primary fails
  private static readonly FALLBACK_MODELS = [
    'Xenova/ms-marco-MiniLM-L-6-v2', // Primary - proven to work in standalone test
    'cross-encoder/ms-marco-MiniLM-L-6-v2', // Original (may have issues)
    'cross-encoder/ms-marco-MiniLM-L-2-v2', // Smaller original (may have issues)
  ];

  /**
   * Ensure DOM polyfills are set up for transformers.js
   */
  private ensurePolyfills(): void {
    // Use the exact same approach as the working standalone version
    if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
      if (typeof (globalThis as any).self === 'undefined') {
        (globalThis as any).self = globalThis;
      }
      if (typeof (global as any).self === 'undefined') {
        (global as any).self = global;
      }
      // Polyfills already set up at module level
    }
  }

  /**
   * Load the embedding model with graceful fallback
   */
  async loadModel(): Promise<void> {
    // Try primary model first (should work since it's Xenova)
    if (await this.tryLoadModel(this.modelName)) {
      return;
    }

    // Try fallback models if primary fails
    console.warn(`Primary model ${this.modelName} failed, trying fallbacks...`);
    for (const fallbackModel of CrossEncoderReranker.FALLBACK_MODELS) {
      if (fallbackModel === this.modelName) continue; // Skip already tried model

      console.warn(`Trying fallback model: ${fallbackModel}`);
      if (await this.tryLoadModel(fallbackModel)) {
        this.modelName = fallbackModel;
        return;
      }
    }

    console.warn('All embedding models failed to load. Reranking will be disabled.');
    this.model = null;
    this.tokenizer = null;
  }

  /**
   * Try to load a specific model
   */
  private async tryLoadModel(modelName: string): Promise<boolean> {
    try {
      console.log(`Loading cross-encoder model: ${modelName}`);

      // Ensure polyfills are set up exactly like the working standalone version
      this.ensurePolyfills();

      // Use the exact same approach as the working standalone test
      const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@huggingface/transformers');

      console.log('Loading model...');
      this.model = await AutoModelForSequenceClassification.from_pretrained(modelName, {
        cache_dir: config.model_cache_path,
        dtype: 'fp32'
      });

      console.log('Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained(modelName, {
        cache_dir: config.model_cache_path
      });

      console.log(`Cross-encoder model loaded successfully: ${modelName}`);
      return true;
    } catch (error) {
      console.warn(`Failed to load model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Rerank search results using embedding similarity scoring
   * @param query - Original search query
   * @param results - Initial search results from vector search
   * @returns Promise resolving to reranked results
   */
  async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.model) {
      throw new Error('Cross-encoder model not loaded. Call loadModel() first.');
    }

    if (results.length === 0) {
      return results;
    }

    try {
      // Use cross-encoder approach - prepare queries and documents for proper cross-encoder format
      const queries = results.map(() => query);
      const documents = results.map(result => result.content);

      console.log('Tokenizing query-document pairs...');

      // Tokenize using the proper cross-encoder format with text_pair
      const features = this.tokenizer(queries, {
        text_pair: documents,
        padding: true,
        truncation: true,
        return_tensors: 'pt'
      });

      console.log('Running cross-encoder inference...');

      // Get model predictions
      const output = await this.model(features);

      // Extract logits - these are the raw relevance scores
      const logits = output.logits;

      // Convert logits to scores and pair with results
      const scores = results.map((result, i) => {
        // For cross-encoders, we typically use the raw logit as the relevance score
        // Higher logits = more relevant
        const rawScore = Array.isArray(logits) ? logits[i] : logits.data[i];

        // Apply sigmoid to convert logit to probability-like score
        const score = 1 / (1 + Math.exp(-rawScore));

        return {
          score: score,
          result: result
        };
      });

      // Check if scores look reasonable
      const maxScore = Math.max(...scores.map(s => s.score));
      const minScore = Math.min(...scores.map(s => s.score));
      const scoreRange = maxScore - minScore;

      // If there's very little variation in scores, fall back to simple reranking
      if (scoreRange < 0.1) {
        console.log(`Cross-encoder scores have low variation (range: ${scoreRange.toFixed(3)}), using simple text reranking`);
        return this.simpleTextReranking(query, results);
      }

      // Sort by cross-encoder scores (descending)
      scores.sort((a, b) => b.score - a.score);

      // Update results with new scores and return reranked results
      return scores.map(item => ({
        ...item.result,
        score: item.score
      }));

    } catch (error) {
      console.warn(`Reranking failed, falling back to simple text reranking: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.simpleTextReranking(query, results);
    }
  }

  /**
   * Check if the model is loaded
   */
  isLoaded(): boolean {
    return this.model !== null && this.tokenizer !== null;
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Compute cosine similarity between two Float32Array embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Simple text-based reranking using keyword matching and text similarity
   * This is a fallback when embedding similarity doesn't provide good discrimination
   */
  private simpleTextReranking(query: string, results: SearchResult[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

    const rerankedResults = results.map(result => {
      const textLower = result.content.toLowerCase();
      const titleLower = result.document.title?.toLowerCase() || '';

      let score = result.score; // Start with vector search score
      let bonus = 0;

      // Bonus for exact query matches
      if (textLower.includes(queryLower)) {
        bonus += 0.15;
      }

      // Bonus for title matches
      if (titleLower.includes(queryLower)) {
        bonus += 0.1;
      }

      // Special handling for "What is X?" queries
      if (queryLower.startsWith('what is')) {
        const subject = queryLower.replace('what is', '').trim().replace(/\?$/, '');

        // Major bonus for definitional patterns like "X is a/an..."
        const definitionPatterns = [
          `${subject} is a`,
          `${subject} is an`,
          `${subject} is the`,
          `${subject} provides`,
          `${subject} helps`
        ];

        for (const pattern of definitionPatterns) {
          if (textLower.includes(pattern)) {
            bonus += 0.3; // Large bonus for definitional content
            break;
          }
        }
      }

      // Bonus for individual word matches
      let wordMatches = 0;
      for (const word of queryWords) {
        if (textLower.includes(word)) {
          wordMatches++;
        }
        if (titleLower.includes(word)) {
          wordMatches += 0.5; // Title matches are worth more
        }
      }

      // Normalize word match bonus
      if (queryWords.length > 0) {
        bonus += (wordMatches / queryWords.length) * 0.1;
      }

      // Bonus for content that appears to be introductory/definitional
      const introKeywords = ['introduction', 'what is', 'overview', 'about', 'definition', '# introduction'];
      for (const keyword of introKeywords) {
        if (textLower.includes(keyword) || titleLower.includes(keyword)) {
          bonus += 0.08;
        }
      }

      // Extra bonus for files with "intro" in the path
      if (result.document.source?.toLowerCase().includes('intro')) {
        bonus += 0.1;
      }

      // Apply bonus but cap the total score at 1.0
      const newScore = Math.min(1.0, score + bonus);

      return {
        ...result,
        score: newScore
      };
    });

    // Sort by new scores (descending)
    rerankedResults.sort((a, b) => b.score - a.score);

    return rerankedResults;
  }
}
/*
*
 * Create a RerankFunction implementation using the embedding-based reranker
 * This function implements the core RerankFunction interface for dependency injection
 * @param modelName - Optional model name override
 * @returns RerankFunction that can be injected into core components
 */
export function createTextRerankFunction(modelName?: string): RerankFunction {
  let reranker: CrossEncoderReranker | null = null;

  const rerankFunction: RerankFunction = async (
    query: string,
    results: SearchResult[],
    contentType?: string
  ): Promise<SearchResult[]> => {
    // Only support text content type
    if (contentType && contentType !== 'text') {
      throw new Error(`Text reranker only supports 'text' content type, got: ${contentType}`);
    }

    // Initialize reranker if not already done
    if (!reranker) {
      reranker = new CrossEncoderReranker();
      if (modelName) {
        // Set custom model name if provided
        (reranker as any).modelName = modelName;
      }
      await reranker.loadModel();
    }

    // If reranker failed to load, return results unchanged
    if (!reranker.isLoaded()) {
      console.warn('Text reranker not loaded, returning results unchanged');
      return results;
    }

    // Use the existing rerank method
    return await reranker.rerank(query, results);
  };

  return rerankFunction;
}

/**
 * Create a text reranker factory function
 * @param modelName - Optional model name override
 * @returns Factory function that creates initialized rerankers
 */
export function createTextReranker(modelName?: string) {
  return {
    async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
      const reranker = new CrossEncoderReranker();
      if (modelName) {
        (reranker as any).modelName = modelName;
      }
      await reranker.loadModel();

      if (!reranker.isLoaded()) {
        console.warn('Text reranker not loaded, returning results unchanged');
        return results;
      }

      return reranker.rerank(query, results);
    },

    async loadModel(): Promise<void> {
      const reranker = new CrossEncoderReranker();
      if (modelName) {
        (reranker as any).modelName = modelName;
      }
      await reranker.loadModel();
    },

    isLoaded(): boolean {
      // For the factory version, we create new instances each time
      // so we can't track loaded state
      return true;
    }
  };
}