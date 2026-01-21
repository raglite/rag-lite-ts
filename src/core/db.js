/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { handleError, ErrorSeverity, createError } from './error-handler.js';
/**
 * Opens a SQLite database connection with promisified methods
 * @param dbPath - Path to the SQLite database file
 * @returns Promise that resolves to a database connection object
 */
export function openDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                const errorMsg = `Failed to open database at ${dbPath}: ${err.message}`;
                // Categorize database errors for better handling
                if (err.message.includes('ENOENT')) {
                    handleError(createError.fileSystem(`Database file not found: ${dbPath}. It will be created automatically.`), 'Database Connection', { severity: ErrorSeverity.INFO });
                }
                else if (err.message.includes('EACCES') || err.message.includes('permission')) {
                    reject(createError.database(`Permission denied accessing database: ${dbPath}. Check file permissions.`));
                    return;
                }
                else if (err.message.includes('SQLITE_CORRUPT')) {
                    reject(createError.database(`Database file is corrupted: ${dbPath}. Try running 'raglite rebuild'.`));
                    return;
                }
                else {
                    reject(createError.database(errorMsg));
                    return;
                }
            }
            // Enable foreign key constraints
            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    reject(createError.database(`Failed to enable foreign keys: ${err.message}`));
                    return;
                }
                // Create promisified methods with proper context binding and error handling
                const connection = {
                    db,
                    run: (sql, params) => {
                        return new Promise((resolve, reject) => {
                            db.run(sql, params || [], function (err) {
                                if (err) {
                                    // Enhance SQLite error messages
                                    const enhancedError = enhanceSQLiteError(err, sql);
                                    reject(enhancedError);
                                }
                                else {
                                    resolve(this);
                                }
                            });
                        });
                    },
                    get: promisify(db.get.bind(db)),
                    all: promisify(db.all.bind(db)),
                    close: promisify(db.close.bind(db))
                };
                resolve(connection);
            });
        });
    });
}
/**
 * Enhance SQLite error messages with more context
 */
function enhanceSQLiteError(error, sql) {
    let enhancedMessage = error.message;
    if (error.message.includes('SQLITE_BUSY')) {
        enhancedMessage = 'Database is locked by another process. Ensure no other RAG-lite instances are running.';
    }
    else if (error.message.includes('SQLITE_FULL')) {
        enhancedMessage = 'Database disk is full. Free up disk space and try again.';
    }
    else if (error.message.includes('SQLITE_CORRUPT')) {
        enhancedMessage = 'Database file is corrupted. Try running "raglite rebuild" to recreate it.';
    }
    else if (error.message.includes('UNIQUE constraint failed')) {
        enhancedMessage = `Duplicate entry detected: ${error.message}. This item may already exist.`;
    }
    else if (error.message.includes('FOREIGN KEY constraint failed')) {
        enhancedMessage = `Foreign key constraint violation: ${error.message}. Referenced record may not exist.`;
    }
    if (sql && sql.length < 200) {
        enhancedMessage += `\nSQL: ${sql}`;
    }
    return new Error(enhancedMessage);
}
/**
 * Initializes the database schema with all required tables and indexes
 * Enhanced to support content types for multimodal use
 * @param connection - Database connection object
 */
