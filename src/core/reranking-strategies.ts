/**
 * Cross-Encoder Reranking Strategy for Text Mode
 * 
 * Adapts the existing CrossEncoderReranker to work with the new RerankingStrategy
 * interface defined in the Chameleon Multimodal Architecture.
 */

import type { SearchResult, RerankFunction } from './types.js';
import { CrossEncoderReranker } from '../text/reranker.js';

/**
 * Reranking strategy interface for the Chameleon architecture
 */
export interface RerankingStrategy {
  name: string;
  supportedContentTypes: string[];
  isEnabled: boolean;
  
  rerank: RerankFunction;
  configure(config: Record<string, any>): void;
  getMetadata(): {
    description: string;
    requiredModels: string[];
    configOptions: Record<string, any>;
  };
}

/**
 * Cross-Encoder Reranking Strategy Implementation
 * 
 * Uses the existing CrossEncoderReranker from the text module to provide
 * reranking functionality for text mode in the new architecture.
 */
export class CrossEncoderRerankingStrategy implements RerankingStrategy {
  public readonly name = 'cross-encoder';
  public readonly supportedContentTypes = ['text'];
  public isEnabled = true;
  
  private reranker: CrossEncoderReranker;
  private modelName?: string;
  private initialized = false;

  constructor(modelName?: string) {
    this.modelName = modelName;
    this.reranker = new CrossEncoderReranker();
    
    // Set custom model name if provided
    if (modelName) {
      (this.reranker as any).modelName = modelName;
    }
  }

  /**
   * Initialize the reranker if not already done
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      try {
        await this.reranker.loadModel();
        this.initialized = true;
        this.isEnabled = this.reranker.isLoaded();
        
        if (!this.isEnabled) {
          console.warn('Cross-encoder reranker failed to load, strategy disabled');
        }
      } catch (error) {
        console.warn(`Cross-encoder reranker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.isEnabled = false;
      }
    }
  }

  /**
   * Rerank search results using cross-encoder model
   */
  rerank: RerankFunction = async (
    query: string, 
    results: SearchResult[], 
    contentType?: string
  ): Promise<SearchResult[]> => {
    // If strategy is disabled, return results unchanged immediately
    if (!this.isEnabled) {
      return results;
    }

    // Validate content type
    if (contentType && !this.supportedContentTypes.includes(contentType)) {
      throw new Error(
        `Cross-encoder strategy does not support content type '${contentType}'. ` +
        `Supported types: ${this.supportedContentTypes.join(', ')}`
      );
    }

    // Ensure reranker is initialized
    await this.ensureInitialized();

    // If reranker failed to initialize, return results unchanged
    if (!this.isEnabled) {
      console.warn('Cross-encoder reranker not enabled, returning results unchanged');
      return results;
    }

    // Filter to only text content if mixed content types are present
    const textResults = results.filter(result => 
      !result.contentType || result.contentType === 'text'
    );

    if (textResults.length === 0) {
      return results; // No text results to rerank
    }

    if (textResults.length !== results.length) {
      console.warn(
        `Cross-encoder reranker filtering ${results.length - textResults.length} ` +
        `non-text results from reranking`
      );
    }

    try {
      // Use the existing reranker implementation
      const rerankedTextResults = await this.reranker.rerank(query, textResults);
      
      // If we filtered results, we need to merge back non-text results
      if (textResults.length !== results.length) {
        const nonTextResults = results.filter(result => 
          result.contentType && result.contentType !== 'text'
        );
        
        // Append non-text results at the end with their original scores
        return [...rerankedTextResults, ...nonTextResults];
      }
      
      return rerankedTextResults;
    } catch (error) {
      console.warn(
        `Cross-encoder reranking failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Returning original results.`
      );
      return results;
    }
  };

