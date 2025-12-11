/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

import { existsSync } from 'fs';
import { JSDOM } from 'jsdom';
import { handleError, ErrorCategory, ErrorSeverity, createError, safeExecute } from './error-handler.js';
import {
  createMissingFileError,
  createDimensionMismatchError,
  createMissingDependencyError
} from './actionable-error-messages.js';
import { BinaryIndexFormat } from './binary-index-format.js';

export interface VectorIndexOptions {
  dimensions: number;
  maxElements: number;
  efConstruction?: number;
  M?: number;
  seed?: number;
}

export interface SearchResult {
  neighbors: number[];
  distances: number[];
}

// Set up browser-like environment for hnswlib-wasm
if (typeof window === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  // Type assertion to avoid TypeScript issues with global polyfills
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).XMLHttpRequest = dom.window.XMLHttpRequest;
  
  // Disable IndexedDB to prevent hnswlib-wasm from trying to use it
  (global as any).indexedDB = undefined;
  
  // Override indexedDB on the window object to return undefined
  Object.defineProperty(dom.window, 'indexedDB', {
    value: undefined,
    writable: false,
    configurable: true
  });
}

export class VectorIndex {
  private index: any = null;
  private hnswlib: any = null;
  private indexPath: string;
  private options: VectorIndexOptions;
  private currentSize = 0;
  private vectorStorage: Map<number, Float32Array> = new Map(); // For persistence

  constructor(indexPath: string, options: VectorIndexOptions) {
    this.indexPath = indexPath;
    this.options = {
      efConstruction: 200,
      M: 16,
      seed: 100,
      ...options
    };
  }

