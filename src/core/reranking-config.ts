/**
 * Simple Reranking Configuration System
 * 
 * Provides straightforward configuration types and validation for different
 * reranking strategies without complex interface patterns.
 */

import type { RerankFunction } from './types.js';

// Basic strategy enumeration as defined in requirements
export type RerankingStrategyType = 
  | 'cross-encoder'    // Text cross-encoder (text mode default)
  | 'text-derived'     // Convert images to text, then use cross-encoder (multimodal mode)
  | 'metadata'         // Use file metadata for scoring
  | 'hybrid'           // Combine multiple signals (text-derived + metadata)
  | 'disabled';        // No reranking

// Simple configuration structure for reranking strategies
export interface RerankingConfig {
  strategy: RerankingStrategyType;
  model?: string;
  enabled: boolean;
  
  // Strategy-specific configuration options
  weights?: {
    semantic?: number;
    metadata?: number;
    visual?: number;
  };
  
  // Fallback strategy if primary fails
  fallback?: RerankingStrategyType;
}

// Default configurations for different modes
export const DEFAULT_TEXT_RERANKING_CONFIG: RerankingConfig = {
  strategy: 'cross-encoder',
  enabled: true,
  fallback: 'disabled'
};

export const DEFAULT_MULTIMODAL_RERANKING_CONFIG: RerankingConfig = {
  strategy: 'text-derived',
  enabled: true,
  weights: {
    semantic: 0.7,
    metadata: 0.3
  },
  fallback: 'metadata'
};

// Strategy validation without complex interface patterns
export function validateRerankingStrategy(strategy: string): strategy is RerankingStrategyType {
  const validStrategies: RerankingStrategyType[] = [
    'cross-encoder',
    'text-derived', 
    'metadata',
    'hybrid',
    'disabled'
  ];
  
  return validStrategies.includes(strategy as RerankingStrategyType);
}

// Simple strategy validation with clear error messages
export function validateRerankingConfig(config: Partial<RerankingConfig>): RerankingConfig {
  if (!config.strategy) {
    throw new Error('Reranking strategy is required');
  }
  
  if (!validateRerankingStrategy(config.strategy)) {
    const validStrategies = ['cross-encoder', 'text-derived', 'metadata', 'hybrid', 'disabled'];
    throw new Error(
      `Invalid reranking strategy '${config.strategy}'. ` +
      `Valid strategies: ${validStrategies.join(', ')}`
    );
  }
  
  // Validate weights if provided
  if (config.weights) {
    const { semantic, metadata, visual } = config.weights;
    
    if (semantic !== undefined && (semantic < 0 || semantic > 1)) {
      throw new Error('Semantic weight must be between 0 and 1');
    }
    
    if (metadata !== undefined && (metadata < 0 || metadata > 1)) {
      throw new Error('Metadata weight must be between 0 and 1');
    }
    
    if (visual !== undefined && (visual < 0 || visual > 1)) {
      throw new Error('Visual weight must be between 0 and 1');
    }
    
    // Ensure weights sum to reasonable value for hybrid strategy
    if (config.strategy === 'hybrid') {
      const totalWeight = (semantic || 0) + (metadata || 0) + (visual || 0);
      if (totalWeight === 0) {
        throw new Error('Hybrid strategy requires at least one weight to be greater than 0');
      }
    }
  }
  
  // Validate fallback strategy if provided
  if (config.fallback && !validateRerankingStrategy(config.fallback)) {
    const validStrategies = ['cross-encoder', 'text-derived', 'metadata', 'hybrid', 'disabled'];
    throw new Error(
      `Invalid fallback strategy '${config.fallback}'. ` +
      `Valid strategies: ${validStrategies.join(', ')}`
    );
  }
  
  return {
    strategy: config.strategy,
    enabled: config.enabled ?? true,
    model: config.model,
    weights: config.weights,
    fallback: config.fallback || 'disabled'
  };
}

// Get appropriate default configuration based on mode
export function getDefaultRerankingConfig(mode: 'text' | 'multimodal'): RerankingConfig {
  switch (mode) {
    case 'text':
      return { ...DEFAULT_TEXT_RERANKING_CONFIG };
    case 'multimodal':
      return { ...DEFAULT_MULTIMODAL_RERANKING_CONFIG };
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

// Check if a strategy is supported for a given mode
export function isStrategySupported(strategy: RerankingStrategyType, mode: 'text' | 'multimodal'): boolean {
  switch (mode) {
    case 'text':
      return strategy === 'cross-encoder' || strategy === 'disabled';
    case 'multimodal':
      return ['text-derived', 'metadata', 'hybrid', 'disabled'].includes(strategy);
    default:
      return false;
  }
}

// Get supported strategies for a mode
export function getSupportedStrategies(mode: 'text' | 'multimodal'): RerankingStrategyType[] {
  switch (mode) {
    case 'text':
      return ['cross-encoder', 'disabled'];
    case 'multimodal':
      return ['text-derived', 'metadata', 'hybrid', 'disabled'];
    default:
      return ['disabled'];
  }
}

// Simple configuration builder for common scenarios
export class RerankingConfigBuilder {
  private config: Partial<RerankingConfig> = {};
  
  strategy(strategy: RerankingStrategyType): this {
    this.config.strategy = strategy;
    return this;
  }
  
  model(model: string): this {
    this.config.model = model;
    return this;
  }
  
  enabled(enabled: boolean): this {
    this.config.enabled = enabled;
    return this;
  }
  
  weights(weights: { semantic?: number; metadata?: number; visual?: number }): this {
    this.config.weights = weights;
    return this;
  }
  
  fallback(fallback: RerankingStrategyType): this {
    this.config.fallback = fallback;
    return this;
  }
  
  build(): RerankingConfig {
    return validateRerankingConfig(this.config);
  }
  
  // Convenience methods for common configurations
  static textMode(): RerankingConfigBuilder {
    return new RerankingConfigBuilder()
      .strategy('cross-encoder')
      .enabled(true)
      .fallback('disabled');
  }
  
  static multimodalMode(): RerankingConfigBuilder {
    return new RerankingConfigBuilder()
      .strategy('text-derived')
      .enabled(true)
      .weights({ semantic: 0.7, metadata: 0.3 })
      .fallback('metadata');
  }
  
  static disabled(): RerankingConfigBuilder {
    return new RerankingConfigBuilder()
      .strategy('disabled')
      .enabled(false);
  }
}