  /**
   * Configure the reranking strategy
   */
  configure(config: Record<string, any>): void {
    if (config.modelName && typeof config.modelName === 'string') {
      this.modelName = config.modelName;
      // Reset initialization to use new model
      this.initialized = false;
      this.reranker = new CrossEncoderReranker();
      (this.reranker as any).modelName = config.modelName;
    }

    if (config.enabled !== undefined) {
      this.isEnabled = Boolean(config.enabled);
    }
  }

  /**
   * Get metadata about this reranking strategy
   */
  getMetadata() {
    return {
      description: 'Cross-encoder reranking using transformer models for improved text relevance scoring',
      requiredModels: [
        'Xenova/ms-marco-MiniLM-L-6-v2',
        'cross-encoder/ms-marco-MiniLM-L-6-v2',
        'cross-encoder/ms-marco-MiniLM-L-2-v2'
      ],
      configOptions: {
        modelName: {
          type: 'string',
          description: 'Cross-encoder model name to use for reranking',
          default: 'Xenova/ms-marco-MiniLM-L-6-v2'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable cross-encoder reranking',
          default: true
        }
      }
    };
  }

  /**
   * Check if the strategy is ready to use
   */
  async isReady(): Promise<boolean> {
    await this.ensureInitialized();
    return this.isEnabled && this.reranker.isLoaded();
  }

  /**
   * Get the current model name being used
   */
  getModelName(): string {
    return this.reranker.getModelName();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // The existing CrossEncoderReranker doesn't have explicit cleanup
    // but we can reset the initialization state
    this.initialized = false;
  }
}

/**
 * Factory function to create a cross-encoder reranking strategy
 * 
 * This provides a simple way to create the strategy without complex factory patterns,
 * following the design principle of using simple functions over complex factories.
 */
export function createCrossEncoderStrategy(modelName?: string): CrossEncoderRerankingStrategy {
  return new CrossEncoderRerankingStrategy(modelName);
}

/**
 * Text-Derived Reranking Strategy Implementation
 * 
 * Converts images to text descriptions using image-to-text models, then applies
 * cross-encoder reranking to the text descriptions. This enables multimodal
 * content to be reranked using text-based reranking models.
 */
export class TextDerivedRerankingStrategy implements RerankingStrategy {
  public readonly name = 'text-derived';
  public readonly supportedContentTypes = ['text', 'image'];
  public isEnabled = true;
  
  private crossEncoderReranker: CrossEncoderRerankingStrategy;
  private imageToTextModel: any = null;
  private imageToTextModelName: string = 'Xenova/vit-gpt2-image-captioning';
  private initialized = false;

  constructor(
    imageToTextModelName?: string,
    crossEncoderModelName?: string
  ) {
    if (imageToTextModelName) {
      this.imageToTextModelName = imageToTextModelName;
    }
    
    // Create the underlying cross-encoder strategy
    this.crossEncoderReranker = new CrossEncoderRerankingStrategy(crossEncoderModelName);
  }

