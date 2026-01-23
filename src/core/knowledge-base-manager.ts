/**
 * Knowledge Base Manager
 * 
 * Provides a unified API for managing the knowledge base (database + vector index).
 * This module is designed to solve file locking issues on Windows by using
 * in-place reset operations instead of file deletion.
 * 
 * Key Features:
 * - Reset database and index without file deletion (avoids EBUSY/EACCES errors)
 * - Coordinated reset of both database and index in a single operation
 * - Connection management to prevent orphaned handles
 * - Cross-platform compatibility (especially Windows)
 * 
 * @module knowledge-base-manager
 */

import { openDatabase, resetDatabase, hasDatabaseData, type DatabaseConnection, type DatabaseResetOptions, type DatabaseResetResult } from './db.js';
import { IndexManager } from '../index-manager.js';
import { DatabaseConnectionManager } from './database-connection-manager.js';
import { getModelDefaults, config } from './config.js';
import { existsSync } from 'fs';

/**
 * Result of a knowledge base reset operation
 */
export interface KnowledgeBaseResetResult {
  /** Whether the overall reset was successful */
  success: boolean;
  /** Database reset result */
  database: DatabaseResetResult;
  /** Index reset statistics */
  index: {
    /** Number of vectors cleared */
    vectorsCleared: number;
    /** Time taken for index reset in milliseconds */
    resetTimeMs: number;
  };
  /** Total time for the complete reset operation */
  totalTimeMs: number;
  /** Any warnings that occurred during reset */
  warnings: string[];
}

/**
 * Options for knowledge base reset operation
 */
export interface KnowledgeBaseResetOptions {
  /** Whether to preserve system_info (mode, model configuration) - default: false */
  preserveSystemInfo?: boolean;
  /** Whether to run VACUUM after database reset - default: true */
  runVacuum?: boolean;
  /** Model name to use for index recreation - default: from config */
  modelName?: string;
}

/**
 * Knowledge Base Manager
 * 
 * Manages the complete knowledge base lifecycle including database and vector index.
 * Provides safe reset operations that avoid file locking issues on Windows.
 * 
 * @example
 * ```typescript
 * // Reset knowledge base for force rebuild
 * const result = await KnowledgeBaseManager.reset('./db.sqlite', './index.bin');
 * console.log(`Reset ${result.database.documentsDeleted} documents and ${result.index.vectorsCleared} vectors`);
 * 
 * // Reset with options
 * const result = await KnowledgeBaseManager.reset('./db.sqlite', './index.bin', {
 *   preserveSystemInfo: true,  // Keep mode/model configuration
 *   modelName: 'all-MiniLM-L6-v2'  // Specify model for index
 * });
 * ```
 */
export class KnowledgeBaseManager {
  
  /**
   * Reset the knowledge base by clearing all data while keeping files intact.
   * This is a safer alternative to file deletion that avoids file locking issues on Windows.
   * 
   * The reset operation:
   * 1. Closes any existing connections via DatabaseConnectionManager
   * 2. Opens a fresh connection to the database
   * 3. Deletes all rows from documents, chunks, content_metadata tables
   * 4. Optionally runs VACUUM to reclaim disk space
   * 5. Reinitializes the vector index (clears all vectors)
   * 6. Saves the empty index to disk (overwrites existing file content)
   * 
   * This approach works because:
   * - We don't delete files, so no EBUSY/EACCES errors
   * - The same file handles can be reused or replaced safely
   * - SQLite transactions ensure data integrity
   * - Index overwrite uses standard file write operations
   * 
   * @param dbPath - Path to the SQLite database file
   * @param indexPath - Path to the vector index file
   * @param options - Reset options
   * @returns Promise resolving to reset result statistics
   * 
   * @throws Error if database or index reset fails
   */
  static async reset(
    dbPath: string,
    indexPath: string,
    options: KnowledgeBaseResetOptions = {}
  ): Promise<KnowledgeBaseResetResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    console.log('🔄 Starting knowledge base reset...');
    console.log(`  Database: ${dbPath}`);
    console.log(`  Index: ${indexPath}`);

    // Step 1: Close any existing managed connections to prevent conflicts
    console.log('\n📡 Step 1: Closing existing connections...');
    try {
      if (DatabaseConnectionManager.hasConnection(dbPath)) {
        await DatabaseConnectionManager.forceCloseConnection(dbPath);
        console.log('  ✓ Closed existing database connection');
      } else {
        console.log('  ✓ No existing connection to close');
      }
    } catch (error) {
      const warning = `Warning: Error closing existing connection: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(warning);
      console.warn(`  ⚠️ ${warning}`);
    }

    // Small delay to ensure handles are fully released
    await new Promise(resolve => setTimeout(resolve, 50));

    // Step 2: Reset the database
    console.log('\n💾 Step 2: Resetting database...');
    let db: DatabaseConnection | null = null;
    let dbResetResult: DatabaseResetResult;

    try {
      // Open a fresh connection
      db = await openDatabase(dbPath);
      
      // Perform the reset
      dbResetResult = await resetDatabase(db, {
        preserveSystemInfo: options.preserveSystemInfo,
        runVacuum: options.runVacuum
      });

      console.log('  ✓ Database reset complete');
    } catch (error) {
      console.error('  ❌ Database reset failed:', error);
      throw new Error(`Failed to reset database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Close the database connection
      if (db) {
        try {
          await db.close();
        } catch (closeError) {
          warnings.push(`Warning: Error closing database after reset: ${closeError}`);
        }
      }
    }

