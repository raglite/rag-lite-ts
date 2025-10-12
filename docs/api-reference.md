# API Reference

This document provides comprehensive documentation for RAG-lite TS APIs, focusing on the clean architecture with simple constructors and optional factory patterns.

## Table of Contents

- [Quick Start](#quick-start)
- [Main Classes](#main-classes)
  - [SearchEngine](#searchengine)
  - [IngestionPipeline](#ingestionpipeline)
- [Factory Pattern](#factory-pattern)
  - [SearchFactory](#searchfactory)
  - [IngestionFactory](#ingestionfactory)
  - [RAGFactory](#ragfactory)
- [Core Architecture](#core-architecture)
- [Configuration](#configuration)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Utility Functions](#utility-functions)

## Quick Start

*For most users - get started in minutes*

The fastest way to get started with RAG-lite TS using simple constructors:

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Initialize and ingest documents
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin');
await ingestion.ingestDirectory('./docs');

// Search your documents
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('your query');
```

### Configuration Options

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Custom model configuration
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true
});

// Ingestion with custom settings
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80
});
```

## Main Classes

*For application developers - the primary API*

These classes provide the main interface for RAG-lite TS functionality with simple, direct constructors that handle initialization automatically.

### SearchEngine

Performs semantic search over indexed documents with automatic initialization.

```typescript
class SearchEngine {
  constructor(indexPath: string, dbPath: string, options?: SearchEngineOptions);
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async getStats(): Promise<SearchStats>;
  async cleanup(): Promise<void>;
}
```

#### Constructor Parameters

- `indexPath` (string): Path to the vector index file (must exist)
- `dbPath` (string): Path to the SQLite database file (must exist)
- `options` (SearchEngineOptions, optional): Configuration options

#### SearchEngineOptions

```typescript
interface SearchEngineOptions {
  embeddingModel?: string;        // Model name (auto-detected from database)
  batchSize?: number;             // Embedding batch size
  enableReranking?: boolean;      // Enable reranking (default: false)
  rerankingModel?: string;        // Reranking model name
  // Advanced: Custom functions for dependency injection
  embedFn?: EmbedFunction;        // Custom embedding function
  rerankFn?: RerankFunction;      // Custom reranking function
}
```

#### Methods

##### `search(query, options?)`

Performs semantic search over indexed documents.

**Parameters:**
- `query` (string): Search query text
- `options` (SearchOptions, optional): Search configuration

**Returns:** `Promise<SearchResult[]>` - Array of search results ordered by relevance

**Example:**
```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('machine learning', { 
  top_k: 5, 
  rerank: true 
});

console.log(results);
// [
//   {
//     content: "Machine learning is a subset of artificial intelligence...",
//     score: 0.85,
//     document: { 
//       id: 1, 
//       source: "ml-guide.md", 
//       title: "ML Guide"
//     }
//   }
// ]
```

##### `getStats()`

Gets statistics about the search engine and indexed content.

**Returns:** `Promise<SearchStats>` - Statistics object

**Example:**
```typescript
const stats = await search.getStats();
console.log(`Indexed ${stats.totalChunks} chunks from ${stats.totalDocuments} documents`);
console.log(`Reranking: ${stats.rerankingEnabled ? 'enabled' : 'disabled'}`);
```

##### `cleanup()`

Cleans up resources and closes connections.

**Returns:** `Promise<void>`

**Example:**
```typescript
// Always cleanup when done
await search.cleanup();
```

#### Complete Example

```typescript
import { SearchEngine } from 'rag-lite-ts';

// Basic usage
const search = new SearchEngine('./index.bin', './db.sqlite');

try {
  const results = await search.search('artificial intelligence');
  console.log(`Found ${results.length} results`);
  
  for (const result of results) {
    console.log(`${result.document.title}: ${result.score.toFixed(2)}`);
    console.log(result.content.substring(0, 100) + '...');
  }
} finally {
  await search.cleanup();
}
```

### IngestionPipeline

Handles document ingestion, processing, and indexing with automatic initialization.

```typescript
class IngestionPipeline {
  constructor(dbPath: string, indexPath: string, options?: IngestionPipelineOptions);
  
  async ingestDirectory(path: string, options?: IngestionOptions): Promise<IngestionResult>;
  async ingestFile(filePath: string, options?: IngestionOptions): Promise<IngestionResult>;
  async cleanup(): Promise<void>;
}
```

#### Constructor Parameters

- `dbPath` (string): Path to the SQLite database file (will be created if doesn't exist)
- `indexPath` (string): Path to the vector index file (will be created if doesn't exist)
- `options` (IngestionPipelineOptions, optional): Configuration options

#### IngestionPipelineOptions

```typescript
interface IngestionPipelineOptions {
  embeddingModel?: string;        // Model name (default: 'sentence-transformers/all-MiniLM-L6-v2')
  batchSize?: number;             // Embedding batch size
  chunkSize?: number;             // Chunk size in tokens (default: 250)
  chunkOverlap?: number;          // Overlap between chunks (default: 50)
  forceRebuild?: boolean;         // Force index rebuild (default: false)
}
```

#### Methods

##### `ingestDirectory(path, options?)`

Ingests all supported documents in a directory.

**Parameters:**
- `path` (string): Directory path to ingest
- `options` (IngestionOptions, optional): Ingestion configuration

**Returns:** `Promise<IngestionResult>` - Ingestion statistics and results

##### `ingestFile(filePath, options?)`

Ingests a single document.

**Parameters:**
- `filePath` (string): Path to the document to ingest
- `options` (IngestionOptions, optional): Ingestion configuration

**Returns:** `Promise<IngestionResult>` - Ingestion statistics and results

**Example:**
```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// Basic usage
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');

try {
  const result = await pipeline.ingestDirectory('./docs/');
  console.log(`Processed ${result.documentsProcessed} documents`);
  console.log(`Generated ${result.chunksCreated} chunks`);
} finally {
  await pipeline.cleanup();
}
```

##### `cleanup()`

Cleans up resources and closes connections.

**Returns:** `Promise<void>`

#### Complete Example

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// With configuration options
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80
});

try {
  // Ingest documents from directory
  const result = await pipeline.ingestDirectory('./documents');
  
  console.log('Ingestion Summary:');
  console.log(`- Documents processed: ${result.documentsProcessed}`);
  console.log(`- Chunks created: ${result.chunksCreated}`);
  console.log(`- Processing time: ${result.processingTimeMs}ms`);
  
  if (result.documentErrors > 0) {
    console.warn(`- Document errors: ${result.documentErrors}`);
  }
} finally {
  await pipeline.cleanup();
}
```

## Factory Pattern

*For advanced users and library authors*

Factory functions provide advanced initialization with automatic setup, smart defaults, and comprehensive error handling. Use these when:

- **Building libraries or frameworks** that use rag-lite-ts internally
- **Need automatic resource management** and cleanup on process exit
- **Require extensive error handling** and validation with detailed error messages
- **Working with complex deployment scenarios** where initialization might fail

**When to Use:**
- **Use constructors** for direct application usage (90% of cases)
- **Use factories** for library development, complex error handling, or automatic resource management

### SearchFactory

Creates and initializes search engines with automatic model loading and validation.

```typescript
class SearchFactory {
  static async create(
    indexPath: string, 
    dbPath: string, 
    options?: TextSearchOptions
  ): Promise<SearchEngine>;
  
  static async createWithDefaults(
    options?: TextSearchOptions
  ): Promise<SearchEngine>;
}
```

#### TextSearchOptions

```typescript
interface TextSearchOptions {
  embeddingModel?: string;        // Model name override
  batchSize?: number;             // Embedding batch size override
  rerankingModel?: string;        // Reranking model name override
  enableReranking?: boolean;      // Enable/disable reranking (default: false)
}
```

#### Example

```typescript
import { SearchFactory } from 'rag-lite-ts';

// Basic usage with comprehensive error handling
const search = await SearchFactory.create('./index.bin', './db.sqlite');
const results = await search.search('machine learning');

// Advanced configuration
const search = await SearchFactory.create('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true
});

// Use default paths from configuration
const search = await SearchFactory.createWithDefaults({
  enableReranking: false
});
```

### IngestionFactory

Creates and initializes ingestion pipelines with automatic model loading and directory setup.

```typescript
class IngestionFactory {
  static async create(
    dbPath: string,
    indexPath: string,
    options?: TextIngestionOptions
  ): Promise<IngestionPipeline>;
  
  static async createWithDefaults(
    options?: TextIngestionOptions
  ): Promise<IngestionPipeline>;
}
```

#### TextIngestionOptions

```typescript
interface TextIngestionOptions {
  embeddingModel?: string;        // Model name override
  batchSize?: number;             // Embedding batch size override
  chunkSize?: number;             // Chunk size override
  chunkOverlap?: number;          // Chunk overlap override
  forceRebuild?: boolean;         // Force rebuild of existing index
}
```

#### Example

```typescript
import { IngestionFactory } from 'rag-lite-ts';

// Basic usage with automatic directory creation
const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin');
await ingestion.ingestDirectory('./documents');

// Advanced configuration with force rebuild
const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80,
  forceRebuild: true
});
```

### RAGFactory

Creates complete RAG systems with both search and ingestion capabilities.

```typescript
class RAGFactory {
  static async createBoth(
    indexPath: string,
    dbPath: string,
    searchOptions?: TextSearchOptions,
    ingestionOptions?: TextIngestionOptions
  ): Promise<{
    searchEngine: SearchEngine;
    ingestionPipeline: IngestionPipeline;
  }>;
  
  static async createBothWithDefaults(
    searchOptions?: TextSearchOptions,
    ingestionOptions?: TextIngestionOptions
  ): Promise<{
    searchEngine: SearchEngine;
    ingestionPipeline: IngestionPipeline;
  }>;
}
```

#### Example

```typescript
import { RAGFactory } from 'rag-lite-ts';

// Create complete RAG system
const { searchEngine, ingestionPipeline } = await RAGFactory.createBoth(
  './index.bin',
  './db.sqlite'
);

// First, ingest some documents
await ingestionPipeline.ingestDirectory('./knowledge-base');

// Then search the ingested content
const results = await searchEngine.search('What is the main topic?');

// Clean up both instances
await Promise.all([
  searchEngine.cleanup(),
  ingestionPipeline.cleanup()
]);
```

## Core Architecture

*For library authors and custom implementations*

The core architecture provides low-level access to internal components for advanced use cases, custom implementations, and library development.

### Core Classes

#### CoreSearchEngine

Low-level search engine with explicit dependency injection.

```typescript
import { SearchEngine as CoreSearchEngine } from 'rag-lite-ts';

const coreSearch = new CoreSearchEngine(embedFn, indexManager, db, rerankFn);
```

#### CoreIngestionPipeline

Low-level ingestion pipeline with explicit dependency injection.

```typescript
import { IngestionPipeline as CoreIngestionPipeline } from 'rag-lite-ts';

const corePipeline = new CoreIngestionPipeline(embedFn, indexManager, db, chunkConfig);
```

### Text Implementations

#### Embedding Functions

```typescript
import { createTextEmbedFunction, createTextEmbedder } from 'rag-lite-ts';

// Create embedding function
const embedFn = createTextEmbedFunction('Xenova/all-mpnet-base-v2', 16);

// Create embedding engine directly
const embedder = createTextEmbedder('Xenova/all-mpnet-base-v2');
await embedder.loadModel();
```

#### Reranking Functions

```typescript
import { createTextRerankFunction, createTextReranker } from 'rag-lite-ts';

// Create reranking function
const rerankFn = createTextRerankFunction('cross-encoder/ms-marco-MiniLM-L-6-v2');

// Create reranker directly
const reranker = createTextReranker('cross-encoder/ms-marco-MiniLM-L-6-v2');
await reranker.loadModel();
```

### Custom Implementation Example

```typescript
import { 
  SearchEngine as CoreSearchEngine,
  createTextEmbedFunction,
  IndexManager,
  openDatabase
} from 'rag-lite-ts';

// Custom embedding function
const customEmbedFn = async (query: string) => {
  // Your custom embedding logic
  return {
    embedding_id: 'custom-' + Date.now(),
    vector: new Float32Array([/* your embeddings */])
  };
};

// Create core components
const db = await openDatabase('./db.sqlite');
const indexManager = new IndexManager('./index.bin', './db.sqlite', 384, 'custom-model');
await indexManager.initialize();

// Create search engine with custom embedding
const search = new CoreSearchEngine(customEmbedFn, indexManager, db);
```

## Configuration

### Global Configuration

```typescript
import { config, validateConfig, getModelDefaults } from 'rag-lite-ts';

// Get current config
console.log(config.embedding_model); // Current model

// Get model-specific defaults
const defaults = getModelDefaults('Xenova/all-mpnet-base-v2');
console.log(defaults.chunk_size); // 400 (optimized for this model)

// Validate custom config
const customConfig = validateConfig({
  embedding_model: 'Xenova/all-mpnet-base-v2',
  chunk_size: 300
});
```

### Model Defaults

```typescript
// Available models with optimized defaults
const models = {
  'sentence-transformers/all-MiniLM-L6-v2': {
    dimensions: 384,
    chunk_size: 250,
    chunk_overlap: 50,
    batch_size: 16
  },
  'Xenova/all-mpnet-base-v2': {
    dimensions: 768,
    chunk_size: 400,
    chunk_overlap: 80,
    batch_size: 8
  }
};
```

## Type Definitions

### Core Types

#### SearchResult

```typescript
interface SearchResult {
  content: string;                // Chunk text content
  score: number;                  // Similarity score (0-1)
  document: {
    id: number;                   // Document ID
    source: string;               // Document source path
    title: string;                // Document title
  };
}
```

#### SearchOptions

```typescript
interface SearchOptions {
  top_k?: number;                 // Number of results to return (default: 10)
  rerank?: boolean;               // Enable result reranking (default: false)
}
```

#### IngestionResult

```typescript
interface IngestionResult {
  documentsProcessed: number;     // Number of documents processed
  chunksCreated: number;          // Number of chunks created
  embeddingsGenerated: number;    // Number of embeddings generated
  documentErrors: number;         // Number of document processing errors
  embeddingErrors: number;        // Number of embedding errors
  processingTimeMs: number;       // Total processing time in milliseconds
}
```

#### Document

```typescript
interface Document {
  source: string;                 // File path or identifier
  title: string;                  // Document title
  content: string;                // Full document content
}
```

#### EmbeddingResult

```typescript
interface EmbeddingResult {
  embedding_id: string;           // Unique identifier
  vector: Float32Array;           // Embedding vector
}
```

### Configuration Types

#### CoreConfig

```typescript
interface CoreConfig {
  // Model settings
  embedding_model: string;
  
  // Processing settings
  chunk_size: number;
  chunk_overlap: number;
  batch_size: number;
  top_k: number;
  
  // File paths
  db_file: string;
  index_file: string;
  model_cache_path: string;
  
  // Features
  rerank_enabled: boolean;
}
```

## Error Handling

### Error Types

```typescript
import { 
  APIError,
  IngestionError,
  SearchError,
  ResourceError,
  ModelCompatibilityError
} from 'rag-lite-ts';
```

### Error Handling Patterns

```typescript
import { SearchEngine } from 'rag-lite-ts';

try {
  const search = new SearchEngine('./index.bin', './db.sqlite');
  const results = await search.search('query');
} catch (error) {
  if (error instanceof ModelCompatibilityError) {
    console.error('Model mismatch detected:', error.message);
    // Handle model compatibility issues
  } else if (error instanceof SearchError) {
    console.error('Search failed:', error.message);
    // Handle search-specific errors
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Utility Functions

### Database Operations

```typescript
import { 
  openDatabase, 
  initializeSchema,
  insertDocument,
  insertChunk,
  getChunksByEmbeddingIds
} from 'rag-lite-ts';

const db = await openDatabase('./my-docs.sqlite');
await initializeSchema(db);

const docId = await insertDocument(db, 'README.md', 'My Document', 'Content...');
```

### File Processing

```typescript
import { 
  discoverFiles,
  processFiles,
  discoverAndProcessFiles
} from 'rag-lite-ts';

const result = await discoverFiles('./docs/', { 
  recursive: true,
  extensions: ['.md', '.txt', '.mdx']
});

console.log(`Found ${result.files.length} files`);
```

### Tokenization

```typescript
import { countTokens } from 'rag-lite-ts';

const count = await countTokens('Hello world, this is a test.');
console.log(`Token count: ${count}`); // Token count: 8
```

### Path Management

```typescript
import { DocumentPathManager } from 'rag-lite-ts';

const pathManager = new DocumentPathManager('relative', '/project');
const storagePath = pathManager.toStoragePath('/project/docs/readme.md');
console.log(storagePath); // "docs/readme.md"
```

---

This API reference covers all aspects of RAG-lite TS from simple usage to advanced customization. Start with the [Quick Start](#quick-start) section and [Main Classes](#main-classes) for typical usage, then explore the [Factory Pattern](#factory-pattern) and [Core Architecture](#core-architecture) sections for advanced use cases.