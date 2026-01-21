/**
 * CORE MODULE — Validation Messages and Error Descriptions
 * Comprehensive error messages and user guidance for model validation
 * Provides helpful, actionable error messages with troubleshooting steps
 */
import { ModelRegistry } from './model-registry.js';
// =============================================================================
// ERROR MESSAGE TEMPLATES
// =============================================================================
/**
 * Error message templates for different validation scenarios
 */
export const ERROR_MESSAGES = {
    MODEL_NOT_FOUND: (modelName, suggestions) => ({
        title: `Model '${modelName}' not found`,
        description: `The specified model is not supported by the Chameleon architecture.`,
        details: [
            `Model '${modelName}' is not in the supported models registry.`,
            `This could be due to a typo in the model name or the model not being compatible with transformers.js.`
        ],
        suggestions: suggestions.length > 0 ? [
            `Did you mean one of these models?`,
            ...suggestions.map(s => `  • ${s}`)
        ] : [
            `Available models:`,
            ...ModelRegistry.getSupportedModels().map(s => `  • ${s}`)
        ],
        actions: [
            `Check the model name for typos`,
            `Use 'ModelRegistry.getSupportedModels()' to see all available models`,
            `Visit the documentation for the latest supported models list`
        ]
    }),
    TRANSFORMERS_VERSION_INCOMPATIBLE: (modelName, required, current) => ({
        title: `Transformers.js version incompatible`,
        description: `Model '${modelName}' requires a newer version of transformers.js.`,
        details: [
            `Required version: ${required}`,
            `Current version: ${current}`,
            `The model uses features not available in the current transformers.js version.`
        ],
        suggestions: [
            `Upgrade transformers.js to the latest version:`,
            `  npm install @huggingface/transformers@latest`,
            ``,
            `Or install a specific compatible version:`,
            `  npm install @huggingface/transformers@${required.replace(/[>=<~^]/g, '')}`
        ],
        actions: [
            `Update your package.json dependencies`,
            `Run npm install to update transformers.js`,
            `Restart your application after updating`
        ]
    }),
    INSUFFICIENT_MEMORY: (modelName, required, available) => ({
        title: `Insufficient memory for model`,
        description: `Model '${modelName}' requires more memory than available.`,
        details: [
            `Required memory: ${required}MB`,
            `Available memory: ${available}MB`,
            `Shortfall: ${required - available}MB`
        ],
        suggestions: [
            `Consider using a smaller model variant:`,
            ...ModelRegistry.getSupportedModels().filter(name => {
                const info = ModelRegistry.getModelInfo(name);
                return info &&
                    info.requirements.minimumMemory &&
                    info.requirements.minimumMemory <= available;
            }).map(name => `  • ${name}`),
            ``,
            `Or increase available memory by:`,
            `  • Closing other applications`,
            `  • Increasing Node.js memory limit: --max-old-space-size=${required + 512}`,
            `  • Using a machine with more RAM`
        ],
        actions: [
            `Free up system memory`,
            `Choose a more memory-efficient model`,
            `Consider using model quantization if available`
        ]
    }),
    PLATFORM_UNSUPPORTED: (modelName, currentPlatform, supportedPlatforms) => ({
        title: `Platform not supported`,
        description: `Model '${modelName}' is not supported on ${currentPlatform}.`,
        details: [
            `Current platform: ${currentPlatform}`,
            `Supported platforms: ${supportedPlatforms.join(', ')}`,
            `The model may use platform-specific features or optimizations.`
        ],
        suggestions: [
            `Try running on a supported platform:`,
            ...supportedPlatforms.map(platform => `  • ${platform}`),
            ``,
            `Or use a platform-agnostic model:`,
            ...ModelRegistry.getSupportedModels().filter(name => {
                const info = ModelRegistry.getModelInfo(name);
                return info &&
                    info.requirements.platformSupport &&
                    info.requirements.platformSupport.includes(currentPlatform);
            }).slice(0, 3).map(name => `  • ${name}`)
        ],
        actions: [
            `Switch to a supported platform`,
            `Use a different model that supports your platform`,
            `Check if there are platform-specific installation instructions`
        ]
    }),
    FEATURES_MISSING: (modelName, missingFeatures) => ({
        title: `Required features not available`,
        description: `Model '${modelName}' requires features not available in current transformers.js version.`,
        details: [
            `Missing features: ${missingFeatures.join(', ')}`,
            `These features are required for the model to function properly.`
        ],
        suggestions: [
            `Upgrade transformers.js to get missing features:`,
            `  npm install @huggingface/transformers@latest`,
            ``,
            `Or use a model that doesn't require these features:`,
            ...ModelRegistry.getSupportedModels().filter(name => {
                const info = ModelRegistry.getModelInfo(name);
                return info &&
                    (!info.requirements.requiredFeatures ||
                        info.requirements.requiredFeatures.every(f => !missingFeatures.includes(f)));
            }).slice(0, 3).map(name => `  • ${name}`)
        ],
        actions: [
            `Update transformers.js to the latest version`,
            `Check the transformers.js changelog for feature availability`,
            `Use an alternative model with fewer feature requirements`
        ]
    }),
    CONTENT_TYPE_UNSUPPORTED: (contentType, modelName, supportedTypes) => ({
        title: `Content type not supported`,
        description: `Model '${modelName}' does not support '${contentType}' content.`,
        details: [
            `Requested content type: ${contentType}`,
            `Supported content types: ${supportedTypes.join(', ')}`,
            `The model was not trained to handle this type of content.`
        ],
        suggestions: [
            `Use a model that supports '${contentType}' content:`,
            ...ModelRegistry.getModelsByContentType(contentType).slice(0, 3).map(name => `  • ${name}`),
            ``,
            `Or convert your content to a supported type:`,
            ...supportedTypes.map(type => `  • Convert to ${type}`)
        ],
        actions: [
            `Choose a multimodal model for mixed content types`,
            `Preprocess your content to match supported types`,
            `Use separate models for different content types`
        ]
    })
};
// =============================================================================
// WARNING MESSAGE TEMPLATES
// =============================================================================
/**
 * Warning message templates for non-critical issues
 */
