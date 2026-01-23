import { SearchFactory } from '../../../../src/index.js';
import path from 'path';
import fs from 'fs/promises';
import { createEmbedder } from '../../../../src/core/embedder-factory.js';
import { supportsImages } from '../../../../src/core/universal-embedder.js';
import { ModeDetectionService } from '../../../../src/core/mode-detection-service.js';
import { DatabaseConnectionManager } from '../../../../src/core/database-connection-manager.js';

// Generation imports (experimental)
import { createGenerateFunctionFromModel, getDefaultGeneratorModel } from '../../../../src/factories/generator-factory.js';
import { getDefaultMaxChunksForContext } from '../../../../src/core/generator-registry.js';
import type { GenerateFunction } from '../../../../src/core/response-generator.js';

export class SearchService {
  private static instance: any = null;
  private static instancePaths: { dbPath: string; indexPath: string } | null = null;
  
  // Generator cache (experimental)
  private static generatorCache: Map<string, GenerateFunction> = new Map();
  
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

  /**
   * Get or create a generator function for the specified model (experimental)
   */
  private static async getGenerator(modelName: string): Promise<GenerateFunction> {
    // Check cache first
    if (this.generatorCache.has(modelName)) {
      return this.generatorCache.get(modelName)!;
    }

    console.log(`🤖 [EXPERIMENTAL] Loading generator model: ${modelName}`);
    const generateFn = await createGenerateFunctionFromModel(modelName);
    
    // Cache for reuse
    this.generatorCache.set(modelName, generateFn);
    console.log(`✅ Generator model loaded and cached: ${modelName}`);
    
    return generateFn;
  }
  
  static async search(query: string, options: any = {}) {
    const { dbPath, indexPath } = options;
    const engine = await this.getSearchEngine(dbPath, indexPath);
    
    // If generation is requested, force reranking (required for generation)
    const rerank = options.generateResponse ? true : (options.rerank || false);
    
    const results = await engine.search(query, {
      top_k: options.topK || 10,
      rerank: rerank,
      contentType: options.contentType || 'all'
    });

    const stats = await engine.getStats();

    // Handle generation if requested (experimental, text mode only)
    let generation = null;
    if (options.generateResponse && results.length > 0) {
      try {
        console.log('🤖 [EXPERIMENTAL] Generating response from search results...');
        
        const modelName = options.generatorModel || getDefaultGeneratorModel();
        const generateFn = await this.getGenerator(modelName);
        
        // Set up generator on search engine
        engine.setGenerateFunction(generateFn);
        
        // Get default max chunks for the model
        const defaultMaxChunks = getDefaultMaxChunksForContext(modelName) || 3;
        const maxChunksForContext = options.maxChunksForContext || defaultMaxChunks;
        
        console.log(`   Model: ${modelName}`);
        console.log(`   Max chunks for context: ${maxChunksForContext}`);
        
        // Generate response
        const generationResult = await generateFn(query, results, {
          maxChunksForContext: maxChunksForContext
        });
        
        generation = {
          response: generationResult.response,
          modelUsed: generationResult.modelName,
          tokensUsed: generationResult.tokensUsed,
          truncated: generationResult.truncated,
          chunksUsedForContext: generationResult.metadata.chunksIncluded,
          generationTimeMs: generationResult.generationTimeMs
        };
        
        console.log(`✅ Generation completed in ${generationResult.generationTimeMs}ms`);
      } catch (error) {
        console.error('❌ [EXPERIMENTAL] Generation failed:', error);
        // Don't fail the whole request, just return results without generation
      }
    }

    return {
      results,
      generation,
      stats: {
        totalChunks: stats.totalChunks,
        rerankingEnabled: stats.rerankingEnabled,
        mode: stats.mode
      }
    };
  }

  static async searchImage(imageFile: Express.Multer.File, options: any = {}) {
    const { dbPath, indexPath } = options;
    const resolvedDbPath = this.resolvePath(dbPath, this.getDefaultDbPath());
    const resolvedIndexPath = this.resolvePath(indexPath, this.getDefaultIndexPath());
    
    // Validate paths
    await this.validatePaths(resolvedDbPath, resolvedIndexPath);
    
    // Get system info to determine model
    const db = await DatabaseConnectionManager.getConnection(resolvedDbPath);
    const modeService = new ModeDetectionService(resolvedDbPath);
    const systemInfo = await modeService.detectMode(db);
    
    // Check if model supports images
    const embedder = await createEmbedder(systemInfo.modelName);
    if (!supportsImages(embedder)) {
      throw new Error(
        `Image search requires a multimodal model (CLIP). ` +
        `Current model: ${systemInfo.modelName} does not support image embedding. ` +
        `Please re-run ingestion with a CLIP model (e.g., Xenova/clip-vit-base-patch32).`
      );
    }
    
    // Save uploaded image to temporary file
    const tempDir = path.join(process.cwd(), '.raglite-temp');
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
    const tempImagePath = path.join(tempDir, `search-${Date.now()}-${imageFile.originalname}`);
    
    try {
      // Write image buffer to temp file
      await fs.writeFile(tempImagePath, imageFile.buffer);
      
      // Embed the image
      console.log(`Embedding image: ${imageFile.originalname}...`);
      const imageEmbedding = await embedder.embedImage!(tempImagePath);
      
      // Get search engine
      const engine = await this.getSearchEngine(dbPath, indexPath);
      
      // Search with the image embedding vector
      // Disable reranking for image-to-image search (as per CLI behavior)
      const searchOptions = {
        top_k: options.topK || 10,
        rerank: false, // Disabled for image search to preserve visual similarity
        contentType: options.contentType || 'all'
      };
      
      console.log('Searching with image embedding...');
      const results = await engine.searchWithVector(imageEmbedding.vector, searchOptions);
      
      const stats = await engine.getStats();
      
      return {
        results,
        generation: null, // Generation not supported for image search
        stats: {
          totalChunks: stats.totalChunks,
          rerankingEnabled: false, // Always false for image search
          mode: stats.mode
        }
      };
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (err) {
        // Ignore cleanup errors
        console.warn(`Failed to clean up temp image file: ${tempImagePath}`, err);
      }
    }
  }
}
