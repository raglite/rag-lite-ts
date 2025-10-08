# RAG-lite TS
*A local-first, TypeScript-friendly retrieval engine*

A local-first TypeScript retrieval engine for semantic search over static documents. Built to be lightweight, modular, and hackable with zero external run-time dependencies.

![Pipeline](docs/assets/pipeline.jpg)

## Features

- 🏠 **Local-first**: All processing happens offline on your machine
- 🚀 **Fast**: Sub-100ms queries for typical document collections
- 📝 **Simple**: No ORMs, frameworks, or complex abstractions
- 🔍 **Semantic**: Uses embeddings for meaning-based search, not just keywords
- 🛠️ **Hackable**: Clear module boundaries and minimal dependencies
- 📦 **Dual Interface**: CLI + MCP server entry points in one package
- 🎯 **TypeScript**: Full type safety with ESM-only architecture
- 🧠 **Multi-Model**: Support for multiple embedding models with automatic compatibility checking

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Supported Models](#supported-models)
- [MCP Server Integration](#mcp-server-integration)
- [Documentation](#documentation)
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

### Programmatic Usage

```typescript
import { SearchEngine, IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

// Initialize and ingest
const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./data/', embedder);
await pipeline.ingestDirectory('./docs/');

// Search
const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search('machine learning', { top_k: 10 });
```

→ **[Complete CLI Reference](docs/cli-reference.md)** | **[API Documentation](docs/api-reference.md)**

## How It Works

RAG-lite TS follows a simple pipeline:

1. **Document Ingestion**: Reads `.md`, `.txt`, `.mdx`, `.pdf`, and `.docx` files
2. **Preprocessing**: Cleans content (JSX components, Mermaid diagrams, code blocks)
3. **Semantic Chunking**: Splits documents at natural boundaries with token limits
4. **Embedding Generation**: Uses transformers.js models for semantic vectors
5. **Vector Storage**: Fast similarity search with hnswlib-wasm
6. **Metadata Storage**: SQLite for document info and model compatibility
7. **Search**: Embeds queries and finds similar chunks using cosine similarity
8. **Reranking** (optional): Cross-encoder models for improved relevance

### Architecture

```
Documents → Preprocessor → Chunker → Embedder → Vector Index
                                        ↓
Query → Embedder → Vector Search → SQLite Lookup → Results
```

→ **[Document Preprocessing Guide](docs/preprocessing.md)** | **[Model Management Details](models/README.md)**

## Supported Models

RAG-lite TS supports multiple embedding models with automatic optimization:

| Model | Dimensions | Speed | Use Case |
|-------|------------|-------|----------|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Fast | General purpose (default) |
| `Xenova/all-mpnet-base-v2` | 768 | Slower | Higher quality, complex queries |

**Model Features:**
- **Automatic downloads**: Models cached locally on first use
- **Smart compatibility**: Detects model changes and prompts rebuilds
- **Offline support**: Pre-download for offline environments
- **Reranking**: Optional cross-encoder models for better relevance

→ **[Complete Model Guide](docs/model-guide.md)** | **[Performance Benchmarks](docs/EMBEDDING_MODELS_COMPARISON.md)**




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

## Documentation

### 📚 Core Guides
- **[CLI Reference](docs/cli-reference.md)** - Complete command-line documentation
- **[API Reference](docs/api-reference.md)** - Programmatic usage and types
- **[Configuration Guide](docs/configuration.md)** - Advanced configuration options

### 🔧 Specialized Guides  
- **[Model Selection Guide](docs/model-guide.md)** - Embedding models and performance
- **[Path Storage Strategies](docs/path-strategies.md)** - Document path management
- **[Document Preprocessing](docs/preprocessing.md)** - Content processing options
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Common issues and solutions

### 📊 Technical References
- **[Embedding Models Comparison](docs/EMBEDDING_MODELS_COMPARISON.md)** - Detailed benchmarks
- **[Documentation Hub](docs/README.md)** - Complete documentation index

### Quick Links by Use Case

| Use Case | Primary Guide | Supporting Guides |
|----------|---------------|-------------------|
| **Getting Started** | [CLI Reference](docs/cli-reference.md) | [Configuration](docs/configuration.md) |
| **Model Selection** | [Model Guide](docs/model-guide.md) | [Performance Benchmarks](docs/EMBEDDING_MODELS_COMPARISON.md) |
| **Production Setup** | [Configuration Guide](docs/configuration.md) | [Path Strategies](docs/path-strategies.md) |
| **File Processing** | [Preprocessing Guide](docs/preprocessing.md) | [Troubleshooting](docs/troubleshooting.md) |
| **Integration** | [API Reference](docs/api-reference.md) | [Configuration](docs/configuration.md) |
| **Issue Resolution** | [Troubleshooting Guide](docs/troubleshooting.md) | All guides |

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
├── index.ts              # Main exports
├── config.ts             # Configuration system
├── db.ts                 # SQLite operations
├── embedder.ts           # Embedding generation
├── search.ts             # Search engine
├── ingestion.ts          # Document ingestion
├── preprocess.ts         # Document preprocessing
├── cli.ts                # CLI interface
├── mcp-server.ts         # MCP server
└── preprocessors/        # Content type processors

dist/                     # Compiled output
```

### Design Philosophy

**"Boringly Simple" Approach:**
- ✅ Raw SQLite queries (no ORMs)
- ✅ Direct function calls (no REST/GraphQL)
- ✅ Simple configuration objects
- ✅ Minimal abstractions
- ❌ No complex frameworks or dependency injection

This keeps the codebase hackable and maintainable while providing all functionality needed for local semantic search.

## Contributing

1. Fork the repository
2. Create a feature branch  
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

Please maintain the "boringly simple" philosophy - avoid unnecessary abstractions or dependencies.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- **[transformers.js](https://github.com/xenova/transformers.js)** - Client-side ML models
- **[hnswlib](https://github.com/nmslib/hnswlib)** - Fast approximate nearest neighbor search