  /**
   * Initialize the image-to-text model if not already done
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      try {
        console.log(`Loading image-to-text model: ${this.imageToTextModelName}`);
        
        // Set up polyfills for transformers.js
        this.ensurePolyfills();
        
        const { pipeline } = await import('@huggingface/transformers');
        this.imageToTextModel = await pipeline('image-to-text', this.imageToTextModelName);
        
        this.initialized = true;
        console.log(`Image-to-text model loaded successfully: ${this.imageToTextModelName}`);
      } catch (error) {
        console.warn(`Image-to-text model initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.isEnabled = false;
      }
    }
  }

  /**
   * Ensure DOM polyfills are set up for transformers.js
   */
  private ensurePolyfills(): void {
    if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
      if (typeof (globalThis as any).self === 'undefined') {
        (globalThis as any).self = globalThis;
      }
      if (typeof (global as any).self === 'undefined') {
        (global as any).self = global;
      }
    }
  }

  /**
   * Generate text description for an image
   */
  private async generateImageDescription(imagePath: string): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.imageToTextModel) {
      throw new Error('Image-to-text model not loaded');
    }

    try {
      const result = await this.imageToTextModel(imagePath);
      
      // Handle different response formats from the pipeline
      if (Array.isArray(result) && result.length > 0) {
        return result[0].generated_text || result[0].text || String(result[0]);
      } else if (result && typeof result === 'object') {
        return result.generated_text || result.text || String(result);
      } else {
        return String(result);
      }
    } catch (error) {
      console.warn(`Failed to generate description for image ${imagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to filename-based description
      const filename = imagePath.split('/').pop() || imagePath;
      return `Image file: ${filename}`;
    }
  }

  /**
   * Rerank search results using text-derived approach
   */
  rerank: RerankFunction = async (
    query: string, 
    results: SearchResult[], 
    contentType?: string
  ): Promise<SearchResult[]> => {
    // If strategy is disabled, return results unchanged
    if (!this.isEnabled) {
      return results;
    }

    // Validate content type
    if (contentType && !this.supportedContentTypes.includes(contentType)) {
      throw new Error(
        `Text-derived strategy does not support content type '${contentType}'. ` +
        `Supported types: ${this.supportedContentTypes.join(', ')}`
      );
    }

    // Ensure models are initialized
    await this.ensureInitialized();

    // If initialization failed, return results unchanged
    if (!this.isEnabled) {
      console.warn('Text-derived reranker not enabled, returning results unchanged');
      return results;
    }

    try {
      // Step 1: Convert images to text descriptions
      const processedResults = await Promise.all(
        results.map(async (result) => {
          if (result.contentType === 'image') {
            // Generate text description for image
            const description = await this.generateImageDescription(result.content);
            
            return { 
              ...result, 
              content: description, 
              originalContent: result.content,
              originalContentType: result.contentType,
              metadata: {
                ...result.metadata,
                originalImagePath: result.content,
                generatedDescription: description
              }
            };
          }
          return result;
        })
      );

      // Step 2: Use cross-encoder reranking on the text descriptions
      const rerankedResults = await this.crossEncoderReranker.rerank(query, processedResults);
      
      // Step 3: Restore original content for images
      return rerankedResults.map(result => {
        if ((result as any).originalContent && (result as any).originalContentType) {
          return {
            ...result,
            content: (result as any).originalContent,
            contentType: (result as any).originalContentType,
            // Keep the generated description in metadata for reference
            metadata: {
              ...result.metadata,
              generatedDescription: result.content
            }
          };
        }
        return result;
      });

    } catch (error) {
      console.warn(
        `Text-derived reranking failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Returning original results.`
      );
      return results;
    }
  };

  /**
   * Configure the reranking strategy
   */
  configure(config: Record<string, any>): void {
    if (config.imageToTextModel && typeof config.imageToTextModel === 'string') {
      this.imageToTextModelName = config.imageToTextModel;
      // Reset initialization to use new model
      this.initialized = false;
      this.imageToTextModel = null;
    }

    if (config.crossEncoderModel && typeof config.crossEncoderModel === 'string') {
      this.crossEncoderReranker.configure({ modelName: config.crossEncoderModel });
    }

    if (config.enabled !== undefined) {
      this.isEnabled = Boolean(config.enabled);
    }
  }

  /**
   * Get metadata about this reranking strategy
   */
  getMetadata() {
    return {
      description: 'Text-derived reranking that converts images to text descriptions then applies cross-encoder reranking',
      requiredModels: [
        'Xenova/vit-gpt2-image-captioning', // Image-to-text model
        'Xenova/ms-marco-MiniLM-L-6-v2'     // Cross-encoder model
      ],
      configOptions: {
        imageToTextModel: {
          type: 'string',
          description: 'Image-to-text model name for generating descriptions',
          default: 'Xenova/vit-gpt2-image-captioning'
        },
        crossEncoderModel: {
          type: 'string',
          description: 'Cross-encoder model name for text reranking',
          default: 'Xenova/ms-marco-MiniLM-L-6-v2'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable text-derived reranking',
          default: true
        }
      }
    };
  }

  /**
   * Check if the strategy is ready to use
   */
  async isReady(): Promise<boolean> {
    await this.ensureInitialized();
    const crossEncoderReady = await this.crossEncoderReranker.isReady();
    return this.isEnabled && this.imageToTextModel !== null && crossEncoderReady;
  }

  /**
   * Get the current model names being used
   */
  getModelNames(): { imageToText: string; crossEncoder: string } {
    return {
      imageToText: this.imageToTextModelName,
      crossEncoder: this.crossEncoderReranker.getModelName()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.imageToTextModel = null;
    await this.crossEncoderReranker.cleanup();
  }
}

/**
 * Factory function to create a text-derived reranking strategy
 */
export function createTextDerivedStrategy(
  imageToTextModelName?: string,
  crossEncoderModelName?: string
): TextDerivedRerankingStrategy {
  return new TextDerivedRerankingStrategy(imageToTextModelName, crossEncoderModelName);
}

/**
 * Create a RerankFunction using the text-derived strategy
 */
export function createTextDerivedRerankFunction(
  imageToTextModelName?: string,
  crossEncoderModelName?: string
): RerankFunction {
  const strategy = createTextDerivedStrategy(imageToTextModelName, crossEncoderModelName);
  return strategy.rerank;
}

/**
 * Configuration interface for metadata reranking strategy
 */
interface MetadataRerankingConfig {
  weights: {
    filename: number;
    contentType: number;
    metadata: number;
  };
  boostFactors: {
    diagram: number;
    chart: number;
    graph: number;
    image: number;
    screenshot: number;
    figure: number;
  };
  keywordBoosts: Record<string, number>;
}

/**
 * Metadata-Based Reranking Strategy Implementation
 * 
 * Reranks search results based on filename patterns, metadata, and content type
 * information. This strategy is particularly useful for multimodal content where
 * semantic similarity might not capture all relevant aspects.
 */
export class MetadataRerankingStrategy implements RerankingStrategy {
  public readonly name = 'metadata';
  public readonly supportedContentTypes = ['text', 'image', 'pdf', 'docx'];
  public isEnabled = true;
  
  private config: MetadataRerankingConfig;

  constructor(config?: Partial<MetadataRerankingConfig>) {
    // Default configuration with reasonable weights and boost factors
    const defaultConfig: MetadataRerankingConfig = {
      weights: {
        filename: 0.4,
        contentType: 0.3,
        metadata: 0.3
      },
      boostFactors: {
        diagram: 1.5,
        chart: 1.4,
        graph: 1.4,
        image: 1.2,
        screenshot: 1.3,
        figure: 1.3
      },
      keywordBoosts: {
        // Technical terms
        'api': 1.2,
        'architecture': 1.3,
        'design': 1.2,
        'implementation': 1.2,
        'configuration': 1.2,
        'setup': 1.2,
        'guide': 1.2,
        'tutorial': 1.2,
        'example': 1.1,
        'demo': 1.1,
        // Visual content indicators
        'visual': 1.3,
        'overview': 1.2,
        'flow': 1.3,
        'process': 1.2,
        'workflow': 1.3
      }
    };

    this.config = {
      weights: { ...defaultConfig.weights, ...config?.weights },
      boostFactors: { ...defaultConfig.boostFactors, ...config?.boostFactors },
      keywordBoosts: { ...defaultConfig.keywordBoosts, ...config?.keywordBoosts }
    };
  }

  /**
   * Calculate filename-based score
   */
  private calculateFilenameScore(query: string, filename: string): number {
    const queryLower = query.toLowerCase();
    const filenameLower = filename.toLowerCase();
    
    let score = 0;
    
    // Exact filename match gets highest score
    if (filenameLower.includes(queryLower)) {
      score += 1.0;
    }
    
    // Word-level matching
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const filenameWords = filenameLower.split(/[_\-\s\.]+/).filter(word => word.length > 2);
    
    for (const queryWord of queryWords) {
      for (const filenameWord of filenameWords) {
        if (filenameWord.includes(queryWord) || queryWord.includes(filenameWord)) {
          score += 0.3;
        }
      }
    }
    
    // Apply keyword boosts
    for (const [keyword, boost] of Object.entries(this.config.keywordBoosts)) {
      if (filenameLower.includes(keyword)) {
        score *= boost;
      }
    }
    
    // Apply pattern-based boosts
    for (const [pattern, boost] of Object.entries(this.config.boostFactors)) {
      if (filenameLower.includes(pattern)) {
        score *= boost;
      }
    }
    
    return Math.min(score, 2.0); // Cap at 2.0 to prevent extreme scores
  }

  /**
   * Calculate content type-based score
   */
  private calculateContentTypeScore(query: string, contentType: string): number {
    const queryLower = query.toLowerCase();
    
    // Base scores for different content types
    const contentTypeScores: Record<string, number> = {
      'image': 0.8,
      'text': 1.0,
      'pdf': 0.9,
      'docx': 0.9
    };
    
    let score = contentTypeScores[contentType] || 0.5;
    
    // Boost image content for visual-related queries
    if (contentType === 'image') {
      const visualKeywords = ['diagram', 'chart', 'graph', 'image', 'visual', 'screenshot', 'figure', 'illustration', 'visualization'];
      for (const keyword of visualKeywords) {
        if (queryLower.includes(keyword)) {
          score *= 2.0; // More aggressive boost
          break;
        }
      }
    }
    
    // Boost document content for text-heavy queries
    if (contentType === 'text' || contentType === 'pdf' || contentType === 'docx') {
      const textKeywords = ['documentation', 'guide', 'tutorial', 'explanation', 'description', 'details'];
      for (const keyword of textKeywords) {
        if (queryLower.includes(keyword)) {
          score *= 1.8; // More aggressive boost
          break;
        }
      }
    }
    
    return score;
  }

  /**
   * Calculate metadata-based score
   */
  private calculateMetadataScore(query: string, metadata: Record<string, any> = {}): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Check various metadata fields
    const metadataFields = ['title', 'description', 'tags', 'category', 'type'];
    
    for (const field of metadataFields) {
      const value = metadata[field];
      if (typeof value === 'string') {
        const valueLower = value.toLowerCase();
        if (valueLower.includes(queryLower)) {
          score += 0.5;
        }
        
        // Word-level matching
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
        for (const word of queryWords) {
          if (valueLower.includes(word)) {
            score += 0.2;
          }
        }
      } else if (Array.isArray(value)) {
        // Handle tag arrays
        for (const item of value) {
          if (typeof item === 'string' && item.toLowerCase().includes(queryLower)) {
            score += 0.3;
          }
        }
      }
    }
    
    // Special handling for image metadata
    if (metadata.dimensions) {
      // Larger images might be more important
      const { width, height } = metadata.dimensions;
      if (width && height && width * height > 500000) { // > 500k pixels
        score += 0.5; // More significant boost for large images
      }
    }
    
    // File size considerations
    if (metadata.fileSize) {
      // Very small files might be less important
      if (metadata.fileSize < 1000) {
        score -= 0.1;
      }
    }
    
    return Math.max(score, 0); // Ensure non-negative
  }

  /**
   * Rerank search results using metadata-based scoring
   */
  rerank: RerankFunction = async (
    query: string, 
    results: SearchResult[], 
    contentType?: string
  ): Promise<SearchResult[]> => {
    // If strategy is disabled, return results unchanged
    if (!this.isEnabled) {
      return results;
    }

    // Validate content type if specified
    if (contentType && !this.supportedContentTypes.includes(contentType)) {
      console.warn(
        `Metadata strategy does not support content type '${contentType}'. ` +
        `Supported types: ${this.supportedContentTypes.join(', ')}. Proceeding anyway.`
      );
    }

    try {
      // Calculate metadata scores for each result
      const scoredResults = results.map(result => {
        const filename = result.document.source.split('/').pop() || result.document.source;
        
        // Calculate individual scores
        const filenameScore = this.calculateFilenameScore(query, filename);
        const contentTypeScore = this.calculateContentTypeScore(query, result.contentType);
        const metadataScore = this.calculateMetadataScore(query, result.metadata);
        
        // Combine scores using configured weights
        const metadataBoost = (
          filenameScore * this.config.weights.filename +
          contentTypeScore * this.config.weights.contentType +
          metadataScore * this.config.weights.metadata
        );
        
        // Combine with original vector similarity score
        // Use a weighted combination where metadata boost can have significant influence
        const combinedScore = result.score * 0.4 + metadataBoost * 0.6;
        
        return {
          ...result,
          score: combinedScore,
          metadata: {
            ...result.metadata,
            rerankingScores: {
              original: result.score,
              filename: filenameScore,
              contentType: contentTypeScore,
              metadata: metadataScore,
              combined: combinedScore
            }
          }
        };
      });

      // Sort by combined score (descending)
      scoredResults.sort((a, b) => b.score - a.score);
      
      return scoredResults;

    } catch (error) {
      console.warn(
        `Metadata reranking failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Returning original results.`
      );
      return results;
    }
  };

  /**
   * Configure the reranking strategy
   */
  configure(config: Record<string, any>): void {
    if (config.weights && typeof config.weights === 'object') {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }

    if (config.boostFactors && typeof config.boostFactors === 'object') {
      this.config.boostFactors = { ...this.config.boostFactors, ...config.boostFactors };
    }

    if (config.keywordBoosts && typeof config.keywordBoosts === 'object') {
      this.config.keywordBoosts = { ...this.config.keywordBoosts, ...config.keywordBoosts };
    }

    if (config.enabled !== undefined) {
      this.isEnabled = Boolean(config.enabled);
    }
  }

  /**
   * Get metadata about this reranking strategy
   */
  getMetadata() {
    return {
      description: 'Metadata-based reranking using filename patterns, content types, and file metadata',
      requiredModels: [], // No models required
      configOptions: {
        weights: {
          type: 'object',
          description: 'Weights for different scoring components',
          default: this.config.weights,
          properties: {
            filename: { type: 'number', min: 0, max: 1 },
            contentType: { type: 'number', min: 0, max: 1 },
            metadata: { type: 'number', min: 0, max: 1 }
          }
        },
        boostFactors: {
          type: 'object',
          description: 'Boost factors for specific file patterns',
          default: this.config.boostFactors
        },
        keywordBoosts: {
          type: 'object',
          description: 'Boost factors for specific keywords in filenames',
          default: this.config.keywordBoosts
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable metadata-based reranking',
          default: true
        }
      }
    };
  }

  /**
   * Check if the strategy is ready to use
   */
  async isReady(): Promise<boolean> {
    // Metadata strategy doesn't require model loading, so it's always ready if enabled
    return this.isEnabled;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Clean up resources (no-op for metadata strategy)
   */
  async cleanup(): Promise<void> {
    // No resources to clean up for metadata-based reranking
  }
}

/**
 * Factory function to create a metadata reranking strategy
 */
export function createMetadataStrategy(
  config?: Partial<MetadataRerankingConfig>
): MetadataRerankingStrategy {
  return new MetadataRerankingStrategy(config);
}

/**
 * Create a RerankFunction using the metadata strategy
 */
export function createMetadataRerankFunction(
  config?: Partial<MetadataRerankingConfig>
): RerankFunction {
  const strategy = createMetadataStrategy(config);
  return strategy.rerank;
}

/**
 * Create a RerankFunction using the cross-encoder strategy
 * 
 * This provides backward compatibility with the existing RerankFunction interface
 * while using the new strategy-based architecture internally.
 */
export function createCrossEncoderRerankFunction(modelName?: string): RerankFunction {
  const strategy = createCrossEncoderStrategy(modelName);
  return strategy.rerank;
}