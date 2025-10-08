import { AutoTokenizer, AutoModelForSequenceClassification } from '@huggingface/transformers';
import type { SearchResult } from './types.js';
import { config } from './config.js';

/**
 * Cross-encoder reranker for improving search result quality
 * Uses a cross-encoder model to rerank initial vector search results
 */
export class CrossEncoderReranker {
  private model: any = null; // Use any to avoid complex transformers.js typing issues
  private tokenizer: any = null;
  private modelName: string = 'Xenova/ms-marco-MiniLM-L-6-v2'; // Use working model as default
  // Alternative models in case the primary fails
  private static readonly FALLBACK_MODELS = [
    'Xenova/ms-marco-MiniLM-L-6-v2', // Primary - optimized for transformers.js
    'cross-encoder/ms-marco-MiniLM-L-6-v2', // Original (likely to fail)
    'cross-encoder/ms-marco-MiniLM-L-2-v2', // Smaller original (likely to fail)
    // Note: sentence-transformers/all-MiniLM-L6-v2 is a bi-encoder, not cross-encoder, so removed
  ];

  /**
   * Load the cross-encoder model with graceful fallback
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

    console.warn('All cross-encoder models failed to load. Reranking will be disabled.');
    this.model = null;
    this.tokenizer = null;
  }

  /**
   * Try to load a specific model
   */
  private async tryLoadModel(modelName: string): Promise<boolean> {
    try {
      console.log(`Loading cross-encoder model: ${modelName}`);
      
      // Load model and tokenizer separately for proper cross-encoder usage
      this.model = await AutoModelForSequenceClassification.from_pretrained(modelName, {
        cache_dir: config.model_cache_path,
        dtype: 'fp32' // Suppress dtype warnings
      });
      
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
   * Rerank search results using cross-encoder scoring
   * @param query - Original search query
   * @param results - Initial search results from vector search
   * @returns Promise resolving to reranked results
   */
  async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.model || !this.tokenizer) {
      throw new Error('Cross-encoder model not loaded. Call loadModel() first.');
    }

    if (results.length === 0) {
      return results;
    }

    try {
      // Prepare queries and documents for proper cross-encoder format
      const queries = results.map(() => query);
      const documents = results.map(result => result.text);

      // Tokenize using the proper cross-encoder format with text_pair
      const features = this.tokenizer(queries, {
        text_pair: documents,
        padding: true,
        truncation: true,
        return_tensors: 'pt'
      });

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
   * Simple text-based reranking using keyword matching and text similarity
   * This is a fallback when cross-encoder models don't work well for the content
   */
  private simpleTextReranking(query: string, results: SearchResult[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    const rerankedResults = results.map(result => {
      const textLower = result.text.toLowerCase();
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