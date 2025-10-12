// Text implementation layer exports
export { 
  EmbeddingEngine, 
  getEmbeddingEngine, 
  initializeEmbeddingEngine,
  createTextEmbedFunction,
  createTextEmbedder
} from './embedder.js';
export { 
  CrossEncoderReranker, 
  createTextRerankFunction, 
  createTextReranker 
} from './reranker.js';
export { countTokens, getTokenizer, resetTokenizer } from './tokenizer.js';
export { chunkDocument, type Chunk, type Document } from '../core/chunker.js';
export { type ChunkConfig } from '../core/chunker.js';

// Re-export preprocessors
export * from './preprocessors/index.js';