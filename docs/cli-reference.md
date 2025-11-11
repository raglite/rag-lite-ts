# CLI Reference

Complete reference for all RAG-lite TS command-line interface commands with **Chameleon Multimodal Architecture** support.

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Commands](#commands)
  - [raglite ingest](#raglite-ingest)
  - [raglite search](#raglite-search)
  - [raglite rebuild](#raglite-rebuild)
  - [raglite help](#raglite-help)
- [Examples](#examples)

> **Note:** For MCP (Model Context Protocol) server integration, see the [MCP Server Multimodal Guide](./mcp-server-multimodal-guide.md).

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
- `--mode <mode>`: Processing mode (`text` or `multimodal`)
- `--rerank-strategy <strategy>`: Reranking strategy for multimodal mode
- `--rebuild-if-needed`: Auto-rebuild if model mismatch detected ⚠️ **Rebuilds entire index**
- `--path-strategy <strategy>`: Path storage strategy (`relative` or `absolute`)
- `--path-base <path>`: Base directory for relative paths
- `--db <path>`: Database file path
- `--index <path>`: Index file path

#### Supported File Types

**Text Mode (default):**
- `.md` - Markdown files
- `.txt` - Plain text files
- `.mdx` - Markdown with JSX
- `.pdf` - PDF documents
- `.docx` - Word documents

**Multimodal Mode:**
- All text file types above
- `.jpg`, `.jpeg` - JPEG images
- `.png` - PNG images
- `.gif` - GIF images
- `.webp` - WebP images

#### Available Models

**Text Mode:**
- `sentence-transformers/all-MiniLM-L6-v2` (384 dim, fast, default)
- `Xenova/all-mpnet-base-v2` (768 dim, higher quality)

**Multimodal Mode:**
- `Xenova/clip-vit-base-patch32` (512 dim, text + image support)

#### Available Reranking Strategies

**Text Mode:**
- `cross-encoder` - Use cross-encoder model for reranking (default)
- `disabled` - No reranking, use vector similarity only

**Multimodal Mode:**
- `text-derived` - Convert images to text, then use cross-encoder (default)
- `metadata` - Use filename and metadata-based scoring
- `disabled` - No reranking, use vector similarity only

**Note:** The search command automatically detects the mode and uses the model that was configured during ingestion (stored in database). To search with a different model or mode, you need to re-ingest with that configuration first.

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

# Auto-rebuild if switching models (WARNING: rebuilds entire index)
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed
```

**Multimodal processing:**
```bash
# Enable multimodal mode for text and image content
raglite ingest ./docs/ --mode multimodal

# Use specific multimodal model and reranking strategy
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32 --rerank-strategy metadata

# Multimodal with text-derived reranking (default)
raglite ingest ./docs/ --mode multimodal --rerank-strategy text-derived
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
- `--content-type <type>`: Filter results by content type (`text` or `image`)
- `--db <path>`: Database file path
- `--index <path>`: Index file path

#### Examples

**Basic search:**
```bash
# Simple search (works for both text and multimodal modes)
raglite search "machine learning concepts"

# Get more results
raglite search "API documentation" --top-k 20

# Search for images or visual content (multimodal mode)
raglite search "diagram showing architecture"
```

**Cross-modal search (multimodal mode):**
```bash
# Find images using text query
raglite search "red sports car" --content-type image

# Find text documents only
raglite search "vehicle specifications" --content-type text

# Search all content types (default - no filter)
raglite search "vehicles and transportation"

# Combine content type filter with other options
raglite search "mountain sunset" --content-type image --top-k 5 --rerank
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

### Multimodal Workflow

```bash
# Ingest with multimodal support
raglite ingest ./docs/ --mode multimodal

# Search works the same - mode is auto-detected
raglite search "diagram showing data flow"

# Use different reranking strategy
raglite ingest ./docs/ --mode multimodal --rerank-strategy metadata
raglite search "chart with performance metrics"
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

## CLI Workflow Examples

For comprehensive, hands-on examples of CLI workflows, see the `examples/cli-multimodal-workflows/` directory:

### Available Example Scripts

1. **`text-mode-workflow.sh`** - Complete text-only workflow
   - Creating sample content
   - Ingesting text documents
   - Performing various searches
   - Using different search options

2. **`multimodal-ingestion.sh`** - Multimodal content ingestion
   - Setting up multimodal mode
   - Understanding CLIP models
   - Choosing reranking strategies
   - Best practices for mixed content

3. **`cross-modal-search.sh`** - Cross-modal search examples
   - Finding images with text queries
   - Finding text with image descriptions
   - Understanding semantic similarity
   - Real-world use cases

4. **`content-type-filtering.sh`** - Filtering results by content type
   - Text-only searches
   - Image-only searches
   - Combining filters with other options
   - Performance considerations

5. **`advanced-workflows.sh`** - Advanced usage patterns
   - Mode migration strategies
   - Hybrid content organization
   - Performance optimization
   - Batch processing
   - Error recovery
   - Integration with other tools

### Running the Examples

```bash
# Navigate to examples directory
cd examples/cli-multimodal-workflows/

# Make scripts executable (Unix/Mac)
chmod +x *.sh

# Run an example
./text-mode-workflow.sh

# Or use bash directly
bash multimodal-ingestion.sh
```

For Windows users, PowerShell versions are provided:
```powershell
# Run PowerShell example
.\text-mode-workflow.ps1
```

### Quick Example: Cross-Modal Search

```bash
# 1. Ingest mixed content in multimodal mode
raglite ingest ./content/ --mode multimodal --model Xenova/clip-vit-base-patch32

# 2. Search for images using text query
raglite search "red sports car" --content-type image

# 3. Search for all related content (default - no filter needed)
raglite search "vehicles"

# 4. Filter to text documents only
raglite search "vehicle specifications" --content-type text

# 5. Combine with other options
raglite search "mountain landscape" --content-type image --top-k 5 --rerank
```

### Example: Content Type Filtering

```bash
# Search all content types (default)
raglite search "machine learning"

# Filter to text documents only
raglite search "machine learning tutorial" --content-type text

# Filter to images only
raglite search "neural network diagram" --content-type image

# Combine with top-k
raglite search "data visualization" --content-type image --top-k 3
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