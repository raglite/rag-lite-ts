import { SearchFactory, openDatabase } from '../../../../src/index.js';
import { getSystemInfo } from '../../../../src/core/db.js';
import path from 'path';
import fs from 'fs/promises';

export class SystemService {
  // Get working directory from environment (where 'raglite ui' was called)
  // or fall back to current working directory
  private static getWorkingDir(): string {
    return process.env.RAG_WORKING_DIR || process.cwd();
  }
  
  // ISSUE #1 FIX: Make path resolution dynamic (methods instead of static properties)
  // These are now methods that compute paths on each call, not frozen IIFEs
  
  /**
   * Get database path - computed dynamically on each call
   * Respects RAG_DB_FILE environment variable (same as CLI)
   */
  private static getDbPath(): string {
    const workingDir = this.getWorkingDir();
    return process.env.RAG_DB_FILE 
      ? (path.isAbsolute(process.env.RAG_DB_FILE) 
          ? process.env.RAG_DB_FILE 
          : path.resolve(workingDir, process.env.RAG_DB_FILE))
      : path.resolve(workingDir, 'db.sqlite');
  }
  
  /**
   * Get index path - computed dynamically on each call
   * Respects RAG_INDEX_FILE environment variable (same as CLI)
   */
  private static getIndexPath(): string {
    const workingDir = this.getWorkingDir();
    return process.env.RAG_INDEX_FILE 
      ? (path.isAbsolute(process.env.RAG_INDEX_FILE) 
          ? process.env.RAG_INDEX_FILE 
          : path.resolve(workingDir, process.env.RAG_INDEX_FILE))
      : path.resolve(workingDir, 'vector-index.bin');
  }

  static async getStats() {
    // Get paths dynamically
    const dbPath = this.getDbPath();
    const indexPath = this.getIndexPath();
    
    try {
      // Check if files exist before trying to create search engine
      let dbExists = false;
      let indexExists = false;
      
      try {
        await fs.stat(dbPath);
        dbExists = true;
      } catch (e) {
        // Database doesn't exist
      }

      try {
        await fs.stat(indexPath);
        indexExists = true;
      } catch (e) {
        // Index doesn't exist
      }

      // If files don't exist, return empty stats
      if (!dbExists || !indexExists) {
        return {
          error: 'System not initialized',
          message: 'Index or database not found. Please run ingestion first.',
          mode: null,
          totalChunks: 0,
          totalDocuments: 0,
          rerankingEnabled: false,
          modelName: null,
          modelDimensions: null,
          createdAt: null,
          dbSize: '0.00',
          indexSize: '0.00',
          dbPath: dbPath,
          indexPath: indexPath,
          contentTypeDistribution: []
        };
      }

      // Files exist, try to get stats
      const searchEngine = await SearchFactory.create(indexPath, dbPath);
      const stats = await searchEngine.getStats();
      
      let dbSize = 0;
      let indexSize = 0;
      let contentTypeDistribution: { name: string; value: number }[] = [];
      let totalDocuments = 0;
      let modelName = null;
      let modelDimensions = null;
      let mode = null;
      let createdAt = null;

      try {
        const dbStat = await fs.stat(dbPath);
        dbSize = dbStat.size;

        // Get database statistics
        const db = await openDatabase(dbPath);
        
        // Get document count
        const docCount = await db.get('SELECT COUNT(*) as count FROM documents');
        totalDocuments = docCount?.count || 0;
        
        // Get content type distribution
        const distribution = await db.all(
          'SELECT content_type as name, COUNT(*) as value FROM chunks GROUP BY content_type'
        );
        contentTypeDistribution = distribution.map(d => ({
          name: d.name || 'text',
          value: d.value
        }));
        
        // Get system info (model name, dimensions, mode, etc.)
        try {
          const systemInfo = await getSystemInfo(db);
          if (systemInfo) {
            modelName = systemInfo.modelName;
            modelDimensions = systemInfo.modelDimensions;
            mode = systemInfo.mode;
            createdAt = systemInfo.createdAt.toISOString();
          }
        } catch (e) {
          // System info might not exist yet
        }
        
        await db.close();
      } catch (e) {
        // Ignore errors reading database
      }

      try {
        const indexStat = await fs.stat(indexPath);
        indexSize = indexStat.size;
      } catch (e) {
        // Ignore errors reading index
      }

      return {
        mode: mode || (stats as any).mode || null,
        totalChunks: stats.totalChunks,
        totalDocuments: totalDocuments,
        rerankingEnabled: stats.rerankingEnabled,
        modelName: modelName,
        modelDimensions: modelDimensions,
        createdAt: createdAt,
        dbSize: (dbSize / (1024 * 1024)).toFixed(2), // MB
        indexSize: (indexSize / (1024 * 1024)).toFixed(2), // MB
        dbPath: dbPath,
        indexPath: indexPath,
        contentTypeDistribution
      };
    } catch (error: any) {
      // Return error without logging (expected when index doesn't exist)
      return {
        error: 'System not initialized',
        message: error.message,
        mode: null,
        totalChunks: 0,
        totalDocuments: 0,
        rerankingEnabled: false,
        modelName: null,
        modelDimensions: null,
        createdAt: null,
        dbSize: '0.00',
        indexSize: '0.00',
        dbPath: this.getDbPath(),
        indexPath: this.getIndexPath(),
        contentTypeDistribution: []
      };
    }
  }
}
