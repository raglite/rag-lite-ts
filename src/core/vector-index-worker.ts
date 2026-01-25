/**
 * Worker thread for VectorIndex operations
 * Isolates hnswlib-wasm WebAssembly memory to prevent accumulation
 */

import { parentPort } from 'worker_threads';
import { existsSync } from 'fs';
import { BinaryIndexFormat } from './binary-index-format.js';
import type {
  VectorIndexRequest,
  VectorIndexResponse,
  InitPayload,
  LoadIndexPayload,
  AddVectorPayload,
  AddVectorsPayload,
  SearchPayload,
  ResizeIndexPayload,
  SetEfPayload,
  IndexExistsPayload
} from './vector-index-messages.js';

// Set up browser-like environment for hnswlib-wasm (same as current vector-index.ts)
if (typeof window === 'undefined') {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).XMLHttpRequest = dom.window.XMLHttpRequest;
  (global as any).indexedDB = undefined;
  
  Object.defineProperty(dom.window, 'indexedDB', {
    value: undefined,
    writable: false,
    configurable: true
  });
}

// Worker state
let hnswlib: any = null;
let index: any = null;
let vectorStorage: Map<number, Float32Array> = new Map();
let currentSize = 0;
let options: {
  dimensions: number;
  maxElements: number;
  M: number;
  efConstruction: number;
  seed: number;
} | null = null;
let indexPath: string | null = null; // Set during init or loadIndex

// Helper: Load hnswlib module (only once per worker)
async function loadHnswlibModule(): Promise<any> {
  if (hnswlib) {
    return hnswlib;
  }

  // Suppress stderr during loading (same as current implementation)
  const originalStderrWrite = process.stderr.write;
  const originalConsoleError = console.error;
  
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
    const message = chunk.toString();
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
    const hnswlibModule = await import('hnswlib-wasm/dist/hnswlib.js') as any;
    const { loadHnswlib } = hnswlibModule;
    hnswlib = await loadHnswlib();
    return hnswlib;
  } finally {
    process.stderr.write = originalStderrWrite;
    console.error = originalConsoleError;
  }
}

// Helper: Convert ArrayBuffer to Float32Array
function bufferToFloat32Array(buffer: ArrayBuffer, dimensions: number): Float32Array {
  return new Float32Array(buffer, 0, dimensions);
}

// Message handlers
async function handleInit(payload: InitPayload): Promise<void> {
  await loadHnswlibModule();
  
  // Store indexPath for saveIndex operations
  indexPath = payload.indexPath;
  
  options = {
    dimensions: payload.dimensions,
    maxElements: payload.maxElements,
    M: payload.M || 16,
    efConstruction: payload.efConstruction || 200,
    seed: payload.seed || 100
  };
  
  index = new hnswlib.HierarchicalNSW('cosine', options.dimensions, '');
  index.initIndex(options.maxElements, options.M, options.efConstruction, options.seed);
  
  currentSize = 0;
  vectorStorage.clear();
}

async function handleLoadIndex(payload: LoadIndexPayload): Promise<void> {
  if (!existsSync(payload.indexPath)) {
    throw new Error(`Index file not found: ${payload.indexPath}`);
  }
  
  await loadHnswlibModule();
  
  const data = await BinaryIndexFormat.load(payload.indexPath);
  indexPath = payload.indexPath;
  
  if (!options) {
    options = {
      dimensions: data.dimensions,
      maxElements: data.maxElements,
      M: data.M || 16,
      efConstruction: data.efConstruction || 200,
      seed: data.seed || 100
    };
  }
  
  // Validate dimensions
  if (data.dimensions !== options.dimensions) {
    throw new Error(
      `Dimension mismatch: stored ${data.dimensions}, expected ${options.dimensions}`
    );
  }
  
  // Create index
  index = new hnswlib.HierarchicalNSW('cosine', options.dimensions, '');
  index.initIndex(options.maxElements, options.M, options.efConstruction, options.seed);
  
  // Clear and repopulate
  vectorStorage.clear();
  currentSize = 0;
  
  // Load vectors in batches
  const batchSize = 1000;
  const totalVectors = data.vectors.length;
  
  for (let i = 0; i < totalVectors; i += batchSize) {
    const batch = data.vectors.slice(i, i + batchSize);
    for (const item of batch) {
      try {
        index.addPoint(item.vector, item.id, false);
        vectorStorage.set(item.id, item.vector);
        currentSize++;
      } catch (error: any) {
        if (error?.message?.includes('Cannot enlarge memory') || 
            error?.message?.includes('memory') ||
            (error?.name === 'WebAssembly.Exception' && error?.message?.includes('memory'))) {
          throw new Error(
            `WebAssembly memory limit exceeded while loading vector index. ` +
            `Index contains ${totalVectors} vectors which requires more than 2GB of memory. ` +
            `Consider: 1) Rebuilding the index with fewer vectors, 2) Using a smaller embedding model, ` +
            `3) Splitting your data into multiple smaller indexes, or 4) Increasing Node.js memory with --max-old-space-size=4096`
          );
        }
        throw error;
      }
    }
    
    if (totalVectors > 10000 && (i + batchSize) % 10000 === 0) {
      console.log(`  Loaded ${Math.min(i + batchSize, totalVectors)}/${totalVectors} vectors...`);
    }
  }
}

