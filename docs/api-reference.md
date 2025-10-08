# API Reference

This document provides comprehensive documentation for all public APIs in RAG-lite TS.

## Table of Contents

- [Core Classes](#core-classes)
  - [SearchEngine](#searchengine)
  - [IngestionPipeline](#ingestionpipeline)
  - [EmbeddingEngine](#embeddingengine)
- [Advanced Classes](#advanced-classes)
  - [VectorIndex](#vectorindex)
  - [IndexManager](#indexmanager)
  - [ResourceManager](#resourcemanager)
  - [CrossEncoderReranker](#crossencoderreranker)
- [Database Operations](#database-operations)
- [File Processing](#file-processing)
- [Preprocessing](#preprocessing)
- [Tokenization](#tokenization)
- [Configuration](#configuration)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Utility Functions](#utility-functions)

## Core Classes

### SearchEngine

The main class for performing semantic search over indexed documents.

```typescript
class SearchEngine {
  constructor(indexPath: string, dbPath: string, embedder?: EmbeddingEngine);
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async close(): Promise<void>;
}
```

#### Constructor Parameters

- `indexPath` (string): Path to the vector index file
- `dbPath` (string): Path to the SQLite database file  
- `embedder` (EmbeddingEngine, optional): Embedding engine instance. If not provided, will be auto-initialized

#### Methods

##### `search(query, options?)`

Performs semantic search over the indexed documents.

**Parameters:**
- `query` (string): Search query text
- `options` (SearchOptions, optional): Search configuration

**Returns:** `Promise<SearchResult[]>` - Array of search results ordered by relevance

**Example:**
```typescript
import { SearchEngine } from 'rag-lite-ts';

const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search('machine learning', { 
  top_k: 5, 
  rerank: true 
});

console.log(results);
// [
//   {
//     text: "Machine learning is a subset of artificial intelligence...",
//     score: 0.85,
//     document: { id: 1, source: "ml-guide.md", title: "ML Guide" }
//   }
// ]
```

##### `close()`

Closes the search engine and releases resources.

**Returns:** `Promise<void>`

### IngestionPipeline

Handles document ingestion, processing, and indexing.

```typescript
class IngestionPipeline {
  constructor(basePath: string, embedder: EmbeddingEngine, options?: IngestionOptions);
  
  async ingestDirectory(path: string): Promise<IngestionResult>;
  async ingestFile(filePath: string): Promise<IngestionResult>;
  async rebuildIndex(): Promise<void>;
  async close(): Promise<void>;
  
  // Path storage configuration
  setPathStorageStrategy(strategy: 'absolute' | 'relative', basePath?: string): void;
}
```

#### Constructor Parameters

- `basePath` (string): Base directory path for relative file resolution
- `embedder` (EmbeddingEngine): Embedding engine for generating vectors
- `options` (IngestionOptions, optional): Ingestion configuration

#### Methods

##### `ingestDirectory(path)`

Ingests all supported files from a directory.

**Parameters:**
- `path` (string): Directory path to ingest

**Returns:** `Promise<IngestionResult>` - Ingestion statistics

**Example:**
```typescript
import { IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./', embedder);

const result = await pipeline.ingestDirectory('./docs/');
console.log(`Processed ${result.documentsProcessed} documents`);
console.log(`Generated ${result.chunksGenerated} chunks`);
```

##### `ingestFile(filePath)`

Ingests a single file.

**Parameters:**
- `filePath` (string): Path to the file to ingest

**Returns:** `Promise<IngestionResult>` - Ingestion statistics

##### `rebuildIndex()`

Rebuilds the entire vector index from existing documents in the database.

**Returns:** `Promise<void>`

##### `setPathStorageStrategy(strategy, basePath?)`

Configures how document paths are stored in the database.

**Parameters:**
- `strategy` ('absolute' | 'relative'): Path storage strategy
- `basePath` (string, optional): Base directory for relative paths

**Returns:** `void`

**Example:**
```typescript
import { IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./', embedder);

// Configure for relative paths (portable)
pipeline.setPathStorageStrategy('relative', '/project/base');

// Configure for absolute paths (legacy)
pipeline.setPathStorageStrategy('absolute');

await pipeline.ingestDirectory('./docs/');
```

### EmbeddingEngine

Generates embeddings using transformers.js models.

```typescript
class EmbeddingEngine {
  constructor(modelName?: string, batchSize?: number);
  
  async loadModel(): Promise<void>;
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
  async embedSingle(text: string): Promise<EmbeddingResult>;
  getModelVersion(): string;
  getDimensions(): number;
  getBatchSize(): number;
}
```

#### Constructor Parameters

- `modelName` (string, optional): Hugging Face model name. Defaults to configuration value
- `batchSize` (number, optional): Batch size for processing. Defaults to model-optimized value

#### Methods

##### `loadModel()`

Loads the embedding model. Called automatically on first use.

**Returns:** `Promise<void>`

##### `embedBatch(texts)`

Generates embeddings for multiple texts efficiently.

**Parameters:**
- `texts` (string[]): Array of texts to embed

**Returns:** `Promise<EmbeddingResult[]>` - Array of embedding results

##### `embedSingle(text)`

Generates embedding for a single text.

**Parameters:**
- `text` (string): Text to embed

**Returns:** `Promise<EmbeddingResult>` - Single embedding result

**Example:**
```typescript
import { EmbeddingEngine } from 'rag-lite-ts';

const embedder = new EmbeddingEngine('sentence-transformers/all-MiniLM-L6-v2');
await embedder.loadModel();

const result = await embedder.embedSingle('Hello world');
console.log(result.embedding_id); // Unique identifier
console.log(result.vector.length); // 384 for MiniLM model
```

## Advanced Classes

### VectorIndex

Low-level vector similarity search using HNSW algorithm.

```typescript
class VectorIndex {
  constructor(options: VectorIndexOptions);
  
  async initialize(): Promise<void>;
  async addVector(id: string, vector: Float32Array): Promise<void>;
  async addVectors(vectors: Array<{ id: string; vector: Float32Array }>): Promise<void>;
  async search(queryVector: Float32Array, k: number): Promise<SearchResult>;
  async save(filePath: string): Promise<void>;
  async load(filePath: string): Promise<void>;
  getSize(): number;
}
```

#### Constructor Parameters

- `options` (VectorIndexOptions): Index configuration

**Example:**
```typescript
import { VectorIndex } from 'rag-lite-ts';

const index = new VectorIndex({
  dimensions: 384,
  maxElements: 100000,
  efConstruction: 200,
  M: 16
});

await index.initialize();
await index.addVector('doc1_chunk1', embedding.vector);
const results = await index.search(queryEmbedding, 10);
```

### IndexManager

Manages vector index lifecycle and statistics.

```typescript
class IndexManager {
  constructor(indexPath: string, dbConnection: DatabaseConnection);
  
  async initialize(dimensions: number, maxElements?: number): Promise<void>;
  async addEmbedding(embeddingId: string, vector: Float32Array): Promise<void>;
  async search(queryVector: Float32Array, k: number): Promise<string[]>;
  async save(): Promise<void>;
  async load(): Promise<void>;
  async getStats(): Promise<IndexStats>;
}
```

### ResourceManager

Handles automatic resource management and cleanup.

```typescript
class ResourceManager {
  static async getResources(config?: ResourceConfig): Promise<ManagedResources>;
  static async cleanup(key?: string): Promise<void>;
  static async cleanupAll(): Promise<void>;
}
```

**Example:**
```typescript
import { ResourceManager } from 'rag-lite-ts';

// Get managed resources (auto-cleanup on process exit)
const resources = await ResourceManager.getResources({
  dbPath: './custom.sqlite',
  indexPath: './custom-index.bin'
});

// Use resources
const results = await resources.indexManager.search(queryVector, 10);

// Manual cleanup (optional - happens automatically)
await ResourceManager.cleanup();
```

### CrossEncoderReranker

Reranks search results using a cross-encoder model for improved relevance.

```typescript
class CrossEncoderReranker {
  constructor(modelName?: string);
  
  async loadModel(): Promise<void>;
  async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]>;
}
```

### DocumentPathManager

Manages document path storage and resolution strategies.

```typescript
class DocumentPathManager {
  constructor(strategy: 'absolute' | 'relative', basePath: string);
  
  toStoragePath(absolutePath: string): string;
  toAbsolutePath(storagePath: string): string;
  getStrategy(): 'absolute' | 'relative';
  getBasePath(): string;
  withBasePath(newBasePath: string): DocumentPathManager;
  withStrategy(newStrategy: 'absolute' | 'relative', newBasePath?: string): DocumentPathManager;
}
```

#### Constructor Parameters

- `strategy` ('absolute' | 'relative'): Path storage strategy
- `basePath` (string): Base directory for relative path calculations

#### Methods

##### `toStoragePath(absolutePath)`

Converts an absolute file path to the storage format based on strategy.

**Parameters:**
- `absolutePath` (string): Absolute file path

**Returns:** `string` - Path to store in database

##### `toAbsolutePath(storagePath)`

Converts a storage path back to absolute path for file operations.

**Parameters:**
- `storagePath` (string): Path from database

**Returns:** `string` - Absolute file path

**Example:**
```typescript
import { DocumentPathManager } from 'rag-lite-ts';

// Create path manager for relative paths
const pathManager = new DocumentPathManager('relative', '/project');

// Convert absolute path to storage format
const storagePath = pathManager.toStoragePath('/project/docs/api/auth.md');
console.log(storagePath); // "docs/api/auth.md"

// Convert back to absolute path
const absolutePath = pathManager.toAbsolutePath('docs/api/auth.md');
console.log(absolutePath); // "/project/docs/api/auth.md"

// Create new manager with different base
const newManager = pathManager.withBasePath('/different/base');
```

## Database Operations

### Connection Management

#### `openDatabase(dbPath)`

Opens a SQLite database connection with promise-based interface.

**Parameters:**
- `dbPath` (string): Path to SQLite database file

**Returns:** `Promise<DatabaseConnection>` - Database connection object

**Example:**
```typescript
import { openDatabase, initializeSchema } from 'rag-lite-ts';

const db = await openDatabase('./my-docs.sqlite');
await initializeSchema(db);

// Use database operations
const docId = await insertDocument(db, 'README.md', 'My Document', 'Content...');
```

#### `initializeSchema(connection)`

Creates the required database tables and indexes.

**Parameters:**
- `connection` (DatabaseConnection): Database connection

**Returns:** `Promise<void>`

### Document Operations

#### `insertDocument(connection, source, title, content)`

Inserts a new document into the database.

**Parameters:**
- `connection` (DatabaseConnection): Database connection
- `source` (string): Document source path or identifier
- `title` (string): Document title
- `content` (string): Full document content

**Returns:** `Promise<number>` - Document ID

#### `upsertDocument(connection, source, title, content)`

Inserts or updates a document (based on source path).

**Parameters:**
- `connection` (DatabaseConnection): Database connection  
- `source` (string): Document source path or identifier
- `title` (string): Document title
- `content` (string): Full document content

**Returns:** `Promise<number>` - Document ID

### Chunk Operations

#### `insertChunk(connection, embeddingId, documentId, text, chunkIndex)`

Inserts a document chunk with its embedding reference.

**Parameters:**
- `connection` (DatabaseConnection): Database connection
- `embeddingId` (string): Unique embedding identifier
- `documentId` (number): Parent document ID
- `text` (string): Chunk text content
- `chunkIndex` (number): Chunk position within document

**Returns:** `Promise<void>`

#### `getChunksByEmbeddingIds(connection, embeddingIds)`

Retrieves chunks and their document metadata by embedding IDs.

**Parameters:**
- `connection` (DatabaseConnection): Database connection
- `embeddingIds` (string[]): Array of embedding identifiers

**Returns:** `Promise<ChunkResult[]>` - Array of chunks with document metadata

### Model Version Management

#### `getModelVersion(connection)`

Gets the stored embedding model version.

**Parameters:**
- `connection` (DatabaseConnection): Database connection

**Returns:** `Promise<string | null>` - Model version or null if not set

#### `setModelVersion(connection, modelVersion)`

Stores the embedding model version for compatibility checking.

**Parameters:**
- `connection` (DatabaseConnection): Database connection
- `modelVersion` (string): Model version string

**Returns:** `Promise<void>`

## File Processing

### File Discovery

#### `discoverFiles(path, options?)`

Discovers supported files in a path (file or directory).

**Parameters:**
- `path` (string): File or directory path
- `options` (FileProcessorOptions, optional): Discovery options

**Returns:** `Promise<FileDiscoveryResult>` - Discovery results with file list and errors

**Example:**
```typescript
import { discoverFiles } from 'rag-lite-ts';

const result = await discoverFiles('./docs/', { 
  recursive: true,
  extensions: ['.md', '.txt', '.mdx']
});

console.log(`Found ${result.files.length} files`);
result.errors.forEach(error => console.warn(error));
```

#### `processFiles(filePaths)`

Processes discovered files into Document objects.

**Parameters:**
- `filePaths` (string[]): Array of file paths to process

**Returns:** `Promise<DocumentProcessingResult>` - Processing results with documents and errors

#### `discoverAndProcessFiles(path, options?)`

Combines file discovery and processing in one operation.

**Parameters:**
- `path` (string): File or directory path
- `options` (FileProcessorOptions, optional): Processing options

**Returns:** `Promise<DocumentProcessingResult>` - Processing results

## Preprocessing

### Document Preprocessing

#### `preprocessDocument(content, filePath, config?)`

Preprocesses document content based on file type and configuration.

**Parameters:**
- `content` (string): Raw document content
- `filePath` (string): File path (used to determine processing rules)
- `config` (PreprocessingConfig, optional): Preprocessing configuration

**Returns:** `string` - Processed content

**Example:**
```typescript
import { preprocessDocument } from 'rag-lite-ts';

const mdxContent = `
# My Component

<MyButton onClick={handler}>Click me</MyButton>

Regular markdown content here.
`;

const processed = preprocessDocument(mdxContent, 'component.mdx', {
  mode: 'balanced',
  overrides: { mdx: 'placeholder' }
});

console.log(processed);
// # My Component
// 
// [component removed]
// 
// Regular markdown content here.
```

#### `getPreprocessingStats(originalContent, processedContent)`

Gets statistics about preprocessing changes for debugging.

**Parameters:**
- `originalContent` (string): Original content
- `processedContent` (string): Processed content

**Returns:** `object` - Statistics object with character counts and reduction percentage

## Tokenization

#### `countTokens(text)`

Counts tokens in text using the configured tokenizer.

**Parameters:**
- `text` (string): Text to tokenize

**Returns:** `Promise<number>` - Token count

**Example:**
```typescript
import { countTokens } from 'rag-lite-ts';

const count = await countTokens('Hello world, this is a test.');
console.log(`Token count: ${count}`); // Token count: 8
```

#### `DocumentPathManager`

Utility class for managing document path storage strategies.

**Example:**
```typescript
import { DocumentPathManager } from 'rag-lite-ts';

const pathManager = new DocumentPathManager('relative', '/project');
const storagePath = pathManager.toStoragePath('/project/docs/readme.md');
console.log(storagePath); // "docs/readme.md"
```

## Configuration

### Configuration Management

#### `config`

Global configuration object with current settings.

**Type:** `Config`

#### `validateConfig(userConfig?)`

Validates and merges user configuration with defaults.

**Parameters:**
- `userConfig` (Partial\<Config\>, optional): User configuration overrides

**Returns:** `Config` - Validated configuration object

#### `getModelDefaults(modelName)`

Gets optimized default settings for a specific model.

**Parameters:**
- `modelName` (string): Embedding model name

**Returns:** `Partial<Config>` - Model-specific defaults

**Example:**
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

## Type Definitions

### Core Types

#### `SearchResult`

```typescript
interface SearchResult {
  text: string;           // Chunk text content
  score: number;          // Similarity score (0-1)
  document: {
    id: number;           // Document ID
    source: string;       // Document source path
    title: string;        // Document title
  };
}
```

#### `SearchOptions`

```typescript
interface SearchOptions {
  top_k?: number;         // Number of results to return (default: 10)
  rerank?: boolean;       // Enable result reranking (default: false)
}
```

#### `Document`

```typescript
interface Document {
  source: string;         // File path or identifier
  title: string;          // Document title
  content: string;        // Full document content
}
```

#### `Chunk`

```typescript
interface Chunk {
  text: string;           // Chunk text content
  chunk_index: number;    // Position within document
}
```

#### `EmbeddingResult`

```typescript
interface EmbeddingResult {
  embedding_id: string;   // Unique identifier
  vector: Float32Array;   // Embedding vector
}
```

### Configuration Types

#### `Config`

```typescript
interface Config {
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
  
  // Path storage
  path_storage_strategy: 'absolute' | 'relative';
  
  // Features
  rerank_enabled: boolean;
  
  // Preprocessing
  preprocessing: PreprocessingConfig;
}
```

#### `PreprocessingConfig`

```typescript
interface PreprocessingConfig {
  mode: 'strict' | 'balanced' | 'rich';
  overrides?: {
    mdx?: 'strip' | 'keep' | 'placeholder';
    mermaid?: 'strip' | 'extract' | 'placeholder';
    code?: 'strip' | 'keep' | 'placeholder';
  };
}
```

### File Processing Types

#### `FileProcessorOptions`

```typescript
interface FileProcessorOptions {
  recursive?: boolean;                    // Process subdirectories
  extensions?: string[];                  // File extensions to include
  maxFileSize?: number;                   // Maximum file size in bytes
  encoding?: string;                      // File encoding
}
```

#### `FileDiscoveryResult`

```typescript
interface FileDiscoveryResult {
  files: string[];                        // Successfully discovered files
  errors: string[];                       // Discovery errors
  totalSize: number;                      // Total size in bytes
}
```

#### `DocumentProcessingResult`

```typescript
interface DocumentProcessingResult {
  documents: Document[];                  // Successfully processed documents
  errors: string[];                       // Processing errors
  totalChunks: number;                    // Total chunks generated
}
```

### Advanced Types

#### `VectorIndexOptions`

```typescript
interface VectorIndexOptions {
  dimensions: number;                     // Vector dimensions
  maxElements: number;                    // Maximum vectors
  efConstruction?: number;                // HNSW construction parameter
  M?: number;                            // HNSW connectivity parameter
}
```

#### `IndexStats`

```typescript
interface IndexStats {
  totalVectors: number;                   // Number of vectors in index
  modelVersion: string;                   // Embedding model version
  dimensions: number;                     // Vector dimensions
}
```

#### `DatabaseConnection`

```typescript
interface DatabaseConnection {
  db: sqlite3.Database;                   // Raw SQLite database
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}
```

## Error Handling

### Error Classes

#### `APIError`

Base error class for all API-related errors.

```typescript
class APIError extends Error {
  constructor(message: string, public code?: string, public details?: any);
}
```

#### `SearchError`

Errors related to search operations.

```typescript
class SearchError extends APIError {
  constructor(message: string, suggestions?: string[]);
}
```

#### `IngestionError`

Errors related to document ingestion.

```typescript
class IngestionError extends APIError {
  constructor(message: string, suggestions?: string[]);
}
```

#### `ResourceError`

Errors related to resource management.

```typescript
class ResourceError extends APIError {
  constructor(message: string, resourceType?: string);
}
```

#### `ModelCompatibilityError`

Errors related to model compatibility issues.

```typescript
class ModelCompatibilityError extends APIError {
  constructor(currentModel: string, indexModel: string);
}
```

### Error Utilities

#### `handleAPIError(error)`

Handles and formats API errors with user-friendly messages.

**Parameters:**
- `error` (Error): Error to handle

**Returns:** `never` - Throws formatted error

#### `ErrorFactory`

Factory for creating specific error types.

```typescript
class ErrorFactory {
  static createSearchError(message: string, suggestions?: string[]): SearchError;
  static createIngestionError(message: string, suggestions?: string[]): IngestionError;
  static createResourceError(message: string, resourceType?: string): ResourceError;
  static createModelCompatibilityError(current: string, index: string): ModelCompatibilityError;
}
```

## Utility Functions

### Embedding Utilities

#### `getEmbeddingEngine(modelName?, batchSize?)`

Gets an embedding engine instance (cached or new).

**Parameters:**
- `modelName` (string, optional): Model name
- `batchSize` (number, optional): Batch size

**Returns:** `EmbeddingEngine` - Engine instance

#### `initializeEmbeddingEngine(modelName?, batchSize?)`

Gets and initializes an embedding engine.

**Parameters:**
- `modelName` (string, optional): Model name  
- `batchSize` (number, optional): Batch size

**Returns:** `Promise<EmbeddingEngine>` - Initialized engine

### High-Level Functions

#### `ingestDocuments(path, options?)`

High-level function for document ingestion with automatic resource management.

**Parameters:**
- `path` (string): Path to ingest
- `options` (IngestionOptions, optional): Ingestion options

**Returns:** `Promise<IngestionResult>` - Ingestion results

#### `rebuildIndex()`

High-level function for index rebuilding with automatic resource management.

**Returns:** `Promise<void>`

**Example:**
```typescript
import { ingestDocuments, rebuildIndex } from 'rag-lite-ts';

// Simple ingestion with automatic cleanup
const result = await ingestDocuments('./docs/', {
  fileOptions: { recursive: true }
});

console.log(`Processed ${result.documentsProcessed} documents`);

// Rebuild index if needed
await rebuildIndex();
```

## Usage Patterns

### Basic Usage

```typescript
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

// Initialize
const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./', embedder);
const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');

// Configure path storage (optional - defaults to relative)
pipeline.setPathStorageStrategy('relative', '/project/base');

// Ingest
await pipeline.ingestDirectory('./docs/');

// Search
const results = await searchEngine.search('machine learning');
// Results will include relative paths like "docs/api/auth.md"
```

### Advanced Usage with Resource Management

```typescript
import { ResourceManager, ingestDocuments } from 'rag-lite-ts';

// Automatic resource management
const resources = await ResourceManager.getResources();

// Use managed resources
const stats = await resources.indexManager.getStats();
console.log(`Index has ${stats.totalVectors} vectors`);

// Resources are automatically cleaned up on process exit
```

### Custom Configuration

```typescript
import { validateConfig, EmbeddingEngine, IngestionPipeline } from 'rag-lite-ts';

// Custom configuration
const config = validateConfig({
  embedding_model: 'Xenova/all-mpnet-base-v2',
  chunk_size: 300,
  path_storage_strategy: 'relative',
  preprocessing: {
    mode: 'rich',
    overrides: { mdx: 'keep' }
  }
});

// Use custom configuration
const embedder = new EmbeddingEngine(config.embedding_model, config.batch_size);
const pipeline = new IngestionPipeline('./', embedder);

// Apply path storage strategy from config
pipeline.setPathStorageStrategy(config.path_storage_strategy, './project');
```

This API reference covers all public APIs available in RAG-lite TS. For configuration details, see the [Configuration Guide](configuration.md).