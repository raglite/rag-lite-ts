/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 *
 * This module defines the core interfaces for dependency injection in the search engine.
 * These interfaces enable:
 * 1. Different embedding implementations (text-only, multimodal, etc.)
 * 2. Different reranking strategies (cross-encoder, neural, etc.)
 * 3. Support for multiple content types (text, image, etc.)
 * 4. Different embedding dimensions (384, 512, 768, etc.)
 *
 * DEPENDENCY INJECTION PATTERNS:
 *
 * 1. Direct Function Injection (Advanced Users):
 * ```typescript
 * // Text-only implementation
 * const textEmbedFn: EmbedFunction = async (query) => textEmbedder.embedSingle(query);
 * const textRerankFn: RerankFunction = async (query, results) => textReranker.rerank(query, results);
 * const search = new SearchEngine(textEmbedFn, indexManager, db, textRerankFn);
 *
 * // Custom implementation
 * const customEmbedFn: EmbedFunction = async (query) => ({
 *   embedding_id: generateId(),
 *   vector: await myCustomModel.embed(query)
 * });
 * const search = new SearchEngine(customEmbedFn, indexManager, db);
 * ```
 *
 * 2. Factory Pattern (Recommended for Common Use Cases):
 * ```typescript
 * // Using factory for convenience
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite', {
 *   embeddingModel: 'all-MiniLM-L6-v2',
 *   enableReranking: true
 * });
 *
 * // Factory with custom configuration
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
 *   chunkSize: 300,
 *   chunkOverlap: 50
 * });
 * ```
 *
 * 3. Interface-Based Implementation (Plugin Architecture):
 * ```typescript
 * // Implement interfaces for custom behavior
 * class CustomEmbeddingInterface implements EmbeddingQueryInterface {
 *   async embedQuery(query: string): Promise<EmbeddingResult> {
 *     return { embedding_id: generateId(), vector: await this.model.embed(query) };
 *   }
 *   supportedContentTypes = ['text', 'code'];
 *   embeddingDimensions = 384;
 *   modelIdentifier = 'custom-model-v1';
 * }
 *
 * const customInterface = new CustomEmbeddingInterface();
 * const embedFn = customInterface.embedQuery.bind(customInterface);
 * const search = new SearchEngine(embedFn, indexManager, db);
 * ```
 *
 * 4. Multimodal Implementation (Future):
 * ```typescript
 * // Multimodal embedding function
 * const multimodalEmbedFn: EmbedFunction = async (query, contentType) => {
 *   if (contentType === 'image') return clipEmbedder.embedImage(query);
 *   return clipEmbedder.embedText(query);
 * };
 *
 * // Multimodal reranking function
 * const multimodalRerankFn: RerankFunction = async (query, results, contentType) => {
 *   return multimodalReranker.rerank(query, results, contentType);
 * };
 *
 * const search = new SearchEngine(multimodalEmbedFn, indexManager, db, multimodalRerankFn);
 * ```
 */
/**
 * Validation utilities for interface compatibility
 */
export class InterfaceValidator {
    /**
     * Validate that an EmbedFunction is compatible with expected interface
     */
    static validateEmbedFunction(embedFn) {
        return typeof embedFn === 'function';
    }
    /**
     * Validate that a RerankFunction is compatible with expected interface
     */
    static validateRerankFunction(rerankFn) {
        return typeof rerankFn === 'function';
    }
    /**
     * Validate embedding dimensions compatibility
     */
    static validateEmbeddingDimensions(expected, actual) {
        return expected === actual;
    }
    /**
     * Validate content type support
     */
    static validateContentTypeSupport(supportedTypes, requestedType) {
        return supportedTypes.includes(requestedType);
    }
}
