# Configuration Guide

*For users who need custom settings, multiple environments, or production deployments*

This guide covers configuration options for RAG-lite TS, from simple constructor options to advanced environment-specific setups.

## Configuration Methods

RAG-lite TS supports configuration through:
1. **Constructor options** (programmatic usage)
2. **Configuration file** (`raglite.config.js`)
3. **Environment variables** (override any setting)
4. **CLI flags** (for specific commands)

## Programmatic Configuration

*For application developers using the TypeScript/JavaScript API*

When using RAG-lite TS programmatically, you can configure options directly in the constructor:

### Basic Configuration

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Search with custom model and reranking
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true
});

// Ingestion with custom chunking
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80,
  batchSize: 8
});
```

### Advanced Configuration

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Production search configuration
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true,
  rerankingModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  batchSize: 8
});

// High-throughput ingestion configuration
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  chunkSize: 300,
  chunkOverlap: 60,
  batchSize: 32,
  forceRebuild: false
});
```

### Model-Specific Configurations

```typescript
// Fast processing (development)
const fastSearch = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  enableReranking: false,
  batchSize: 16
});

// High quality (production)
const qualitySearch = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true,
  batchSize: 8
});
```

## Configuration File

Create a `raglite.config.js` file in your project root:

```javascript
export const config = {
  // Embedding model (transformers.js compatible)
  embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
  // Alternative: 'Xenova/all-mpnet-base-v2' for higher quality
  
  // Chunking parameters (auto-adjusted based on model)
  chunk_size: 250,        // Target tokens per chunk
  chunk_overlap: 50,      // Overlap between chunks
  
  // Processing parameters (auto-adjusted based on model)
  batch_size: 16,         // Embedding batch size
  top_k: 10,             // Default search results
  
  // File paths
  db_file: 'db.sqlite',
  index_file: 'vector-index.bin',
  model_cache_path: '~/.raglite/models/',
  
  // Path storage strategy
  path_storage_strategy: 'relative',  // 'relative' (default) or 'absolute'
  
  // Optional reranking
  rerank_enabled: false,
  
  // Preprocessing configuration
  preprocessing: {
    mode: 'balanced',     // 'strict', 'balanced', or 'rich'
    overrides: {
      mdx: 'placeholder', // 'strip', 'keep', or 'placeholder'
      mermaid: 'extract', // 'strip', 'extract', or 'placeholder'
      code: 'keep'        // 'strip', 'keep', or 'placeholder'
    }
  }
};
```

## Environment Variables

You can override any configuration setting using environment variables with the `RAG_` prefix:

### File Paths
```bash
export RAG_DB_FILE="./custom-db.sqlite"
export RAG_INDEX_FILE="./custom-index.bin"
export RAG_MODEL_CACHE_PATH="./models/"
export RAG_PATH_STORAGE_STRATEGY="relative"  # or "absolute"
```

### Model and Processing Settings
```bash
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_CHUNK_SIZE="300"
export RAG_CHUNK_OVERLAP="60"
export RAG_BATCH_SIZE="32"
export RAG_TOP_K="10"
export RAG_RERANK_ENABLED="true"
```

### Preprocessing Settings
```bash
export RAG_PREPROCESSING_MODE="balanced"
export RAG_PREPROCESSING_MDX="placeholder"
export RAG_PREPROCESSING_MERMAID="extract"
export RAG_PREPROCESSING_CODE="keep"
```

## Complete Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_DB_FILE` | `db.sqlite` | SQLite database file path |
| `RAG_INDEX_FILE` | `vector-index.bin` | Vector index file path |
| `RAG_MODEL_CACHE_PATH` | `~/.raglite/models/` | Model cache directory |
| `RAG_PATH_STORAGE_STRATEGY` | `relative` | Path storage strategy: 'relative' or 'absolute' |
| `RAG_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Hugging Face model name |
| `RAG_CHUNK_SIZE` | `250` | Target tokens per chunk |
| `RAG_CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `RAG_BATCH_SIZE` | `16` | Embedding batch size |
| `RAG_TOP_K` | `10` | Default number of search results |
| `RAG_RERANK_ENABLED` | `false` | Enable result reranking |
| `RAG_PREPROCESSING_MODE` | `balanced` | Preprocessing mode |
| `RAG_PREPROCESSING_MDX` | `placeholder` | MDX/JSX handling |
| `RAG_PREPROCESSING_MERMAID` | `extract` | Mermaid diagram handling |
| `RAG_PREPROCESSING_CODE` | `keep` | Code block handling |

## Use Cases for Environment Variables

### Multiple Document Collections
```bash
# Work documents
export RAG_DB_FILE="work.sqlite"
export RAG_INDEX_FILE="work-index.bin"
raglite ingest ./work-docs/
raglite search "project requirements"

# Personal documents  
export RAG_DB_FILE="personal.sqlite"
export RAG_INDEX_FILE="personal-index.bin"
raglite ingest ./personal-docs/
raglite search "recipe ideas"
```

