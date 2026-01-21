/**
 * CORE MODULE — Actionable Error Messages
 * Provides user-friendly, actionable error messages with specific guidance
 * Replaces technical error messages with helpful troubleshooting steps
 */
import { dirname, basename } from 'path';
/**
 * Default configuration for error messages
 */
const DEFAULT_CONFIG = {
    includeExamples: true,
    includeTroubleshooting: true,
    operationContext: 'operation'
};
// =============================================================================
// FILE AND PATH ERROR MESSAGES
// =============================================================================
/**
 * Create actionable error message for missing files
 */
export function createMissingFileError(filePath, fileType, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const fileName = basename(filePath);
    const dirName = dirname(filePath);
    const messages = [];
    // Main error message
    switch (fileType) {
        case 'index':
            messages.push(`❌ Vector index file not found: ${filePath}`);
            messages.push('');
            messages.push('🔍 This usually means you need to run ingestion first to create the search index.');
            break;
        case 'database':
            messages.push(`❌ Database file not found: ${filePath}`);
            messages.push('');
            messages.push('🔍 This usually means you need to run ingestion first to create the database.');
            break;
        case 'config':
            messages.push(`❌ Configuration file not found: ${filePath}`);
            messages.push('');
            messages.push('🔍 The configuration file is missing or in the wrong location.');
            break;
        case 'content':
            messages.push(`❌ Content file not found: ${filePath}`);
            messages.push('');
            messages.push('🔍 The content file may have been moved, deleted, or the path is incorrect.');
            break;
    }
    if (cfg.includeTroubleshooting) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        if (fileType === 'index' || fileType === 'database') {
            messages.push('   1. Run ingestion to create the required files:');
            messages.push('      raglite ingest <your-documents-directory>');
            messages.push('');
            messages.push('   2. Or create an ingestion pipeline programmatically:');
            if (cfg.includeExamples) {
                messages.push('      ```typescript');
                messages.push('      import { IngestionFactory } from "rag-lite-ts";');
                messages.push('      const pipeline = await IngestionFactory.create(');
                messages.push(`        "${filePath.endsWith('.bin') ? filePath.replace('.bin', '.sqlite') : filePath}",`);
                messages.push(`        "${filePath.endsWith('.sqlite') ? filePath.replace('.sqlite', '.bin') : filePath}"`);
                messages.push('      );');
                messages.push('      await pipeline.ingestDirectory("./your-documents");');
                messages.push('      ```');
            }
            messages.push('');
            messages.push('   3. Verify the file paths are correct');
            messages.push(`      Expected directory: ${dirName}`);
            messages.push(`      Expected filename: ${fileName}`);
        }
        else {
            messages.push(`   1. Check if the file exists at: ${filePath}`);
            messages.push('   2. Verify the file path is correct');
            messages.push('   3. Check file permissions');
        }
    }
    return new Error(messages.join('\n'));
}
/**
 * Create actionable error message for invalid paths
 */
export function createInvalidPathError(paths, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push('❌ Invalid file paths provided');
    messages.push('');
    const missingPaths = paths.filter(p => !p.value || p.value.trim() === '');
    if (missingPaths.length > 0) {
        messages.push('🔍 Missing required paths:');
        missingPaths.forEach(p => messages.push(`   • ${p.name}: not provided`));
        messages.push('');
    }
    if (cfg.includeTroubleshooting) {
        messages.push('🛠️  How to fix this:');
        messages.push('   1. Provide all required file paths:');
        if (cfg.includeExamples) {
            messages.push('      ```typescript');
            messages.push('      // ✅ Correct usage');
            messages.push('      const search = await TextSearchFactory.create(');
            messages.push('        "./my-index.bin",    // Vector index path');
            messages.push('        "./my-database.sqlite" // Database path');
            messages.push('      );');
            messages.push('      ```');
            messages.push('');
            messages.push('      ```typescript');
            messages.push('      // ❌ Incorrect - missing paths');
            messages.push('      const search = await TextSearchFactory.create("", "");');
            messages.push('      ```');
        }
    }
    return new Error(messages.join('\n'));
}
// =============================================================================
// MODEL AND CONFIGURATION ERROR MESSAGES
// =============================================================================
/**
 * Create actionable error message for model loading failures
 */
