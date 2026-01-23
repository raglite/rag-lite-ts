/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 *
 * Worker-based implementation to prevent WebAssembly memory accumulation.
 */
import { Worker } from 'worker_threads';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleError, ErrorCategory, ErrorSeverity, createError } from './error-handler.js';
import { createMissingFileError, createDimensionMismatchError } from './actionable-error-messages.js';
export class VectorIndex {
    worker = null;
    indexPath;
    options;
    messageQueue = new Map();
    messageId = 0;
    isInitialized = false;
    constructor(indexPath, options) {
        this.indexPath = indexPath;
        this.options = {
            efConstruction: 200,
            M: 16,
            seed: 100,
            ...options
        };
    }
    /**
     * Get the path to the worker script
     * Always uses compiled .js files - workers cannot execute TypeScript directly
     */
    getWorkerPath() {
        const currentFile = fileURLToPath(import.meta.url);
        const currentDir = dirname(currentFile);
        // Always prefer .js (compiled output)
        const jsPath = join(currentDir, 'vector-index-worker.js');
        // Check if .js exists in current directory (compiled)
        if (existsSync(jsPath)) {
            return jsPath;
        }
        // If running from src/ (development), try dist/ paths
        if (currentDir.includes('src')) {
            // Find project root (go up from src/core)
            const projectRoot = currentDir.replace(/[\\/]src[\\/]core.*$/, '');
            const distEsmPath = join(projectRoot, 'dist', 'esm', 'core', 'vector-index-worker.js');
            const distCjsPath = join(projectRoot, 'dist', 'cjs', 'core', 'vector-index-worker.js');
            if (existsSync(distEsmPath)) {
                return distEsmPath;
            }
            if (existsSync(distCjsPath)) {
                return distCjsPath;
            }
        }
        // If running from node_modules (installed package), try dist paths
        if (currentDir.includes('node_modules')) {
            const packageRoot = currentDir.split('node_modules')[0];
            const distEsmPath = join(packageRoot, 'node_modules', 'rag-lite-ts', 'dist', 'esm', 'core', 'vector-index-worker.js');
            const distCjsPath = join(packageRoot, 'node_modules', 'rag-lite-ts', 'dist', 'cjs', 'core', 'vector-index-worker.js');
            if (existsSync(distEsmPath)) {
                return distEsmPath;
            }
            if (existsSync(distCjsPath)) {
                return distCjsPath;
            }
        }
        // Final fallback - will fail with clear error
        throw new Error(`Worker file not found. Expected: ${jsPath}\n` +
            'Please run "npm run build" to compile the vector-index-worker.ts file.\n' +
            `Current directory: ${currentDir}\n` +
            `Checked paths: ${jsPath}, ${currentDir.includes('src') ? join(currentDir.replace(/[\\/]src[\\/]core.*$/, ''), 'dist', 'esm', 'core', 'vector-index-worker.js') : 'N/A'}`);
    }
    /**
     * Ensure worker is created and ready
     */
    async ensureWorker() {
        if (this.worker) {
            return;
        }
        const workerPath = this.getWorkerPath();
        this.worker = new Worker(workerPath);
        // Set up message handler
        this.worker.on('message', (response) => {
            const handler = this.messageQueue.get(response.id);
            if (handler) {
                this.messageQueue.delete(response.id);
                if (response.type === 'error') {
                    handler.reject(new Error(response.error || 'Unknown error'));
                }
                else {
                    handler.resolve(response.payload);
                }
            }
        });
        // Handle worker errors
        this.worker.on('error', (error) => {
            console.error('VectorIndex worker error:', error);
            // Reject all pending requests
            for (const [id, handler] of this.messageQueue.entries()) {
                handler.reject(error);
            }
            this.messageQueue.clear();
        });
        // Handle worker exit
        this.worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`VectorIndex worker exited with code ${code}`);
            }
            // Reject all pending requests
            for (const [id, handler] of this.messageQueue.entries()) {
                handler.reject(new Error(`Worker exited with code ${code}`));
            }
            this.messageQueue.clear();
            this.worker = null;
            this.isInitialized = false;
        });
    }
    /**
     * Send a message to the worker and wait for response
     */
    async sendMessage(type, payload) {
        await this.ensureWorker();
        return new Promise((resolve, reject) => {
            const id = this.messageId++;
            this.messageQueue.set(id, { resolve, reject });
            const request = { id, type, payload };
            this.worker.postMessage(request);
        });
    }
    /**
     * Convert Float32Array to ArrayBuffer for transfer
     */
    float32ArrayToBuffer(vector) {
        const buffer = vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength);
        // Ensure we return ArrayBuffer, not SharedArrayBuffer
        return buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(0);
    }
    /**
     * Initialize the HNSW index with cosine similarity using hnswlib-wasm
     */
    async initialize() {
        try {
            const payload = {
                dimensions: this.options.dimensions,
                maxElements: this.options.maxElements,
                M: this.options.M,
                efConstruction: this.options.efConstruction,
                seed: this.options.seed,
                indexPath: this.indexPath // Pass indexPath to worker for saveIndex operations
            };
            await this.sendMessage('init', payload);
            this.isInitialized = true;
            console.log(`Initialized HNSW index with ${this.options.dimensions} dimensions using hnswlib-wasm (worker)`);
        }
        catch (error) {
            handleError(createError.index(`Failed to initialize vector index: ${error instanceof Error ? error.message : String(error)}`), 'Vector Index Initialization', {
                category: ErrorCategory.INDEX,
                severity: ErrorSeverity.FATAL
            });
            throw error;
        }
    }
    /**
     * Load existing index from file using hnswlib-wasm
     */
    async loadIndex() {
        if (!existsSync(this.indexPath)) {
            throw createMissingFileError(this.indexPath, 'index', {
                operationContext: 'VectorIndex.loadIndex'
            });
        }
        try {
            const payload = {
                indexPath: this.indexPath
            };
            const result = await this.sendMessage('loadIndex', payload);
            this.isInitialized = true;
            console.log(`✓ Loaded HNSW index with ${result.count} vectors from ${this.indexPath} (worker)`);
        }
        catch (error) {
            throw new Error(`Failed to load index from ${this.indexPath}: ${error}`);
        }
    }
    /**
     * Save index to binary format
     */
    async saveIndex() {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        try {
            const result = await this.sendMessage('saveIndex');
            const actualSize = result.count;
            console.log(`✓ Saved HNSW index with ${actualSize} vectors (${(actualSize * this.options.dimensions * 4 / 1024).toFixed(2)} KB of vector data) to ${this.indexPath} (worker)`);
        }
        catch (error) {
            throw new Error(`Failed to save index to ${this.indexPath}: ${error}`);
        }
    }
    /**
     * Add a single vector to the HNSW index
     * Now async due to worker-based implementation
     */
    async addVector(embeddingId, vector) {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        if (vector.length !== this.options.dimensions) {
            throw createDimensionMismatchError(this.options.dimensions, vector.length, 'vector addition', { operationContext: 'VectorIndex.addVector' });
        }
        const payload = {
            id: embeddingId,
            vector: this.float32ArrayToBuffer(vector),
            dimensions: vector.length
        };
        await this.sendMessage('addVector', payload);
    }
    /**
     * Add multiple vectors to the index in batch
     * Now async due to worker-based implementation
     */
    async addVectors(vectors) {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        const payload = {
            vectors: vectors.map(v => ({
                id: v.id,
                vector: this.float32ArrayToBuffer(v.vector),
                dimensions: v.vector.length
            }))
        };
        await this.sendMessage('addVectors', payload);
    }
    /**
     * Search for k nearest neighbors using hnswlib-wasm
     * Now async due to worker-based implementation
     */
    async search(queryVector, k = 5) {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        if (queryVector.length !== this.options.dimensions) {
            throw createDimensionMismatchError(this.options.dimensions, queryVector.length, 'vector search', { operationContext: 'VectorIndex.search' });
        }
        const payload = {
            queryVector: this.float32ArrayToBuffer(queryVector),
            dimensions: queryVector.length,
            k
        };
        const result = await this.sendMessage('search', payload);
        // Check if empty result
        if (result.neighbors.length === 0 && result.distances.length === 0) {
            return { neighbors: [], distances: [] };
        }
        return result;
    }
    /**
     * Get current number of vectors in the index
     * Now async due to worker-based implementation
     */
    async getCurrentCount() {
        if (!this.isInitialized) {
            return 0;
        }
        const result = await this.sendMessage('getCurrentCount');
        return result.count;
    }
    /**
     * Check if index exists on disk
     */
    indexExists() {
        // This can be synchronous since it's just a file system check
        return existsSync(this.indexPath);
    }
    /**
     * Set search parameters for query time
     * Now async due to worker-based implementation
     */
    async setEf(ef) {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        const payload = { ef };
        try {
            await this.sendMessage('setEf', payload);
        }
        catch (error) {
            console.log(`Failed to set ef: ${error}`);
        }
    }
    /**
     * Resize index to accommodate more vectors
     * Now async due to worker-based implementation
     */
    async resizeIndex(newMaxElements) {
        if (!this.isInitialized) {
            throw new Error('Index not initialized');
        }
        if (newMaxElements <= this.options.maxElements) {
            throw new Error(`New max elements (${newMaxElements}) must be greater than current (${this.options.maxElements})`);
        }
        const payload = { newMaxElements };
        await this.sendMessage('resizeIndex', payload);
        this.options.maxElements = newMaxElements;
        console.log(`Resized index to accommodate ${newMaxElements} vectors`);
    }
    /**
     * Reset the vector index to an empty state.
     * Clears all vectors from the HNSW graph and vectorStorage.
     * The index parameters (dimensions, M, efConstruction) are preserved.
     */
    async reset() {
        console.log('🔄 VectorIndex: Resetting to empty state...');
        await this.sendMessage('reset');
        console.log('✓ VectorIndex reset: cleared all vectors');
    }
    /**
     * Get index options (for external access to configuration)
     */
    getOptions() {
        return { ...this.options };
    }
    /**
     * Cleanup: terminate worker and free all WebAssembly memory
     */
    async cleanup() {
        if (this.worker) {
            try {
                // Send cleanup message (worker will acknowledge)
                await this.sendMessage('cleanup');
            }
            catch (error) {
                // Ignore errors during cleanup
            }
            // Terminate worker - this frees ALL WebAssembly memory
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            this.messageQueue.clear();
        }
    }
}
