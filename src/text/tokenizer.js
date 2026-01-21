import '../dom-polyfills.js';
/**
 * Tokenizer instance for consistent token counting
 * Uses the same tokenizer as the embedding model (MiniLM-L6-v2)
 */
let tokenizer = null;
/**
 * Initialize the tokenizer with the MiniLM-L6-v2 model
 * This ensures token counting matches the embedding model exactly
 */
async function initializeTokenizer() {
    if (tokenizer) {
        return tokenizer;
    }
    try {
        // Ensure DOM polyfills are set up before importing transformers
        if (typeof globalThis.self === 'undefined') {
            globalThis.self = globalThis;
        }
        // Use the same model as embeddings for consistent token counting using dynamic import
        const { AutoTokenizer } = await import('@huggingface/transformers');
        tokenizer = await AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2');
        return tokenizer;
    }
    catch (error) {
        throw new Error(`Failed to initialize tokenizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Count tokens in a text string using the MiniLM-L6-v2 tokenizer
 * This ensures token counts match exactly with the embedding model
 *
 * @param text - Text to count tokens for
 * @returns Number of tokens in the text
 * @throws {Error} If tokenizer fails to initialize or tokenize
 */
export async function countTokens(text) {
    if (!text || typeof text !== 'string') {
        return 0;
    }
    try {
        const tokenizerInstance = await initializeTokenizer();
        const tokens = await tokenizerInstance.encode(text);
        return tokens.length;
    }
    catch (error) {
        throw new Error(`Failed to count tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get the tokenizer instance (for testing purposes)
 * @internal
 */
export async function getTokenizer() {
    return await initializeTokenizer();
}
/**
 * Reset the tokenizer instance (for testing purposes)
 * @internal
 */
export function resetTokenizer() {
    tokenizer = null;
}