    // Step 3: Reset the vector index
    console.log('\n📇 Step 3: Resetting vector index...');
    let indexResetResult: { vectorsCleared: number; resetTimeMs: number };
    const indexStartTime = Date.now();

    try {
      // Determine model and dimensions
      const modelName = options.modelName || config.embedding_model;
      const modelDefaults = getModelDefaults(modelName);
      
      // Check if index file exists
      if (!existsSync(indexPath)) {
        console.log('  Index file does not exist, will be created during ingestion');
        indexResetResult = {
          vectorsCleared: 0,
          resetTimeMs: Date.now() - indexStartTime
        };
      } else {
        // Create IndexManager and reset
        // We need to handle dimension mismatch gracefully since the user might be
        // switching models (e.g., from MPNet 768D to MiniLM 384D)
        const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions, modelName);
        
        let previousVectorCount = 0;
        
        try {
          // Try to initialize with forceRecreate=false first to get the vector count
          // skipModelCheck=true since we're resetting anyway
          await indexManager.initialize(true, false);
          
          // Get current vector count before reset
          previousVectorCount = (await indexManager.hasVectors()) ? 
            (await indexManager.getStats()).totalVectors : 0;
          
          // Perform the reset
          await indexManager.reset();
        } catch (initError: any) {
          // If initialization failed (e.g., dimension mismatch), force recreate the index
          // This handles the case where user is switching models
          const errorMessage = initError?.message || String(initError);
          
          if (errorMessage.includes('dimension mismatch') || errorMessage.includes('Vector dimension')) {
            console.log('  ⚠️ Dimension mismatch detected - forcing index recreation');
            console.log('  (This is expected when switching embedding models)');
            
            // Create a fresh IndexManager and force recreate
            const freshIndexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions, modelName);
            await freshIndexManager.initialize(true, true); // skipModelCheck=true, forceRecreate=true
            await freshIndexManager.saveIndex();
            await freshIndexManager.close();
            
            // We don't know the previous count since we couldn't load the old index
            // But we can estimate it was non-zero since the file existed
            previousVectorCount = -1; // Indicate unknown
          } else {
            // Re-throw other errors
            throw initError;
          }
        }
        
        // Close the index manager
        await indexManager.close();
        
        indexResetResult = {
          vectorsCleared: previousVectorCount,
          resetTimeMs: Date.now() - indexStartTime
        };
        
        console.log('  ✓ Index reset complete');
      }
    } catch (error) {
      console.error('  ❌ Index reset failed:', error);
      throw new Error(`Failed to reset index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const totalTimeMs = Date.now() - startTime;

    // Summary
    console.log('\n✅ Knowledge base reset complete!');
    console.log(`  Total time: ${totalTimeMs}ms`);
    console.log(`  Documents deleted: ${dbResetResult.documentsDeleted}`);
    console.log(`  Chunks deleted: ${dbResetResult.chunksDeleted}`);
    console.log(`  Vectors cleared: ${indexResetResult.vectorsCleared === -1 ? '(unknown - index recreated due to model change)' : indexResetResult.vectorsCleared}`);
    if (warnings.length > 0) {
      console.log(`  Warnings: ${warnings.length}`);
    }

    return {
      success: true,
      database: dbResetResult,
      index: indexResetResult,
      totalTimeMs,
      warnings
    };
  }

  /**
   * Check if the knowledge base has any data
   * 
   * @param dbPath - Path to the SQLite database file
   * @returns Promise resolving to true if database has data, false if empty
   */
  static async hasData(dbPath: string): Promise<boolean> {
    let db: DatabaseConnection | null = null;
    try {
      db = await openDatabase(dbPath);
      return await hasDatabaseData(db);
    } catch (error) {
      // If we can't open the database, assume no data
      return false;
    } finally {
      if (db) {
        try {
          await db.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Close all connections to the knowledge base
   * Useful before operations that might conflict with open handles
   * 
   * @param dbPath - Path to the SQLite database file
   */
  static async closeAllConnections(dbPath: string): Promise<void> {
    console.log('🔒 Closing all knowledge base connections...');
    
    try {
      if (DatabaseConnectionManager.hasConnection(dbPath)) {
        await DatabaseConnectionManager.forceCloseConnection(dbPath);
      }
      
      // Also close WAL/SHM connections if they exist
      const sidecars = [`${dbPath}-wal`, `${dbPath}-shm`];
      for (const sidecar of sidecars) {
        if (DatabaseConnectionManager.hasConnection(sidecar)) {
          await DatabaseConnectionManager.forceCloseConnection(sidecar);
        }
      }
      
      console.log('✓ All connections closed');
    } catch (error) {
      console.warn('⚠️ Error closing connections:', error);
    }
  }
}
