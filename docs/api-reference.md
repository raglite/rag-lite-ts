# API Reference

This document provides comprehensive documentation for RAG-lite TS APIs with **Chameleon Multimodal Architecture**, focusing on the clean architecture with simple constructors and polymorphic runtime capabilities.

## Table of Contents

- [Quick Start](#quick-start)
- [Main Classes](#main-classes)
  - [SearchEngine](#searchengine)
  - [IngestionPipeline](#ingestionpipeline)
- [Chameleon Architecture](#chameleon-architecture)
  - [UniversalEmbedder Interface](#universalembedder-interface)
  - [Polymorphic Factories](#polymorphic-factories)
  - [Mode Detection](#mode-detection)
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

// Initialize and ingest documents (text mode by default)
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin');
await ingestion.ingestDirectory('./docs');

// Search your documents (mode auto-detected from database)
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('your query');
```

### Configuration Options

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Text mode with custom model
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true
});

// Multimodal ingestion with CLIP model
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 400,
  chunkOverlap: 80
});
```

### Multimodal Mode Examples

#### Cross-Modal Search: Text Queries Finding Images

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Ingest mixed content in multimodal mode
const ingestion = new IngestionPipeline('./multimodal.sqlite', './multimodal.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32'
});

await ingestion.ingestDirectory('./content/'); // Contains text and images
await ingestion.cleanup();

// 2. Search for images using text descriptions
const search = new SearchEngine('./multimodal.bin', './multimodal.sqlite');
const results = await search.search('red sports car', { top_k: 5 });

// Filter to only image results
const imageResults = results.filter(r => r.contentType === 'image');

console.log('Images matching "red sports car":');
imageResults.forEach((result, i) => {
  console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
  console.log(`   Description: ${result.content}`);
  if (result.metadata?.dimensions) {
    console.log(`   Size: ${result.metadata.dimensions.width}x${result.metadata.dimensions.height}`);
  }
});

await search.cleanup();
```

#### Searching Across Both Text and Images

```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./multimodal.bin', './multimodal.sqlite');

// Search for content about ocean landscapes
const results = await search.search('blue ocean water landscape', {
  top_k: 10,
  rerank: true
});

// Separate by content type
const textResults = results.filter(r => r.contentType === 'text');
const imageResults = results.filter(r => r.contentType === 'image');

console.log(`Found ${textResults.length} text documents and ${imageResults.length} images`);

console.log('\nText Documents:');
textResults.forEach((result, i) => {
  console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
  console.log(`   ${result.content.substring(0, 100)}...`);
});

console.log('\nImages:');
imageResults.forEach((result, i) => {
  console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
  console.log(`   ${result.content}`);
});

await search.cleanup();
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
  async getContent(contentId: string, format?: 'file' | 'base64'): Promise<string>;
  async getContentBatch(requests: ContentRequest[]): Promise<ContentResult[]>;
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
  rerankingStrategy?: string;     // Reranking strategy for multimodal mode
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
  async ingestFromMemory(content: Buffer, metadata: MemoryContentMetadata): Promise<IngestionResult>;
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
  mode?: 'text' | 'multimodal';  // Processing mode (default: 'text')
  embeddingModel?: string;        // Model name (default: 'sentence-transformers/all-MiniLM-L6-v2')
  rerankingStrategy?: 'cross-encoder' | 'text-derived' | 'metadata' | 'hybrid' | 'disabled';
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

## Chameleon Architecture

*The polymorphic runtime system that adapts between text and multimodal modes*

The Chameleon Multimodal Architecture enables RAG-lite TS to seamlessly switch between text-only and multimodal processing modes based on configuration stored during ingestion. The system automatically detects the mode during search operations and creates appropriate implementations.

### UniversalEmbedder Interface

The unified interface for all embedding models, supporting both text and multimodal capabilities:

```typescript
interface UniversalEmbedder {
  // Model identification
  modelName: string;
  modelType: 'sentence-transformer' | 'clip';
  dimensions: number;
  supportedContentTypes: string[];
  
  // Core embedding methods
  embedText(text: string): Promise<EmbeddingResult>;
  embedImage?(imagePath: string): Promise<EmbeddingResult>;
  embedBatch(items: Array<{content: string, type: string}>): Promise<EmbeddingResult[]>;
  
  // Model lifecycle
  loadModel(): Promise<void>;
  isLoaded(): boolean;
  cleanup(): Promise<void>;
}
```

#### Creating Embedders

The UniversalEmbedder interface is used internally by the system. For most users, the simple constructor API is recommended:

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Simple API - embedders created automatically based on configuration
const search = new SearchEngine('./index.bin', './db.sqlite');
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/clip-vit-base-patch32'
});
```

**Advanced: Direct Embedder Creation**

```typescript
// Advanced usage - direct embedder creation (internal API)
import { createEmbedder } from 'rag-lite-ts';

const embedder = await createEmbedder('sentence-transformers/all-MiniLM-L6-v2');
const result = await embedder.embedText('Hello world');
```

#### Supported Models

**Text Mode Models:**
- `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, fast)
- `Xenova/all-mpnet-base-v2` (768 dimensions, higher quality)

**Multimodal Mode Models:**
- `Xenova/clip-vit-base-patch32` (512 dimensions, text + image)

### Polymorphic Factories

The system includes polymorphic factories for advanced use cases, but the main API uses simple constructors with automatic initialization:

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Main API - simple constructors with automatic mode detection
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query'); // Mode auto-detected from database

// Ingestion with mode specification
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32'
});
```

**Advanced: Direct Polymorphic Factory Usage**

```typescript
import { PolymorphicSearchFactory } from 'rag-lite-ts';

// Advanced usage - direct factory access
const search = await PolymorphicSearchFactory.create('./index.bin', './db.sqlite');
// Automatically detects mode and creates appropriate search engine
```

### Mode Detection

Mode detection happens automatically when using the main API. For advanced use cases, you can access the mode detection service directly:

```typescript
// Main API - mode detection is automatic
import { SearchEngine } from 'rag-lite-ts';
const search = new SearchEngine('./index.bin', './db.sqlite');
// Mode is automatically detected from database during search

// Advanced: Direct mode detection access
import { ModeDetectionService } from 'rag-lite-ts';

const modeService = new ModeDetectionService('./db.sqlite');
const systemInfo = await modeService.detectMode();
console.log(`Current mode: ${systemInfo.mode}`);
```

### Mode Selection Guide

Choose the right mode for your use case:

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// Text Mode - for text-only content
const textPipeline = new IngestionPipeline('./docs.sqlite', './docs.bin', {
  mode: 'text',
  embeddingModel: 'Xenova/all-mpnet-base-v2'
});

// Multimodal Mode - for text and images
const multimodalPipeline = new IngestionPipeline('./content.sqlite', './content.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32'
});
```

**Use Text Mode When:**
- You only have text documents
- You want the fastest performance for text search
- You don't need cross-modal capabilities
- You're using image-to-text conversion for images

**Use Multimodal Mode When:**
- You have both text and images
- You want to find images using text queries
- You want to find text using image descriptions
- You need semantic similarity across content types

### Reranking Strategies

Reranking is configured during ingestion and applied automatically during search:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Configure reranking during ingestion
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  rerankingStrategy: 'text-derived'
});

