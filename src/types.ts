// Type definitions for rag-lite-ts

export interface SearchResult {
  text: string;
  score: number;
  document: {
    id: number;
    source: string;
    title: string;
  };
}

export interface SearchOptions {
  top_k?: number;
  rerank?: boolean;
}

export interface Chunk {
  text: string;
  chunk_index: number;
}

export interface Document {
  source: string;
  title: string;
  content: string;
}

export interface EmbeddingResult {
  embedding_id: string;
  vector: Float32Array;
}

// Preprocessing types
export interface Preprocessor {
  appliesTo(language: string): boolean;
  process(content: string, options: PreprocessorOptions): string;
}

export interface PreprocessorOptions {
  mode: 'strip' | 'keep' | 'placeholder' | 'extract';
  [key: string]: any; // Additional preprocessor-specific options
}

export interface PreprocessingConfig {
  mode: 'strict' | 'balanced' | 'rich';
  overrides?: {
    mdx?: 'strip' | 'keep' | 'placeholder';
    mermaid?: 'strip' | 'extract' | 'placeholder';
    code?: 'strip' | 'keep' | 'placeholder';
  };
}

// Re-export database types for convenience
export type { DatabaseConnection, ChunkResult } from './db.js';