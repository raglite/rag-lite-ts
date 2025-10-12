/**
 * Simple validation script for the new clean public API exports
 * Validates that all expected exports are available
 */

async function validateAPIExports() {
  console.log('🔍 Validating new clean public API exports...\n');

  try {
    // Import the main API
    const api = await import('./index.js');
    
    // Track validation results
    const results = {
      passed: 0,
      failed: 0,
      errors: []
    };

    function validate(name, condition, description) {
      if (condition) {
        console.log(`✅ ${name}: ${description}`);
        results.passed++;
      } else {
        console.log(`❌ ${name}: ${description}`);
        results.failed++;
        results.errors.push(`${name}: ${description}`);
      }
    }

    // Validate factory functions
    console.log('📦 Factory Functions:');
    validate('TextSearchFactory', api.TextSearchFactory && typeof api.TextSearchFactory.create === 'function', 'Factory class with create method');
    validate('TextIngestionFactory', api.TextIngestionFactory && typeof api.TextIngestionFactory.create === 'function', 'Factory class with create method');
    validate('TextRAGFactory', api.TextRAGFactory && typeof api.TextRAGFactory.createBoth === 'function', 'Factory class with createBoth method');
    validate('TextFactoryHelpers', api.TextFactoryHelpers && typeof api.TextFactoryHelpers.validateSearchFiles === 'function', 'Helper class with utility methods');

    // Validate core classes
    console.log('\n🏗️ Core Classes:');
    validate('SearchEngine', api.SearchEngine && typeof api.SearchEngine === 'function', 'Core SearchEngine class');
    validate('IngestionPipeline', api.IngestionPipeline && typeof api.IngestionPipeline === 'function', 'Core IngestionPipeline class');

    // Validate text implementations
    console.log('\n📝 Text Implementations:');
    validate('EmbeddingEngine', api.EmbeddingEngine && typeof api.EmbeddingEngine === 'function', 'Text embedding engine class');
    validate('createTextEmbedFunction', api.createTextEmbedFunction && typeof api.createTextEmbedFunction === 'function', 'Text embed function factory');
    validate('CrossEncoderReranker', api.CrossEncoderReranker && typeof api.CrossEncoderReranker === 'function', 'Text reranker class');
    validate('createTextRerankFunction', api.createTextRerankFunction && typeof api.createTextRerankFunction === 'function', 'Text rerank function factory');
    validate('countTokens', api.countTokens && typeof api.countTokens === 'function', 'Text tokenization utility');

    // Validate core infrastructure
    console.log('\n🔧 Core Infrastructure:');
    validate('openDatabase', api.openDatabase && typeof api.openDatabase === 'function', 'Database connection function');
    validate('IndexManager', api.IndexManager && typeof api.IndexManager === 'function', 'Vector index manager class');
    validate('VectorIndex', api.VectorIndex && typeof api.VectorIndex === 'function', 'Vector index class');
    validate('config', api.config && typeof api.config === 'object', 'Configuration object');
    validate('getModelDefaults', api.getModelDefaults && typeof api.getModelDefaults === 'function', 'Model defaults function');

    // Validate file processing
    console.log('\n📁 File Processing:');
    validate('discoverAndProcessFiles', api.discoverAndProcessFiles && typeof api.discoverAndProcessFiles === 'function', 'File discovery and processing');
    validate('chunkDocument', api.chunkDocument && typeof api.chunkDocument === 'function', 'Document chunking function');
    validate('DocumentPathManager', api.DocumentPathManager && typeof api.DocumentPathManager === 'function', 'Path management class');

    // Validate error handling
    console.log('\n⚠️ Error Handling:');
    validate('handleError', api.handleError && typeof api.handleError === 'function', 'Core error handler');
    validate('ErrorCategory', api.ErrorCategory && typeof api.ErrorCategory === 'object', 'Error category enum');
    validate('ErrorSeverity', api.ErrorSeverity && typeof api.ErrorSeverity === 'object', 'Error severity enum');
    validate('APIError', api.APIError && typeof api.APIError === 'function', 'API error class');

    // Validate interface utilities
    console.log('\n🔌 Interface Utilities:');
    validate('InterfaceValidator', api.InterfaceValidator && typeof api.InterfaceValidator.validateEmbedFunction === 'function', 'Interface validation utilities');

    // Validate that legacy items are NOT exported
    console.log('\n🚫 Legacy Items (should NOT be exported):');
    validate('ResourceManager removed', !api.ResourceManager, 'ResourceManager should not be exported');
    validate('validateConfig removed', !api.validateConfig, 'validateConfig should not be exported');

    // Summary
    console.log('\n📊 Validation Summary:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.failed > 0) {
      console.log('\n❌ Failed validations:');
      results.errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    } else {
      console.log('\n🎉 All API exports validated successfully!');
      console.log('The new clean public API is ready for use.');
    }

  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  }
}

// Run validation
validateAPIExports();