export async function initializeSchema(connection) {
    try {
        // Create documents table with content type support and content_id reference
        await connection.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id TEXT,                        -- References content_metadata.id
        source TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES content_metadata(id)
      )
    `);
        // Create chunks table with content type and metadata support
        await connection.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id TEXT NOT NULL UNIQUE,
        document_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        chunk_index INTEGER NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);
        // Create content_metadata table for unified content system
        await connection.run(`
      CREATE TABLE IF NOT EXISTS content_metadata (
        id TEXT PRIMARY KEY,                    -- Hash-based content ID
        storage_type TEXT NOT NULL CHECK (storage_type IN ('filesystem', 'content_dir')),
        original_path TEXT,                     -- Original file path (filesystem only)
        content_path TEXT NOT NULL,             -- Actual storage path
        display_name TEXT NOT NULL,             -- User-friendly name
        content_type TEXT NOT NULL,             -- MIME type
        file_size INTEGER NOT NULL,             -- Size in bytes
        content_hash TEXT NOT NULL,             -- SHA-256 hash
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create storage_stats table for basic content directory tracking
        await connection.run(`
      CREATE TABLE IF NOT EXISTS storage_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content_dir_files INTEGER DEFAULT 0,
        content_dir_size INTEGER DEFAULT 0,
        filesystem_refs INTEGER DEFAULT 0,
        last_cleanup DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create system_info table for mode persistence and model tracking
        await connection.run(`
      CREATE TABLE IF NOT EXISTS system_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        
        -- Core mode and model information
        mode TEXT NOT NULL DEFAULT 'text' CHECK (mode IN ('text', 'multimodal')),
        model_name TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
        model_type TEXT NOT NULL DEFAULT 'sentence-transformer' CHECK (model_type IN ('sentence-transformer', 'clip')),
        model_dimensions INTEGER NOT NULL DEFAULT 384,
        model_version TEXT NOT NULL DEFAULT '',
        
        -- Content type support (JSON array)
        supported_content_types TEXT NOT NULL DEFAULT '["text"]',
        
        -- Reranking configuration
        reranking_strategy TEXT DEFAULT 'cross-encoder' CHECK (
          reranking_strategy IN ('cross-encoder', 'text-derived', 'disabled')
        ),
        reranking_model TEXT,
        reranking_config TEXT, -- JSON configuration for strategy-specific settings
        
        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Clean slate approach - no migration logic needed
        // Users will perform fresh ingestion with the new architecture
        // Create indexes for performance
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_chunks_embedding_id ON chunks(embedding_id)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_chunks_content_type ON chunks(content_type)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_documents_content_id ON documents(content_id)
    `);
        // Create indexes for content metadata table for efficient lookup
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_content_hash ON content_metadata(content_hash)
    `);
        await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_storage_type ON content_metadata(storage_type)
    `);
        console.log('Database schema initialized successfully');
    }
    catch (error) {
        throw new Error(`Failed to initialize database schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Inserts a new document into the database with content type support
 * @param connection - Database connection object
 * @param source - Source path of the document
 * @param title - Title of the document
 * @param contentType - Type of content ('text', 'image', etc.)
 * @param metadata - Optional metadata object
 * @param contentId - Optional content ID referencing content_metadata table
 * @returns Promise that resolves to the document ID
 */
export async function insertDocument(connection, source, title, contentType = 'text', metadata, contentId) {
    try {
        // Validate content type
        validateContentType(contentType);
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        const result = await connection.run('INSERT INTO documents (content_id, source, title, content_type, metadata) VALUES (?, ?, ?, ?, ?)', [contentId || null, source, title, contentType, metadataJson]);
        if (typeof result.lastID !== 'number' || result.lastID <= 0) {
            throw new Error('Failed to get document ID after insertion');
        }
        return result.lastID;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(`Document with source '${source}' already exists`);
        }
        throw new Error(`Failed to insert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Inserts or updates a chunk in the database with content type support (upsert operation)
 * @param connection - Database connection object
 * @param embeddingId - Unique embedding ID for the chunk
 * @param documentId - ID of the parent document
 * @param content - Content of the chunk (text, image path, etc.)
 * @param chunkIndex - Index of the chunk within the document
 * @param contentType - Type of content ('text', 'image', etc.)
 * @param metadata - Optional metadata object
 */
export async function insertChunk(connection, embeddingId, documentId, content, chunkIndex, contentType = 'text', metadata) {
    try {
        // Validate content type
        validateContentType(contentType);
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        // Use INSERT OR REPLACE to handle duplicates gracefully
        await connection.run('INSERT OR REPLACE INTO chunks (embedding_id, document_id, content, chunk_index, content_type, metadata) VALUES (?, ?, ?, ?, ?, ?)', [embeddingId, documentId, content, chunkIndex, contentType, metadataJson]);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
            throw new Error(`Document with ID ${documentId} does not exist`);
        }
        throw new Error(`Failed to insert/update chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Inserts a new document or returns existing document ID if it already exists
 * Enhanced with content type support
 * @param connection - Database connection object
 * @param source - Source path of the document
 * @param title - Title of the document
 * @param contentType - Type of content ('text', 'image', etc.)
 * @param metadata - Optional metadata object
 * @param contentId - Optional content ID referencing content_metadata table
 * @returns Promise that resolves to the document ID
 */
export async function upsertDocument(connection, source, title, contentType = 'text', metadata, contentId) {
    try {
        // Validate content type
        validateContentType(contentType);
        // First try to get existing document
        const existing = await connection.get('SELECT id FROM documents WHERE source = ?', [source]);
        if (existing) {
            return existing.id;
        }
        // Insert new document if it doesn't exist
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        const result = await connection.run('INSERT INTO documents (content_id, source, title, content_type, metadata) VALUES (?, ?, ?, ?, ?)', [contentId || null, source, title, contentType, metadataJson]);
        if (typeof result.lastID !== 'number' || result.lastID <= 0) {
            throw new Error('Failed to get document ID after insertion');
        }
        return result.lastID;
    }
    catch (error) {
        throw new Error(`Failed to upsert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Retrieves chunks by their embedding IDs with document metadata
 * Enhanced to include content type information
 * @param connection - Database connection object
 * @param embeddingIds - Array of embedding IDs to retrieve
 * @returns Promise that resolves to an array of chunk results with document metadata
 */
export async function getChunksByEmbeddingIds(connection, embeddingIds) {
    if (embeddingIds.length === 0) {
        return [];
    }
    try {
        const placeholders = embeddingIds.map(() => '?').join(',');
        const sql = `
      SELECT 
        c.id,
        c.embedding_id,
        c.document_id,
        c.content,
        c.content_type,
        c.chunk_index,
        c.metadata,
        c.created_at,
        d.source as document_source,
        d.title as document_title,
        d.content_type as document_content_type,
        d.content_id as document_content_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding_id IN (${placeholders})
      ORDER BY c.chunk_index
    `;
        const results = await connection.all(sql, embeddingIds);
        // Parse metadata JSON strings back to objects
        return results.map((row) => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        }));
    }
    catch (error) {
        throw new Error(`Failed to retrieve chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Validates mode value against allowed enum values
 */
function validateMode(mode) {
    const validModes = ['text', 'multimodal'];
    if (!validModes.includes(mode)) {
        throw new Error(`Invalid mode '${mode}'. Must be one of: ${validModes.join(', ')}`);
    }
}
/**
 * Validates model type value against allowed enum values
 */
function validateModelType(modelType) {
    const validTypes = ['sentence-transformer', 'clip'];
    if (!validTypes.includes(modelType)) {
        throw new Error(`Invalid model type '${modelType}'. Must be one of: ${validTypes.join(', ')}`);
    }
}
/**
 * Validates reranking strategy value against allowed enum values
 */
function validateRerankingStrategy(strategy) {
    const validStrategies = ['cross-encoder', 'text-derived', 'metadata', 'hybrid', 'disabled'];
    if (!validStrategies.includes(strategy)) {
        throw new Error(`Invalid reranking strategy '${strategy}'. Must be one of: ${validStrategies.join(', ')}`);
    }
}
/**
 * Validates content type value against allowed types
 */
function validateContentType(contentType) {
    const validTypes = ['text', 'image', 'pdf', 'docx'];
    if (!validTypes.includes(contentType)) {
        throw new Error(`Invalid content type '${contentType}'. Must be one of: ${validTypes.join(', ')}`);
    }
}
/**
 * Gets the complete system information from system_info table
 * @param connection - Database connection object
 * @returns Promise that resolves to SystemInfo object or null if not set
 */
export async function getSystemInfo(connection) {
    try {
        const result = await connection.get(`
      SELECT 
        mode, model_name, model_type, model_dimensions, model_version,
        supported_content_types, reranking_strategy, reranking_model, 
        reranking_config, created_at, updated_at
      FROM system_info WHERE id = 1
    `);
        if (!result) {
            return null;
        }
        // Parse JSON fields and convert to proper types
        const supportedContentTypes = result.supported_content_types
            ? JSON.parse(result.supported_content_types)
            : ['text'];
        const rerankingConfig = result.reranking_config
            ? JSON.parse(result.reranking_config)
            : undefined;
        return {
            mode: result.mode,
            modelName: result.model_name,
            modelType: result.model_type,
            modelDimensions: result.model_dimensions,
            modelVersion: result.model_version,
            supportedContentTypes,
            rerankingStrategy: result.reranking_strategy,
            rerankingModel: result.reranking_model,
            rerankingConfig,
            createdAt: new Date(result.created_at),
            updatedAt: new Date(result.updated_at)
        };
    }
    catch (error) {
        throw new Error(`Failed to get system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Sets the complete system information in system_info table
 * @param connection - Database connection object
 * @param systemInfo - SystemInfo object to store
 */
export async function setSystemInfo(connection, systemInfo) {
    try {
        // Validate enum values if provided
        if (systemInfo.mode) {
            validateMode(systemInfo.mode);
        }
        if (systemInfo.modelType) {
            validateModelType(systemInfo.modelType);
        }
        if (systemInfo.rerankingStrategy) {
            validateRerankingStrategy(systemInfo.rerankingStrategy);
        }
        // Check if there's already a row
        const existing = await connection.get('SELECT id FROM system_info WHERE id = 1');
        // Prepare JSON fields
        const supportedContentTypesJson = systemInfo.supportedContentTypes
            ? JSON.stringify(systemInfo.supportedContentTypes)
            : undefined;
        const rerankingConfigJson = systemInfo.rerankingConfig
            ? JSON.stringify(systemInfo.rerankingConfig)
            : undefined;
        if (existing) {
            // Build dynamic UPDATE query based on provided fields
            const updateFields = [];
            const updateValues = [];
            if (systemInfo.mode !== undefined) {
                updateFields.push('mode = ?');
                updateValues.push(systemInfo.mode);
            }
            if (systemInfo.modelName !== undefined) {
                updateFields.push('model_name = ?');
                updateValues.push(systemInfo.modelName);
            }
            if (systemInfo.modelType !== undefined) {
                updateFields.push('model_type = ?');
                updateValues.push(systemInfo.modelType);
            }
            if (systemInfo.modelDimensions !== undefined) {
                updateFields.push('model_dimensions = ?');
                updateValues.push(systemInfo.modelDimensions);
            }
            if (systemInfo.modelVersion !== undefined) {
                updateFields.push('model_version = ?');
                updateValues.push(systemInfo.modelVersion);
            }
            if (supportedContentTypesJson !== undefined) {
                updateFields.push('supported_content_types = ?');
                updateValues.push(supportedContentTypesJson);
            }
            if (systemInfo.rerankingStrategy !== undefined) {
                updateFields.push('reranking_strategy = ?');
                updateValues.push(systemInfo.rerankingStrategy);
            }
            if (systemInfo.rerankingModel !== undefined) {
                updateFields.push('reranking_model = ?');
                updateValues.push(systemInfo.rerankingModel);
            }
            if (rerankingConfigJson !== undefined) {
                updateFields.push('reranking_config = ?');
                updateValues.push(rerankingConfigJson);
            }
            // Always update the timestamp
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(1); // Add WHERE clause parameter
            if (updateFields.length > 1) { // More than just the timestamp
                const sql = `UPDATE system_info SET ${updateFields.join(', ')} WHERE id = ?`;
                await connection.run(sql, updateValues);
            }
        }
        else {
            // Insert new row with provided values and defaults
            const insertSql = `
        INSERT INTO system_info (
          id, mode, model_name, model_type, model_dimensions, model_version,
          supported_content_types, reranking_strategy, reranking_model, reranking_config,
          created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
            await connection.run(insertSql, [
                systemInfo.mode || 'text',
                systemInfo.modelName || 'sentence-transformers/all-MiniLM-L6-v2',
                systemInfo.modelType || 'sentence-transformer',
                systemInfo.modelDimensions || 384,
                systemInfo.modelVersion || '',
                supportedContentTypesJson || '["text"]',
                systemInfo.rerankingStrategy || 'cross-encoder',
                systemInfo.rerankingModel || null,
                rerankingConfigJson || null
            ]);
        }
    }
    catch (error) {
        throw new Error(`Failed to set system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// =============================================================================
// REMOVED IN v3.0.0: Legacy database functions
// =============================================================================
// The following functions have been removed. Use getSystemInfo() and setSystemInfo() instead:
//
// - getModelVersion() → Use: const systemInfo = await getSystemInfo(db); const version = systemInfo?.modelVersion;
// - setModelVersion() → Use: await setSystemInfo(db, { modelVersion: 'version' });
// - getStoredModelInfo() → Use: const systemInfo = await getSystemInfo(db); access systemInfo.modelName and systemInfo.modelDimensions
// - setStoredModelInfo() → Use: await setSystemInfo(db, { modelName: 'name', modelDimensions: 384 });
//
// Migration guide: See CHANGELOG.md for v3.0.0 breaking changes
/**
 * Retrieves documents by content type
 * @param connection - Database connection object
 * @param contentType - Content type to filter by
 * @returns Promise that resolves to an array of documents
 */
export async function getDocumentsByContentType(connection, contentType) {
    try {
        validateContentType(contentType);
        const results = await connection.all('SELECT id, source, title, content_type, metadata, created_at FROM documents WHERE content_type = ? ORDER BY created_at DESC', [contentType]);
        // Parse metadata JSON strings back to objects
        return results.map((row) => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        }));
    }
    catch (error) {
        throw new Error(`Failed to get documents by content type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Retrieves chunks by content type
 * @param connection - Database connection object
 * @param contentType - Content type to filter by
 * @returns Promise that resolves to an array of chunks with document metadata
 */
export async function getChunksByContentType(connection, contentType) {
    try {
        validateContentType(contentType);
        const sql = `
      SELECT 
        c.id,
        c.embedding_id,
        c.document_id,
        c.content,
        c.content_type,
        c.chunk_index,
        c.metadata,
        c.created_at,
        d.source as document_source,
        d.title as document_title,
        d.content_type as document_content_type,
        d.content_id as document_content_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.content_type = ?
      ORDER BY d.source, c.chunk_index
    `;
        const results = await connection.all(sql, [contentType]);
        // Parse metadata JSON strings back to objects
        return results.map((row) => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        }));
    }
    catch (error) {
        throw new Error(`Failed to get chunks by content type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Gets content type statistics from the database
 * @param connection - Database connection object
 * @returns Promise that resolves to content type statistics
 */
export async function getContentTypeStatistics(connection) {
    try {
        // Get document statistics
        const docStats = await connection.all(`
      SELECT content_type, COUNT(*) as count 
      FROM documents 
      GROUP BY content_type
    `);
        // Get chunk statistics
        const chunkStats = await connection.all(`
      SELECT content_type, COUNT(*) as count 
      FROM chunks 
      GROUP BY content_type
    `);
        // Get totals
        const totalDocs = await connection.get('SELECT COUNT(*) as count FROM documents');
        const totalChunks = await connection.get('SELECT COUNT(*) as count FROM chunks');
        const documentStats = {};
        const chunkStatsMap = {};
        docStats.forEach((row) => {
            documentStats[row.content_type] = row.count;
        });
        chunkStats.forEach((row) => {
            chunkStatsMap[row.content_type] = row.count;
        });
        return {
            documents: documentStats,
            chunks: chunkStatsMap,
            total: {
                documents: totalDocs.count,
                chunks: totalChunks.count
            }
        };
    }
    catch (error) {
        throw new Error(`Failed to get content type statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Updates document metadata
 * @param connection - Database connection object
 * @param documentId - ID of the document to update
 * @param metadata - New metadata object
 */
export async function updateDocumentMetadata(connection, documentId, metadata) {
    try {
        const metadataJson = JSON.stringify(metadata);
        const result = await connection.run('UPDATE documents SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [metadataJson, documentId]);
        if (result.changes === 0) {
            throw new Error(`Document with ID ${documentId} not found`);
        }
    }
    catch (error) {
        throw new Error(`Failed to update document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Updates chunk metadata
 * @param connection - Database connection object
 * @param chunkId - ID of the chunk to update
 * @param metadata - New metadata object
 */
export async function updateChunkMetadata(connection, chunkId, metadata) {
    try {
        const metadataJson = JSON.stringify(metadata);
        const result = await connection.run('UPDATE chunks SET metadata = ? WHERE id = ?', [metadataJson, chunkId]);
        if (result.changes === 0) {
            throw new Error(`Chunk with ID ${chunkId} not found`);
        }
    }
    catch (error) {
        throw new Error(`Failed to update chunk metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Inserts content metadata into the content_metadata table
 * @param connection - Database connection object
 * @param contentMetadata - Content metadata to insert
 */
export async function insertContentMetadata(connection, contentMetadata) {
    try {
        await connection.run(`
      INSERT INTO content_metadata (
        id, storage_type, original_path, content_path, display_name, 
        content_type, file_size, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            contentMetadata.id,
            contentMetadata.storageType,
            contentMetadata.originalPath || null,
            contentMetadata.contentPath,
            contentMetadata.displayName,
            contentMetadata.contentType,
            contentMetadata.fileSize,
            contentMetadata.contentHash
        ]);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(`Content with ID '${contentMetadata.id}' already exists`);
        }
        throw new Error(`Failed to insert content metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Gets content metadata by content ID
 * @param connection - Database connection object
 * @param contentId - Content ID to retrieve
 * @returns Promise that resolves to ContentMetadata or null if not found
 */
export async function getContentMetadata(connection, contentId) {
    try {
        const result = await connection.get(`
      SELECT id, storage_type, original_path, content_path, display_name,
             content_type, file_size, content_hash, created_at
      FROM content_metadata 
      WHERE id = ?
    `, [contentId]);
        if (!result) {
            return null;
        }
        return {
            id: result.id,
            storageType: result.storage_type,
            originalPath: result.original_path,
            contentPath: result.content_path,
            displayName: result.display_name,
            contentType: result.content_type,
            fileSize: result.file_size,
            contentHash: result.content_hash,
            createdAt: new Date(result.created_at)
        };
    }
    catch (error) {
        throw new Error(`Failed to get content metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Gets content metadata by content hash (for deduplication)
 * @param connection - Database connection object
 * @param contentHash - Content hash to search for
 * @returns Promise that resolves to ContentMetadata or null if not found
 */
export async function getContentMetadataByHash(connection, contentHash) {
    try {
        const result = await connection.get(`
      SELECT id, storage_type, original_path, content_path, display_name,
             content_type, file_size, content_hash, created_at
      FROM content_metadata 
      WHERE content_hash = ?
    `, [contentHash]);
        if (!result) {
            return null;
        }
        return {
            id: result.id,
            storageType: result.storage_type,
            originalPath: result.original_path,
            contentPath: result.content_path,
            displayName: result.display_name,
            contentType: result.content_type,
            fileSize: result.file_size,
            contentHash: result.content_hash,
            createdAt: new Date(result.created_at)
        };
    }
    catch (error) {
        throw new Error(`Failed to get content metadata by hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Gets all content metadata by storage type
 * @param connection - Database connection object
 * @param storageType - Storage type to filter by
 * @returns Promise that resolves to array of ContentMetadata
 */
export async function getContentMetadataByStorageType(connection, storageType) {
    try {
        const results = await connection.all(`
      SELECT id, storage_type, original_path, content_path, display_name,
             content_type, file_size, content_hash, created_at
      FROM content_metadata 
      WHERE storage_type = ?
      ORDER BY created_at DESC
    `, [storageType]);
        return results.map((result) => ({
            id: result.id,
            storageType: result.storage_type,
            originalPath: result.original_path,
            contentPath: result.content_path,
            displayName: result.display_name,
            contentType: result.content_type,
            fileSize: result.file_size,
            contentHash: result.content_hash,
            createdAt: new Date(result.created_at)
        }));
    }
    catch (error) {
        throw new Error(`Failed to get content metadata by storage type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Deletes content metadata by content ID
 * @param connection - Database connection object
 * @param contentId - Content ID to delete
 * @returns Promise that resolves to true if deleted, false if not found
 */
export async function deleteContentMetadata(connection, contentId) {
    try {
        const result = await connection.run('DELETE FROM content_metadata WHERE id = ?', [contentId]);
        return result.changes > 0;
    }
    catch (error) {
        throw new Error(`Failed to delete content metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Gets storage statistics from storage_stats table
 * @param connection - Database connection object
 * @returns Promise that resolves to storage statistics
 */
export async function getStorageStats(connection) {
    try {
        const result = await connection.get(`
      SELECT content_dir_files, content_dir_size, filesystem_refs, 
             last_cleanup, updated_at
      FROM storage_stats 
      WHERE id = 1
    `);
        if (!result) {
            return null;
        }
        return {
            contentDirFiles: result.content_dir_files,
            contentDirSize: result.content_dir_size,
            filesystemRefs: result.filesystem_refs,
            lastCleanup: result.last_cleanup ? new Date(result.last_cleanup) : null,
            updatedAt: new Date(result.updated_at)
        };
    }
    catch (error) {
        throw new Error(`Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Updates storage statistics in storage_stats table
 * @param connection - Database connection object
 * @param stats - Partial storage statistics to update
 */
export async function updateStorageStats(connection, stats) {
    try {
        // Check if there's already a row
        const existing = await connection.get('SELECT id FROM storage_stats WHERE id = 1');
        if (existing) {
            // Build dynamic UPDATE query based on provided fields
            const updateFields = [];
            const updateValues = [];
            if (stats.contentDirFiles !== undefined) {
                updateFields.push('content_dir_files = ?');
                updateValues.push(stats.contentDirFiles);
            }
            if (stats.contentDirSize !== undefined) {
                updateFields.push('content_dir_size = ?');
                updateValues.push(stats.contentDirSize);
            }
            if (stats.filesystemRefs !== undefined) {
                updateFields.push('filesystem_refs = ?');
                updateValues.push(stats.filesystemRefs);
            }
            if (stats.lastCleanup !== undefined) {
                updateFields.push('last_cleanup = ?');
                updateValues.push(stats.lastCleanup.toISOString());
            }
            // Always update the timestamp
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(1); // Add WHERE clause parameter
            if (updateFields.length > 1) { // More than just the timestamp
                const sql = `UPDATE storage_stats SET ${updateFields.join(', ')} WHERE id = ?`;
                await connection.run(sql, updateValues);
            }
        }
        else {
            // Insert new row with provided values and defaults
            const insertSql = `
        INSERT INTO storage_stats (
          id, content_dir_files, content_dir_size, filesystem_refs, 
          last_cleanup, updated_at
        ) VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
            await connection.run(insertSql, [
                stats.contentDirFiles || 0,
                stats.contentDirSize || 0,
                stats.filesystemRefs || 0,
                stats.lastCleanup ? stats.lastCleanup.toISOString() : null
            ]);
        }
    }
    catch (error) {
        throw new Error(`Failed to update storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
