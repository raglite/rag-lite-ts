/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */
/**
 * Registry for chunking strategies
 */
export class ChunkingStrategyRegistry {
    strategies = [];
    /**
     * Register a chunking strategy
     */
    register(strategy) {
        this.strategies.push(strategy);
    }
    /**
     * Find the appropriate strategy for a content type
     */
    findStrategy(contentType) {
        return this.strategies.find(strategy => strategy.appliesTo(contentType));
    }
    /**
     * Get all registered strategies
     */
    getStrategies() {
        return [...this.strategies];
    }
}
/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG = {
    chunkSize: 250, // Target 200-300 tokens
    chunkOverlap: 50
};
/**
 * Global chunking strategy registry
 */
export const chunkingRegistry = new ChunkingStrategyRegistry();
/**
 * Generic chunking function that uses registered strategies
 */
export async function chunkGenericDocument(document, config = DEFAULT_CHUNK_CONFIG) {
    const strategy = chunkingRegistry.findStrategy(document.contentType);
    if (!strategy) {
        throw new Error(`No chunking strategy found for content type: ${document.contentType}`);
    }
    return strategy.chunk(document, config);
}
/**
 * Text document chunking function
 * Uses the text chunking strategy from the text implementation layer
 */
export async function chunkDocument(document, config = DEFAULT_CHUNK_CONFIG) {
    // Import the text chunker implementation dynamically to avoid circular dependencies
    const { chunkDocument: textChunkDocument } = await import('../text/chunker.js');
    return textChunkDocument(document, config);
}
/**
 * Register the text chunking strategy with the global registry
 * This should be called during application initialization
 */
export async function registerTextChunkingStrategy() {
    const { TextChunkingStrategy } = await import('../text/chunker.js');
    const textStrategy = new TextChunkingStrategy();
    chunkingRegistry.register(textStrategy);
}
// Auto-register the text strategy when this module is loaded
// This ensures text chunking works out of the box
registerTextChunkingStrategy().catch(error => {
    console.warn('Failed to register text chunking strategy:', error);
});