// Reranking is applied automatically during search
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query', { rerank: true });
```

#### Available Reranking Strategies

**Text Mode:**
- `cross-encoder` - Cross-encoder model reranking (default)

**Multimodal Mode:**
- `text-derived` - Convert images to text, then use cross-encoder (default)
- `metadata` - Filename and metadata-based scoring
- `hybrid` - Combine multiple scoring signals
- `disabled` - No reranking, vector similarity only

### Complete Multimodal Example

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Ingest mixed content (text + images) in multimodal mode
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived'
});

await ingestion.ingestDirectory('./mixed-content/');
await ingestion.cleanup();

// 2. Search automatically detects multimodal mode from database
const search = new SearchEngine('./index.bin', './db.sqlite');

// Search works for both text and image content
const results = await search.search('diagram showing architecture');

// Results include both text and image matches
for (const result of results) {
  console.log(`${result.document.source}: ${result.score.toFixed(2)}`);
  if (result.metadata?.contentType) {
    console.log(`Content type: ${result.metadata.contentType}`);
  }
}

await search.cleanup();
```

### Multimodal API Patterns

#### Visual Asset Management

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

class VisualAssetManager {
  private search: SearchEngine;
  
  async indexAssets(assetsPath: string) {
    const ingestion = new IngestionPipeline('./assets.sqlite', './assets.bin', {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'metadata', // Use filename-based matching
      batchSize: 4 // Conservative for large images
    });
    
    const result = await ingestion.ingestDirectory(assetsPath);
    await ingestion.cleanup();
    return result;
  }
  