### CI/CD Pipelines
```bash
# Override paths for build environment
export RAG_DB_FILE="/tmp/build-docs.sqlite"
export RAG_INDEX_FILE="/tmp/build-index.bin"
export RAG_MODEL_CACHE_PATH="/cache/models/"
raglite ingest ./docs/
```

### Docker Containers
```bash
# Configure for mounted volumes
export RAG_DB_FILE="/data/db.sqlite"
export RAG_INDEX_FILE="/data/index.bin"
export RAG_MODEL_CACHE_PATH="/models/"
```

### Development vs Production
```bash
# Development - fast model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_BATCH_SIZE="32"

# Production - high quality model
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"
export RAG_BATCH_SIZE="8"
export RAG_RERANK_ENABLED="true"
```

## Model-Specific Auto-Configuration

The system automatically applies optimal settings based on your chosen model:

### sentence-transformers/all-MiniLM-L6-v2 (default)
- Dimensions: 384
- Chunk size: 250 tokens
- Batch size: 16
- Best for: Fast processing, lower memory usage

### Xenova/all-mpnet-base-v2
- Dimensions: 768  
- Chunk size: 400 tokens
- Batch size: 8
- Best for: Higher quality embeddings, better search accuracy

You can override these auto-configured values using environment variables or configuration files if needed.

## Configuration Priority

Settings are applied in this order (later overrides earlier):

1. **Default values** (built into the system)
2. **Model-specific auto-configuration** (based on chosen model)
3. **Configuration file** (`raglite.config.js`)
4. **Environment variables** (`RAG_*`)
5. **CLI flags** (for specific commands)

This allows you to set project defaults in the config file while overriding specific settings via environment variables or CLI flags as needed.

## Path Storage Configuration

RAG-lite TS supports flexible path storage strategies to make your document indexes portable and suitable for different deployment scenarios.

### Path Storage Strategies

#### Relative Paths (Default - Recommended)

Stores document paths relative to the ingestion directory, making indexes portable:

```bash
# Configuration
export RAG_PATH_STORAGE_STRATEGY="relative"

# CLI usage
raglite ingest ./docs/

# Results in database paths like:
# - "api/authentication.md"
# - "guides/getting-started.md"
```

**Benefits:**
- ✅ Portable across different machines and environments
- ✅ Version control friendly - same paths regardless of checkout location
- ✅ Team collaboration - consistent paths for all team members
- ✅ URL generation - easy to convert to web URLs

#### Absolute Paths (Legacy)

Stores full system paths for backward compatibility:

```bash
# Configuration
export RAG_PATH_STORAGE_STRATEGY="absolute"

# CLI usage
raglite ingest ./docs/

# Results in database paths like:
# - "/home/user/project/docs/api/authentication.md"
# - "/home/user/project/docs/guides/getting-started.md"
```

### CLI Path Options

The CLI provides additional path control options:

```bash
# Use relative paths with custom base directory
raglite ingest ./docs/ --path-strategy relative --path-base /project

# Use absolute paths explicitly
raglite ingest ./docs/ --path-strategy absolute

# Default behavior (relative paths from current directory)
raglite ingest ./docs/
```

### Use Cases

#### URL Generation for Web Documentation

Perfect for local mirrors of web documentation:

```bash
# Ingest local documentation mirror
raglite ingest ./local-docs/ --path-strategy relative

# In your application:
# Database path: "api/authentication.md"
# Web URL: "https://docs.example.com/" + "api/authentication.md"
# Result: "https://docs.example.com/api/authentication.md"
```

#### Multi-Environment Deployment

```bash
# Development environment
export RAG_PATH_STORAGE_STRATEGY="relative"
raglite ingest ./docs/

# Production environment (same relative paths work)
export RAG_PATH_STORAGE_STRATEGY="relative"
raglite ingest ./docs/
```

#### Legacy System Integration

```bash
# For systems that require absolute paths
export RAG_PATH_STORAGE_STRATEGY="absolute"
raglite ingest ./docs/
```

### Configuration Examples

#### Project Configuration File

```javascript
// raglite.config.js
export const config = {
  // Use relative paths for portability
  path_storage_strategy: 'relative',
  
  // Other settings
  embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
  db_file: 'db.sqlite',
  index_file: 'vector-index.bin'
};
```

#### Environment-Specific Configuration

```bash
# Development - relative paths
export RAG_PATH_STORAGE_STRATEGY="relative"
export RAG_DB_FILE="dev-db.sqlite"

# Production - relative paths (portable)
export RAG_PATH_STORAGE_STRATEGY="relative"
export RAG_DB_FILE="prod-db.sqlite"

# Legacy system - absolute paths
export RAG_PATH_STORAGE_STRATEGY="absolute"
export RAG_DB_FILE="legacy-db.sqlite"
```