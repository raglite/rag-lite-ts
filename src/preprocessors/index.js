import { PreprocessorRegistry } from './registry.js';
import { MdxPreprocessor } from './mdx.js';
import { MermaidPreprocessor } from './mermaid.js';
// Export all preprocessor classes
export { PreprocessorRegistry, ContentTypeDetector } from './registry.js';
export { MdxPreprocessor } from './mdx.js';
export { MermaidPreprocessor } from './mermaid.js';
/**
 * Create and initialize the global preprocessor registry
 */
function createPreprocessorRegistry() {
    const registry = new PreprocessorRegistry();
    // Register built-in preprocessors
    registry.register('mdx', new MdxPreprocessor());
    registry.register('mermaid', new MermaidPreprocessor());
    return registry;
}
/**
 * Global preprocessor registry instance
 */
export const preprocessorRegistry = createPreprocessorRegistry();
/**
 * Validate that all required preprocessors are available in the registry
 */
export function validatePreprocessorConfiguration(requiredPreprocessors) {
    const validation = preprocessorRegistry.validatePreprocessors(requiredPreprocessors);
    if (!validation.valid) {
        const missingList = validation.missing.join(', ');
        throw new Error(`Missing required preprocessors: ${missingList}. Available: ${preprocessorRegistry.getRegisteredNames().join(', ')}`);
    }
}
/**
 * Get all available preprocessor names
 */
export function getAvailablePreprocessors() {
    return preprocessorRegistry.getRegisteredNames();
}
