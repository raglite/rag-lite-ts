/**
 * Simple Reranking Creation Function
 * 
 * Implements createReranker function with simple conditional logic and automatic
 * fallback mechanism for failed strategy initialization. Follows the design
 * principle of using simple functions over complex factory patterns.
 */

import type { RerankFunction, SearchResult } from './types.js';
import type { RerankingStrategyType, RerankingConfig } from './reranking-config.js';
import { 
  getDefaultRerankingConfig, 
  isStrategySupported, 
  getSupportedStrategies,
  validateRerankingConfig 
} from './reranking-config.js';
import {
  createCrossEncoderRerankFunction,
  createTextDerivedRerankFunction,
  createMetadataRerankFunction
} from './reranking-strategies.js';

/**
 * Simple reranking creation function with conditional logic
 * 
 * Creates appropriate reranking function based on mode and strategy with
 * automatic fallback mechanism for failed strategy initialization.
 * 
 * @param mode - Operating mode ('text' or 'multimodal')
 * @param strategy - Desired reranking strategy
 * @param config - Optional configuration for the strategy
 * @returns RerankFunction or undefined if reranking is disabled
 */
export function createReranker(
  mode: 'text' | 'multimodal',
  strategy?: RerankingStrategyType,
  config?: Partial<RerankingConfig>
): RerankFunction | undefined {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 Starting reranker creation for ${mode} mode`);
    
    // Use default strategy for mode if not specified
    if (!strategy) {
      const defaultConfig = getDefaultRerankingConfig(mode);
      strategy = defaultConfig.strategy;
      console.log(`Using default strategy for ${mode} mode: ${strategy}`);
    }

    // Return undefined immediately for disabled strategy
    if (strategy === 'disabled') {
      console.log('Reranking disabled by configuration');
      return undefined;
    }

    // Validate strategy is supported for the mode
    if (!isStrategySupported(strategy, mode)) {
      const supportedStrategies = getSupportedStrategies(mode);
      console.warn(
        `⚠️ Strategy '${strategy}' not supported for ${mode} mode. ` +
        `Supported strategies: ${supportedStrategies.join(', ')}. ` +
        `Initiating fallback sequence.`
      );
      
      // Initiate fallback chain instead of just using default
      return createFallbackReranker(mode);
    }

    // Validate and merge configuration
    let validatedConfig: RerankingConfig;
    try {
      validatedConfig = config ? validateRerankingConfig({
        strategy,
        ...config
      }) : getDefaultRerankingConfig(mode);
    } catch (configError) {
      console.warn(
        `⚠️ Configuration validation failed: ${configError instanceof Error ? configError.message : 'Unknown error'}. ` +
        `Using default configuration.`
      );
      validatedConfig = getDefaultRerankingConfig(mode);
      validatedConfig.strategy = strategy; // Keep the requested strategy
    }

    // Create reranking function based on strategy with enhanced error handling
    const reranker = createRerankingFunction(mode, strategy, validatedConfig);
    
    const duration = Date.now() - startTime;
    if (reranker) {
      console.log(`✅ Reranker creation completed successfully (${duration}ms)`);
    } else {
      console.log(`ℹ️ Reranker creation completed - reranking disabled (${duration}ms)`);
    }
    
    return reranker;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.warn(
      `❌ Failed to create reranker with strategy '${strategy}' for ${mode} mode (${duration}ms): ` +
      `${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Initiating comprehensive fallback sequence.`
    );
    
    // Log error details for debugging
    if (error instanceof RerankingStrategyError) {
      console.error('Detailed error information:', {
        strategy: error.strategy,
        mode: error.mode,
        errorCode: error.errorCode,
        message: error.message
      });
    }
    
    // Attempt comprehensive fallback sequence
    try {
      const fallbackReranker = createFallbackReranker(mode);
      const totalDuration = Date.now() - startTime;
      
      if (fallbackReranker) {
        console.log(`✅ Fallback reranker created successfully (total: ${totalDuration}ms)`);
      } else {
        console.log(`ℹ️ All fallback strategies exhausted, reranking disabled (total: ${totalDuration}ms)`);
      }
      
      return fallbackReranker;
    } catch (fallbackError) {
      const totalDuration = Date.now() - startTime;
      console.error(
        `❌ Fallback reranker creation also failed (total: ${totalDuration}ms): ` +
        `${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}. ` +
        `Reranking will be completely disabled.`
      );
      
      // Return undefined to disable reranking completely
      // This ensures search operations can continue with vector similarity only
      return undefined;
    }
  }
}

/**
 * Create reranking function for specific strategy with enhanced error handling and recovery
 */
function createRerankingFunction(
  mode: 'text' | 'multimodal',
  strategy: RerankingStrategyType,
  config: RerankingConfig
): RerankFunction | undefined {
  const startTime = Date.now();
  
  try {
    logRerankingAttempt(mode, strategy, config);
    
    let reranker: RerankFunction | undefined;
    
    switch (strategy) {
      case 'cross-encoder':
        console.log(`Creating cross-encoder reranker for ${mode} mode`);
        reranker = createCrossEncoderRerankFunction(config.model);
        break;

      case 'text-derived':
        if (mode !== 'multimodal') {
          throw new RerankingStrategyError(
            strategy,
            mode,
            'Text-derived strategy only supported in multimodal mode',
            'UNSUPPORTED_MODE'
          );
        }
        console.log('Creating text-derived reranker for multimodal mode');
        reranker = createTextDerivedRerankFunction(
          config.model, // Image-to-text model
          undefined     // Use default cross-encoder model
        );
        break;

      case 'metadata':
        console.log(`Creating metadata reranker for ${mode} mode`);
        reranker = createMetadataRerankFunction({
          weights: config.weights ? {
            filename: config.weights.metadata || 0.4,
            contentType: 0.3,
            metadata: config.weights.metadata || 0.3
          } : undefined
        });
        break;

      case 'hybrid':
        if (mode !== 'multimodal') {
          throw new RerankingStrategyError(
            strategy,
            mode,
            'Hybrid strategy only supported in multimodal mode',
            'UNSUPPORTED_MODE'
          );
        }
        console.log('Creating hybrid reranker for multimodal mode');
        reranker = createHybridRerankFunction(config);
        break;

      case 'disabled':
        console.log('Reranking explicitly disabled');
        return undefined;

      default:
        throw new RerankingStrategyError(
          strategy,
          mode,
          `Unknown reranking strategy: ${strategy}`,
          'UNKNOWN_STRATEGY'
        );
    }
    
    // Validate that reranker was created successfully
    if (!reranker) {
      throw new RerankingStrategyError(
        strategy,
        mode,
        `Strategy '${strategy}' returned undefined reranker`,
        'CREATION_FAILED'
      );
    }
    
    // Wrap reranker with error recovery
    const wrappedReranker = wrapRerankFunctionWithErrorRecovery(reranker, strategy, mode);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Successfully created ${strategy} reranker for ${mode} mode (${duration}ms)`);
    
    return wrappedReranker;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const rerankingError = error instanceof RerankingStrategyError 
      ? error 
      : new RerankingStrategyError(
          strategy,
          mode,
          error instanceof Error ? error.message : 'Unknown error',
          'CREATION_ERROR'
        );
    
    logRerankingError(rerankingError, duration);
    
    // Try fallback strategy if specified in config
    if (config.fallback && config.fallback !== strategy && config.fallback !== 'disabled') {
      console.log(`🔄 Attempting fallback to ${config.fallback} strategy`);
      return createRerankingFunction(mode, config.fallback, {
        ...config,
        strategy: config.fallback,
        fallback: 'disabled' // Prevent infinite recursion
      });
    }
    
    throw rerankingError; // Re-throw if no fallback available
  }
}