  async findAssetsByDescription(description: string) {
    if (!this.search) {
      this.search = new SearchEngine('./assets.bin', './assets.sqlite');
    }
    
    const results = await this.search.search(description, {
      top_k: 20,
      rerank: true
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        filename: r.document.source.split('/').pop(),
        path: r.document.source,
        description: r.content,
        score: r.score,
        dimensions: r.metadata?.dimensions
      }));
  }
  
  async cleanup() {
    if (this.search) {
      await this.search.cleanup();
    }
  }
}

// Usage
const assetManager = new VisualAssetManager();
await assetManager.indexAssets('./images/');

const redCars = await assetManager.findAssetsByDescription('red sports car');
console.log('Found assets:');
redCars.forEach((asset, i) => {
  console.log(`${i + 1}. ${asset.filename} (${asset.score.toFixed(2)})`);
  if (asset.dimensions) {
    console.log(`   Size: ${asset.dimensions.width}x${asset.dimensions.height}`);
  }
});

await assetManager.cleanup();
```

#### Technical Documentation with Diagrams

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

class TechnicalDocsSearch {
  private search: SearchEngine;
  
  async ingestDocs(docsPath: string) {
    const ingestion = new IngestionPipeline('./tech-docs.sqlite', './tech-docs.bin', {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'text-derived',
      chunkSize: 300,
      chunkOverlap: 60
    });
    
    const result = await ingestion.ingestDirectory(docsPath);
    await ingestion.cleanup();
    return result;
  }
  
  async searchDocs(query: string) {
    if (!this.search) {
      this.search = new SearchEngine('./tech-docs.bin', './tech-docs.sqlite');
    }
    
    const results = await this.search.search(query, {
      top_k: 10,
      rerank: true
    });
    
    return {
      text: results.filter(r => r.contentType === 'text'),
      diagrams: results.filter(r => r.contentType === 'image')
    };
  }
  
  async findDiagrams(topic: string) {
    if (!this.search) {
      this.search = new SearchEngine('./tech-docs.bin', './tech-docs.sqlite');
    }
    
    const results = await this.search.search(`${topic} diagram`, {
      top_k: 8,
      rerank: true
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        filename: r.document.source.split('/').pop(),
        path: r.document.source,
        description: r.content,
        score: r.score
      }));
  }
  
  async cleanup() {
    if (this.search) {
      await this.search.cleanup();
    }
  }
}

// Usage
const techDocs = new TechnicalDocsSearch();
await techDocs.ingestDocs('./technical-docs/');

const authResults = await techDocs.searchDocs('authentication and authorization');
console.log(`Text sections: ${authResults.text.length}`);
console.log(`Diagrams: ${authResults.diagrams.length}`);

const architectureDiagrams = await techDocs.findDiagrams('system architecture');
console.log('\nArchitecture Diagrams:');
architectureDiagrams.forEach((diagram, i) => {
  console.log(`${i + 1}. ${diagram.filename} (${diagram.score.toFixed(2)})`);
});

await techDocs.cleanup();
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

## Unified Content System

*For MCP integration and memory-based content ingestion*

The unified content system enables memory-based content ingestion and format-adaptive retrieval, designed for MCP server integration and AI agent workflows.

### Memory Ingestion

Ingest content directly from memory buffers without requiring filesystem access:

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');

// Ingest content from memory (e.g., from MCP client)
const content = Buffer.from('Document content from AI agent');
const result = await pipeline.ingestFromMemory(content, {
  displayName: 'agent-document.txt',
  contentType: 'text/plain',
  originalPath: '/virtual/agent-content'
});

console.log(`Content ID: ${result.contentId}`);
console.log(`Storage type: ${result.storageType}`); // 'content_dir'
```

