import { SearchFactory } from '../../../../src/index.js';
import path from 'path';
import fs from 'fs/promises';

export class SearchService {
  private static instance: any = null;
  private static instancePaths: { dbPath: string; indexPath: string } | null = null;
  
  // Get working directory from environment (where 'raglite ui' was called)
  // or fall back to current working directory
  private static getWorkingDir(): string {
    return process.env.RAG_WORKING_DIR || process.cwd();
  }
  
  // Resolve database and index paths relative to working directory
  // Respect RAG_DB_FILE and RAG_INDEX_FILE environment variables (same as CLI)
  private static getDefaultDbPath(): string {
    const workingDir = SearchService.getWorkingDir();
    return process.env.RAG_DB_FILE 
      ? (path.isAbsolute(process.env.RAG_DB_FILE) 
          ? process.env.RAG_DB_FILE 
          : path.resolve(workingDir, process.env.RAG_DB_FILE))
      : path.resolve(workingDir, 'db.sqlite');
  }
  
  private static getDefaultIndexPath(): string {
    const workingDir = SearchService.getWorkingDir();
    return process.env.RAG_INDEX_FILE 
      ? (path.isAbsolute(process.env.RAG_INDEX_FILE) 
          ? process.env.RAG_INDEX_FILE 
          : path.resolve(workingDir, process.env.RAG_INDEX_FILE))
      : path.resolve(workingDir, 'vector-index.bin');
  }

  // Resolve provided paths (support both absolute and relative)
  private static resolvePath(providedPath: string | undefined, defaultPath: string): string {
    if (!providedPath) {
      return defaultPath;
    }
    
    if (path.isAbsolute(providedPath)) {
      return providedPath;
    }
    
    // If relative, resolve from working directory
    const workingDir = SearchService.getWorkingDir();
    return path.resolve(workingDir, providedPath);
  }
  
  // Validate that paths exist
  private static async validatePaths(dbPath: string, indexPath: string): Promise<void> {
    try {
      await fs.stat(dbPath);
    } catch {
      throw new Error(`Database file not found: ${dbPath}`);
    }
    
    try {
      await fs.stat(indexPath);
    } catch {
      throw new Error(`Index file not found: ${indexPath}`);
    }
  }

  /**
   * Reset cached search engine instance.
   * Used by ingestion force-rebuild to ensure no long-lived search
   * connections are holding the SQLite database open.
   * 
   * This is critical for the reset approach to work properly:
   * - Releases the SearchEngine's database connection
   * - Releases the IndexManager's database connection
   * - Allows KnowledgeBaseManager.reset() to operate without conflicts
   */
  static async reset(dbPath?: string, indexPath?: string): Promise<void> {
    console.log('🔄 SearchService.reset() called');
    
    if (!this.instance) {
      console.log('  No cached search engine instance to reset');
      return;
    }

    // If specific paths are provided, only reset when they match
    if (this.instancePaths && (dbPath || indexPath)) {
      const resolvedDbPath = this.resolvePath(dbPath, this.getDefaultDbPath());
      const resolvedIndexPath = this.resolvePath(indexPath, this.getDefaultIndexPath());

      if (this.instancePaths.dbPath !== resolvedDbPath ||
          this.instancePaths.indexPath !== resolvedIndexPath) {
        console.log('  Paths do not match cached instance, skipping reset');
        return;
      }
    }

    console.log('  Cleaning up cached search engine instance...');
    try {
      if (typeof this.instance.cleanup === 'function') {
        await this.instance.cleanup();
        console.log('  ✓ Search engine cleanup completed');
      }
    } catch (error) {
      console.warn('  ⚠️ Error during search engine cleanup:', error);
    } finally {
      this.instance = null;
      this.instancePaths = null;
      console.log('  ✓ Search engine instance cleared');
    }
  }

  /**
   * Check if there's an active search engine instance.
   * Useful for debugging connection issues.
   */
  static hasActiveInstance(): boolean {
    return this.instance !== null;
  }
  
  static async getSearchEngine(dbPath?: string, indexPath?: string) {
    const resolvedDbPath = this.resolvePath(dbPath, this.getDefaultDbPath());
    const resolvedIndexPath = this.resolvePath(indexPath, this.getDefaultIndexPath());
    
    // If paths match current instance, return existing instance
    if (this.instance && this.instancePaths) {
      if (this.instancePaths.dbPath === resolvedDbPath && 
          this.instancePaths.indexPath === resolvedIndexPath) {
        return this.instance;
      }
    }
    
    // Validate paths before creating engine
    await this.validatePaths(resolvedDbPath, resolvedIndexPath);
    
    // Create new instance for these paths
    console.log(`Initializing SearchEngine with:
      DB: ${resolvedDbPath}
      Index: ${resolvedIndexPath}`);
    
    const engine = await SearchFactory.create(
      resolvedIndexPath,
      resolvedDbPath
    );
    
    // Store instance and paths
    this.instance = engine;
    this.instancePaths = { dbPath: resolvedDbPath, indexPath: resolvedIndexPath };
    
    return engine;
  }
  
  static async search(query: string, options: any = {}) {
    const { dbPath, indexPath } = options;
    const engine = await this.getSearchEngine(dbPath, indexPath);
    
    const results = await engine.search(query, {
      top_k: options.topK || 10,
      rerank: options.rerank || false,
      contentType: options.contentType || 'all'
    });

    const stats = await engine.getStats();

    return {
      results,
      stats: {
        totalChunks: stats.totalChunks,
        rerankingEnabled: stats.rerankingEnabled,
        mode: stats.mode
      }
    };
  }
}
