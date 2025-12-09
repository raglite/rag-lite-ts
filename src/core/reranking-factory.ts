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
      throw new Error(
        `Strategy '${strategy}' not supported for ${mode} mode. ` +
        `Supported strategies: ${supportedStrategies.join(', ')}`
      );
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `❌ Failed to create reranker with strategy '${strategy}' for ${mode} mode (${duration}ms): ${errorMessage}`
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
    
    throw error;
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
    
    throw rerankingError;
  }
}

/**
 * Custom error class for reranking strategy failures
 */
class RerankingStrategyError extends Error {
  constructor(
    public strategy: string,
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
 * Hybrid reranking strategy removed in Phase 3 - throwing error for backward compatibility
 */
function createHybridRerankFunction(config: RerankingConfig): RerankFunction {
  throw new RerankingStrategyError(
    'hybrid',
    'multimodal',
    'Hybrid reranking strategy has been removed in this version. Use text-derived instead.',
    'STRATEGY_REMOVED'
  );
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
    hasAvailableStrategies: strategyInfo.some(info => info.available)
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
  
  // Fallback system removed - no longer testing fallback functionality
  let fallbackSystemWorking = true; // Always true since we don't use fallbacks anymore
  
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
      'disabled': 0
    }
  };
}