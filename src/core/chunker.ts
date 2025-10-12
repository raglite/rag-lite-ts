/**
 * CORE MODULE — Shared between text-only (rag-lite-ts) and future multimodal (rag-lite-mm)
 * Model-agnostic. No transformer or modality-specific logic.
 */

/**
 * Configuration for chunking behavior
 */
export interface ChunkConfig {
  /** Target chunk size in tokens (200-300 recommended) */
  chunkSize: number;
  /** Overlap between chunks in tokens (50 recommended) */
  chunkOverlap: number;
}

/**
 * Generic document interface that can represent different content types
 */
export interface GenericDocument {
  /** Source path or identifier */
  source: string;
  /** Document title */
  title: string;
  /** Content (text, image path, etc.) */
  content: string;
  /** Content type identifier (text, image, etc.) */
  contentType: string;
  /** Optional metadata for the document */
  metadata?: Record<string, any>;
}

/**
 * Generic chunk interface that can represent different content types
 */
export interface GenericChunk {
  /** The content of the chunk (text, image path, etc.) */
  content: string;
  /** Content type identifier (text, image, etc.) */
  contentType: string;
  /** Index of this chunk within the document */
  chunkIndex: number;
  /** Optional metadata for the chunk */
  metadata?: Record<string, any>;
}

/**
 * Strategy interface for chunking different content types
 */
export interface ChunkingStrategy {
  /**
   * Check if this strategy applies to the given content type
   */
  appliesTo(contentType: string): boolean;

  /**
   * Chunk a document using this strategy
   */
  chunk(document: GenericDocument, config: ChunkConfig): Promise<GenericChunk[]>;
}

/**
 * Registry for chunking strategies
 */
export class ChunkingStrategyRegistry {
  private strategies: ChunkingStrategy[] = [];

  /**
   * Register a chunking strategy
   */
  register(strategy: ChunkingStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Find the appropriate strategy for a content type
   */
  findStrategy(contentType: string): ChunkingStrategy | undefined {
    return this.strategies.find(strategy => strategy.appliesTo(contentType));
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): ChunkingStrategy[] {
    return [...this.strategies];
  }
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 250, // Target 200-300 tokens
  chunkOverlap: 50
};

/**
 * Global chunking strategy registry
 */
export const chunkingRegistry = new ChunkingStrategyRegistry();

/**
 * Generic chunking function that uses registered strategies
 */
export async function chunkGenericDocument(
  document: GenericDocument,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Promise<GenericChunk[]> {
  const strategy = chunkingRegistry.findStrategy(document.contentType);

  if (!strategy) {
    throw new Error(`No chunking strategy found for content type: ${document.contentType}`);
  }

  return strategy.chunk(document, config);
}

// ============================================================================
// TEXT-SPECIFIC INTERFACES
// These interfaces provide text-specific chunking functionality
// ============================================================================

/**
 * Document interface for text chunking
 */
export interface Document {
  /** Source path or identifier */
  source: string;
  /** Document title */
  title: string;
  /** Full text content */
  content: string;
}

/**
 * Chunk interface for text chunking results
 */
export interface Chunk {
  /** The text content of the chunk */
  text: string;
  /** Index of this chunk within the document */
  chunkIndex: number;
  /** Number of tokens in this chunk */
  tokenCount: number;
}

/**
 * Text document chunking function
 * Uses the text chunking strategy from the text implementation layer
 */
export async function chunkDocument(
  document: Document,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Promise<Chunk[]> {
  // Import the text chunker implementation dynamically to avoid circular dependencies
  const { chunkDocument: textChunkDocument } = await import('../text/chunker.js');
  return textChunkDocument(document, config);
}
/**
 * Register the text chunking strategy with the global registry
 * This should be called during application initialization
 */
export async function registerTextChunkingStrategy(): Promise<void> {
  const { TextChunkingStrategy } = await import('../text/chunker.js');
  const textStrategy = new TextChunkingStrategy();
  chunkingRegistry.register(textStrategy);
}

// Auto-register the text strategy when this module is loaded
// This ensures text chunking works out of the box
registerTextChunkingStrategy().catch(error => {
  console.warn('Failed to register text chunking strategy:', error);
});