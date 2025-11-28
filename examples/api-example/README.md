# RAG-lite API Example

A comprehensive example demonstrating how to use the RAG-lite TypeScript API with the new factory pattern and unified content system.

## What This Example Does

This example demonstrates the complete RAG-lite workflow using the new clean architecture:

1. **Factory Pattern API**: Simple, powerful factory methods for common use cases
   - Use `SearchFactory.create()` and `IngestionFactory.create()` for easy setup
   - Automatic model loading, database initialization, and dependency injection
   - Search factory auto-detects mode and configuration from database (Chameleon Architecture)

2. **Simple Constructor API**: Clean, intuitive constructors for basic usage
   - Create instances with `new SearchEngine()` and `new IngestionPipeline()`
   - Lazy initialization handles complex setup automatically
   - Progressive disclosure from simple to advanced usage

3. **Unified Content System**: Seamless handling of different content types
   - Automatic content type detection and processing
   - Efficient storage with deduplication and cleanup
   - Support for both file-based and memory-based content ingestion

The new architecture provides clean separation between simple usage patterns and advanced customization while maintaining high performance and local-first principles.

## Running the Example

```bash
# Run the complete example (factory + simple API + content system)
node index.js

# Or use npm scripts
npm start

# Clean run (removes existing database and index files first)
npm run clean

# Run specific examples
npm run factory-example    # Factory pattern usage
npm run simple-api        # Simple constructor API
npm run content-system    # Unified content system features
```

## Expected Output

The example demonstrates three key API patterns:

### 1. Factory Pattern API
- Uses `SearchFactory.create()` and `IngestionFactory.create()` for easy setup
- Handles complex initialization automatically (model loading, database setup)
- Search factory auto-detects mode and configuration from database
- Shows proper resource cleanup

### 2. Simple Constructor API
- Uses `new SearchEngine()` and `new IngestionPipeline()` for basic usage
- Demonstrates lazy initialization (setup happens on first use)
- Shows progressive disclosure from simple to advanced usage
- Maintains clean, intuitive constructor signatures

### 3. Unified Content System
- Demonstrates memory-based content ingestion alongside file-based
- Shows automatic content type detection and processing
- Illustrates content deduplication and storage management
- Displays format adaptation for different client types

Each example includes sample search queries with relevance scores, content sources, and system statistics.

## Key API Components

### Factory Pattern API (Recommended)
```javascript
// Create ingestion pipeline with factory
const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  chunkSize: 512,
  chunkOverlap: 50
});

// Create search engine with factory (auto-detects mode and configuration)
const search = await SearchFactory.create('./index.bin', './db.sqlite');

// Create complete RAG system
const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin');
const search = await SearchFactory.create('./index.bin', './db.sqlite');
```

### Simple Constructor API
```javascript
// Simple ingestion pipeline
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
});

// Simple search engine
const searchEngine = new SearchEngine('./index.bin', './db.sqlite', {
  enableReranking: false // Fast mode
});

// Lazy initialization happens automatically on first use
```

### Unified Content System
```javascript
// Memory-based content ingestion
await pipeline.ingestMemoryContent('Content text', {
  title: 'Document Title',
  source: 'memory://custom-id'
});

// File-based content ingestion
await pipeline.ingestDirectory('./documents/');

// Mixed content search works seamlessly
const results = await searchEngine.search('query');
```

### Search Results Structure
```javascript
interface SearchResult {
  content: string;        // Text content or processed content
  score: number;          // Relevance score (0-1, higher is better)
  contentType: string;    // Content type: "text", "markdown", "pdf", etc.
  document: {
    id: number;           // Document ID
    source: string;       // File path or memory reference
    title: string;        // Document title or filename
    contentType: string;  // Document content type
  };
  metadata?: {            // Content-specific metadata
    chunkIndex?: number;
    processingMethod?: string;
    originalPath?: string;
    fileSize?: number;
    // Additional metadata based on content type
  };
}
```

### Factory Options Structure
```javascript
interface IngestionFactoryOptions {
  embeddingModel?: string;     // Override embedding model
  batchSize?: number;          // Embedding batch size
  chunkSize?: number;          // Text chunk size
  chunkOverlap?: number;       // Chunk overlap
  forceRebuild?: boolean;      // Force index rebuild
  contentSystemConfig?: {      // Content system options
    maxFileSize?: number;
    enableDeduplication?: boolean;
    enableStorageTracking?: boolean;
  };
}
```

## Sample Search Queries

### Factory Pattern Queries
Try these queries with the factory-created engines:

- **Installation**: "npm install", "getting started", "quick start"
- **API Usage**: "factory pattern", "SearchFactory", "IngestionFactory"
- **Configuration**: "embedding models", "mode detection", "batch size"
- **Performance**: "optimization", "memory usage", "speed"

### Simple API Queries
Try these queries with constructor-created engines:

- **Basic Usage**: "simple constructor", "lazy initialization", "basic setup"
- **Documentation**: "TypeScript usage", "API reference", "examples"
- **Features**: "local first", "semantic search", "content system"

### Content System Queries
Try these queries to test mixed content types:

- **Memory Content**: "factory pattern", "local-first system", "content system"
- **File Content**: "documentation", "installation guide", "configuration"
- **Mixed Search**: Queries that match both memory and file content

### Search Options
```javascript
// Basic search
const results = await searchEngine.search("query");

// Search with options
const results = await searchEngine.search("query", { 
  top_k: 5,
  rerank: true 
});

// Get system statistics
const stats = await searchEngine.getStats();
console.log(`Total chunks: ${stats.totalChunks}`);
```

## Files Created

After running this example, you'll see:
- `factory-db.sqlite` / `factory-index.bin` - Factory pattern example files
- `simple-db.sqlite` / `simple-index.bin` - Simple API example files  
- `content-db.sqlite` / `content-index.bin` - Content system example files
- `rag-db.sqlite` / `rag-index.bin` - RAG factory example files

## Configuration Examples

### Factory Configuration
```javascript
// Ingestion factory with custom options
const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  chunkSize: 512,
  chunkOverlap: 50,
  batchSize: 16
});

// Search factory auto-detects mode and configuration from database
const search = await SearchFactory.create('./index.bin', './db.sqlite');
```

### Simple Constructor Configuration
```javascript
// Simple ingestion pipeline
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  chunkSize: 256
});

// Simple search engine (fast mode)
const search = new SearchEngine('./index.bin', './db.sqlite', {
  enableReranking: false
});
```

### Content System Configuration
```javascript
// Pipeline with content system options
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  contentSystemConfig: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    enableDeduplication: true,
    enableStorageTracking: true
  }
});
```

## Supported File Types

The unified content system supports:
- `.md` - Markdown documents
- `.txt` - Plain text files
- `.pdf` - PDF documents (with text extraction)
- `.docx` - Word documents (with text extraction)
- Memory-based content (programmatic ingestion)

## Next Steps

- Try indexing your own documents by placing them in the `./docs/` folder
- Experiment with different embedding models and configuration options
- Test memory-based content ingestion with your own programmatic content
- Explore the CLI commands for batch processing: `raglite ingest` and `raglite search`
- Check out the MCP server integration for tool-based usage: `raglite-mcp`
- Review the main documentation for comprehensive API reference and architecture details
- Try the individual example scripts to focus on specific API patterns