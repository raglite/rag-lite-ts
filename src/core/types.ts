/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

// Core content interfaces that support different modalities
export interface ContentDocument {
  source: string;
  title: string;
  content: string;
  contentType: string;
  metadata?: Record<string, any>;
}

export interface ContentChunk {
  text: string;
  chunkIndex: number;
  contentType: string;
  metadata?: Record<string, any>;
}

// Core embedding interfaces for dependency injection
export interface EmbeddingResult {
  embedding_id: string;
  vector: Float32Array;
  contentType?: string;
  metadata?: Record<string, any>;
}

// Function type for embedding queries - supports different content types and dimensions
export type EmbedFunction = (query: string, contentType?: string) => Promise<EmbeddingResult>;

// Core search result interface that supports different content types
export interface SearchResult {
  content: string;
  score: number;
  contentType: string;
  document: {
    id: number;
    source: string;
    title: string;
    contentType: string;
    contentId?: string;     // Universal content identifier for unified content system
  };
  metadata?: Record<string, any>;
}

// Function type for reranking results - supports different content types
export type RerankFunction = (
  query: string, 
  results: SearchResult[], 
  contentType?: string
) => Promise<SearchResult[]>;

// Interface for embedding query operations that can handle different content types
export interface EmbeddingQueryInterface {
  embedQuery: EmbedFunction;
  supportedContentTypes: string[];
  embeddingDimensions: number;
}

// Interface for reranking operations that can handle different content types  
export interface RerankingInterface {
  rerankResults: RerankFunction;
  supportedContentTypes: string[];
  isEnabled: boolean;
}

// Core search options interface
export interface SearchOptions {
  top_k?: number;
  rerank?: boolean;
  contentType?: 'text' | 'image' | 'combined';
}

// Core chunking interfaces
export interface Chunk {
  text: string;
  chunk_index: number;
}

export interface Document {
  source: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}



// Database types (re-exported from db module)
export type { DatabaseConnection } from './db.js';
export type { ContentChunk as ChunkResult } from './db.js';

// Re-export generation types for convenience (experimental)
export type { 
  GenerationRequest, 
  GenerationResult, 
  GenerateFunction,
  ResponseGenerator,
  GeneratorModelInfo
} from './response-generator.js';