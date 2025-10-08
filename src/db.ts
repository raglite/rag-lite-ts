import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { handleError, ErrorCategory, ErrorSeverity, createError } from './error-handler.js';

// Type definitions for database operations
export interface DatabaseConnection {
  db: sqlite3.Database;
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

export interface ChunkResult {
  id: number;
  embedding_id: string;
  document_id: number;
  text: string;
  chunk_index: number;
  created_at: string;
  document_source: string;
  document_title: string;
}

/**
 * Opens a SQLite database connection with promisified methods
 * @param dbPath - Path to the SQLite database file
 * @returns Promise that resolves to a database connection object
 */
export function openDatabase(dbPath: string): Promise<DatabaseConnection> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        const errorMsg = `Failed to open database at ${dbPath}: ${err.message}`;
        
        // Categorize database errors for better handling
        if (err.message.includes('ENOENT')) {
          handleError(
            createError.fileSystem(`Database file not found: ${dbPath}. It will be created automatically.`),
            'Database Connection',
            { severity: ErrorSeverity.INFO }
          );
        } else if (err.message.includes('EACCES') || err.message.includes('permission')) {
          reject(createError.database(`Permission denied accessing database: ${dbPath}. Check file permissions.`));
          return;
        } else if (err.message.includes('SQLITE_CORRUPT')) {
          reject(createError.database(`Database file is corrupted: ${dbPath}. Try running 'raglite rebuild'.`));
          return;
        } else {
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
        const connection: DatabaseConnection = {
          db,
          run: (sql: string, params?: any[]) => {
            return new Promise((resolve, reject) => {
              db.run(sql, params || [], function(err) {
                if (err) {
                  // Enhance SQLite error messages
                  const enhancedError = enhanceSQLiteError(err, sql);
                  reject(enhancedError);
                } else {
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
function enhanceSQLiteError(error: Error, sql?: string): Error {
  let enhancedMessage = error.message;
  
  if (error.message.includes('SQLITE_BUSY')) {
    enhancedMessage = 'Database is locked by another process. Ensure no other RAG-lite instances are running.';
  } else if (error.message.includes('SQLITE_FULL')) {
    enhancedMessage = 'Database disk is full. Free up disk space and try again.';
  } else if (error.message.includes('SQLITE_CORRUPT')) {
    enhancedMessage = 'Database file is corrupted. Try running "raglite rebuild" to recreate it.';
  } else if (error.message.includes('UNIQUE constraint failed')) {
    enhancedMessage = `Duplicate entry detected: ${error.message}. This item may already exist.`;
  } else if (error.message.includes('FOREIGN KEY constraint failed')) {
    enhancedMessage = `Foreign key constraint violation: ${error.message}. Referenced record may not exist.`;
  }
  
  if (sql && sql.length < 200) {
    enhancedMessage += `\nSQL: ${sql}`;
  }
  
  return new Error(enhancedMessage);
}

/**
 * Initializes the database schema with all required tables and indexes
 * @param connection - Database connection object
 */
export async function initializeSchema(connection: DatabaseConnection): Promise<void> {
  try {
    // Create documents table
    await connection.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chunks table with foreign key relationship
    await connection.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id TEXT NOT NULL UNIQUE,
        document_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // Create system_info table for model version tracking
    await connection.run(`
      CREATE TABLE IF NOT EXISTS system_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        model_version TEXT NOT NULL,
        model_name TEXT,
        model_dimensions INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add model tracking columns if they don't exist (migration)
    try {
      await connection.run(`ALTER TABLE system_info ADD COLUMN model_name TEXT`);
    } catch (error) {
      // Column already exists, ignore error
      if (error instanceof Error && !error.message.includes('duplicate column name')) {
        throw error;
      }
    }

    try {
      await connection.run(`ALTER TABLE system_info ADD COLUMN model_dimensions INTEGER`);
    } catch (error) {
      // Column already exists, ignore error
      if (error instanceof Error && !error.message.includes('duplicate column name')) {
        throw error;
      }
    }

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

    console.log('Database schema initialized successfully');
  } catch (error) {
    throw new Error(`Failed to initialize database schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inserts a new document into the database
 * @param connection - Database connection object
 * @param source - Source path of the document
 * @param title - Title of the document
 * @returns Promise that resolves to the document ID
 */
export async function insertDocument(
  connection: DatabaseConnection,
  source: string,
  title: string
): Promise<number> {
  try {
    const result = await connection.run(
      'INSERT INTO documents (source, title) VALUES (?, ?)',
      [source, title]
    );
    
    if (typeof result.lastID !== 'number' || result.lastID <= 0) {
      throw new Error('Failed to get document ID after insertion');
    }
    
    return result.lastID;
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Document with source '${source}' already exists`);
    }
    throw new Error(`Failed to insert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inserts or updates a chunk in the database (upsert operation)
 * @param connection - Database connection object
 * @param embeddingId - Unique embedding ID for the chunk
 * @param documentId - ID of the parent document
 * @param text - Text content of the chunk
 * @param chunkIndex - Index of the chunk within the document
 */
export async function insertChunk(
  connection: DatabaseConnection,
  embeddingId: string,
  documentId: number,
  text: string,
  chunkIndex: number
): Promise<void> {
  try {
    // Use INSERT OR REPLACE to handle duplicates gracefully
    await connection.run(
      'INSERT OR REPLACE INTO chunks (embedding_id, document_id, text, chunk_index) VALUES (?, ?, ?, ?)',
      [embeddingId, documentId, text, chunkIndex]
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
      throw new Error(`Document with ID ${documentId} does not exist`);
    }
    throw new Error(`Failed to insert/update chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Inserts a new document or returns existing document ID if it already exists
 * @param connection - Database connection object
 * @param source - Source path of the document
 * @param title - Title of the document
 * @returns Promise that resolves to the document ID
 */
export async function upsertDocument(
  connection: DatabaseConnection,
  source: string,
  title: string
): Promise<number> {
  try {
    // First try to get existing document
    const existing = await connection.get(
      'SELECT id FROM documents WHERE source = ?',
      [source]
    );
    
    if (existing) {
      return existing.id;
    }
    
    // Insert new document if it doesn't exist
    const result = await connection.run(
      'INSERT INTO documents (source, title) VALUES (?, ?)',
      [source, title]
    );
    
    if (typeof result.lastID !== 'number' || result.lastID <= 0) {
      throw new Error('Failed to get document ID after insertion');
    }
    
    return result.lastID;
  } catch (error) {
    throw new Error(`Failed to upsert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves chunks by their embedding IDs with document metadata
 * @param connection - Database connection object
 * @param embeddingIds - Array of embedding IDs to retrieve
 * @returns Promise that resolves to an array of chunk results with document metadata
 */
export async function getChunksByEmbeddingIds(
  connection: DatabaseConnection,
  embeddingIds: string[]
): Promise<ChunkResult[]> {
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
        c.text,
        c.chunk_index,
        c.created_at,
        d.source as document_source,
        d.title as document_title
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding_id IN (${placeholders})
      ORDER BY c.chunk_index
    `;

    const results = await connection.all(sql, embeddingIds);
    return results as ChunkResult[];
  } catch (error) {
    throw new Error(`Failed to retrieve chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the current model version from system_info table
 * @param connection - Database connection object
 * @returns Promise that resolves to the model version string or null if not set
 */
export async function getModelVersion(connection: DatabaseConnection): Promise<string | null> {
  try {
    const result = await connection.get('SELECT model_version FROM system_info WHERE id = 1');
    return result ? result.model_version : null;
  } catch (error) {
    throw new Error(`Failed to get model version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sets the model version in system_info table
 * @param connection - Database connection object
 * @param modelVersion - Model version string to store
 */
export async function setModelVersion(connection: DatabaseConnection, modelVersion: string): Promise<void> {
  try {
    // Check if there's already a row
    const existing = await connection.get('SELECT model_name, model_dimensions FROM system_info WHERE id = 1');
    
    if (existing) {
      // Update only the model_version field, preserve existing model info
      await connection.run(
        'UPDATE system_info SET model_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [modelVersion]
      );
    } else {
      // Insert new row with just model_version
      await connection.run(
        'INSERT INTO system_info (id, model_version, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)',
        [modelVersion]
      );
    }
  } catch (error) {
    throw new Error(`Failed to set model version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the stored model information from system_info table
 * @param connection - Database connection object
 * @returns Promise that resolves to model info object or null if not set
 */
export async function getStoredModelInfo(connection: DatabaseConnection): Promise<{
  modelName: string;
  dimensions: number;
} | null> {
  try {
    const result = await connection.get(
      'SELECT model_name, model_dimensions FROM system_info WHERE id = 1'
    );
    
    if (!result || !result.model_name || !result.model_dimensions) {
      return null;
    }
    
    return {
      modelName: result.model_name,
      dimensions: result.model_dimensions
    };
  } catch (error) {
    throw new Error(`Failed to get stored model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sets the model information in system_info table
 * @param connection - Database connection object
 * @param modelName - Name of the embedding model
 * @param dimensions - Number of dimensions for the model
 */
export async function setStoredModelInfo(
  connection: DatabaseConnection,
  modelName: string,
  dimensions: number
): Promise<void> {
  try {
    // Check if there's already a row
    const existing = await connection.get('SELECT model_version FROM system_info WHERE id = 1');
    
    if (existing) {
      // Update only the model info fields, preserve existing model_version
      await connection.run(
        'UPDATE system_info SET model_name = ?, model_dimensions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [modelName, dimensions]
      );
    } else {
      // Insert new row with placeholder model_version (will be updated by setModelVersion)
      await connection.run(
        'INSERT INTO system_info (id, model_version, model_name, model_dimensions, updated_at) VALUES (1, "", ?, ?, CURRENT_TIMESTAMP)',
        [modelName, dimensions]
      );
    }
  } catch (error) {
    throw new Error(`Failed to set stored model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}