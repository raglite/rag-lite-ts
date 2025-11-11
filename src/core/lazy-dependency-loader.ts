/**
 * CORE MODULE — Lazy Dependency Loading System
 * Implements dynamic imports for multimodal-specific dependencies
 * Ensures text mode performance is not impacted by multimodal code
 * 
 * Requirements: 9.2 - Lazy loading for multimodal dependencies
 */

// Ensure DOM polyfills are set up before any transformers.js usage
import '../dom-polyfills.js';

import type { UniversalEmbedder } from './universal-embedder.js';
import type { RerankFunction } from './interfaces.js';
import { handleError, ErrorCategory, ErrorSeverity, createError } from './error-handler.js';

// =============================================================================
// LAZY LOADING CACHE
// =============================================================================

/**
 * Cache for loaded modules to avoid repeated imports
 */
class LazyLoadingCache {
  private static instance: LazyLoadingCache;
  private loadedModules = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();

  static getInstance(): LazyLoadingCache {
    if (!LazyLoadingCache.instance) {
      LazyLoadingCache.instance = new LazyLoadingCache();
    }
    return LazyLoadingCache.instance;
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    // Return cached module if available
    if (this.loadedModules.has(key)) {
      return this.loadedModules.get(key);
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    // Start loading and cache the promise
    const loadingPromise = loader().then(module => {
      this.loadedModules.set(key, module);
      this.loadingPromises.delete(key);
      return module;
    }).catch(error => {
      this.loadingPromises.delete(key);
      throw error;
    });

    this.loadingPromises.set(key, loadingPromise);
    return loadingPromise;
  }

  clear(): void {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }

  remove(key: string): void {
    this.loadedModules.delete(key);
    this.loadingPromises.delete(key);
  }

  getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys());
  }
}

// =============================================================================
// LAZY EMBEDDER LOADING
// =============================================================================

/**
 * Lazy loader for embedder implementations
 * Only loads the specific embedder type when needed
 */
export class LazyEmbedderLoader {
  private static cache = LazyLoadingCache.getInstance();

