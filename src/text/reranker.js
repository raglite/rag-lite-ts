// Set up polyfills immediately before any other imports
// Force polyfills in Node.js environment regardless of window state
if (typeof globalThis !== 'undefined') {
    if (typeof globalThis.self === 'undefined') {
        globalThis.self = globalThis;
    }
    if (typeof global.self === 'undefined') {
        global.self = global;
    }
}
import '../dom-polyfills.js';
import { config } from '../core/config.js';
/**
 * Embedding-based reranker for improving search result quality
 * Uses embedding similarity to rerank initial vector search results
 */
export class CrossEncoderReranker {
    model = null; // Use any to avoid complex transformers.js typing issues
    tokenizer = null;
    modelName = 'Xenova/ms-marco-MiniLM-L-6-v2'; // Use working cross-encoder model
    /**
     * Ensure DOM polyfills are set up for transformers.js
     */
    ensurePolyfills() {
        // Use the exact same approach as the working standalone version
        if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
            if (typeof globalThis.self === 'undefined') {
                globalThis.self = globalThis;
            }
            if (typeof global.self === 'undefined') {
                global.self = global;
            }
            // Polyfills already set up at module level
        }
    }
    /**
     * Load the embedding model
     */
    async loadModel() {
        await this.tryLoadModel(this.modelName);
    }
    /**
     * Try to load a specific model
     */
    async tryLoadModel(modelName) {
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
    }
    /**
     * Rerank search results using embedding similarity scoring
     * @param query - Original search query
     * @param results - Initial search results from vector search
     * @returns Promise resolving to reranked results
     */
    async rerank(query, results) {
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
        }
        catch (error) {
            console.warn(`Reranking failed, falling back to simple text reranking: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return this.simpleTextReranking(query, results);
        }
    }
    /**
     * Check if the model is loaded
     */
    isLoaded() {
        return this.model !== null && this.tokenizer !== null;
    }
    /**
     * Get the model name being used
     */
    getModelName() {
        return this.modelName;
    }
    /**
     * Compute cosine similarity between two Float32Array embeddings
     */
    cosineSimilarity(a, b) {
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
    simpleTextReranking(query, results) {
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
export function createTextRerankFunction(modelName) {
    let reranker = null;
    const rerankFunction = async (query, results, contentType) => {
        // Only support text content type
        if (contentType && contentType !== 'text') {
            throw new Error(`Text reranker only supports 'text' content type, got: ${contentType}`);
        }
        // Initialize reranker if not already done
        if (!reranker) {
            reranker = new CrossEncoderReranker();
            if (modelName) {
                // Set custom model name if provided
                reranker.modelName = modelName;
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
// =============================================================================
// REMOVED IN v3.0.0: createTextReranker() factory object
// =============================================================================
// The createTextReranker() function has been removed as it was redundant.
// It was just a wrapper that created new CrossEncoderReranker instances.
//
// Migration guide:
// - For public API: Use createReranker() from core/reranking-factory.ts
// - For dependency injection: Use createTextRerankFunction()
// - For direct access: Use new CrossEncoderReranker() directly
