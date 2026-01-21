/**
 * CORE MODULE — Polymorphic Search Factory for Chameleon Architecture
 *
 * Automatically detects mode from database and creates the appropriate search engine.
 * No fallback mechanisms - each mode uses its optimal implementation reliably.
 *
 * Mode Behavior:
 * - Text Mode: Uses sentence-transformer models for fast text-only search
 * - Multimodal Mode: Uses CLIP models for cross-modal text/image search
 *
 * The mode is determined during ingestion and stored in the database, then
 * automatically detected during search - no manual configuration needed.
 */
// Ensure DOM polyfills are set up before any transformers.js usage
import '../dom-polyfills.js';
import { SearchEngine } from '../core/search.js';
import { ModeDetectionService } from '../core/mode-detection-service.js';
import { IndexManager } from '../index-manager.js';
import { DatabaseConnectionManager } from '../core/database-connection-manager.js';
import { createEmbedder } from '../core/embedder-factory.js';
import { ContentResolver } from '../core/content-resolver.js';
import { validateModeModelCompatibilityOrThrow } from '../core/mode-model-validator.js';
import { createMissingFileError } from '../core/actionable-error-messages.js';
import { handleError, ErrorCategory, ErrorSeverity, createError } from '../core/error-handler.js';
import { existsSync } from 'fs';
// =============================================================================
// POLYMORPHIC SEARCH FACTORY
// =============================================================================
/**
 * Factory for creating search engines with automatic mode detection
 *
 * Detects the mode from database configuration and creates the appropriate
 * search engine without fallback mechanisms. Each mode uses its optimal
 * implementation for predictable, reliable behavior.
 *
 * Mode Selection (configured during ingestion):
 * - Text Mode: Optimized for text-only content
 *   - Uses sentence-transformer models
 *   - Fast text similarity search
 *   - Images converted to text descriptions
 *
 * - Multimodal Mode: Optimized for mixed text/image content
 *   - Uses CLIP models
 *   - Unified embedding space for text and images
 *   - True cross-modal search capabilities
 *   - Text queries find images, image queries find text
 */
