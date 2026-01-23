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
import type { ResponseGenerator } from './response-generator.js';
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
// LAZY GENERATOR LOADING
// =============================================================================

/**
 * Lazy loader for response generator implementations
 * Only loads the specific generator type when needed
 * 
 * @experimental This feature is experimental and may change in future versions.
 */
export class LazyGeneratorLoader {
  private static cache = LazyLoadingCache.getInstance();

  /**
   * Lazily load and create an instruct generator (SmolLM2-Instruct)
   * Only imports the module when generation is actually requested
   */
  static async loadInstructGenerator(
    modelName: string,
    options: any = {}
  ): Promise<ResponseGenerator> {
    const cacheKey = `generator:instruct:${modelName}`;
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log(`🔄 [EXPERIMENTAL] Lazy loading instruct generator: ${modelName}`);
        
        // Dynamic import - only loaded when generation is requested
        const { InstructGenerator } = await import('../text/generators/instruct-generator.js');
        
        const generator = new InstructGenerator(modelName, options);
        await generator.loadModel();
        
        console.log(`✅ Instruct generator loaded: ${modelName}`);
        return generator;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load instruct generator '${modelName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyGeneratorLoader', {
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Lazily load and create a causal LM generator (DistilGPT2)
   * Only imports the module when generation is actually requested
   */
  static async loadCausalLMGenerator(
    modelName: string,
    options: any = {}
  ): Promise<ResponseGenerator> {
    const cacheKey = `generator:causal-lm:${modelName}`;
    
    return this.cache.getOrLoad(cacheKey, async () => {
      try {
        console.log(`🔄 [EXPERIMENTAL] Lazy loading causal LM generator: ${modelName}`);
        
        // Dynamic import - only loaded when generation is requested
        const { CausalLMGenerator } = await import('../text/generators/causal-lm-generator.js');
        
        const generator = new CausalLMGenerator(modelName, options);
        await generator.loadModel();
        
        console.log(`✅ Causal LM generator loaded: ${modelName}`);
        return generator;
        
      } catch (error) {
        const enhancedError = createError.model(
          `Failed to lazy load causal LM generator '${modelName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        handleError(enhancedError, 'LazyGeneratorLoader', {
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.MODEL
        });
        
        throw enhancedError;
      }
    });
  }

  /**
   * Check if a generator is already loaded in cache
   */
  static isGeneratorLoaded(modelName: string, modelType: 'instruct' | 'causal-lm'): boolean {
    const cacheKey = `generator:${modelType}:${modelName}`;
    return this.cache.getLoadedModules().includes(cacheKey);
  }

  /**
   * Remove a generator from the cache (called when generator is cleaned up)
   */
  static removeGeneratorFromCache(modelName: string, modelType: 'instruct' | 'causal-lm'): void {
    const cacheKey = `generator:${modelType}:${modelName}`;
    this.cache.remove(cacheKey);
    console.log(`🧹 Removed generator from cache: ${cacheKey}`);
  }

  /**
   * Get statistics about loaded generators
   */
  static getLoadingStats(): {
    loadedGenerators: string[];
    totalLoaded: number;
    instructGenerators: number;
    causalLMGenerators: number;
  } {
    const loadedModules = this.cache.getLoadedModules().filter(key => key.startsWith('generator:'));
    const instructGenerators = loadedModules.filter(key => key.includes(':instruct:')).length;
    const causalLMGenerators = loadedModules.filter(key => key.includes(':causal-lm:')).length;

    return {
      loadedGenerators: loadedModules,
      totalLoaded: loadedModules.length,
      instructGenerators,
      causalLMGenerators
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
   * Lazily load CLIP AutoProcessor for consistent image preprocessing
   * Shares processor instances across embedder instances to ensure identical preprocessing
   */
  static async loadCLIPAutoProcessor(modelName: string): Promise<any> {
    const cacheKey = `processor:clip:${modelName}`;

    return this.cache.getOrLoad(cacheKey, async () => {
      console.log(`🔄 Lazy loading CLIP AutoProcessor: ${modelName}`);

      // Dynamic import - only loaded when CLIP models are used
      const { AutoProcessor } = await import('@huggingface/transformers');

      const processor = await AutoProcessor.from_pretrained(modelName);

      console.log(`✅ CLIP AutoProcessor loaded: ${modelName}`);
      return processor;
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
   * Load response generator based on model type with lazy loading
   * @experimental This feature is experimental and may change in future versions.
   */
  static async loadGenerator(modelName: string, modelType: 'instruct' | 'causal-lm', options: any = {}): Promise<ResponseGenerator> {
    switch (modelType) {
      case 'instruct':
        return LazyGeneratorLoader.loadInstructGenerator(modelName, options);
      
      case 'causal-lm':
        return LazyGeneratorLoader.loadCausalLMGenerator(modelName, options);
      
      default:
        throw createError.validation(`Unsupported generator model type for lazy loading: ${modelType}`);
    }
  }

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

      default:
        throw new Error(`Unknown reranking strategy '${strategy}'. Supported strategies: cross-encoder, text-derived, disabled`);
    }
  }

  /**
   * Get comprehensive loading statistics
   */
  static getLoadingStatistics(): {
    embedders: ReturnType<typeof LazyEmbedderLoader.getLoadingStats>;
    rerankers: ReturnType<typeof LazyRerankerLoader.getLoadingStats>;
    generators: ReturnType<typeof LazyGeneratorLoader.getLoadingStats>;
    multimodal: ReturnType<typeof LazyMultimodalLoader.getMultimodalLoadingStatus>;
    totalModulesLoaded: number;
    memoryImpact: 'low' | 'medium' | 'high';
  } {
    const embedderStats = LazyEmbedderLoader.getLoadingStats();
    const rerankerStats = LazyRerankerLoader.getLoadingStats();
    const generatorStats = LazyGeneratorLoader.getLoadingStats();
    const multimodalStats = LazyMultimodalLoader.getMultimodalLoadingStatus();
    
    const totalModules = embedderStats.totalLoaded + rerankerStats.totalLoaded + generatorStats.totalLoaded + multimodalStats.loadedProcessors.length;
    
    // Estimate memory impact based on loaded modules
    let memoryImpact: 'low' | 'medium' | 'high' = 'low';
    if (embedderStats.multimodalEmbedders > 0 || multimodalStats.imageToTextLoaded) {
      memoryImpact = 'high';
    } else if (totalModules > 2 || generatorStats.totalLoaded > 0) {
      memoryImpact = 'medium';
    }

    return {
      embedders: embedderStats,
      rerankers: rerankerStats,
      generators: generatorStats,
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