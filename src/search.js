/**
 * Public API SearchEngine - Simple constructor with Chameleon Architecture
 *
 * This class provides a clean, simple API that automatically adapts to the mode
 * (text or multimodal) stored in the database during ingestion. The system detects
 * the mode and creates the appropriate embedder and reranker without user intervention.
 *
 * Chameleon Architecture Features:
 * - Automatic mode detection from database configuration
 * - Seamless switching between text and multimodal modes
 * - Appropriate embedder selection (sentence-transformer or CLIP)
 * - Mode-specific reranking strategies
 *
 * @example
 * ```typescript
 * // Simple usage - mode automatically detected from database
 * const search = new SearchEngine('./index.bin', './db.sqlite');
 * const results = await search.search('query');
 *
 * // Works for both text and multimodal databases
 * // Text mode: uses sentence-transformer embeddings
 * // Multimodal mode: uses CLIP embeddings for cross-modal search
 *
 * // With options (advanced)
 * const search = new SearchEngine('./index.bin', './db.sqlite', {
 *   enableReranking: true
 * });
 * ```
 */
import { SearchEngine as CoreSearchEngine } from './core/search.js';
export class SearchEngine {
    indexPath;
    dbPath;
    options;
    coreEngine = null;
    initPromise = null;
    constructor(indexPath, dbPath, options = {}) {
        this.indexPath = indexPath;
        this.dbPath = dbPath;
        this.options = options;
        // Validate required parameters
        if (!indexPath || typeof indexPath !== 'string' || indexPath.trim() === '') {
            throw new Error('Both indexPath and dbPath are required.\n' +
                'Example: const search = new SearchEngine("./index.bin", "./db.sqlite");\n' +
                'Or use: const search = await SearchFactory.create("./index.bin", "./db.sqlite");');
        }
        if (!dbPath || typeof dbPath !== 'string' || dbPath.trim() === '') {
            throw new Error('Both indexPath and dbPath are required.\n' +
                'Example: const search = new SearchEngine("./index.bin", "./db.sqlite");\n' +
                'Or use: const search = await SearchFactory.create("./index.bin", "./db.sqlite");');
        }
    }
    /**
     * Initialize the search engine using polymorphic factory or direct injection
     *
     * Chameleon Architecture Implementation:
     * - Automatically detects mode from database (text or multimodal)
     * - Creates appropriate embedder based on detected mode
     * - Applies mode-specific reranking strategies
     * - Provides seamless polymorphic behavior
     */
    async initialize() {
        if (this.coreEngine) {
            return; // Already initialized
        }
        if (this.initPromise) {
            return this.initPromise; // Initialization in progress
        }
        this.initPromise = (async () => {
            // If custom functions are provided, use direct dependency injection
            if (this.options.embedFn || this.options.rerankFn) {
                const { IndexManager } = await import('./index-manager.js');
                const { openDatabase } = await import('./core/db.js');
                const { createTextEmbedFunction } = await import('./text/embedder.js');
                const { existsSync } = await import('fs');
                // Validate files exist
                if (!existsSync(this.indexPath)) {
                    throw new Error(`Vector index not found at: ${this.indexPath}`);
                }
                if (!existsSync(this.dbPath)) {
                    throw new Error(`Database not found at: ${this.dbPath}`);
                }
                // Use custom embedFn or create default
                const embedFn = this.options.embedFn || createTextEmbedFunction(this.options.embeddingModel);
                // Get model defaults for dimensions
                const { getModelDefaults, config } = await import('./core/config.js');
                const modelDefaults = getModelDefaults(this.options.embeddingModel || config.embedding_model);
                // Initialize dependencies
                const db = await openDatabase(this.dbPath);
                const indexManager = new IndexManager(this.indexPath, this.dbPath, modelDefaults.dimensions, this.options.embeddingModel);
                await indexManager.initialize();
                // Create ContentResolver for unified content system
                const { ContentResolver } = await import('./core/content-resolver.js');
                const contentResolver = new ContentResolver(db);
                // Create core engine with dependency injection
                this.coreEngine = new CoreSearchEngine(embedFn, indexManager, db, this.options.rerankFn, contentResolver);
            }
            else {
                // Use core polymorphic factory for automatic mode detection (Chameleon Architecture)
                // This enables SearchEngine to automatically adapt to text or multimodal mode
                // based on the configuration stored in the database during ingestion
                const { SearchFactory } = await import('./factories/search-factory.js');
                this.coreEngine = await SearchFactory.create(this.indexPath, this.dbPath);
            }
        })();
        return this.initPromise;
    }
    /**
     * Perform semantic search
     */
    async search(query, options) {
        await this.initialize();
        if (!this.coreEngine) {
            throw new Error('SearchEngine failed to initialize');
        }
        return this.coreEngine.search(query, options);
    }
    /**
     * Retrieve content by ID in the specified format
     * @param contentId - Content ID to retrieve
     * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
     * @returns Promise that resolves to content in requested format
     */
    async getContent(contentId, format = 'file') {
        await this.initialize();
        if (!this.coreEngine) {
            throw new Error('SearchEngine failed to initialize');
        }
        return this.coreEngine.getContent(contentId, format);
    }
    /**
     * Retrieve multiple content items efficiently in batch
     * @param contentIds - Array of content IDs to retrieve
     * @param format - Format to return ('file' for CLI clients, 'base64' for MCP clients)
     * @returns Promise that resolves to array of content in requested format
     */
    async getContentBatch(contentIds, format = 'file') {
        await this.initialize();
        if (!this.coreEngine) {
            throw new Error('SearchEngine failed to initialize');
        }
        return this.coreEngine.getContentBatch(contentIds, format);
    }
    /**
     * Retrieve content metadata for result enhancement
     * @param contentId - Content ID to get metadata for
     * @returns Promise that resolves to content metadata
     */
    async getContentMetadata(contentId) {
        await this.initialize();
        if (!this.coreEngine) {
            throw new Error('SearchEngine failed to initialize');
        }
        return this.coreEngine.getContentMetadata(contentId);
    }
    /**
     * Verify that content exists and is accessible
     * @param contentId - Content ID to verify
     * @returns Promise that resolves to true if content exists, false otherwise
     */
    async verifyContentExists(contentId) {
        await this.initialize();
        if (!this.coreEngine) {
            throw new Error('SearchEngine failed to initialize');
        }
        return this.coreEngine.verifyContentExists(contentId);
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.coreEngine) {
            await this.coreEngine.cleanup();
        }
    }
}