export class SearchFactory {
    /**
     * Create a SearchEngine with automatic mode detection and configuration
     *
     * Automatically detects the mode from database configuration and creates
     * the appropriate search engine. No fallback mechanisms - each mode works
     * reliably with its optimal implementation.
     *
     * Process:
     * 1. Detects mode from database (text or multimodal)
     * 2. Validates mode-model compatibility
     * 3. Creates appropriate embedder (sentence-transformer or CLIP)
     * 4. Creates appropriate reranker based on mode and strategy
     * 5. Initializes SearchEngine with proper dependency injection
     *
     * Mode Behavior:
     * - Text Mode: Fast text-only search with sentence-transformers
     *   - Optimized for text similarity
     *   - Optional cross-encoder reranking
     *
     * - Multimodal Mode: Cross-modal search with CLIP
     *   - Unified embedding space for text and images
     *   - Text queries find images, image queries find text
     *   - Optional text-derived or metadata reranking
     *
     * @param indexPath - Path to the vector index file (must exist)
     * @param dbPath - Path to the SQLite database file (must exist)
     * @returns Promise resolving to configured SearchEngine
     * @throws {Error} If files don't exist, mode-model incompatible, or initialization fails
     *
     * @example
     * ```typescript
     * // Automatic mode detection and engine creation
     * const search = await SearchFactory.create('./index.bin', './db.sqlite');
     *
     * // Search works based on detected mode:
     * // Text mode: fast text similarity search
     * const textResults = await search.search('machine learning');
     *
     * // Multimodal mode: cross-modal search
     * const imageResults = await search.search('red sports car'); // Finds images
     * ```
     */
    static async create(indexPath, dbPath) {
        try {
            console.log('🎭 SearchFactory: Initializing search engine with mode detection...');
            // Step 1: Validate input paths
            if (!indexPath || !dbPath) {
                throw createError.validation('Both indexPath and dbPath are required');
            }
            // Step 2: Validate that required files exist
            this.validateRequiredFiles(indexPath, dbPath);
            // Step 3: Get shared database connection
            const db = await DatabaseConnectionManager.getConnection(dbPath);
            // Step 4: Detect mode from database using shared connection
            const modeService = new ModeDetectionService(dbPath);
            const systemInfo = await modeService.detectMode(db);
            console.log(`🎯 Detected mode: ${systemInfo.mode} (model: ${systemInfo.modelName})`);
            // Step 4.5: Validate mode-model compatibility at creation time
            console.log('🔍 Validating mode-model compatibility...');
            validateModeModelCompatibilityOrThrow(systemInfo.mode, systemInfo.modelName);
            console.log('✓ Mode-model compatibility validated');
            // Step 5: Create search engine based on detected mode
            switch (systemInfo.mode) {
                case 'text':
                    return await this.createTextSearchEngine(indexPath, dbPath, systemInfo, db);
                case 'multimodal':
                    return await this.createMultimodalSearchEngine(indexPath, dbPath, systemInfo, db);
                default:
                    throw createError.validation(`Unsupported mode: ${systemInfo.mode}`);
            }
        }
        catch (error) {
            const enhancedError = this.enhanceCreationError(error, indexPath, dbPath);
            handleError(enhancedError, 'Polymorphic Search Factory', {
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.GENERAL
            });
            throw enhancedError;
        }
    }
    // =============================================================================
    // MODE-SPECIFIC ENGINE CREATION
    // =============================================================================
    /**
     * Create a search engine configured for text mode
     * @private
     */
    static async createTextSearchEngine(indexPath, dbPath, systemInfo, db) {
        console.log('📝 Creating text search engine...');
        try {
            // Step 1: Create text embedder
            const embedder = await createEmbedder(systemInfo.modelName);
            console.log(`✓ Text embedder created: ${systemInfo.modelName} (${systemInfo.modelDimensions}D)`);
            // Step 2: Create reranker based on strategy
            const rerankFn = await this.createTextReranker(systemInfo.rerankingStrategy);
            if (rerankFn) {
                console.log(`✓ Text reranker created: ${systemInfo.rerankingStrategy}`);
            }
            else {
                console.log('ℹ️  Reranking disabled');
            }
            // Step 3: Initialize core components (using shared connection)
            const indexManager = new IndexManager(indexPath, dbPath, systemInfo.modelDimensions, systemInfo.modelName);
            await indexManager.initialize();
            // Step 4: Create ContentResolver for unified content system
            const contentResolver = new ContentResolver(db);
            // Step 5: Create search engine with dependency injection
            const searchEngine = new SearchEngine(embedder.embedText.bind(embedder), indexManager, db, rerankFn, contentResolver);
            console.log('✅ Text search engine initialized successfully');
            return searchEngine;
        }
        catch (error) {
            throw createError.model(`Failed to create text search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a search engine configured for multimodal mode
     * @private
     */
    static async createMultimodalSearchEngine(indexPath, dbPath, systemInfo, db) {
        console.log('🖼️  Creating multimodal search engine...');
        try {
            // Step 1: Create multimodal embedder (CLIP)
            const embedder = await createEmbedder(systemInfo.modelName);
            console.log(`✓ Multimodal embedder created: ${systemInfo.modelName} (${systemInfo.modelDimensions}D)`);
            // Step 2: Create multimodal reranker based on strategy
            const rerankFn = await this.createMultimodalReranker(systemInfo.rerankingStrategy);
            if (rerankFn) {
                console.log(`✓ Multimodal reranker created: ${systemInfo.rerankingStrategy}`);
            }
            else {
                console.log('ℹ️  Reranking disabled');
            }
            // Step 3: Initialize core components (using shared connection)
            const indexManager = new IndexManager(indexPath, dbPath, systemInfo.modelDimensions, systemInfo.modelName);
            await indexManager.initialize();
            // Step 4: Create ContentResolver for unified content system
            const contentResolver = new ContentResolver(db);
            // Step 5: Create search engine with dependency injection
            const searchEngine = new SearchEngine(embedder.embedText.bind(embedder), indexManager, db, rerankFn, contentResolver);
            console.log('✅ Multimodal search engine initialized successfully');
            return searchEngine;
        }
        catch (error) {
            throw createError.model(`Failed to create multimodal search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // RERANKER CREATION FUNCTIONS
    // =============================================================================
    /**
     * Create reranker for text mode using lazy loading
     * @private
     */
    static async createTextReranker(strategy) {
        try {
            if (strategy === 'disabled') {
                return undefined;
            }
            // Use lazy loading to avoid loading reranking dependencies unless needed
            const { LazyRerankerLoader } = await import('../core/lazy-dependency-loader.js');
            // For text mode, use cross-encoder reranking
            if (strategy === 'cross-encoder') {
                return LazyRerankerLoader.loadTextReranker();
            }
            // Fail clearly for unknown strategies in text mode
            throw createError.validation(`Unknown text reranking strategy '${strategy}'. Supported strategies: cross-encoder, disabled`);
        }
        catch (error) {
            throw createError.model(`Failed to create text reranker with strategy '${strategy}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create reranker for multimodal mode using lazy loading
     * @private
     */
    static async createMultimodalReranker(strategy) {
        try {
            if (strategy === 'disabled') {
                return undefined;
            }
            // Use lazy loading to avoid loading multimodal dependencies unless needed
            const { LazyDependencyManager } = await import('../core/lazy-dependency-loader.js');
            // Load the appropriate reranker based on strategy
            return LazyDependencyManager.loadReranker(strategy);
        }
        catch (error) {
            throw createError.model(`Failed to create multimodal reranker with strategy '${strategy}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // VALIDATION AND ERROR HANDLING
    // =============================================================================
    /**
     * Validate that required files exist
     * @private
     */
    static validateRequiredFiles(indexPath, dbPath) {
        if (!existsSync(indexPath)) {
            throw createMissingFileError(indexPath, 'index', {
                operationContext: 'SearchFactory.create'
            });
        }
        if (!existsSync(dbPath)) {
            throw createMissingFileError(dbPath, 'database', {
                operationContext: 'SearchFactory.create'
            });
        }
    }
    /**
     * Enhance creation errors with helpful context
     * @private
     */
    static enhanceCreationError(error, indexPath, dbPath) {
        if (error instanceof Error) {
            // Add context about the operation that failed
            let enhancedMessage = `SearchFactory.create failed: ${error.message}`;
            // Provide specific guidance based on error type
            if (error.message.includes('ENOENT')) {
                enhancedMessage += '\n\n💡 Make sure both the vector index and database files exist.';
                enhancedMessage += '\n   Run ingestion first: raglite ingest <directory>';
            }
            else if (error.message.includes('SQLITE_CORRUPT')) {
                enhancedMessage += '\n\n💡 Database appears to be corrupted.';
                enhancedMessage += '\n   Try deleting the database and re-running ingestion.';
            }
            else if (error.message.includes('Model') && error.message.includes('not found')) {
                enhancedMessage += '\n\n💡 The model specified in the database is not supported.';
                enhancedMessage += '\n   Check the model name or re-run ingestion with a supported model.';
            }
            else if (error.message.includes('dimensions')) {
                enhancedMessage += '\n\n💡 Vector dimension mismatch detected.';
                enhancedMessage += '\n   The index was created with a different model. Rebuild the index:';
                enhancedMessage += '\n   raglite ingest <directory> --force-rebuild';
            }
            else if (error.message.includes('Cannot enlarge memory') ||
                error.message.includes('WebAssembly memory limit') ||
                error.message.includes('memory limit exceeded')) {
                enhancedMessage += '\n\n💡 WebAssembly memory limit exceeded.';
                enhancedMessage += '\n   Your vector index is too large for the 2GB WebAssembly memory limit.';
                enhancedMessage += '\n   Solutions:';
                enhancedMessage += '\n   1. Increase Node.js memory: node --max-old-space-size=4096 ...';
                enhancedMessage += '\n   2. Split your data into smaller indexes';
                enhancedMessage += '\n   3. Use a smaller embedding model (fewer dimensions)';
                enhancedMessage += '\n   4. Rebuild the index with fewer vectors';
            }
            return new Error(enhancedMessage);
        }
        return new Error(`SearchFactory.create failed: Unknown error`);
    }
}
// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================
/**
 * Quick function to create a search engine with automatic mode detection
 * Convenience wrapper around SearchFactory.create
 *
 * @param indexPath - Path to the vector index file
 * @param dbPath - Path to the database file
 * @returns Promise resolving to configured SearchEngine
 *
 * @example
 * ```typescript
 * const search = await createSearchEngine('./index.bin', './db.sqlite');
 * const results = await search.search('query');
 * ```
 */
export async function createSearchEngine(indexPath, dbPath) {
    return SearchFactory.create(indexPath, dbPath);
}
/**
 * Check what mode a database is configured for
 * Convenience function for inspecting database configuration
 *
 * @param dbPath - Path to the database file
 * @returns Promise resolving to the detected mode
 *
 * @example
 * ```typescript
 * const mode = await detectSearchEngineMode('./db.sqlite');
 * console.log(`Database is configured for ${mode} mode`);
 * ```
 */
export async function detectSearchEngineMode(dbPath) {
    const modeService = new ModeDetectionService(dbPath);
    const systemInfo = await modeService.detectMode();
    return systemInfo.mode;
}
/**
 * Get system information for a database
 * Convenience function for inspecting complete database configuration
 *
 * @param dbPath - Path to the database file
 * @returns Promise resolving to complete SystemInfo
 *
 * @example
 * ```typescript
 * const info = await getSearchEngineInfo('./db.sqlite');
 * console.log(`Mode: ${info.mode}, Model: ${info.modelName}, Dimensions: ${info.modelDimensions}`);
 * ```
 */
export async function getSearchEngineInfo(dbPath) {
    const modeService = new ModeDetectionService(dbPath);
    return modeService.detectMode();
}