export const WARNING_MESSAGES = {
    HIGH_MEMORY_USAGE: (modelName, memoryMB) => ({
        title: `High memory usage`,
        message: `Model '${modelName}' requires ${memoryMB}MB of memory, which may impact performance.`,
        suggestions: [
            `Monitor system memory usage during operation`,
            `Consider using a smaller model variant if performance is affected`,
            `Ensure sufficient swap space is available`
        ]
    }),
    LIMITED_BATCH_SIZE: (modelName, maxBatchSize) => ({
        title: `Limited batch processing`,
        message: `Model '${modelName}' supports maximum batch size of ${maxBatchSize}.`,
        suggestions: [
            `Use smaller batch sizes for optimal performance`,
            `Process large datasets in smaller chunks`,
            `Consider parallel processing with multiple model instances`
        ]
    }),
    EXPERIMENTAL_FEATURES: (modelName, features) => ({
        title: `Experimental features in use`,
        message: `Model '${modelName}' uses experimental features: ${features.join(', ')}.`,
        suggestions: [
            `Test thoroughly before using in production`,
            `Monitor for unexpected behavior or errors`,
            `Have fallback options ready`,
            `Check for updates that may stabilize these features`
        ]
    }),
    PERFORMANCE_IMPACT: (modelName, reason) => ({
        title: `Potential performance impact`,
        message: `Model '${modelName}' may have reduced performance: ${reason}.`,
        suggestions: [
            `Monitor processing times and resource usage`,
            `Consider using GPU acceleration if available`,
            `Optimize batch sizes for your use case`,
            `Profile your application to identify bottlenecks`
        ]
    })
};
// =============================================================================
// MESSAGE FORMATTING UTILITIES
// =============================================================================
/**
 * Format an error message for console output
 */
export function formatErrorMessage(error) {
    const lines = [];
    lines.push(`❌ ${error.title}`);
    lines.push('');
    lines.push(error.description);
    if (error.details.length > 0) {
        lines.push('');
        lines.push('Details:');
        error.details.forEach(detail => lines.push(`  ${detail}`));
    }
    if (error.suggestions.length > 0) {
        lines.push('');
        lines.push('Suggestions:');
        error.suggestions.forEach(suggestion => lines.push(`  ${suggestion}`));
    }
    if (error.actions.length > 0) {
        lines.push('');
        lines.push('Actions:');
        error.actions.forEach((action, index) => lines.push(`  ${index + 1}. ${action}`));
    }
    return lines.join('\n');
}
/**
 * Format a warning message for console output
 */