### Format-Adaptive Content Retrieval

Retrieve content in different formats based on client capabilities:

```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./index.bin', './db.sqlite');

// Search and get content IDs
const results = await search.search('query');
const contentId = results[0].contentId;

// For CLI clients - get file path
const filePath = await search.getContent(contentId, 'file');
console.log(`File available at: ${filePath}`);

// For MCP clients - get base64 content
const base64Content = await search.getContent(contentId, 'base64');
console.log(`Base64 content: ${base64Content.substring(0, 100)}...`);

// Batch retrieval for multiple items
const requests = [
  { contentId: 'id1', format: 'file' as const },
  { contentId: 'id2', format: 'base64' as const }
];
const batchResults = await search.getContentBatch(requests);
```

### Content Storage Strategy

The system uses a dual storage approach:

- **Filesystem references**: For file-based ingestion, stores references without copying
- **Content directory**: For memory-based ingestion, stores content with hash-based filenames
- **Deduplication**: Automatically detects and reuses identical content across both storage types

```typescript
// Filesystem ingestion - creates reference only
await pipeline.ingestFile('./document.pdf');

// Memory ingestion - stores in content directory
const buffer = await fs.readFile('./document.pdf');
await pipeline.ingestFromMemory(buffer, {
  displayName: 'document.pdf',
  contentType: 'application/pdf'
});

// Both approaches create searchable content with stable content IDs
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
  content: string;                // Chunk text content or image description
  score: number;                  // Similarity score (0-1)
  contentType: string;            // Content type ('text', 'image', etc.)
  document: {
    id: number;                   // Document ID
    source: string;               // Document source path
    title: string;                // Document title
    contentType: string;          // Document content type
  };
  metadata?: Record<string, any>; // Additional metadata (image dimensions, etc.)
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
  contentType: string;            // Content type ('text', 'image', etc.)
  metadata?: Record<string, any>; // Additional metadata
}
```

### Content System Types

#### Content Retrieval

```typescript
interface ContentRequest {
  contentId: string;
  format: 'file' | 'base64';
}

interface ContentResult {
  contentId: string;
  success: boolean;
  content?: string;
  error?: string;
}
```

#### Memory Ingestion

```typescript
interface MemoryContentMetadata {
  displayName: string;
  contentType?: string;
  originalPath?: string;
}

interface ContentIngestionResult {
  contentId: string;
  wasDeduped: boolean;
  storageType: 'filesystem' | 'content_dir';
  contentPath: string;
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

#### Multimodal Types

```typescript
interface SystemInfo {
  mode: 'text' | 'multimodal';
  modelName: string;
  modelType: 'sentence-transformer' | 'clip';
  modelDimensions: number;
  supportedContentTypes: string[];
  rerankingStrategy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ContentDocument {
  id: number;
  source: string;
  title: string;
  contentType: 'text' | 'image' | 'pdf' | 'docx';
  metadata: Record<string, any>;
  createdAt: Date;
}

interface ImageMetadata {
  originalPath: string;
  dimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  description?: string; // Generated by image-to-text model
}

type RerankingStrategyType = 
  | 'cross-encoder'    // Text cross-encoder (text mode default)
  | 'text-derived'     // Convert images to text, then use cross-encoder
  | 'metadata'         // Use file metadata for scoring
  | 'hybrid'           // Combine multiple signals
  | 'disabled';        // No reranking
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