/**
 * Simple Reranking Configuration System
 *
 * Provides straightforward configuration types and validation for different
 * reranking strategies without complex interface patterns.
 */
// Default configurations for different modes
export const DEFAULT_TEXT_RERANKING_CONFIG = {
    strategy: 'cross-encoder',
    enabled: true,
    fallback: 'disabled'
};
export const DEFAULT_MULTIMODAL_RERANKING_CONFIG = {
    strategy: 'text-derived',
    enabled: true,
    weights: {
        semantic: 0.7,
        metadata: 0.3
    },
    fallback: 'disabled'
};
// Strategy validation without complex interface patterns
export function validateRerankingStrategy(strategy) {
    const validStrategies = [
        'cross-encoder',
        'text-derived',
        'disabled'
    ];
    return validStrategies.includes(strategy);
}
// Simple strategy validation with clear error messages
export function validateRerankingConfig(config) {
    if (!config.strategy) {
        throw new Error('Reranking strategy is required');
    }
    if (!validateRerankingStrategy(config.strategy)) {
        const validStrategies = ['cross-encoder', 'text-derived', 'disabled'];
        throw new Error(`Invalid reranking strategy '${config.strategy}'. ` +
            `Valid strategies: ${validStrategies.join(', ')}`);
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
    }
    // Validate fallback strategy if provided
    if (config.fallback && !validateRerankingStrategy(config.fallback)) {
        const validStrategies = ['cross-encoder', 'text-derived', 'disabled'];
        throw new Error(`Invalid fallback strategy '${config.fallback}'. ` +
            `Valid strategies: ${validStrategies.join(', ')}`);
    }
    return {
        strategy: config.strategy,
        enabled: config.strategy === 'disabled' ? false : (config.enabled ?? true),
        model: config.model,
        weights: config.weights,
        fallback: config.fallback || 'disabled'
    };
}
// Get appropriate default configuration based on mode
export function getDefaultRerankingConfig(mode) {
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
export function isStrategySupported(strategy, mode) {
    switch (mode) {
        case 'text':
            return strategy === 'cross-encoder' || strategy === 'disabled';
        case 'multimodal':
            return ['text-derived', 'disabled'].includes(strategy);
        default:
            return false;
    }
}
// Get supported strategies for a mode
export function getSupportedStrategies(mode) {
    switch (mode) {
        case 'text':
            return ['cross-encoder', 'disabled'];
        case 'multimodal':
            return ['text-derived', 'disabled'];
        default:
            return ['disabled'];
    }
}
// Simple configuration builder for common scenarios
export class RerankingConfigBuilder {
    config = {};
    strategy(strategy) {
        this.config.strategy = strategy;
        return this;
    }
    model(model) {
        this.config.model = model;
        return this;
    }
    enabled(enabled) {
        this.config.enabled = enabled;
        return this;
    }
    weights(weights) {
        this.config.weights = weights;
        return this;
    }
    fallback(fallback) {
        this.config.fallback = fallback;
        return this;
    }
    build() {
        return validateRerankingConfig(this.config);
    }
    // Convenience methods for common configurations
    static textMode() {
        return new RerankingConfigBuilder()
            .strategy('cross-encoder')
            .enabled(true)
            .fallback('disabled');
    }
    static multimodalMode() {
        return new RerankingConfigBuilder()
            .strategy('text-derived')
            .enabled(true)
            .weights({ semantic: 0.7, metadata: 0.3 })
            .fallback('disabled');
    }
    static disabled() {
        return new RerankingConfigBuilder()
            .strategy('disabled')
            .enabled(false);
    }
}
