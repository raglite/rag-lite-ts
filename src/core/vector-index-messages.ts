/**
 * Message protocol for VectorIndex worker thread communication
 */

// Request messages (main thread → worker)
export interface VectorIndexRequest {
  id: number;
  type: 'init' | 'loadIndex' | 'saveIndex' | 'addVector' | 'addVectors' | 
        'search' | 'getCurrentCount' | 'resizeIndex' | 'reset' | 'cleanup' | 'indexExists' | 'setEf';
  payload?: any;
}

// Response messages (worker → main thread)
export interface VectorIndexResponse {
  id: number;
  type: 'success' | 'error';
  payload?: any;
  error?: string;
}

// Specific payload types
export interface InitPayload {
  dimensions: number;
  maxElements: number;
  M?: number;
  efConstruction?: number;
  seed?: number;
  indexPath: string; // Required for saveIndex operations
}

export interface LoadIndexPayload {
  indexPath: string;
}

export interface AddVectorPayload {
  id: number;
  vector: ArrayBuffer; // Serialized Float32Array
  dimensions: number;
}

export interface AddVectorsPayload {
  vectors: Array<{ id: number; vector: ArrayBuffer; dimensions: number }>;
}

export interface SearchPayload {
  queryVector: ArrayBuffer; // Serialized Float32Array
  dimensions: number;
  k: number;
}

export interface ResizeIndexPayload {
  newMaxElements: number;
}

export interface SetEfPayload {
  ef: number;
}

export interface IndexExistsPayload {
  indexPath: string;
}
