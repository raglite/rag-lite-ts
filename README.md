# RAG-lite TS
*Simple by default, powerful when needed*

A local-first TypeScript retrieval engine for semantic search over static documents with **Chameleon Multimodal Architecture**. Built to be simple to use, lightweight, and hackable with zero external run-time dependencies. Seamlessly adapts between text-only and multimodal modes based on your content.

![Pipeline](docs/assets/pipeline.jpg)

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [How It Works](#how-it-works)
- [Supported Models](#supported-models)
- [Documentation](#documentation)
- [MCP Server Integration](#mcp-server-integration)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

### Installation

```bash
npm install -g rag-lite-ts
```

### Basic Usage

```bash
# Ingest documents
raglite ingest ./docs/

# Search your documents
raglite search "machine learning concepts"

# Get more results with reranking
raglite search "API documentation" --top-k 10 --rerank
```

### Using Different Models

```bash
# Use higher quality model (auto-rebuilds if needed)
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed

# Search automatically uses the correct model
raglite search "complex query"
```

### Content Retrieval and MCP Integration

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Memory-based ingestion for AI agents
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');
const content = Buffer.from('Document from AI agent');
await pipeline.ingestFromMemory(content, {
  displayName: 'agent-document.txt'
});

// Format-adaptive content retrieval
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query');

// Get file path for CLI clients
const filePath = await search.getContent(results[0].contentId, 'file');

// Get base64 content for MCP clients
const base64 = await search.getContent(results[0].contentId, 'base64');
```

### Multimodal Search (Text + Images)

```bash
# Enable multimodal processing for text and image content
raglite ingest ./docs/ --mode multimodal

# Use different reranking strategies for multimodal content
raglite ingest ./docs/ --mode multimodal --rerank-strategy metadata

# Search works the same - mode is auto-detected
raglite search "diagram showing architecture"
```

### Programmatic Usage

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Initialize and ingest documents
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin');
await ingestion.ingestDirectory('./docs/');

// Search your documents
const search = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await search.search('machine learning', { top_k: 10 });
```

### Memory Ingestion & Unified Content System (NEW)

```typescript
// Ingest content directly from memory (perfect for MCP integration)
const content = Buffer.from('# AI Guide\n\nComprehensive AI concepts...');
const contentId = await ingestion.ingestFromMemory(content, {
  displayName: 'AI Guide.md',
  contentType: 'text/markdown'
});

// Retrieve content in different formats based on client needs
const filePath = await search.getContent(contentId, 'file');     // For CLI clients
const base64Data = await search.getContent(contentId, 'base64'); // For MCP clients

// Batch content retrieval for efficiency
const contentIds = ['id1', 'id2', 'id3'];
const contents = await search.getContentBatch(contentIds, 'base64');

// Content management with deduplication
const stats = await ingestion.getStorageStats();
console.log(`Content directory: ${stats.contentDirSize} bytes, ${stats.fileCount} files`);

// Cleanup orphaned content
const cleanupResult = await ingestion.cleanup();
console.log(`Removed ${cleanupResult.removedFiles} orphaned files`);
```

#### Configuration Options

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Custom model configuration
const search = new SearchEngine('./vector-index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true,
  topK: 15
});

// Ingestion with custom settings
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80
});
```

→ **[Complete CLI Reference](docs/cli-reference.md)** | **[API Documentation](docs/api-reference.md)**

## Features

- 📝 **Simple**: Get started with just `new SearchEngine()` - no complex setup required
- 🏠 **Local-first**: All processing happens offline on your machine
- 🚀 **Fast**: Sub-100ms queries for typical document collections
- 🔍 **Semantic**: Uses embeddings for meaning-based search, not just keywords
- 🦎 **Chameleon Architecture**: Polymorphic runtime that adapts between text and multimodal modes
- 🖼️ **Multimodal**: Search across text and image content with automatic mode detection
- 🧠 **Unified Content System**: Process content from filesystem or memory with automatic deduplication
- 🔄 **Format-Adaptive Retrieval**: Serve content as file paths (CLI) or base64 data (MCP) automatically
- 📦 **Content Management**: Built-in storage limits, cleanup operations, and orphaned file detection
- 🛠️ **Flexible**: Simple constructors for basic use, advanced options when you need them
- 📦 **Complete**: CLI, programmatic API, and MCP server in one package
- 🎯 **TypeScript**: Full type safety with modern ESM architecture
- 🧠 **Smart**: Automatic model management and compatibility checking

## How It Works

RAG-lite TS follows a simple pipeline:

1. **Document Ingestion**: Reads `.md`, `.txt`, `.mdx`, `.pdf`, `.docx` files, and images (`.jpg`, `.png`, `.gif`, `.webp`)
2. **Preprocessing**: Cleans content (JSX components, Mermaid diagrams, code blocks) and generates image descriptions
3. **Semantic Chunking**: Splits documents at natural boundaries with token limits
4. **Embedding Generation**: Uses transformers.js models for semantic vectors (text or multimodal)
5. **Vector Storage**: Fast similarity search with hnswlib-wasm
6. **Metadata Storage**: SQLite for document info, model compatibility, and mode persistence
7. **Search**: Embeds queries and finds similar chunks using cosine similarity
8. **Reranking** (optional): Multiple strategies including cross-encoder, text-derived, and metadata-based

### Chameleon Architecture

The system automatically adapts its behavior based on the mode stored during ingestion:

```
Documents → Mode Detection → Polymorphic Pipeline → Vector Index
                                     ↓
Query → Auto-Detect Mode → Appropriate Embedder → Vector Search → Results
```

**Text Mode Pipeline:**
```
Text Documents → Text Preprocessor → Sentence Transformer → HNSW Index
Query → Sentence Transformer → Vector Search → Cross-Encoder Reranking → Results
```

**Multimodal Mode Pipeline:**
```
Mixed Content → Content Router → CLIP Embedder + Image-to-Text → HNSW Index
Query → CLIP Text Encoder → Vector Search → Text-Derived Reranking → Results
```

→ **[Document Preprocessing Guide](docs/preprocessing.md)** | **[Model Management Details](models/README.md)**

## Supported Models

RAG-lite TS supports multiple embedding models with automatic optimization:

### Text Mode (Default)
| Model | Dimensions | Speed | Use Case |
|-------|------------|-------|----------|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Fast | General purpose (default) |
| `Xenova/all-mpnet-base-v2` | 768 | Slower | Higher quality, complex queries |

### Multimodal Mode (Text + Images)
| Model | Dimensions | Speed | Use Case |
|-------|------------|-------|----------|
| `Xenova/clip-vit-base-patch32` | 512 | Medium | Text and image understanding |

**Model Features:**
- **Automatic downloads**: Models cached locally on first use
- **Smart compatibility**: Detects model changes and prompts rebuilds
- **Offline support**: Pre-download for offline environments
- **Mode persistence**: Set once during ingestion, auto-detected during search
- **Reranking**: Multiple strategies including text-derived and metadata-based

→ **[Complete Model Guide](docs/model-guide.md)** | **[Performance Benchmarks](docs/EMBEDDING_MODELS_COMPARISON.md)**

## Documentation

### 📚 Getting Started
- **[CLI Reference](docs/cli-reference.md)** - Installation and basic usage
- **[API Reference](docs/api-reference.md)** - Simple constructors and programmatic usage
- **[Unified Content System](docs/unified-content-system.md)** - Memory ingestion and format-adaptive retrieval

### 🔧 Customization & Advanced Usage
- **[Configuration Guide](docs/configuration.md)** - Custom settings and options
- **[Model Selection Guide](docs/model-guide.md)** - Choose the right model for your needs
- **[Path Storage Strategies](docs/path-strategies.md)** - Document path management
- **[Document Preprocessing](docs/preprocessing.md)** - Content processing options

### 🛠️ Support
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Common issues and solutions
- **[Unified Content Troubleshooting](docs/unified-content-troubleshooting.md)** - Memory ingestion and content retrieval issues

### 📊 Technical References
- **[Embedding Models Comparison](docs/EMBEDDING_MODELS_COMPARISON.md)** - Detailed benchmarks
- **[Documentation Hub](docs/README.md)** - Complete documentation index

### Quick Links by User Type

| User Type | Start Here | Next Steps |
|-----------|------------|------------|
| **New Users** | [CLI Reference](docs/cli-reference.md) | [API Reference](docs/api-reference.md) |
| **App Developers** | [API Reference](docs/api-reference.md) | [Configuration Guide](docs/configuration.md) |
| **Performance Optimizers** | [Model Guide](docs/model-guide.md) | [Performance Benchmarks](docs/EMBEDDING_MODELS_COMPARISON.md) |
| **Production Deployers** | [Configuration Guide](docs/configuration.md) | [Path Strategies](docs/path-strategies.md) |
| **Troubleshooters** | [Troubleshooting Guide](docs/troubleshooting.md) | [Preprocessing Guide](docs/preprocessing.md) |

## MCP Server Integration

RAG-lite TS includes a Model Context Protocol (MCP) server for integration with AI agents.

```bash
# Start MCP server
raglite-mcp
```

**MCP Configuration:**
```json
{
  "mcpServers": {
    "rag-lite": {
      "command": "raglite-mcp",
      "args": []
    }
  }
}
```

**Available Tools:** `search_documents`, `ingest_documents`, `rebuild_index`, `get_stats`

→ **[Complete MCP Integration Guide](docs/cli-reference.md#mcp-server)**

## Development

### Building from Source

```bash
# Clone and setup
git clone https://github.com/your-username/rag-lite-ts.git
cd rag-lite-ts
npm install

# Build and link for development
npm run build
npm link  # Makes raglite/raglite-mcp available globally

# Run tests
npm test
npm run test:integration
```

### Project Structure

```
src/
├── index.ts              # Main exports and factory functions
├── search.ts             # Public SearchEngine API
├── ingestion.ts          # Public IngestionPipeline API
├── core/                 # Model-agnostic core layer
│   ├── search.ts         # Core search engine
│   ├── ingestion.ts      # Core ingestion pipeline
│   ├── db.ts             # SQLite operations
│   ├── config.ts         # Configuration system
│   └── types.ts          # Core type definitions
├── factories/            # Factory functions for easy setup
│   └── text-factory.ts   # Text-specific factories
├── text/                 # Text-specific implementations
│   ├── embedder.ts       # Text embedding generation
│   ├── reranker.ts       # Text reranking
│   └── tokenizer.ts      # Text tokenization
├── cli.ts                # CLI interface
├── mcp-server.ts         # MCP server
└── preprocessors/        # Content type processors

dist/                     # Compiled output
```

### Design Philosophy

**Simple by default, powerful when needed:**
- ✅ Simple constructors work immediately with sensible defaults
- ✅ Configuration options available when you need customization
- ✅ Advanced patterns available for complex use cases
- ✅ Clean architecture with minimal dependencies
- ✅ No ORMs or heavy frameworks - just TypeScript and SQLite
- ✅ Extensible design for future capabilities

This approach ensures that basic usage is effortless while providing the flexibility needed for advanced scenarios.



## Contributing

1. Fork the repository
2. Create a feature branch  
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

We welcome contributions that maintain our clean architecture principles while enhancing functionality and developer experience.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- **[transformers.js](https://github.com/xenova/transformers.js)** - Client-side ML models
- **[hnswlib](https://github.com/nmslib/hnswlib)** - Fast approximate nearest neighbor search
