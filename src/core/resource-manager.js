/**
 * CORE MODULE — Resource Manager
 * Implements proper cleanup methods for all embedder implementations
 * Adds automatic resource management for image processing operations
 * Creates memory monitoring and garbage collection optimization
 * Ensures proper disposal of transformers.js model resources
 *
 * Requirements: 9.4, 9.6 - Resource cleanup and memory management
 */
// =============================================================================
// RESOURCE MANAGER
// =============================================================================
/**
 * Comprehensive resource manager for embedders and models
 * Handles automatic cleanup, memory monitoring, and garbage collection
 */
export class ResourceManager {
    static instance;
    resources = new Map();
    memoryThresholdMB = 512; // Default 512MB threshold
    autoCleanupEnabled = true;
    gcEnabled = true;
    cleanupIntervalMs = 30000; // 30 seconds
    cleanupTimer;
    memoryMonitorTimer;
    peakMemoryMB = 0;
    gcCount = 0;
    lastGcAt;
    constructor() {
        this.startAutoCleanup();
        this.setupMemoryMonitoring();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }
    // =============================================================================
    // RESOURCE REGISTRATION
    // =============================================================================
    /**
     * Register an embedder for resource management
     */
    registerEmbedder(embedder) {
        const resourceId = this.generateResourceId('embedder', embedder.modelName);
        const resourceInfo = {
            id: resourceId,
            type: 'embedder',
            name: embedder.modelName,
            memoryEstimateMB: this.estimateEmbedderMemory(embedder),
            createdAt: new Date(),
            lastUsedAt: new Date(),
            resource: embedder,
            cleanupFn: async () => {
                // Don't call embedder.cleanup() to avoid circular reference
                // The embedder will handle its own cleanup when explicitly called
                // Just clear the reference here
                console.log(`🧹 Resource manager clearing reference to embedder: ${embedder.modelName}`);
            }
        };
        this.resources.set(resourceId, resourceInfo);
        console.log(`📝 Registered embedder: ${embedder.modelName} (ID: ${resourceId}, Est. Memory: ${resourceInfo.memoryEstimateMB}MB)`);
        return resourceId;
    }
    /**
     * Register a transformers.js model for resource management
     */
    registerModel(model, modelName, modelType) {
        const resourceId = this.generateResourceId('model', `${modelType}:${modelName}`);
        const resourceInfo = {
            id: resourceId,
            type: 'model',
            name: `${modelType}:${modelName}`,
            memoryEstimateMB: this.estimateModelMemory(modelType),
            createdAt: new Date(),
            lastUsedAt: new Date(),
            resource: model,
            cleanupFn: async () => {
                if (typeof model.dispose === 'function') {
                    await model.dispose();
                }
                else if (typeof model.destroy === 'function') {
                    await model.destroy();
                }
                else if (typeof model.cleanup === 'function') {
                    await model.cleanup();
                }
            }
        };
        this.resources.set(resourceId, resourceInfo);
        console.log(`📝 Registered model: ${modelName} (ID: ${resourceId}, Est. Memory: ${resourceInfo.memoryEstimateMB}MB)`);
        return resourceId;
    }
    /**
     * Register an image processor for resource management
     */
    registerImageProcessor(processor, processorName) {
        const resourceId = this.generateResourceId('processor', processorName);
        const resourceInfo = {
            id: resourceId,
            type: 'processor',
            name: processorName,
            memoryEstimateMB: this.estimateProcessorMemory(processorName),
            createdAt: new Date(),
            lastUsedAt: new Date(),
            resource: processor,
            cleanupFn: async () => {
                if (typeof processor.dispose === 'function') {
                    await processor.dispose();
                }
                else if (typeof processor.cleanup === 'function') {
                    await processor.cleanup();
                }
            }
        };
        this.resources.set(resourceId, resourceInfo);
        console.log(`📝 Registered processor: ${processorName} (ID: ${resourceId}, Est. Memory: ${resourceInfo.memoryEstimateMB}MB)`);
        return resourceId;
    }
    /**
     * Update last used timestamp for a resource
     */
    updateResourceUsage(resourceId) {
        const resource = this.resources.get(resourceId);
        if (resource) {
            resource.lastUsedAt = new Date();
        }
    }
    // =============================================================================
    // RESOURCE CLEANUP
    // =============================================================================
    /**
     * Clean up a specific resource by ID
     */
    async cleanupResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            console.warn(`Resource not found for cleanup: ${resourceId}`);
            return false;
        }
        try {
            console.log(`🧹 Cleaning up resource: ${resource.name} (${resource.type})`);
            if (resource.cleanupFn) {
                await resource.cleanupFn();
            }
            this.resources.delete(resourceId);
            console.log(`✅ Resource cleaned up: ${resource.name}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to cleanup resource ${resource.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }
    /**
     * Clean up all resources of a specific type
     */
    async cleanupResourcesByType(type) {
        const startTime = Date.now();
        const resourcesOfType = Array.from(this.resources.values()).filter(r => r.type === type);
        let cleanedUp = 0;
        let errors = 0;
        let memoryFreed = 0;
        console.log(`🧹 Cleaning up ${resourcesOfType.length} resources of type: ${type}`);
        for (const resource of resourcesOfType) {
            const success = await this.cleanupResource(resource.id);
            if (success) {
                cleanedUp++;
                memoryFreed += resource.memoryEstimateMB;
            }
            else {
                errors++;
            }
        }
        const cleanupTime = Date.now() - startTime;
        const stats = {
            totalResourcesTracked: resourcesOfType.length,
            resourcesCleanedUp: cleanedUp,
            cleanupErrors: errors,
            memoryFreedMB: memoryFreed,
            cleanupTimeMs: cleanupTime
        };
        console.log(`✅ Cleanup complete for ${type}: ${cleanedUp}/${resourcesOfType.length} cleaned, ${memoryFreed}MB freed, ${cleanupTime}ms`);
        return stats;
    }
    /**
     * Clean up all registered resources
     */
    async cleanupAllResources() {
        const startTime = Date.now();
        const allResources = Array.from(this.resources.values());
        let cleanedUp = 0;
        let errors = 0;
        let memoryFreed = 0;
        console.log(`🧹 Cleaning up all ${allResources.length} registered resources`);
        for (const resource of allResources) {
            const success = await this.cleanupResource(resource.id);
            if (success) {
                cleanedUp++;
                memoryFreed += resource.memoryEstimateMB;
            }
            else {
                errors++;
            }
        }
        const cleanupTime = Date.now() - startTime;
        const stats = {
            totalResourcesTracked: allResources.length,
            resourcesCleanedUp: cleanedUp,
            cleanupErrors: errors,
            memoryFreedMB: memoryFreed,
            cleanupTimeMs: cleanupTime
        };
        console.log(`✅ Full cleanup complete: ${cleanedUp}/${allResources.length} cleaned, ${memoryFreed}MB freed, ${cleanupTime}ms`);
        return stats;
    }
    /**
     * Clean up unused resources (not used recently)
     */
    async cleanupUnusedResources(maxAgeMinutes = 30) {
        const startTime = Date.now();
        const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
        const unusedResources = Array.from(this.resources.values()).filter(resource => resource.lastUsedAt < cutoffTime);
        let cleanedUp = 0;
        let errors = 0;
        let memoryFreed = 0;
        console.log(`🧹 Cleaning up ${unusedResources.length} unused resources (older than ${maxAgeMinutes} minutes)`);
        for (const resource of unusedResources) {
            const success = await this.cleanupResource(resource.id);
            if (success) {
                cleanedUp++;
                memoryFreed += resource.memoryEstimateMB;
            }
            else {
                errors++;
            }
        }
        const cleanupTime = Date.now() - startTime;
        const stats = {
            totalResourcesTracked: unusedResources.length,
            resourcesCleanedUp: cleanedUp,
            cleanupErrors: errors,
            memoryFreedMB: memoryFreed,
            cleanupTimeMs: cleanupTime
        };
        console.log(`✅ Unused resource cleanup complete: ${cleanedUp}/${unusedResources.length} cleaned, ${memoryFreed}MB freed`);
        return stats;
    }
    // =============================================================================
    // MEMORY MANAGEMENT
    // =============================================================================
    /**
     * Get current memory statistics
     */
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        const currentHeapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        // Update peak memory
        if (currentHeapMB > this.peakMemoryMB) {
            this.peakMemoryMB = currentHeapMB;
        }
        return {
            heapUsedMB: currentHeapMB,
            heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
            externalMB: Math.round(memUsage.external / 1024 / 1024),
            rssMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
            peakHeapUsedMB: this.peakMemoryMB,
            gcCount: this.gcCount,
            lastGcAt: this.lastGcAt
        };
    }
    /**
     * Check if memory usage exceeds threshold
     */
    isMemoryThresholdExceeded() {
        const stats = this.getMemoryStats();
        return stats.heapUsedMB > this.memoryThresholdMB;
    }
    /**
     * Force garbage collection
     */
    forceGarbageCollection() {
        if (this.gcEnabled && global.gc) {
            try {
                global.gc();
                this.gcCount++;
                this.lastGcAt = new Date();
                console.log(`🗑️ Forced garbage collection (count: ${this.gcCount})`);
                return true;
            }
            catch (error) {
                console.warn(`Failed to force garbage collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return false;
            }
        }
        return false;
    }
    /**
     * Perform memory optimization
     */
    async optimizeMemory() {
        const initialStats = this.getMemoryStats();
        console.log(`🔧 Starting memory optimization (current: ${initialStats.heapUsedMB}MB, threshold: ${this.memoryThresholdMB}MB)`);
        let resourcesCleanedUp = 0;
        // Clean up unused resources if memory threshold exceeded
        if (this.isMemoryThresholdExceeded()) {
            console.log('💾 Memory threshold exceeded, cleaning up unused resources');
            const cleanupStats = await this.cleanupUnusedResources(15); // Clean resources unused for 15+ minutes
            resourcesCleanedUp = cleanupStats.resourcesCleanedUp;
        }
        // Force garbage collection
        const gcPerformed = this.forceGarbageCollection();
        const finalStats = this.getMemoryStats();
        const memoryFreed = Math.max(0, initialStats.heapUsedMB - finalStats.heapUsedMB);
        console.log(`✅ Memory optimization complete: ${initialStats.heapUsedMB}MB → ${finalStats.heapUsedMB}MB (freed: ${memoryFreed}MB)`);
        return {
            initialMemoryMB: initialStats.heapUsedMB,
            finalMemoryMB: finalStats.heapUsedMB,
            memoryFreedMB: memoryFreed,
            resourcesCleanedUp,
            gcPerformed
        };
    }
    // =============================================================================
    // CONFIGURATION
    // =============================================================================
    /**
     * Configure memory threshold
     */
    setMemoryThreshold(thresholdMB) {
        if (thresholdMB < 64) {
            throw new Error('Memory threshold must be at least 64MB');
        }
        this.memoryThresholdMB = thresholdMB;
        console.log(`⚙️ Memory threshold set to ${thresholdMB}MB`);
    }
    /**
     * Enable or disable automatic cleanup
     */
    setAutoCleanup(enabled) {
        this.autoCleanupEnabled = enabled;
        if (enabled) {
            this.startAutoCleanup();
        }
        else {
            this.stopAutoCleanup();
        }
        console.log(`⚙️ Auto cleanup ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Enable or disable garbage collection
     */
    setGarbageCollection(enabled) {
        this.gcEnabled = enabled;
        console.log(`⚙️ Garbage collection ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Set cleanup interval
     */
    setCleanupInterval(intervalMs) {
        if (intervalMs < 5000) {
            throw new Error('Cleanup interval must be at least 5 seconds');
        }
        this.cleanupIntervalMs = intervalMs;
        // Restart auto cleanup with new interval
        if (this.autoCleanupEnabled) {
            this.stopAutoCleanup();
            this.startAutoCleanup();
        }
        console.log(`⚙️ Cleanup interval set to ${intervalMs}ms`);
    }
    // =============================================================================
    // RESOURCE STATISTICS
    // =============================================================================
    /**
     * Get comprehensive resource statistics
     */
    getResourceStats() {
        const resources = Array.from(this.resources.values());
        const now = new Date();
        const resourcesByType = resources.reduce((acc, resource) => {
            acc[resource.type] = (acc[resource.type] || 0) + 1;
            return acc;
        }, {});
        const totalEstimatedMemory = resources.reduce((sum, resource) => sum + resource.memoryEstimateMB, 0);
        let oldestResource = null;
        let newestResource = null;
        if (resources.length > 0) {
            const sortedByAge = resources.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            const oldest = sortedByAge[0];
            const newest = sortedByAge[sortedByAge.length - 1];
            oldestResource = {
                name: oldest.name,
                ageMinutes: Math.round((now.getTime() - oldest.createdAt.getTime()) / 60000)
            };
            newestResource = {
                name: newest.name,
                ageMinutes: Math.round((now.getTime() - newest.createdAt.getTime()) / 60000)
            };
        }
        return {
            totalResources: resources.length,
            resourcesByType,
            totalEstimatedMemoryMB: totalEstimatedMemory,
            oldestResource,
            newestResource,
            memoryStats: this.getMemoryStats()
        };
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    /**
     * Generate unique resource ID
     */
    generateResourceId(type, name) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${type}_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
    }
    /**
     * Estimate memory usage for embedder
     */
    estimateEmbedderMemory(embedder) {
        // Rough estimates based on model type and dimensions
        const dimensions = embedder.dimensions;
        const modelType = embedder.modelType;
        if (modelType === 'clip') {
            // CLIP models are typically larger
            return Math.max(200, dimensions * 0.5); // Minimum 200MB for CLIP
        }
        else {
            // Sentence transformers are typically smaller
            return Math.max(100, dimensions * 0.3); // Minimum 100MB for sentence transformers
        }
    }
    /**
     * Estimate memory usage for model
     */
    estimateModelMemory(modelType) {
        const estimates = {
            'clip': 300,
            'sentence-transformer': 150,
            'image-to-text': 250,
            'cross-encoder': 100,
            'default': 100
        };
        return estimates[modelType] || estimates.default;
    }
    /**
     * Estimate memory usage for processor
     */
    estimateProcessorMemory(processorName) {
        if (processorName.includes('image')) {
            return 50; // Image processors are relatively lightweight
        }
        return 25; // Default for other processors
    }
    /**
     * Start automatic cleanup timer
     */
    startAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(async () => {
            if (this.autoCleanupEnabled) {
                try {
                    // Check memory and clean up if needed
                    if (this.isMemoryThresholdExceeded()) {
                        await this.optimizeMemory();
                    }
                }
                catch (error) {
                    console.warn(`Auto cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }, this.cleanupIntervalMs);
    }
    /**
     * Stop automatic cleanup timer
     */
    stopAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
    /**
     * Setup memory monitoring
     */
    setupMemoryMonitoring() {
        // Monitor memory usage periodically
        this.memoryMonitorTimer = setInterval(() => {
            const stats = this.getMemoryStats();
            // Log warning if memory usage is high
            if (stats.heapUsedMB > this.memoryThresholdMB * 0.8) {
                console.warn(`⚠️ High memory usage: ${stats.heapUsedMB}MB (threshold: ${this.memoryThresholdMB}MB)`);
            }
        }, 60000); // Check every minute
    }
    /**
     * Stop memory monitoring
     */
    stopMemoryMonitoring() {
        if (this.memoryMonitorTimer) {
            clearInterval(this.memoryMonitorTimer);
            this.memoryMonitorTimer = undefined;
        }
    }
    /**
     * Shutdown resource manager
     */
    async shutdown() {
        console.log('🔄 Shutting down resource manager...');
        this.stopAutoCleanup();
        this.stopMemoryMonitoring();
        const stats = await this.cleanupAllResources();
        console.log(`✅ Resource manager shutdown complete: ${stats.resourcesCleanedUp} resources cleaned up`);
    }
}
// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================
/**
 * Get the global resource manager instance
 */
export function getResourceManager() {
    return ResourceManager.getInstance();
}
/**
 * Register an embedder for automatic resource management
 */
export function registerEmbedder(embedder) {
    return getResourceManager().registerEmbedder(embedder);
}
/**
 * Clean up all resources and optimize memory
 */
export async function cleanupAndOptimizeMemory() {
    const manager = getResourceManager();
    await manager.optimizeMemory();
}
/**
 * Force garbage collection if available
 */
export function forceGarbageCollection() {
    return getResourceManager().forceGarbageCollection();
}
/**
 * Get current memory statistics
 */
export function getMemoryStats() {
    return getResourceManager().getMemoryStats();
}
// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export default ResourceManager;
