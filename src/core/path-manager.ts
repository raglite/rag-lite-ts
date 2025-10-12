/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

import { relative, resolve, isAbsolute } from 'path';

/**
 * Manages document path storage and resolution strategies
 * Model-agnostic - works with any content type (text, image, etc.)
 */
export class DocumentPathManager {
    constructor(
        private strategy: 'absolute' | 'relative',
        private basePath: string
    ) { }

    /**
     * Convert absolute file path to storage path based on strategy
     * @param absolutePath - The absolute file path
     * @returns Path to store in database
     */
    toStoragePath(absolutePath: string): string {
        if (this.strategy === 'absolute') {
            return absolutePath;
        }

        // For relative strategy, store path relative to base
        return relative(this.basePath, absolutePath);
    }

    /**
     * Convert storage path back to absolute path for file operations
     * @param storagePath - Path stored in database
     * @returns Absolute path for file operations
     */
    toAbsolutePath(storagePath: string): string {
        if (isAbsolute(storagePath)) {
            return storagePath;
        }

        // Resolve relative path against base path
        return resolve(this.basePath, storagePath);
    }

    /**
     * Get the current strategy
     */
    getStrategy(): 'absolute' | 'relative' {
        return this.strategy;
    }

    /**
     * Get the current base path
     */
    getBasePath(): string {
        return this.basePath;
    }

    /**
     * Create a new path manager with different base path (for search/retrieval)
     * @param newBasePath - New base path to use
     * @returns New DocumentPathManager instance
     */
    withBasePath(newBasePath: string): DocumentPathManager {
        return new DocumentPathManager(this.strategy, newBasePath);
    }

    /**
     * Create a new path manager with different strategy
     * @param newStrategy - New strategy to use
     * @param newBasePath - Optional new base path
     * @returns New DocumentPathManager instance
     */
    withStrategy(newStrategy: 'absolute' | 'relative', newBasePath?: string): DocumentPathManager {
        return new DocumentPathManager(newStrategy, newBasePath || this.basePath);
    }
}