export function createModelLoadingError(modelName, originalError, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ Failed to load embedding model: ${modelName}`);
    messages.push('');
    messages.push(`🔍 Original error: ${originalError}`);
    messages.push('');
    if (cfg.includeTroubleshooting) {
        messages.push('🛠️  How to fix this:');
        if (originalError.includes('network') || originalError.includes('download') || originalError.includes('fetch')) {
            messages.push('   📡 Network/Download Issues:');
            messages.push('   1. Check your internet connection');
            messages.push('   2. Try again in a few minutes (temporary server issues)');
            messages.push('   3. Check if you\'re behind a firewall or proxy');
            messages.push('');
        }
        if (originalError.includes('memory') || originalError.includes('OOM')) {
            messages.push('   💾 Memory Issues:');
            messages.push('   1. Close other applications to free up memory');
            messages.push('   2. Try a smaller model:');
            messages.push('      • sentence-transformers/all-MiniLM-L6-v2 (lightweight)');
            messages.push('      • Xenova/clip-vit-base-patch32 (for multimodal)');
            messages.push('');
        }
        messages.push('   🔧 General Solutions:');
        messages.push('   1. Verify the model name is correct');
        messages.push('   2. Check available models:');
        if (cfg.includeExamples) {
            messages.push('      ```typescript');
            messages.push('      import { listAvailableModels } from "rag-lite-ts";');
            messages.push('      const models = listAvailableModels();');
            messages.push('      console.log("Available models:", models);');
            messages.push('      ```');
        }
        messages.push('   3. Try a different model if the current one is problematic');
    }
    return new Error(messages.join('\n'));
}
/**
 * Create actionable error message for dimension mismatches
 */
export function createDimensionMismatchError(expected, actual, context, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ Vector dimension mismatch in ${context}`);
    messages.push('');
    messages.push(`🔍 Expected: ${expected} dimensions`);
    messages.push(`🔍 Actual: ${actual} dimensions`);
    messages.push('');
    messages.push('This usually means the model used to create the index is different from the current model.');
    if (cfg.includeTroubleshooting) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        messages.push('   1. Rebuild the index with the current model:');
        messages.push('      raglite ingest <directory> --force-rebuild');
        messages.push('');
        messages.push('   2. Or use the same model that was used to create the index');
        messages.push('');
        messages.push('   3. Check which model was used originally:');
        if (cfg.includeExamples) {
            messages.push('      ```typescript');
            messages.push('      import { getSearchEngineInfo } from "rag-lite-ts";');
            messages.push('      const info = await getSearchEngineInfo("./database.sqlite");');
            messages.push('      console.log("Original model:", info.modelName);');
            messages.push('      console.log("Original dimensions:", info.modelDimensions);');
            messages.push('      ```');
        }
    }
    return new Error(messages.join('\n'));
}
/**
 * Create actionable error message for mode mismatches
 */
export function createModeMismatchError(expectedMode, actualMode, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ Mode mismatch detected`);
    messages.push('');
    messages.push(`🔍 Database is configured for: ${expectedMode} mode`);
    messages.push(`🔍 You requested: ${actualMode} mode`);
    messages.push('');
    messages.push('Each database can only be used with one mode consistently.');
    if (cfg.includeTroubleshooting) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        messages.push('   1. Use the existing mode (recommended):');
        if (cfg.includeExamples) {
            messages.push('      ```typescript');
            messages.push('      // Let the system auto-detect the mode');
            messages.push('      const search = await TextSearchFactory.create("./index.bin", "./db.sqlite");');
            messages.push('      ```');
        }
        messages.push('');
        messages.push('   2. Or rebuild with the new mode:');
        messages.push(`      raglite ingest <directory> --mode ${actualMode} --force-rebuild`);
        messages.push('');
        messages.push('   3. Or create a new database for the different mode:');
        if (cfg.includeExamples) {
            messages.push('      ```typescript');
            messages.push('      const pipeline = await IngestionFactory.create(');
            messages.push('        "./new-database.sqlite",');
            messages.push('        "./new-index.bin",');
            messages.push(`        { mode: "${actualMode}" }`);
            messages.push('      );');
            messages.push('      ```');
        }
    }
    return new Error(messages.join('\n'));
}
// =============================================================================
// CONTENT AND PROCESSING ERROR MESSAGES
// =============================================================================
/**
 * Create actionable error message for empty or invalid content
 */
