/**
 * CORE MODULE — Universal Embedder Interface for Chameleon Architecture
 * Model-agnostic interfaces supporting both text and multimodal models
 * Designed for runtime polymorphism and extensibility
 */

import type { EmbeddingResult } from '../types.js';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * Universal embedder interface supporting both text and multimodal models
 * Provides a consistent API across different model types and content types
 */
export interface UniversalEmbedder {
  // Model identification and metadata
  readonly modelName: string;
  readonly modelType: ModelType;
  readonly dimensions: number;
  readonly supportedContentTypes: readonly string[];
  
  // Core embedding methods
  embedText(text: string): Promise<EmbeddingResult>;
  embedImage?(imagePath: string): Promise<EmbeddingResult>;
  embedBatch(items: EmbeddingBatchItem[]): Promise<EmbeddingResult[]>;
  
  // Model lifecycle management
  loadModel(): Promise<void>;
  isLoaded(): boolean;
  getModelInfo(): ModelInfo;
  cleanup(): Promise<void>;
}

/**
 * Enhanced embedding result with content type and metadata support
 * Extends the existing EmbeddingResult interface for multimodal compatibility
 */
export interface EnhancedEmbeddingResult extends EmbeddingResult {
  contentType: string;
  metadata?: Record<string, any>;
}

/**
 * Batch embedding item for efficient processing
 */
export interface EmbeddingBatchItem {
  content: string;
  contentType: string;
  metadata?: Record<string, any>;
}

/**
 * Model information interface for runtime introspection
 */
export interface ModelInfo {
  name: string;
  type: ModelType;
  dimensions: number;
  version: string;
  supportedContentTypes: readonly string[];
  capabilities: ModelCapabilities;
  requirements: ModelRequirements;
}

/**
 * Model capabilities for feature detection
 */
export interface ModelCapabilities {
  supportsText: boolean;
  supportsImages: boolean;
  supportsBatchProcessing: boolean;
  supportsMetadata: boolean;
  maxBatchSize?: number;
  maxTextLength?: number;
  supportedImageFormats?: readonly string[];
}

/**
 * Model requirements for validation and compatibility checking
 */
export interface ModelRequirements {
  transformersJsVersion: string;
  minimumMemory?: number;
  requiredFeatures?: readonly string[];
  platformSupport?: readonly string[];
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Supported model types in the Chameleon architecture
 */
export type ModelType = 'sentence-transformer' | 'clip';

/**
 * Content types supported by the system
 */
export type ContentType = 'text' | 'image' | 'pdf' | 'docx';

/**
 * Model validation result for compatibility checking
 */
export interface ModelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// EMBEDDER CREATION FUNCTION TYPE
// =============================================================================

/**
 * Simple embedder creation function type
 * Replaces complex factory patterns with a straightforward function approach
 */
export type CreateEmbedderFunction = (
  modelName: string,
  options?: EmbedderCreationOptions
) => Promise<UniversalEmbedder>;

/**
 * Options for creating embedder instances
 */
export interface EmbedderCreationOptions {
  cachePath?: string;
  maxBatchSize?: number;
  timeout?: number;
  enableGPU?: boolean;
  customConfig?: Record<string, any>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Model validation error for unsupported or incompatible models
 */
export class ModelValidationError extends Error {
  constructor(
    public readonly modelName: string,
    public readonly availableModels: readonly string[],
    message: string
  ) {
    super(message);
    this.name = 'ModelValidationError';
  }
}

/**
 * Transformers.js compatibility error for version mismatches
 */
export class TransformersCompatibilityError extends Error {
  constructor(
    public readonly modelName: string,
    public readonly requiredVersion: string,
    public readonly currentVersion: string,
    message: string
  ) {
    super(message);
    this.name = 'TransformersCompatibilityError';
  }
}

/**
 * Content type error for unsupported content types
 */
export class ContentTypeError extends Error {
  constructor(
    public readonly contentType: string,
    public readonly supportedTypes: readonly string[],
    message: string
  ) {
    super(message);
    this.name = 'ContentTypeError';
  }
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Type guard for checking if an embedder supports images
 */
export function supportsImages(embedder: UniversalEmbedder): embedder is UniversalEmbedder & {
  embedImage(imagePath: string): Promise<EmbeddingResult>;
} {
  return embedder.supportedContentTypes.includes('image') && 
         typeof embedder.embedImage === 'function';
}

/**
 * Type guard for checking if an embedder supports a specific content type
 */
export function supportsContentType(
  embedder: UniversalEmbedder, 
  contentType: string
): boolean {
  return embedder.supportedContentTypes.includes(contentType);
}

/**
 * Utility function to create enhanced embedding results
 */
export function createEnhancedEmbeddingResult(
  embeddingId: string,
  vector: Float32Array,
  contentType: string,
  metadata?: Record<string, any>
): EnhancedEmbeddingResult {
  return {
    embedding_id: embeddingId,
    vector,
    contentType,
    metadata
  };
}

/**
 * Utility function to validate content type against supported types
 */
export function validateContentType(
  contentType: string,
  supportedTypes: readonly string[]
): void {
  if (!supportedTypes.includes(contentType)) {
    throw new ContentTypeError(
      contentType,
      supportedTypes,
      `Content type '${contentType}' is not supported. Supported types: ${supportedTypes.join(', ')}`
    );
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default supported content types for different model types
 */
export const DEFAULT_CONTENT_TYPES: Record<ModelType, readonly string[]> = {
  'sentence-transformer': ['text'] as const,
  'clip': ['text', 'image'] as const
} as const;

/**
 * Default model capabilities for different model types
 */
export const DEFAULT_CAPABILITIES: Record<ModelType, ModelCapabilities> = {
  'sentence-transformer': {
    supportsText: true,
    supportsImages: false,
    supportsBatchProcessing: true,
    supportsMetadata: true,
    maxBatchSize: 32,
    maxTextLength: 512
  },
  'clip': {
    supportsText: true,
    supportsImages: true,
    supportsBatchProcessing: true,
    supportsMetadata: true,
    maxBatchSize: 16,
    maxTextLength: 77,
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
  }
} as const;