async function handleSaveIndex(): Promise<void> {
  if (!index || !indexPath) {
    throw new Error('Index not initialized or indexPath not set');
  }
  
  const vectors = Array.from(vectorStorage.entries()).map(([id, vector]) => ({
    id,
    vector
  }));
  
  await BinaryIndexFormat.save(indexPath, {
    dimensions: options!.dimensions,
    maxElements: options!.maxElements,
    M: options!.M,
    efConstruction: options!.efConstruction,
    seed: options!.seed,
    currentSize: vectors.length,
    vectors
  });
}

function handleAddVector(payload: AddVectorPayload): void {
  if (!index || !options) {
    throw new Error('Index not initialized');
  }
  
  const vector = bufferToFloat32Array(payload.vector, payload.dimensions);
  
  if (vector.length !== options.dimensions) {
    throw new Error(`Vector dimension mismatch: ${vector.length} vs ${options.dimensions}`);
  }
  
  index.addPoint(vector, payload.id, false);
  vectorStorage.set(payload.id, new Float32Array(vector));
  currentSize++;
}

function handleAddVectors(payload: AddVectorsPayload): void {
  for (const item of payload.vectors) {
    handleAddVector({
      id: item.id,
      vector: item.vector,
      dimensions: item.dimensions
    });
  }
}

function handleSearch(payload: SearchPayload): { neighbors: number[]; distances: number[] } {
  if (!index || !options) {
    throw new Error('Index not initialized');
  }
  
  const queryVector = bufferToFloat32Array(payload.queryVector, payload.dimensions);
  
  if (queryVector.length !== options.dimensions) {
    throw new Error(`Query vector dimension mismatch: ${queryVector.length} vs ${options.dimensions}`);
  }
  
  if (currentSize === 0) {
    return { neighbors: [], distances: [] };
  }
  
  const result = index.searchKnn(queryVector, Math.min(payload.k, currentSize), undefined);
  return {
    neighbors: result.neighbors,
    distances: result.distances
  };
}

function handleGetCurrentCount(): number {
  return currentSize;
}

function handleResizeIndex(payload: ResizeIndexPayload): void {
  if (!index || !options) {
    throw new Error('Index not initialized');
  }
  
  if (payload.newMaxElements <= options.maxElements) {
    throw new Error(`New max elements must be greater than current`);
  }
  
  index.resizeIndex(payload.newMaxElements);
  options.maxElements = payload.newMaxElements;
}

async function handleReset(): Promise<void> {
  vectorStorage.clear();
  currentSize = 0;
  
  if (index && options && hnswlib) {
    index = new hnswlib.HierarchicalNSW('cosine', options.dimensions, '');
    index.initIndex(options.maxElements, options.M, options.efConstruction, options.seed);
    
    // Set efSearch for query time
    if (typeof index.setEfSearch === 'function') {
      index.setEfSearch(50);
    }
  }
}

function handleSetEf(payload: SetEfPayload): void {
  if (!index) {
    throw new Error('Index not initialized');
  }
  
  if (typeof index.setEfSearch === 'function') {
    index.setEfSearch(payload.ef);
  }
}

function handleIndexExists(payload: IndexExistsPayload): boolean {
  return existsSync(payload.indexPath);
}

// Handle unhandled promise rejections to prevent worker crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Worker unhandled rejection:', reason);
  // Don't exit - just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Worker uncaught exception:', error);
  // Don't exit - just log the error
});

// Main message handler
parentPort!.on('message', async (request: VectorIndexRequest) => {
  try {
    let response: VectorIndexResponse = { id: request.id, type: 'success' };
    
    switch (request.type) {
      case 'init':
        await handleInit(request.payload as InitPayload);
        break;
        
      case 'loadIndex':
        await handleLoadIndex(request.payload as LoadIndexPayload);
        response.payload = { count: currentSize };
        break;
        
      case 'saveIndex':
        await handleSaveIndex();
        response.payload = { count: currentSize };
        break;
        
      case 'addVector':
        handleAddVector(request.payload as AddVectorPayload);
        response.payload = { count: currentSize };
        break;
        
      case 'addVectors':
        handleAddVectors(request.payload as AddVectorsPayload);
        response.payload = { count: currentSize };
        break;
        
      case 'search':
        response.payload = handleSearch(request.payload as SearchPayload);
        break;
        
      case 'getCurrentCount':
        response.payload = { count: currentSize };
        break;
        
      case 'resizeIndex':
        handleResizeIndex(request.payload as ResizeIndexPayload);
        break;
        
      case 'reset':
        await handleReset();
        response.payload = { count: 0 };
        break;
        
      case 'setEf':
        handleSetEf(request.payload as SetEfPayload);
        break;
        
      case 'indexExists':
        response.payload = { exists: handleIndexExists(request.payload as IndexExistsPayload) };
        break;
        
      case 'cleanup':
        // Worker will be terminated by main thread, just acknowledge
        break;
        
      default:
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
    
    parentPort!.postMessage(response);
  } catch (error) {
    parentPort!.postMessage({
      id: request.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