/**
 * Custom error class for reranking strategy failures
 */
class RerankingStrategyError extends Error {
  constructor(
    public strategy: RerankingStrategyType,
    public mode: 'text' | 'multimodal',
    message: string,
    public errorCode: string
  ) {
    super(message);
    this.name = 'RerankingStrategyError';
  }
}

/**
 * Log reranking attempt details
 */
function logRerankingAttempt(
  mode: 'text' | 'multimodal',
  strategy: RerankingStrategyType,
  config: RerankingConfig
): void {
  console.log(`🔧 Creating reranker: ${strategy} (mode: ${mode})`);
  if (config.model) {
    console.log(`   Model: ${config.model}`);
  }
  if (config.weights) {
    console.log(`   Weights: ${JSON.stringify(config.weights)}`);
  }
  if (config.fallback && config.fallback !== 'disabled') {
    console.log(`   Fallback: ${config.fallback}`);
  }
}

/**
 * Log comprehensive reranking error details
 */
function logRerankingError(error: RerankingStrategyError, duration: number): void {
  console.error('❌ Reranking Strategy Creation Failed');
  console.error(`   Strategy: ${error.strategy}`);
  console.error(`   Mode: ${error.mode}`);
  console.error(`   Error Code: ${error.errorCode}`);
  console.error(`   Duration: ${duration}ms`);
  console.error(`   Message: ${error.message}`);
  
  // Provide troubleshooting guidance based on error type
  switch (error.errorCode) {
    case 'UNSUPPORTED_MODE':
      console.error('💡 Suggestion: Use a strategy supported by the current mode');
      break;
    case 'UNKNOWN_STRATEGY':
      console.error('💡 Suggestion: Check strategy name spelling and supported strategies');
      break;
    case 'CREATION_FAILED':
      console.error('💡 Suggestion: Check model availability and network connectivity');
      break;
    case 'CREATION_ERROR':
      console.error('💡 Suggestion: Check logs above for specific model loading errors');
      break;
  }
}

