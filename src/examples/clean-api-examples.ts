/**
 * Examples demonstrating the simple API in rag-lite-ts
 * 
 * This file shows the recommended usage patterns with simple constructors and smart initialization.
 */

import {
  // Factory functions (recommended for most users)
  TextSearchFactory,
  TextIngestionFactory,
  TextRAGFactory,
  TextFactoryHelpers,
  
  // Core classes for direct dependency injection
  CoreSearchEngine,
  CoreIngestionPipeline,
  
  // Text implementations for custom dependency injection
  createTextEmbedFunction,
  createTextRerankFunction,
  
  // Core infrastructure
  IndexManager,
  openDatabase,
  
  // Configuration
  getModelDefaults,
  
  // Types
  type SearchEngineOptions,
  type IngestionPipelineOptions,
  type TextSearchOptions,
  type TextIngestionOptions,
  type EmbedFunction,
  type RerankFunction
} from '../index.js';

/**
 * Example 1: Simple Constructor Usage (Recommended)
 * 
 * This is the easiest way to get started with rag-lite-ts.
 * Clean, simple API with powerful architecture underneath.
 */
async function simpleConstructorExample() {
  console.log('=== Simple Constructor Example ===');
  
  try {
    // Simple ingestion using factory - just works!
    const ingestion = await TextIngestionFactory.create('./example-db.sqlite', './example-index.bin');
    await ingestion.ingestDirectory('./documents');
    await ingestion.cleanup();
    
    // Simple search using factory - just works!
    const search = await TextSearchFactory.create('./example-index.bin', './example-db.sqlite');
    const results = await search.search('What is machine learning?');
    console.log(`Found ${results.length} results`);
    await search.cleanup();
    
  } catch (error) {
    console.error('Simple constructor example failed:', error);
  }
}

/**
 * Example 2: Configuration Options
 * 
 * Shows how to customize behavior using configuration options.
 */
async function configurationExample() {
  console.log('=== Configuration Example ===');
  
  try {
    // Custom ingestion options
    const ingestionOptions: IngestionPipelineOptions = {
      embeddingModel: 'Xenova/all-mpnet-base-v2',  // Use different model
      chunkSize: 2048,                              // Larger chunks
      chunkOverlap: 200,                            // More overlap
      batchSize: 8                                  // Smaller batches for quality
    };
    
    // Custom search options
    const searchOptions: SearchEngineOptions = {
      embeddingModel: 'Xenova/all-mpnet-base-v2',  // Match ingestion model
      enableReranking: true,                        // Enable reranking
      rerankingModel: 'Xenova/ms-marco-MiniLM-L-6-v2',
      topK: 20                                      // Return more results
    };
    
    // Use factories with configuration
    const ingestion = await TextIngestionFactory.create('./custom-db.sqlite', './custom-index.bin', ingestionOptions);
    await ingestion.ingestDirectory('./documents');
    await ingestion.cleanup();
    
    const search = await TextSearchFactory.create('./custom-index.bin', './custom-db.sqlite', searchOptions);
    const results = await search.search('advanced machine learning techniques');
    
    console.log(`Custom search found ${results.length} results with reranking`);
    await search.cleanup();
    
  } catch (error) {
    console.error('Configuration example failed:', error);
  }
}

/**
 * Example 3: Custom Functions (Advanced)
 * 
 * Shows how to provide custom embedding and reranking functions.
 */
async function customFunctionsExample() {
  console.log('=== Custom Functions Example ===');
  
  try {
    // Create custom embedding function
    const customEmbedFn: EmbedFunction = createTextEmbedFunction(
      'sentence-transformers/all-MiniLM-L6-v2',
      16  // batch size
    );
    
    // Create custom reranking function
    const customRerankFn: RerankFunction = createTextRerankFunction(
      'Xenova/ms-marco-MiniLM-L-6-v2'
    );
    
    // Use direct dependency injection with custom functions
    const indexManager = new IndexManager('./custom-fn-index.bin', './custom-fn-db.sqlite', 384);
    const db = await openDatabase('./custom-fn-db.sqlite');
    
    const ingestion = new CoreIngestionPipeline(customEmbedFn, indexManager, db);
    await ingestion.ingestDirectory('./documents');
    await ingestion.cleanup();
    
    const search = new CoreSearchEngine(customEmbedFn, indexManager, db, customRerankFn);
    
    const results = await search.search('custom function patterns');
    console.log(`Custom functions search found ${results.length} results`);
    await search.cleanup();
    
  } catch (error) {
    console.error('Custom functions example failed:', error);
  }
}