  /**
   * Initialize the HNSW index with cosine similarity using hnswlib-wasm
   */
  async initialize(): Promise<void> {
    await safeExecute(
      async () => {
        // Load the hnswlib module
        if (!this.hnswlib) {
          // Temporarily suppress stderr output during hnswlib loading to avoid IndexedDB warnings
          const originalStderrWrite = process.stderr.write;
          const originalConsoleError = console.error;
          
          process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
            const message = chunk.toString();
            // Suppress specific IndexedDB/IDBFS related errors and WebAssembly errors
            if (message.includes('IDBFS') || message.includes('indexedDB not supported') || 
                message.includes('EmscriptenFileSystemManager') || message.includes('Aborted') ||
                message.includes('jsFS Error') || message.includes('syncing FS') ||
                message.includes('RuntimeError: unreachable') || message.includes('___trap') ||
                message.includes('abort') || message.includes('assert') ||
                message.includes('hnswlib-wasm/dist/hnswlib')) {
              if (callback) callback();
              return true;
            }
            return originalStderrWrite.call(this, chunk, encoding, callback);
          };
          
          console.error = (...args: any[]) => {
            const message = args.join(' ');
            if (message.includes('IDBFS') || message.includes('indexedDB not supported') || 
                message.includes('EmscriptenFileSystemManager') || message.includes('Aborted') ||
                message.includes('jsFS Error') || message.includes('syncing FS') ||
                message.includes('RuntimeError: unreachable') || message.includes('___trap') ||
                message.includes('abort') || message.includes('assert') ||
                message.includes('hnswlib-wasm/dist/hnswlib')) {
              return;
            }
            originalConsoleError.apply(console, args);
          };
          
          try {
            const { loadHnswlib } = await import('hnswlib-wasm/dist/hnswlib.js');
            this.hnswlib = await loadHnswlib();
          } finally {
            // Restore original output streams
            process.stderr.write = originalStderrWrite;
            console.error = originalConsoleError;
          }
        }
        
        // Create new HNSW index (third parameter is autoSaveFilename, but we'll handle persistence manually)
        this.index = new this.hnswlib.HierarchicalNSW('cosine', this.options.dimensions, '');
        this.index.initIndex(
          this.options.maxElements,
          this.options.M || 16,
          this.options.efConstruction || 200,
          this.options.seed || 100
        );
        
        this.currentSize = 0;
        console.log(`Initialized HNSW index with ${this.options.dimensions} dimensions using hnswlib-wasm`);
      },
      'Vector Index Initialization',
      {
        category: ErrorCategory.INDEX,
        severity: ErrorSeverity.FATAL
      }
    );
  }

  /**
   * Load existing index from file using hnswlib-wasm
   */
  async loadIndex(): Promise<void> {
    if (!existsSync(this.indexPath)) {
      throw createMissingFileError(this.indexPath, 'index', {
        operationContext: 'VectorIndex.loadIndex'
      });
    }

    try {
      // Load the hnswlib module
      if (!this.hnswlib) {
        // Temporarily suppress stderr output during hnswlib loading to avoid IndexedDB warnings
        const originalStderrWrite = process.stderr.write;
        const originalConsoleError = console.error;
        
        process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
          const message = chunk.toString();
          // Suppress specific IndexedDB/IDBFS related errors and WebAssembly errors
          if (message.includes('IDBFS') || message.includes('indexedDB not supported') || 
              message.includes('EmscriptenFileSystemManager') || message.includes('Aborted') ||
              message.includes('jsFS Error') || message.includes('syncing FS') ||
              message.includes('RuntimeError: unreachable') || message.includes('___trap') ||
              message.includes('abort') || message.includes('assert') ||
              message.includes('hnswlib-wasm/dist/hnswlib')) {
            if (callback) callback();
            return true;
          }
          return originalStderrWrite.call(this, chunk, encoding, callback);
        };
        
        console.error = (...args: any[]) => {
          const message = args.join(' ');
          if (message.includes('IDBFS') || message.includes('indexedDB not supported') || 
              message.includes('EmscriptenFileSystemManager') || message.includes('Aborted') ||
              message.includes('jsFS Error') || message.includes('syncing FS') ||
              message.includes('RuntimeError: unreachable') || message.includes('___trap') ||
              message.includes('abort') || message.includes('assert') ||
              message.includes('hnswlib-wasm/dist/hnswlib')) {
            return;
          }
          originalConsoleError.apply(console, args);
        };
        
        try {
          const { loadHnswlib } = await import('hnswlib-wasm/dist/hnswlib.js');
          this.hnswlib = await loadHnswlib();
        } finally {
          // Restore original output streams
          process.stderr.write = originalStderrWrite;
          console.error = originalConsoleError;
        }
      }
      
      // Create new HNSW index (third parameter is autoSaveFilename, but we'll handle persistence manually)
      this.index = new this.hnswlib.HierarchicalNSW('cosine', this.options.dimensions, '');
      
      // Load from binary format
      const data = await BinaryIndexFormat.load(this.indexPath);
      
      // Validate dimensions
      if (data.dimensions !== this.options.dimensions) {
        console.log(`⚠️  Dimension mismatch detected:`);
        console.log(`   Stored dimensions: ${data.dimensions}`);
        console.log(`   Expected dimensions: ${this.options.dimensions}`);
        console.log(`   Number of vectors: ${data.vectors.length}`);
        if (data.vectors.length > 0) {
          console.log(`   Actual vector length: ${data.vectors[0].vector.length}`);
        }
        
        throw createDimensionMismatchError(
          this.options.dimensions,
          data.dimensions,
          'vector index loading',
          { operationContext: 'VectorIndex.loadIndex' }
        );
      }
      
      // Update options from stored data
      this.options.maxElements = data.maxElements;
      this.options.M = data.M;
      this.options.efConstruction = data.efConstruction;
      this.options.seed = data.seed;
      
      // Initialize HNSW index
      this.index.initIndex(
        this.options.maxElements,
        this.options.M,
        this.options.efConstruction,
        this.options.seed
      );
      
      // Clear and repopulate vector storage
      this.vectorStorage.clear();
      
      // Add all stored vectors to HNSW index
      for (const item of data.vectors) {
        this.index.addPoint(item.vector, item.id, false);
        this.vectorStorage.set(item.id, item.vector);
      }
      
      this.currentSize = data.currentSize;
      console.log(`✓ Loaded HNSW index with ${this.currentSize} vectors from ${this.indexPath}`);
    } catch (error) {
      throw new Error(`Failed to load index from ${this.indexPath}: ${error}`);
    }
  }

  /**
   * Save index to binary format
   */
  async saveIndex(): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    try {
      // Collect all vectors from storage
      const vectors = Array.from(this.vectorStorage.entries()).map(([id, vector]) => ({
        id,
        vector
      }));
      
      // Save to binary format
      await BinaryIndexFormat.save(this.indexPath, {
        dimensions: this.options.dimensions,
        maxElements: this.options.maxElements,
        M: this.options.M || 16,
        efConstruction: this.options.efConstruction || 200,
        seed: this.options.seed || 100,
        currentSize: this.currentSize,
        vectors
      });
      
      console.log(`✓ Saved HNSW index with ${this.currentSize} vectors to ${this.indexPath}`);
    } catch (error) {
      throw new Error(`Failed to save index to ${this.indexPath}: ${error}`);
    }
  }

  /**
   * Add a single vector to the HNSW index
   */
  addVector(embeddingId: number, vector: Float32Array): void {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    if (vector.length !== this.options.dimensions) {
      throw createDimensionMismatchError(
        this.options.dimensions,
        vector.length,
        'vector addition',
        { operationContext: 'VectorIndex.addVector' }
      );
    }

    try {
      this.index.addPoint(vector, embeddingId, false);
      // Store vector for persistence
      this.vectorStorage.set(embeddingId, new Float32Array(vector));
      this.currentSize++;
    } catch (error) {
      throw new Error(`Failed to add vector ${embeddingId}: ${error}`);
    }
  }

  /**
   * Add multiple vectors to the index in batch
   */
  addVectors(vectors: Array<{ id: number; vector: Float32Array }>): void {
    for (const { id, vector } of vectors) {
      this.addVector(id, vector);
    }
  }

  /**
   * Search for k nearest neighbors using hnswlib-wasm
   */
  search(queryVector: Float32Array, k: number = 5): SearchResult {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    if (queryVector.length !== this.options.dimensions) {
      throw createDimensionMismatchError(
        this.options.dimensions,
        queryVector.length,
        'vector search',
        { operationContext: 'VectorIndex.search' }
      );
    }

    if (this.currentSize === 0) {
      return { neighbors: [], distances: [] };
    }

    try {
      const result = this.index.searchKnn(queryVector, Math.min(k, this.currentSize), undefined);
      return {
        neighbors: result.neighbors,
        distances: result.distances
      };
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Get current number of vectors in the index
   */
  getCurrentCount(): number {
    return this.currentSize;
  }

  /**
   * Check if index exists on disk
   */
  indexExists(): boolean {
    return existsSync(this.indexPath);
  }

  /**
   * Set search parameters for query time
   */
  setEf(ef: number): void {
    if (!this.index) {
      throw new Error('Index not initialized');
    }
    
    try {
      // hnswlib-wasm might not have setEf method, check if it exists
      if (typeof this.index.setEfSearch === 'function') {
        this.index.setEfSearch(ef);
        console.log(`Set efSearch to ${ef}`);
      } else {
        console.log(`setEfSearch not available in hnswlib-wasm`);
      }
    } catch (error) {
      console.log(`Failed to set ef: ${error}`);
    }
  }

  /**
   * Resize index to accommodate more vectors
   */
  resizeIndex(newMaxElements: number): void {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    if (newMaxElements <= this.options.maxElements) {
      throw new Error(`New max elements (${newMaxElements}) must be greater than current (${this.options.maxElements})`);
    }

    try {
      this.index.resizeIndex(newMaxElements);
      this.options.maxElements = newMaxElements;
      console.log(`Resized index to accommodate ${newMaxElements} vectors`);
    } catch (error) {
      throw new Error(`Failed to resize index: ${error}`);
    }
  }

  /**
   * Get index options (for external access to configuration)
   */
  getOptions(): VectorIndexOptions {
    return { ...this.options };
  }
}