/**
 * Wrap rerank function with error recovery to ensure search operations continue
 */
function wrapRerankFunctionWithErrorRecovery(
  reranker: RerankFunction,
  strategy: RerankingStrategyType,
  mode: 'text' | 'multimodal'
): RerankFunction {
  return async (query: string, results: SearchResult[], contentType?: string): Promise<SearchResult[]> => {
    try {
      const startTime = Date.now();
      const rerankedResults = await reranker(query, results, contentType);
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${strategy} reranking completed successfully (${duration}ms, ${results.length} → ${rerankedResults.length} results)`);
      return rerankedResults;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `⚠️ ${strategy} reranking failed during execution: ${errorMessage}. ` +
        `Falling back to vector similarity scores.`
      );
      
      // Log detailed error information for debugging
      console.error('Reranking execution error details:', {
        strategy,
        mode,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        resultCount: results.length,
        contentType,
        error: errorMessage
      });
      
      // Return original results with vector similarity scores
      // This ensures search operations continue even when reranking fails
      return results.map(result => ({
        ...result,
        metadata: {
          ...result.metadata,
          rerankingFailed: true,
          rerankingError: errorMessage,
          rerankingStrategy: strategy,
          fallbackToVectorSimilarity: true
        }
      }));
    }
  };
}

/**
 * Create fallback reranker when primary strategy fails
 * Implements automatic strategy downgrade: hybrid → text-derived → metadata → disabled
 */
function createFallbackReranker(mode: 'text' | 'multimodal'): RerankFunction | undefined {
  try {
    console.log(`Creating fallback reranker for ${mode} mode`);
    
    if (mode === 'text') {
      // For text mode: cross-encoder → disabled
      return createFallbackChain(mode, ['cross-encoder', 'disabled']);
    } else {
      // For multimodal mode: hybrid → text-derived → metadata → disabled
      return createFallbackChain(mode, ['hybrid', 'text-derived', 'metadata', 'disabled']);
    }
  } catch (error) {
    console.warn(
      `Fallback reranker creation failed: ` +
      `${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Reranking will be disabled.`
    );
    return undefined;
  }
}

/**
 * Create reranker with automatic fallback chain
 * Tries strategies in order until one succeeds or all fail
 */
function createFallbackChain(
  mode: 'text' | 'multimodal', 
  strategies: RerankingStrategyType[]
): RerankFunction | undefined {
  const errors: Array<{ strategy: RerankingStrategyType; error: string }> = [];
  
  for (const strategy of strategies) {
    if (strategy === 'disabled') {
      console.log('Reached disabled strategy in fallback chain, reranking will be disabled');
      logFallbackSummary(mode, strategies, errors);
      return undefined;
    }
    
    try {
      console.log(`Attempting fallback strategy: ${strategy} for ${mode} mode`);
      
      // Validate strategy is supported for the mode
      if (!isStrategySupported(strategy, mode)) {
        const error = `Strategy '${strategy}' not supported for ${mode} mode`;
        errors.push({ strategy, error });
        console.warn(error);
        continue;
      }
      
      const config = getDefaultRerankingConfig(mode);
      const reranker = createRerankingFunction(mode, strategy, {
        ...config,
        strategy,
        fallback: 'disabled' // Prevent infinite recursion in fallback chain
      });
      
      if (reranker) {
        console.log(`Successfully created fallback reranker with ${strategy} strategy`);
        logFallbackSummary(mode, strategies, errors, strategy);
        return reranker;
      } else {
        const error = `Strategy '${strategy}' returned undefined reranker`;
        errors.push({ strategy, error });
        console.warn(error);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ strategy, error: errorMessage });
      console.warn(`Fallback strategy '${strategy}' failed: ${errorMessage}`);
    }
  }
  
  // All strategies failed
  console.error('All fallback strategies failed, reranking will be disabled');
  logFallbackSummary(mode, strategies, errors);
  return undefined;
}

/**
 * Log comprehensive summary of fallback attempts
 */
function logFallbackSummary(
  mode: 'text' | 'multimodal',
  attemptedStrategies: RerankingStrategyType[],
  errors: Array<{ strategy: RerankingStrategyType; error: string }>,
  successfulStrategy?: RerankingStrategyType
): void {
  console.log('=== Reranking Strategy Fallback Summary ===');
  console.log(`Mode: ${mode}`);
  console.log(`Attempted strategies: ${attemptedStrategies.join(' → ')}`);
  
  if (successfulStrategy) {
    console.log(`✅ Successfully fell back to: ${successfulStrategy}`);
    if (errors.length > 0) {
      console.log('Failed strategies:');
      errors.forEach(({ strategy, error }) => {
        console.log(`  ❌ ${strategy}: ${error}`);
      });
    }
  } else {
    console.log('❌ All strategies failed, reranking disabled');
    console.log('Failure details:');
    errors.forEach(({ strategy, error }) => {
      console.log(`  ❌ ${strategy}: ${error}`);
    });
  }
  
  console.log('=== End Fallback Summary ===');
}

/**
 * Create hybrid reranking function that combines multiple strategies with enhanced error recovery
 */
function createHybridRerankFunction(config: RerankingConfig): RerankFunction {
  // Default weights if not specified
  const weights = config.weights || {
    semantic: 0.6,
    metadata: 0.4,
    visual: 0.0 // Not implemented yet
  };

  // Track which strategies are available
  const availableStrategies: {
    textDerived?: RerankFunction;
    metadata?: RerankFunction;
  } = {};

  // Initialize strategies with error handling
  try {
    if (weights.semantic && weights.semantic > 0) {
      availableStrategies.textDerived = createTextDerivedRerankFunction();
      console.log('✅ Text-derived strategy initialized for hybrid reranking');
    }
  } catch (error) {
    console.warn(`⚠️ Text-derived strategy initialization failed for hybrid reranking: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    if (weights.metadata && weights.metadata > 0) {
      availableStrategies.metadata = createMetadataRerankFunction();
      console.log('✅ Metadata strategy initialized for hybrid reranking');
    }
  } catch (error) {
    console.warn(`⚠️ Metadata strategy initialization failed for hybrid reranking: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check if any strategies are available
  const hasAvailableStrategies = Object.keys(availableStrategies).length > 0;
  if (!hasAvailableStrategies) {
    throw new RerankingStrategyError(
      'hybrid',
      'multimodal',
      'No hybrid reranking strategies could be initialized',
      'NO_STRATEGIES_AVAILABLE'
    );
  }

  console.log(`Hybrid reranking initialized with ${Object.keys(availableStrategies).length} available strategies`);

  return async (query: string, results: SearchResult[], contentType?: string) => {
    const startTime = Date.now();
    const strategyResults: Record<string, { success: boolean; error?: string; duration?: number }> = {};
    
    try {
      console.log(`🔄 Running hybrid reranking with ${Object.keys(availableStrategies).length} strategies`);
      
      // Start with original results
      let hybridResults = [...results];
      let successfulStrategies = 0;
      
      // Apply text-derived reranking if available and enabled
      if (availableStrategies.textDerived && weights.semantic && weights.semantic > 0) {
        const strategyStartTime = Date.now();
        try {
          console.log(`🔧 Applying text-derived reranking (weight: ${weights.semantic})`);
          const textDerivedResults = await availableStrategies.textDerived(query, hybridResults, contentType);
          
          // Combine scores with semantic weight
          hybridResults = hybridResults.map((result, index) => {
            const textDerivedScore = textDerivedResults[index]?.score || result.score;
            const combinedScore = result.score * (1 - weights.semantic!) + textDerivedScore * weights.semantic!;
            
            return {
              ...result,
              score: combinedScore,
              metadata: {
                ...result.metadata,
                hybridScores: {
                  ...((result.metadata?.hybridScores as any) || {}),
                  textDerived: textDerivedScore,
                  semantic: combinedScore
                }
              }
            };
          });
          
          const strategyDuration = Date.now() - strategyStartTime;
          strategyResults.textDerived = { success: true, duration: strategyDuration };
          successfulStrategies++;
          console.log(`✅ Text-derived reranking completed (${strategyDuration}ms)`);
          
        } catch (error) {
          const strategyDuration = Date.now() - strategyStartTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          strategyResults.textDerived = { success: false, error: errorMessage, duration: strategyDuration };
          console.warn(`❌ Text-derived reranking failed in hybrid mode (${strategyDuration}ms): ${errorMessage}`);
        }
      }
      
      // Apply metadata reranking if available and enabled
      if (availableStrategies.metadata && weights.metadata && weights.metadata > 0) {
        const strategyStartTime = Date.now();
        try {
          console.log(`🔧 Applying metadata reranking (weight: ${weights.metadata})`);
          const metadataResults = await availableStrategies.metadata(query, hybridResults, contentType);
          
          // Combine scores with metadata weight
          hybridResults = hybridResults.map((result, index) => {
            const metadataScore = metadataResults[index]?.score || result.score;
            const currentScore = result.score;
            const combinedScore = currentScore * (1 - weights.metadata!) + metadataScore * weights.metadata!;
            
            return {
              ...result,
              score: combinedScore,
              metadata: {
                ...result.metadata,
                hybridScores: {
                  ...((result.metadata?.hybridScores as any) || {}),
                  metadata: metadataScore,
                  combined: combinedScore
                }
              }
            };
          });
          
          const strategyDuration = Date.now() - strategyStartTime;
          strategyResults.metadata = { success: true, duration: strategyDuration };
          successfulStrategies++;
          console.log(`✅ Metadata reranking completed (${strategyDuration}ms)`);
          
        } catch (error) {
          const strategyDuration = Date.now() - strategyStartTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          strategyResults.metadata = { success: false, error: errorMessage, duration: strategyDuration };
          console.warn(`❌ Metadata reranking failed in hybrid mode (${strategyDuration}ms): ${errorMessage}`);
        }
      }
      
      // Sort by final combined scores
      hybridResults.sort((a, b) => b.score - a.score);
      
      const totalDuration = Date.now() - startTime;
      
      // Add hybrid reranking metadata to results
      hybridResults = hybridResults.map(result => ({
        ...result,
        metadata: {
          ...result.metadata,
          hybridRerankingInfo: {
            totalDuration,
            successfulStrategies,
            strategyResults,
            weights
          }
        }
      }));
      
      if (successfulStrategies > 0) {
        console.log(`✅ Hybrid reranking completed successfully (${totalDuration}ms, ${successfulStrategies}/${Object.keys(availableStrategies).length} strategies succeeded)`);
      } else {
        console.warn(`⚠️ Hybrid reranking completed with no successful strategies (${totalDuration}ms), returning original results`);
        return results; // Return original results if no strategies succeeded
      }
      
      return hybridResults;
      
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `❌ Hybrid reranking failed (${totalDuration}ms): ${errorMessage}. ` +
        `Returning original results.`
      );
      
      // Log detailed error information
      console.error('Hybrid reranking error details:', {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        resultCount: results.length,
        contentType,
        availableStrategies: Object.keys(availableStrategies),
        weights,
        strategyResults,
        error: errorMessage
      });
      
      return results.map(result => ({
        ...result,
        metadata: {
          ...result.metadata,
          hybridRerankingFailed: true,
          hybridRerankingError: errorMessage,
          fallbackToVectorSimilarity: true
        }
      }));
    }
  };
}

/**
 * Create reranker with automatic mode detection
 * 
 * This is a convenience function that automatically detects the appropriate
 * default strategy based on mode and creates the reranker.
 * 
 * @param mode - Operating mode ('text' or 'multimodal')
 * @param config - Optional configuration override
 * @returns RerankFunction or undefined if reranking is disabled
 */
export function createDefaultReranker(
  mode: 'text' | 'multimodal',
  config?: Partial<RerankingConfig>
): RerankFunction | undefined {
  const defaultConfig = getDefaultRerankingConfig(mode);
  const strategy = config?.strategy || defaultConfig.strategy;
  
  console.log(`Creating default reranker for ${mode} mode with ${strategy} strategy`);
  
  return createReranker(mode, strategy, config);
}

/**
 * Check if reranking is available for a given mode and strategy
 * 
 * This function can be used to test if a reranking strategy can be created
 * without actually creating it.
 * 
 * @param mode - Operating mode ('text' or 'multimodal')
 * @param strategy - Reranking strategy to test
 * @returns Promise<boolean> indicating if the strategy is available
 */
export async function isRerankingAvailable(
  mode: 'text' | 'multimodal',
  strategy?: RerankingStrategyType
): Promise<boolean> {
  try {
    if (!strategy) {
      const defaultConfig = getDefaultRerankingConfig(mode);
      strategy = defaultConfig.strategy;
    }
    
    if (strategy === 'disabled') {
      return false;
    }
    
    if (!isStrategySupported(strategy, mode)) {
      return false;
    }
    
    // Try to create the reranker to test availability
    const reranker = createReranker(mode, strategy);
    return reranker !== undefined;
    
  } catch (error) {
    console.warn(
      `Reranking availability check failed for ${strategy} in ${mode} mode: ` +
      `${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}

/**
 * Get comprehensive information about available reranking strategies for a mode
 * 
 * @param mode - Operating mode ('text' or 'multimodal')
 * @returns Object with strategy information and availability
 */
export async function getRerankingInfo(mode: 'text' | 'multimodal') {
  const supportedStrategies = getSupportedStrategies(mode);
  const defaultConfig = getDefaultRerankingConfig(mode);
  
  const strategyInfo = await Promise.all(
    supportedStrategies.map(async (strategy) => {
      const startTime = Date.now();
      let available = false;
      let error: string | undefined;
      
      try {
        available = await isRerankingAvailable(mode, strategy);
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
      }
      
      const duration = Date.now() - startTime;
      
      return {
        strategy,
        supported: true,
        available,
        isDefault: strategy === defaultConfig.strategy,
        checkDuration: duration,
        error
      };
    })
  );
  
  return {
    mode,
    defaultStrategy: defaultConfig.strategy,
    strategies: strategyInfo,
    hasAvailableStrategies: strategyInfo.some(info => info.available),
    fallbackChain: mode === 'text' 
      ? ['cross-encoder', 'disabled']
      : ['hybrid', 'text-derived', 'metadata', 'disabled']
  };
}

/**
 * Test reranking system health and error recovery
 * 
 * @param mode - Operating mode to test
 * @returns Comprehensive health report
 */
export async function testRerankingHealth(mode: 'text' | 'multimodal'): Promise<{
  mode: 'text' | 'multimodal';
  overallHealth: 'healthy' | 'degraded' | 'failed';
  defaultStrategyWorking: boolean;
  fallbackSystemWorking: boolean;
  strategyTests: Array<{
    strategy: RerankingStrategyType;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  recommendations: string[];
}> {
  console.log(`🔍 Testing reranking system health for ${mode} mode`);
  
  const supportedStrategies = getSupportedStrategies(mode);
  const defaultConfig = getDefaultRerankingConfig(mode);
  const strategyTests: Array<{
    strategy: RerankingStrategyType;
    success: boolean;
    duration: number;
    error?: string;
  }> = [];
  
  let defaultStrategyWorking = false;
  let anyStrategyWorking = false;
  
  // Test each supported strategy
  for (const strategy of supportedStrategies) {
    if (strategy === 'disabled') continue;
    
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    
    try {
      const reranker = createReranker(mode, strategy);
      success = reranker !== undefined;
      
      if (success && strategy === defaultConfig.strategy) {
        defaultStrategyWorking = true;
      }
      
      if (success) {
        anyStrategyWorking = true;
      }
      
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    const duration = Date.now() - startTime;
    strategyTests.push({ strategy, success, duration, error });
  }
  
  // Test fallback system
  let fallbackSystemWorking = false;
  try {
    const fallbackReranker = createFallbackReranker(mode);
    fallbackSystemWorking = fallbackReranker !== undefined;
  } catch (error) {
    console.warn(`Fallback system test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Determine overall health
  let overallHealth: 'healthy' | 'degraded' | 'failed';
  if (defaultStrategyWorking) {
    overallHealth = 'healthy';
  } else if (anyStrategyWorking || fallbackSystemWorking) {
    overallHealth = 'degraded';
  } else {
    overallHealth = 'failed';
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!defaultStrategyWorking) {
    recommendations.push(`Default strategy '${defaultConfig.strategy}' is not working. Check model availability.`);
  }
  
  if (!anyStrategyWorking) {
    recommendations.push('No reranking strategies are working. Check network connectivity and model availability.');
  } else if (!fallbackSystemWorking) {
    recommendations.push('Fallback system is not working properly. Manual intervention may be required.');
  }
  
  if (overallHealth === 'degraded') {
    recommendations.push('System is running in degraded mode. Some reranking strategies are unavailable.');
  }
  
  if (overallHealth === 'healthy') {
    recommendations.push('Reranking system is healthy and all strategies are working properly.');
  }
  
  console.log(`🏥 Health check completed: ${overallHealth} (${strategyTests.filter(t => t.success).length}/${strategyTests.length} strategies working)`);
  
  return {
    mode,
    overallHealth,
    defaultStrategyWorking,
    fallbackSystemWorking,
    strategyTests,
    recommendations
  };
}

/**
 * Get reranking system statistics and performance metrics
 */
export function getRerankingStats(): {
  totalCreationAttempts: number;
  successfulCreations: number;
  failedCreations: number;
  fallbacksTriggered: number;
  strategiesUsed: Record<RerankingStrategyType, number>;
} {
  // This would be implemented with actual metrics collection in a real system
  // For now, return placeholder data
  return {
    totalCreationAttempts: 0,
    successfulCreations: 0,
    failedCreations: 0,
    fallbacksTriggered: 0,
    strategiesUsed: {
      'cross-encoder': 0,
      'text-derived': 0,
      'metadata': 0,
      'hybrid': 0,
      'disabled': 0
    }
  };
}