/**
 * Example 4: Factory Functions (Advanced/Batch Operations)
 * 
 * Shows when to use factory functions for complex scenarios.
 */
async function factoryFunctionsExample() {
  console.log('=== Factory Functions Example ===');
  
  try {
    // Factory functions are useful for:
    // 1. Batch operations
    // 2. Complex initialization scenarios
    // 3. When you need the removed automatic initialization logic
    
    const factorySearchOptions: TextSearchOptions = {
      embeddingModel: 'Xenova/all-mpnet-base-v2',
      enableReranking: true,
      topK: 20
    };
    
    const factoryIngestionOptions: TextIngestionOptions = {
      embeddingModel: 'Xenova/all-mpnet-base-v2',
      chunkSize: 2048,
      forceRebuild: true
    };
    
    // Create both instances with factory (handles complex initialization)
    const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
      './factory-index.bin',
      './factory-db.sqlite',
      factorySearchOptions,
      factoryIngestionOptions
    );
    
    await ingestionPipeline.ingestDirectory('./documents');
    const results = await searchEngine.search('factory pattern usage');
    
    console.log(`Factory functions search found ${results.length} results`);
    
    // Clean up
    await searchEngine.cleanup();
    await ingestionPipeline.cleanup();
    
  } catch (error) {
    console.error('Factory functions example failed:', error);
  }
}

/**
 * Example 5: Error Handling and Fallback Patterns
 * 
 * Shows how to handle errors gracefully with the new API.
 */
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');
  
  try {
    // Use the helper function that provides fallback behavior
    const searchEngine = await TextFactoryHelpers.createSearchWithFallback(
      './fallback-index.bin',
      './fallback-db.sqlite',
      {
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        enableReranking: true  // This might fail, but fallback will disable it
      }
    );
    
    const results = await searchEngine.search('error handling patterns');
    console.log(`Fallback search found ${results.length} results`);
    
    await searchEngine.cleanup();
    
  } catch (error) {
    console.error('Even fallback failed:', error);
  }
}

/**
 * Example 6: Configuration Recommendations
 * 
 * Shows how to use the helper functions to get recommended configurations.
 */
async function configurationRecommendationsExample() {
  console.log('=== Configuration Recommendations Example ===');
  
  try {
    // Get recommended configurations for different use cases
    const fastConfig = TextFactoryHelpers.getRecommendedConfig('fast');
    const balancedConfig = TextFactoryHelpers.getRecommendedConfig('balanced');
    const qualityConfig = TextFactoryHelpers.getRecommendedConfig('quality');
    
    console.log('Fast config:', fastConfig);
    console.log('Balanced config:', balancedConfig);
    console.log('Quality config:', qualityConfig);
    
    // Use the balanced configuration
    const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
      './recommended-index.bin',
      './recommended-db.sqlite',
      balancedConfig.searchOptions,
      balancedConfig.ingestionOptions
    );
    
    await ingestionPipeline.ingestDirectory('./documents');
    const results = await searchEngine.search('configuration recommendations');
    
    console.log(`Recommended config search found ${results.length} results`);
    
    // Clean up
    await searchEngine.cleanup();
    await ingestionPipeline.cleanup();
    
  } catch (error) {
    console.error('Configuration recommendations example failed:', error);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all simple API examples...\n');
  
  await simpleConstructorExample();
  console.log();
  
  await configurationExample();
  console.log();
  
  await customFunctionsExample();
  console.log();
  
  await factoryFunctionsExample();
  console.log();
  
  await errorHandlingExample();
  console.log();
  
  await configurationRecommendationsExample();
  console.log();
  
  console.log('✅ All examples completed!');
}

// Export individual examples for selective testing
export {
  simpleConstructorExample,
  configurationExample,
  customFunctionsExample,
  factoryFunctionsExample,
  errorHandlingExample,
  configurationRecommendationsExample
};