export function formatWarningMessage(warning) {
    const lines = [];
    lines.push(`⚠️  ${warning.title}`);
    lines.push('');
    lines.push(warning.message);
    if (warning.suggestions.length > 0) {
        lines.push('');
        lines.push('Suggestions:');
        warning.suggestions.forEach(suggestion => lines.push(`  • ${suggestion}`));
    }
    return lines.join('\n');
}
/**
 * Create a comprehensive error message for model validation failure
 */
export function createValidationErrorMessage(modelName, errorType, context = {}) {
    switch (errorType) {
        case 'not_found':
            return formatErrorMessage(ERROR_MESSAGES.MODEL_NOT_FOUND(modelName, context.suggestions || []));
        case 'version_incompatible':
            return formatErrorMessage(ERROR_MESSAGES.TRANSFORMERS_VERSION_INCOMPATIBLE(modelName, context.required || 'unknown', context.current || 'unknown'));
        case 'insufficient_memory':
            return formatErrorMessage(ERROR_MESSAGES.INSUFFICIENT_MEMORY(modelName, context.required || 0, context.available || 0));
        case 'platform_unsupported':
            return formatErrorMessage(ERROR_MESSAGES.PLATFORM_UNSUPPORTED(modelName, context.currentPlatform || 'unknown', context.supportedPlatforms || []));
        case 'features_missing':
            return formatErrorMessage(ERROR_MESSAGES.FEATURES_MISSING(modelName, context.missingFeatures || []));
        case 'content_type_unsupported':
            return formatErrorMessage(ERROR_MESSAGES.CONTENT_TYPE_UNSUPPORTED(context.contentType || 'unknown', modelName, context.supportedTypes || []));
        default:
            return `❌ Validation failed for model '${modelName}': ${errorType}`;
    }
}
/**
 * Create helpful suggestions based on model type and use case
 */
export function createModelSuggestions(modelType, contentTypes, memoryLimit) {
    const suggestions = [];
    if (modelType === 'sentence-transformer') {
        suggestions.push('For text-only tasks, sentence-transformers are most efficient');
        suggestions.push('all-MiniLM-L6-v2 offers the best balance of speed and accuracy');
        suggestions.push('all-mpnet-base-v2 provides higher accuracy but uses more memory');
    }
    if (modelType === 'clip') {
        suggestions.push('CLIP models support both text and image content');
        suggestions.push('clip-vit-base-patch32 is recommended for most use cases');
        suggestions.push('patch16 variants are more accurate but slower');
    }
    if (contentTypes?.includes('image')) {
        suggestions.push('Multimodal content requires CLIP models');
        suggestions.push('Ensure images are in supported formats (jpg, png, webp)');
        suggestions.push('Consider image preprocessing for better results');
    }
    if (memoryLimit && memoryLimit < 1024) {
        suggestions.push('Low memory environments should use smaller models');
        suggestions.push('Consider model quantization to reduce memory usage');
        suggestions.push('Process content in smaller batches');
    }
    return suggestions;
}
/**
 * Get troubleshooting steps for common issues
 */
export function getTroubleshootingSteps(issue) {
    const steps = {
        'model_loading_failed': [
            'Check internet connection for model download',
            'Verify model name spelling and availability',
            'Ensure sufficient disk space for model cache',
            'Try clearing the model cache and re-downloading',
            'Check transformers.js version compatibility'
        ],
        'out_of_memory': [
            'Reduce batch size for processing',
            'Use a smaller model variant',
            'Increase Node.js memory limit with --max-old-space-size',
            'Close other memory-intensive applications',
            'Consider using model quantization'
        ],
        'slow_performance': [
            'Use GPU acceleration if available',
            'Optimize batch sizes for your hardware',
            'Consider using a smaller, faster model',
            'Profile your code to identify bottlenecks',
            'Use appropriate hardware for your model size'
        ],
        'compatibility_issues': [
            'Update transformers.js to the latest version',
            'Check model requirements against your environment',
            'Verify platform compatibility (Node.js vs browser)',
            'Test with a known working model first',
            'Check for conflicting dependencies'
        ]
    };
    return steps[issue] || [
        'Check the documentation for your specific issue',
        'Search for similar issues in the project repository',
        'Ensure all dependencies are up to date',
        'Try with a minimal test case to isolate the problem'
    ];
}
