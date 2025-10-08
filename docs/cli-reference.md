# CLI Reference

Complete reference for all RAG-lite TS command-line interface commands.

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Commands](#commands)
  - [raglite ingest](#raglite-ingest)
  - [raglite search](#raglite-search)
  - [raglite rebuild](#raglite-rebuild)
  - [raglite help](#raglite-help)
- [MCP Server](#mcp-server)
- [Examples](#examples)

## Installation

```bash
npm install -g rag-lite-ts
```

## Global Options

These options can be used with any command:

- `--db <path>`: SQLite database file path (default: `db.sqlite`)
- `--index <path>`: Vector index file path (default: `vector-index.bin`)

## Commands

### `raglite ingest`

Ingest documents from files or directories into the search index.

#### Syntax
```bash
raglite ingest <path> [options]
```

#### Arguments
- `<path>`: File or directory path to ingest

#### Options
- `--model <name>`: Embedding model to use
- `--rebuild-if-needed`: Auto-rebuild if model mismatch detected ⚠️ **Rebuilds entire index**
- `--path-strategy <strategy>`: Path storage strategy (`relative` or `absolute`)
- `--path-base <path>`: Base directory for relative paths
- `--db <path>`: Database file path
- `--index <path>`: Index file path

#### Supported File Types
- `.md` - Markdown files
- `.txt` - Plain text files
- `.mdx` - Markdown with JSX
- `.pdf` - PDF documents
- `.docx` - Word documents

#### Available Models
- `sentence-transformers/all-MiniLM-L6-v2` (384 dim, fast, default)
- `Xenova/all-mpnet-base-v2` (768 dim, higher quality)

#### Examples

**Basic ingestion:**
```bash
# Ingest all supported files in a directory
raglite ingest ./docs/

# Ingest a single file
raglite ingest ./README.md
```

**Model selection:**
```bash
# Use higher quality model
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2

# Auto-rebuild if switching models
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed
```

**Path strategies:**
```bash
# Use relative paths (default - portable)
raglite ingest ./docs/ --path-strategy relative

# Use absolute paths
raglite ingest ./docs/ --path-strategy absolute

# Custom base for relative paths
raglite ingest ./docs/ --path-strategy relative --path-base /project
```

**Multiple collections:**
```bash
# Work documents
raglite ingest ./work-docs/ --db work.sqlite --index work-index.bin

# Personal documents
raglite ingest ./personal-docs/ --db personal.sqlite --index personal-index.bin
```

### `raglite search`

Search indexed documents using semantic similarity.

#### Syntax
```bash
raglite search <query> [options]
```

#### Arguments
- `<query>`: Search query text

#### Options
- `--top-k <number>`: Number of results to return (default: 10)
- `--rerank`: Enable cross-encoder reranking for better relevance
- `--no-rerank`: Explicitly disable reranking
- `--db <path>`: Database file path
- `--index <path>`: Index file path

#### Examples

**Basic search:**
```bash
# Simple search
raglite search "machine learning concepts"

# Get more results
raglite search "API documentation" --top-k 20
```

**Reranking:**
```bash
# Enable reranking for better quality
raglite search "typescript examples" --rerank

# Disable reranking for speed
raglite search "database queries" --no-rerank
```

**Multiple collections:**
```bash
# Search work documents
raglite search "project requirements" --db work.sqlite --index work-index.bin

# Search personal documents
raglite search "recipe ideas" --db personal.sqlite --index personal-index.bin
```

#### Output Format

Search results include:
- **Relevance score** (percentage)
- **Source document** path
- **Matching text** excerpt
- **Document title** (if available)

Example output:
```
1. Machine Learning Fundamentals
   Source: guides/ml-basics.md
   Score: 95.2%
   Text: Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed...

2. Neural Networks Overview  
   Source: advanced/neural-nets.md
   Score: 87.3%
   Text: Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes that process information...
```

### `raglite rebuild`

Rebuild the entire vector index from existing documents in the database.

#### Syntax
```bash
raglite rebuild [options]
```

#### Options
- `--db <path>`: Database file path
- `--index <path>`: Index file path

#### When to Rebuild
- After changing the embedding model
- When seeing "Model mismatch detected" errors
- After updating model-specific configuration
- When index becomes corrupted

#### Examples
```bash
# Basic rebuild
raglite rebuild

# Rebuild specific collection
raglite rebuild --db work.sqlite --index work-index.bin
```

⚠️ **Note**: Rebuilding preserves your documents but regenerates all embeddings, which can take time for large collections.

### `raglite help`

Display help information for commands.

#### Syntax
```bash
raglite help [command]
```

#### Examples
```bash
# General help
raglite help

# Command-specific help
raglite help ingest
raglite help search
```

## MCP Server

RAG-lite TS includes a Model Context Protocol (MCP) server for integration with AI agents.

### `raglite-mcp`

Start the MCP server for agent integration.

#### Syntax
```bash
raglite-mcp
```

The server communicates via stdio and provides these tools:
- `search_documents`: Search indexed documents
- `ingest_documents`: Add new documents to index
- `rebuild_index`: Rebuild vector index
- `get_stats`: Get index statistics

#### MCP Configuration

Add to your MCP client configuration:
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

## Examples

### Complete Workflow

```bash
# 1. Install globally
npm install -g rag-lite-ts

# 2. Ingest documentation
raglite ingest ./docs/

# 3. Search your documents
raglite search "authentication setup"

# 4. Get more detailed results with reranking
raglite search "error handling patterns" --top-k 15 --rerank
```

### Model Switching Workflow

```bash
# Start with default model
raglite ingest ./docs/

# Switch to higher quality model (rebuilds automatically)
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed

# Search uses the model from ingestion automatically
raglite search "complex query"
```

### Multiple Project Setup

```bash
# Project A - API documentation
cd ~/projects/api-docs/
raglite ingest ./docs/ --db api.sqlite --index api-index.bin
raglite search "authentication" --db api.sqlite --index api-index.bin

# Project B - User guides  
cd ~/projects/user-guides/
raglite ingest ./guides/ --db guides.sqlite --index guides-index.bin
raglite search "getting started" --db guides.sqlite --index guides-index.bin
```

### Environment-Specific Configuration

```bash
# Development environment
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_DB_FILE="dev-db.sqlite"
raglite ingest ./docs/

# Production environment  
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"
export RAG_DB_FILE="prod-db.sqlite"
export RAG_RERANK_ENABLED="true"
raglite ingest ./docs/
```

## Error Handling

### Common Error Messages

**"No database found"**
```bash
# Solution: Ingest documents first
raglite ingest ./docs/
```

**"Model mismatch detected"**
```bash
# The system shows which models are mismatched:
# Current model: Xenova/all-mpnet-base-v2 (768 dimensions)
# Index model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)

# Solution: Rebuild with new model
raglite rebuild
```

**"No documents found in path"**
```bash
# Check that path contains supported file types (.md, .txt, .mdx, .pdf, .docx)
# Verify file permissions and path accessibility
```

### Debug Mode

Enable verbose logging:
```bash
DEBUG=1 raglite ingest ./docs/
DEBUG=1 raglite search "query"
```

## Performance Tips

### For Large Document Collections
- Use batch ingestion: `raglite ingest ./large-docs/`
- Consider using MiniLM model for speed
- Increase system RAM if possible
- Use SSD storage for better I/O performance

### For Better Search Quality
- Use MPNet model: `--model Xenova/all-mpnet-base-v2`
- Enable reranking: `--rerank`
- Increase results: `--top-k 20`
- Use descriptive, specific queries

### For Resource-Constrained Systems
- Use default MiniLM model
- Reduce batch sizes via environment variables
- Process documents in smaller batches
- Disable reranking for speed

This CLI reference covers all available commands and options. For configuration details, see the [Configuration Guide](configuration.md).