export function createInvalidContentError(contentType, issue, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    switch (issue) {
        case 'empty':
            messages.push(`❌ Empty ${contentType} content provided`);
            messages.push('');
            messages.push('🔍 Content cannot be empty or contain only whitespace.');
            break;
        case 'invalid_format':
            messages.push(`❌ Invalid ${contentType} format`);
            messages.push('');
            messages.push('🔍 The content format is not supported or is corrupted.');
            break;
        case 'too_large':
            messages.push(`❌ ${contentType} content is too large`);
            messages.push('');
            messages.push('🔍 Content exceeds the maximum allowed size.');
            break;
        case 'unsupported':
            messages.push(`❌ Unsupported ${contentType} content type`);
            messages.push('');
            messages.push('🔍 This content type is not supported in the current mode.');
            break;
    }
    if (cfg.includeTroubleshooting) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        switch (issue) {
            case 'empty':
                messages.push('   1. Provide non-empty content');
                messages.push('   2. Check that your content source is working correctly');
                messages.push('   3. Verify file reading/processing is working');
                break;
            case 'invalid_format':
                messages.push('   1. Check the file format is supported');
                messages.push('   2. Verify the file is not corrupted');
                messages.push('   3. Try with a different file');
                break;
            case 'too_large':
                messages.push('   1. Split large content into smaller chunks');
                messages.push('   2. Increase the maximum content size limit');
                messages.push('   3. Process content in batches');
                break;
            case 'unsupported':
                messages.push('   1. Check if you\'re using the right mode:');
                messages.push('      • Text mode: supports text content');
                messages.push('      • Multimodal mode: supports text and images');
                messages.push('   2. Convert content to a supported format');
                break;
        }
    }
    return new Error(messages.join('\n'));
}
// =============================================================================
// INITIALIZATION AND DEPENDENCY ERROR MESSAGES
// =============================================================================
/**
 * Create actionable error message for missing dependencies
 */
export function createMissingDependencyError(dependencyName, dependencyType, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ Missing required ${dependencyType}: ${dependencyName}`);
    messages.push('');
    messages.push(`🔍 The ${dependencyName} ${dependencyType} is required but was not provided or is invalid.`);
    if (cfg.includeTroubleshooting) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        messages.push(`   1. Ensure ${dependencyName} is properly initialized`);
        messages.push('   2. Check the initialization order of your components');
        messages.push('   3. Verify all required parameters are provided');
        if (cfg.includeExamples) {
            messages.push('');
            messages.push('   Example of correct initialization:');
            messages.push('   ```typescript');
            messages.push('   // Make sure all dependencies are created first');
            messages.push('   const embedder = await createEmbedder("model-name");');
            messages.push('   const indexManager = new IndexManager(...);');
            messages.push('   const db = await openDatabase(...);');
            messages.push('   ');
            messages.push('   // Then create the main component');
            messages.push('   const searchEngine = new SearchEngine(embedder, indexManager, db);');
            messages.push('   ```');
        }
    }
    return new Error(messages.join('\n'));
}
/**
 * Create actionable error message for factory creation failures
 */
export function createFactoryCreationError(factoryName, originalError, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ ${factoryName} creation failed`);
    messages.push('');
    messages.push(`🔍 Original error: ${originalError}`);
    messages.push('');
    if (cfg.includeTroubleshooting) {
        messages.push('🛠️  Common solutions:');
        messages.push('   1. Check that all required files exist');
        messages.push('   2. Verify file paths are correct');
        messages.push('   3. Ensure you have proper file permissions');
        messages.push('   4. Check that the model name is valid');
        messages.push('   5. Verify network connectivity (for model downloads)');
        messages.push('');
        messages.push('🔍 For detailed troubleshooting:');
        messages.push('   1. Check the original error message above');
        messages.push('   2. Look for specific error patterns (file not found, network issues, etc.)');
        messages.push('   3. Try the operation with simpler parameters first');
    }
    return new Error(messages.join('\n'));
}
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
/**
 * Enhance an existing error with actionable information
 */
export function enhanceError(originalError, context, suggestions = [], config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ Error in ${context}`);
    messages.push('');
    messages.push(`🔍 ${originalError.message}`);
    if (suggestions.length > 0) {
        messages.push('');
        messages.push('🛠️  Suggestions:');
        suggestions.forEach((suggestion, index) => {
            messages.push(`   ${index + 1}. ${suggestion}`);
        });
    }
    const enhancedError = new Error(messages.join('\n'));
    enhancedError.name = originalError.name;
    enhancedError.stack = originalError.stack;
    return enhancedError;
}
/**
 * Create a user-friendly error message with context
 */
export function createContextualError(message, context, suggestions = [], examples = [], config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const messages = [];
    messages.push(`❌ ${message}`);
    messages.push('');
    messages.push(`🔍 Context: ${context}`);
    if (suggestions.length > 0) {
        messages.push('');
        messages.push('🛠️  How to fix this:');
        suggestions.forEach((suggestion, index) => {
            messages.push(`   ${index + 1}. ${suggestion}`);
        });
    }
    if (cfg.includeExamples && examples.length > 0) {
        messages.push('');
        messages.push('💡 Examples:');
        examples.forEach(example => {
            messages.push(`   ${example}`);
        });
    }
    return new Error(messages.join('\n'));
}