  /**
   * Lazily load and create a sentence transformer embedder
   * Only imports the module when actually needed for text mode
   */
  static async loadSentenceTransformerEmbedder(
    modelName: string,
    options: any = {}
  ): Promise<UniversalEmbedder> {
    const cacheKey = `sentence-transformer:${modelName}`;
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log(`🔄 Lazy loading sentence transformer embedder: ${modelName}`);
        
        // Dynamic import - only loaded when text mode is used
        const { SentenceTransformerEmbedder } = await import('../text/sentence-transformer-embedder.js');
        
        const embedder = new SentenceTransformerEmbedder(modelName, options);
        await embedder.loadModel();
        
        console.log(`✅ Sentence transformer embedder loaded: ${modelName}`);
        return embedder;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load sentence transformer embedder '${modelName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyEmbedderLoader', {
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Lazily load and create a CLIP embedder
   * Only imports the module when actually needed for multimodal mode
   */
  static async loadCLIPEmbedder(
    modelName: string,
    options: any = {}
  ): Promise<UniversalEmbedder> {
    const cacheKey = `clip:${modelName}`;
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log(`🔄 Lazy loading CLIP embedder: ${modelName}`);
        
        // Dynamic import - only loaded when multimodal mode is used
        const { CLIPEmbedder } = await import('../multimodal/clip-embedder.js');
        
        const embedder = new CLIPEmbedder(modelName, options);
        await embedder.loadModel();
        
        console.log(`✅ CLIP embedder loaded: ${modelName}`);
        return embedder;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load CLIP embedder '${modelName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyEmbedderLoader', {
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Check if an embedder is already loaded in cache
   */
  static isEmbedderLoaded(modelName: string, modelType: 'sentence-transformer' | 'clip'): boolean {
    const cacheKey = `${modelType}:${modelName}`;
    return this.cache.getLoadedModules().includes(cacheKey);
  }

  /**
   * Remove an embedder from the cache (called when embedder is cleaned up)
   */
  static removeEmbedderFromCache(modelName: string, modelType: 'sentence-transformer' | 'clip'): void {
    const cacheKey = `${modelType}:${modelName}`;
    this.cache.remove(cacheKey);
    console.log(`🧹 Removed embedder from cache: ${cacheKey}`);
  }

  /**
   * Get statistics about loaded embedders
   */
  static getLoadingStats(): {
    loadedEmbedders: string[];
    totalLoaded: number;
    textEmbedders: number;
    multimodalEmbedders: number;
  } {
    const loadedModules = this.cache.getLoadedModules();
    const textEmbedders = loadedModules.filter(key => key.startsWith('sentence-transformer:')).length;
    const multimodalEmbedders = loadedModules.filter(key => key.startsWith('clip:')).length;

    return {
      loadedEmbedders: loadedModules,
      totalLoaded: loadedModules.length,
      textEmbedders,
      multimodalEmbedders
    };
  }
}

// =============================================================================
// LAZY RERANKER LOADING
// =============================================================================

/**
 * Lazy loader for reranking implementations
 * Only loads the specific reranker type when needed
 */
export class LazyRerankerLoader {
  private static cache = LazyLoadingCache.getInstance();

  /**
   * Lazily load text reranker (cross-encoder)
   * Always available for both text and multimodal modes
   */
  static async loadTextReranker(): Promise<RerankFunction> {
    const cacheKey = 'reranker:text';
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log('🔄 Lazy loading text reranker (cross-encoder)');
        
        // Dynamic import - loaded when reranking is needed
        const { createTextRerankFunction } = await import('../text/reranker.js');
        
        const rerankFn = createTextRerankFunction();
        
        console.log('✅ Text reranker loaded');
        return rerankFn;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load text reranker: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyRerankerLoader', {
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Lazily load text-derived reranker for multimodal mode
   * Only imports multimodal-specific dependencies when needed
   */
  static async loadTextDerivedReranker(): Promise<RerankFunction> {
    const cacheKey = 'reranker:text-derived';
    
    return this.cache.getOrLoad(cacheKey, async () => {
      console.log('🔄 Lazy loading text-derived reranker (multimodal)');
      
      // Dynamic import - only loaded when multimodal mode uses text-derived reranking
      const { TextDerivedRerankingStrategy } = await import('./reranking-strategies.js');
      
      const reranker = new TextDerivedRerankingStrategy();
      
      console.log('✅ Text-derived reranker loaded');
      return reranker.rerank.bind(reranker);
    });
  }

  /**
   * Lazily load metadata-based reranker for multimodal mode
   * Only imports when specifically needed
   */
  static async loadMetadataReranker(): Promise<RerankFunction> {
    const cacheKey = 'reranker:metadata';
    
    return this.cache.getOrLoad(cacheKey, async () => {
      console.log('🔄 Lazy loading metadata reranker (multimodal)');
      
      // Dynamic import - only loaded when multimodal mode uses metadata reranking
      const { MetadataRerankingStrategy } = await import('./reranking-strategies.js');
      
      const reranker = new MetadataRerankingStrategy();
      
      console.log('✅ Metadata reranker loaded');
      return reranker.rerank.bind(reranker);
    });
  }

  /**
   * Lazily load hybrid reranker for multimodal mode
   * Combines multiple reranking strategies (uses text-derived for now)
   */
  static async loadHybridReranker(): Promise<RerankFunction> {
    const cacheKey = 'reranker:hybrid';
    
    return this.cache.getOrLoad(cacheKey, async () => {
      console.log('🔄 Lazy loading hybrid reranker (multimodal)');
      
      // For now, hybrid reranking uses text-derived
      // TODO: Implement proper hybrid reranking in future tasks
      console.log('🔄 Hybrid reranking not yet implemented, using text-derived');
      
      return this.loadTextDerivedReranker();
    });
  }

  /**
   * Check if a reranker is already loaded in cache
   */
  static isRerankerLoaded(strategy: string): boolean {
    const cacheKey = `reranker:${strategy}`;
    return this.cache.getLoadedModules().includes(cacheKey);
  }

  /**
   * Get statistics about loaded rerankers
   */
  static getLoadingStats(): {
    loadedRerankers: string[];
    totalLoaded: number;
    textRerankers: number;
    multimodalRerankers: number;
  } {
    const loadedModules = this.cache.getLoadedModules().filter(key => key.startsWith('reranker:'));
    const textRerankers = loadedModules.filter(key => key === 'reranker:text').length;
    const multimodalRerankers = loadedModules.filter(key => 
      key.includes('text-derived') || key.includes('metadata') || key.includes('hybrid')
    ).length;

    return {
      loadedRerankers: loadedModules,
      totalLoaded: loadedModules.length,
      textRerankers,
      multimodalRerankers
    };
  }
}

// =============================================================================
// LAZY MULTIMODAL PROCESSING LOADING
// =============================================================================

/**
 * Lazy loader for multimodal content processing
 * Only loads image processing dependencies when needed
 */
export class LazyMultimodalLoader {
  private static cache = LazyLoadingCache.getInstance();

  /**
   * Lazily load image-to-text processing capabilities
   * Only imports when multimodal content processing is needed
   */
  static async loadImageToTextProcessor(modelName: string = 'Xenova/vit-gpt2-image-captioning'): Promise<any> {
    const cacheKey = `image-to-text:${modelName}`;
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log(`🔄 Lazy loading image-to-text processor: ${modelName}`);
        
        // Dynamic import - only loaded when multimodal content processing is needed
        const { pipeline } = await import('@huggingface/transformers');
        
        const processor = await pipeline('image-to-text', modelName, {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              console.log(`📥 Downloading image-to-text model: ${Math.round(progress.progress || 0)}%`);
            }
          }
        });
        
        console.log(`✅ Image-to-text processor loaded: ${modelName}`);
        return processor;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load image-to-text processor '${modelName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyMultimodalLoader', {
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Lazily load image metadata extraction capabilities
   * Only imports Sharp when image metadata processing is needed
   */
  static async loadImageMetadataExtractor(): Promise<any> {
    const cacheKey = 'image-metadata-extractor';
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log('🔄 Lazy loading image metadata extractor (Sharp)');
        
        // Dynamic import - only loaded when image metadata extraction is needed
        // Sharp is an optional dependency for image metadata extraction
        let sharp;
        try {
          // Use dynamic import with string to avoid TypeScript checking
          sharp = await import('sharp' as any);
        } catch (error) {
          // Sharp is not available, will use fallback
          throw new Error('Sharp not available for image metadata extraction');
        }
        
        console.log('✅ Image metadata extractor loaded (Sharp)');
        return sharp.default || sharp;
        
      } catch (error) {
        console.warn(`Failed to load Sharp for image metadata extraction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('📊 Image metadata extraction will be limited without Sharp');
        
        // Return a fallback metadata extractor
        return {
          metadata: async () => ({
            width: 0,
            height: 0,
            format: 'unknown',
            size: 0
          })
        };
      }
    });
  }

  /**
   * Check if multimodal processing capabilities are loaded
   */
  static getMultimodalLoadingStatus(): {
    imageToTextLoaded: boolean;
    metadataExtractorLoaded: boolean;
    loadedProcessors: string[];
  } {
    const loadedModules = this.cache.getLoadedModules();
    
    return {
      imageToTextLoaded: loadedModules.some(key => key.startsWith('image-to-text:')),
      metadataExtractorLoaded: loadedModules.includes('image-metadata-extractor'),
      loadedProcessors: loadedModules.filter(key => 
        key.startsWith('image-to-text:') || key === 'image-metadata-extractor'
      )
    };
  }
}

// =============================================================================
// UNIFIED LAZY LOADING INTERFACE
// =============================================================================

/**
 * Unified interface for all lazy loading operations
 * Provides a single entry point for dependency management
 */
export class LazyDependencyManager {
  /**
   * Load embedder based on model type with lazy loading
   */
  static async loadEmbedder(modelName: string, modelType: 'sentence-transformer' | 'clip', options: any = {}): Promise<UniversalEmbedder> {
    switch (modelType) {
      case 'sentence-transformer':
        return LazyEmbedderLoader.loadSentenceTransformerEmbedder(modelName, options);
      
      case 'clip':
        return LazyEmbedderLoader.loadCLIPEmbedder(modelName, options);
      
      default:
        throw createError.validation(`Unsupported model type for lazy loading: ${modelType}`);
    }
  }

  /**
   * Load reranker based on strategy with lazy loading
   */
  static async loadReranker(strategy: string): Promise<RerankFunction | undefined> {
    if (strategy === 'disabled') {
      return undefined;
    }

    switch (strategy) {
      case 'cross-encoder':
        return LazyRerankerLoader.loadTextReranker();
      
      case 'text-derived':
        return LazyRerankerLoader.loadTextDerivedReranker();
      
      case 'metadata':
        return LazyRerankerLoader.loadMetadataReranker();
      
      case 'hybrid':
        return LazyRerankerLoader.loadHybridReranker();
      
      default:
        throw new Error(`Unknown reranking strategy '${strategy}'. Supported strategies: cross-encoder, text-derived, metadata, hybrid, disabled`);
    }
  }

  /**
   * Get comprehensive loading statistics
   */
  static getLoadingStatistics(): {
    embedders: ReturnType<typeof LazyEmbedderLoader.getLoadingStats>;
    rerankers: ReturnType<typeof LazyRerankerLoader.getLoadingStats>;
    multimodal: ReturnType<typeof LazyMultimodalLoader.getMultimodalLoadingStatus>;
    totalModulesLoaded: number;
    memoryImpact: 'low' | 'medium' | 'high';
  } {
    const embedderStats = LazyEmbedderLoader.getLoadingStats();
    const rerankerStats = LazyRerankerLoader.getLoadingStats();
    const multimodalStats = LazyMultimodalLoader.getMultimodalLoadingStatus();
    
    const totalModules = embedderStats.totalLoaded + rerankerStats.totalLoaded + multimodalStats.loadedProcessors.length;
    
    // Estimate memory impact based on loaded modules
    let memoryImpact: 'low' | 'medium' | 'high' = 'low';
    if (embedderStats.multimodalEmbedders > 0 || multimodalStats.imageToTextLoaded) {
      memoryImpact = 'high';
    } else if (totalModules > 2) {
      memoryImpact = 'medium';
    }

    return {
      embedders: embedderStats,
      rerankers: rerankerStats,
      multimodal: multimodalStats,
      totalModulesLoaded: totalModules,
      memoryImpact
    };
  }

  /**
   * Clear all cached modules (for testing or memory management)
   */
  static clearCache(): void {
    LazyLoadingCache.getInstance().clear();
    console.log('🧹 Lazy loading cache cleared');
  }

  /**
   * Check if system is running in text-only mode (no multimodal dependencies loaded)
   */
  static isTextOnlyMode(): boolean {
    const stats = this.getLoadingStatistics();
    return stats.embedders.multimodalEmbedders === 0 && 
           stats.rerankers.multimodalRerankers === 0 && 
           !stats.multimodal.imageToTextLoaded;
  }

  /**
   * Get performance impact assessment
   */
  static getPerformanceImpact(): {
    mode: 'text-only' | 'multimodal';
    startupTime: 'fast' | 'medium' | 'slow';
    memoryUsage: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    const stats = this.getLoadingStatistics();
    const isTextOnly = this.isTextOnlyMode();
    
    const recommendations: string[] = [];
    
    if (isTextOnly) {
      recommendations.push('Optimal performance: Only text dependencies loaded');
    } else {
      recommendations.push('Multimodal mode: Additional dependencies loaded as needed');
      
      if (stats.embedders.multimodalEmbedders > 1) {
        recommendations.push('Consider using a single multimodal model to reduce memory usage');
      }
      
      if (stats.multimodal.imageToTextLoaded && stats.multimodal.metadataExtractorLoaded) {
        recommendations.push('Full multimodal processing active - expect higher memory usage');
      }
    }

    return {
      mode: isTextOnly ? 'text-only' : 'multimodal',
      startupTime: stats.totalModulesLoaded === 0 ? 'fast' : stats.totalModulesLoaded < 3 ? 'medium' : 'slow',
      memoryUsage: stats.memoryImpact,
      recommendations
    };
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default LazyDependencyManager;