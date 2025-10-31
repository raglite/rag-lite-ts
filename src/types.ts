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
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  embedding_id: string;
  vector: Float32Array;
  contentType?: string;
  metadata?: Record<string, any>;
}

// Enhanced embedding result for multimodal support
export interface EnhancedEmbeddingResult extends EmbeddingResult {
  contentType: string;
  metadata?: Record<string, any>;
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

// System information types for Chameleon architecture
export type ModeType = 'text' | 'multimodal';
export type ModelType = 'sentence-transformer' | 'clip';

// Re-export reranking types from core configuration
export type { RerankingStrategyType, RerankingConfig } from './core/reranking-config.js';

// Import types for use in interfaces
import type { RerankingStrategyType, RerankingConfig } from './core/reranking-config.js';

export interface SystemInfo {
  mode: ModeType;
  modelName: string;
  modelType: ModelType;
  modelDimensions: number;
  modelVersion: string;
  supportedContentTypes: string[];
  rerankingStrategy: RerankingStrategyType;
  rerankingModel?: string;
  rerankingConfig?: RerankingConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemInfoRow {
  id: number;
  mode: string;
  model_name: string;
  model_type: string;
  model_dimensions: number;
  model_version: string;
  supported_content_types: string;
  reranking_strategy: string;
  reranking_model?: string;
  reranking_config?: string;
  created_at: string;
  updated_at: string;
}

// Re-export database types for convenience
export type { DatabaseConnection, ContentChunk } from './core/db.js';

// Re-export universal embedder types for convenience
export type {
  UniversalEmbedder,
  ModelInfo,
  ModelCapabilities,
  ModelRequirements,
  EmbeddingBatchItem,
  ModelValidationResult,
  CreateEmbedderFunction,
  EmbedderCreationOptions,
  ContentType
} from './core/universal-embedder.js';