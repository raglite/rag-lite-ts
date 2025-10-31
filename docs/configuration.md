# Configuration Guide

*For users who need custom settings, multiple environments, or production deployments*

This guide covers configuration options for RAG-lite TS with **Chameleon Multimodal Architecture**, from simple constructor options to advanced environment-specific setups including mode persistence and multimodal configuration.

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

// Text mode search with custom model and reranking
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true
});

// Multimodal ingestion with CLIP model and text-derived reranking
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 400,
  chunkOverlap: 80,
  batchSize: 8
});
```

### Advanced Configuration

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';

// Production text search configuration
const search = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true,
  rerankingModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  batchSize: 8
});

// High-throughput multimodal ingestion configuration
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 300,
  chunkOverlap: 60,
  batchSize: 16,
  forceRebuild: false
});
```

### Model-Specific Configurations

```typescript
// Fast text processing (development)
const fastSearch = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  enableReranking: false,
  batchSize: 16
});

// High quality text search (production)
const qualitySearch = new SearchEngine('./index.bin', './db.sqlite', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  enableReranking: true,
  batchSize: 8
});

// Multimodal search (auto-detects mode from database)
const multimodalSearch = new SearchEngine('./index.bin', './db.sqlite');
// Mode, model, and reranking strategy automatically detected from ingestion
```

## Configuration File

Create a `raglite.config.js` file in your project root:

```javascript
export const config = {
  // Processing mode (stored in database during ingestion)
  mode: 'text',           // 'text' (default) or 'multimodal'
  
  // Embedding model (transformers.js compatible)
  embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
  // Text alternatives: 'Xenova/all-mpnet-base-v2' for higher quality
  // Multimodal: 'Xenova/clip-vit-base-patch32' for text + image
  
  // Reranking strategy (mode-dependent)
  reranking_strategy: 'cross-encoder',  // Text: 'cross-encoder', 'disabled'
  // Multimodal: 'text-derived', 'metadata', 'hybrid', 'disabled'
  
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
  
  // Optional reranking (legacy - use reranking_strategy instead)
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
export RAG_MODE="text"  # or "multimodal"
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_RERANKING_STRATEGY="cross-encoder"  # text: cross-encoder, disabled
# multimodal: text-derived, metadata, hybrid, disabled
export RAG_CHUNK_SIZE="300"
export RAG_CHUNK_OVERLAP="60"
export RAG_BATCH_SIZE="32"
export RAG_TOP_K="10"
export RAG_RERANK_ENABLED="true"  # legacy - use RAG_RERANKING_STRATEGY
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
| `RAG_MODE` | `text` | Processing mode: 'text' or 'multimodal' |
| `RAG_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Hugging Face model name |
| `RAG_RERANKING_STRATEGY` | `cross-encoder` | Reranking strategy (mode-dependent) |
| `RAG_CHUNK_SIZE` | `250` | Target tokens per chunk |
| `RAG_CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `RAG_BATCH_SIZE` | `16` | Embedding batch size |
| `RAG_TOP_K` | `10` | Default number of search results |
| `RAG_RERANK_ENABLED` | `false` | Enable result reranking (legacy) |
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
# Development - fast text model
export RAG_MODE="text"
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_BATCH_SIZE="32"
export RAG_RERANKING_STRATEGY="disabled"

# Production - high quality text model
export RAG_MODE="text"
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"
export RAG_BATCH_SIZE="8"
export RAG_RERANKING_STRATEGY="cross-encoder"

# Production - multimodal with image support
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_BATCH_SIZE="8"
export RAG_RERANKING_STRATEGY="text-derived"
```

## Mode Persistence and Multimodal Configuration

The Chameleon Architecture stores mode configuration in the database during ingestion and automatically detects it during search operations.

### Mode Storage During Ingestion

```bash
# Text mode (default) - stored in database
raglite ingest ./docs/

# Multimodal mode - stored in database with model and reranking strategy
raglite ingest ./docs/ --mode multimodal --rerank-strategy text-derived
```

### Automatic Mode Detection During Search

```bash
# Search automatically detects mode from database
raglite search "your query"  # Uses stored mode, model, and reranking strategy

# No need to specify mode during search operations
raglite search "diagram showing architecture"  # Works for both text and images
```

### Mode-Specific Configuration

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// Text mode configuration
const textIngestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'text',
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  rerankingStrategy: 'cross-encoder'
});

// Multimodal mode configuration
const multimodalIngestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived'
});
```

### Supported Content Types by Mode

**Text Mode:**
- Markdown files (`.md`, `.mdx`)
- Text files (`.txt`)
- PDF documents (`.pdf`)
- Word documents (`.docx`)

**Multimodal Mode:**
- All text formats above
- JPEG images (`.jpg`, `.jpeg`)
- PNG images (`.png`)
- GIF images (`.gif`)
- WebP images (`.webp`)

## Model-Specific Auto-Configuration

The system automatically applies optimal settings based on your chosen model:

### Text Mode Models

#### sentence-transformers/all-MiniLM-L6-v2 (default)
- Dimensions: 384
- Chunk size: 250 tokens
- Batch size: 16
- Best for: Fast processing, lower memory usage
- Reranking: Cross-encoder

#### Xenova/all-mpnet-base-v2
- Dimensions: 768  
- Chunk size: 400 tokens
- Batch size: 8
- Best for: Higher quality embeddings, better search accuracy
- Reranking: Cross-encoder

### Multimodal Mode Models

#### Xenova/clip-vit-base-patch32
- Dimensions: 512
- Chunk size: 300 tokens
- Batch size: 8
- Best for: Text and image understanding
- Reranking: Text-derived, metadata, or hybrid strategies
- Content types: Text documents + images (JPG, PNG, GIF, WebP)

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

## Comprehensive Workflow Examples

### Text-Only Workflow

Complete example for traditional document search:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Configure for text-only processing
const ingestion = new IngestionPipeline('./docs.sqlite', './docs-index.bin', {
  mode: 'text',
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  rerankingStrategy: 'cross-encoder',
  chunkSize: 400,
  chunkOverlap: 80
});

// 2. Ingest text documents
await ingestion.ingestDirectory('./documentation/');
await ingestion.cleanup();

// 3. Search (mode auto-detected)
const search = new SearchEngine('./docs-index.bin', './docs.sqlite');
const results = await search.search('authentication setup');

console.log('Text search results:');
for (const result of results) {
  console.log(`${result.document.source}: ${result.score.toFixed(2)}`);
  console.log(result.content.substring(0, 100) + '...\n');
}

await search.cleanup();
```

### Multimodal Workflow

Complete example for mixed text and image content:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Configure for multimodal processing
const ingestion = new IngestionPipeline('./mixed.sqlite', './mixed-index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 300,
  chunkOverlap: 60
});

// 2. Ingest mixed content (text + images)
await ingestion.ingestDirectory('./mixed-content/');
await ingestion.cleanup();

// 3. Search across both text and images
const search = new SearchEngine('./mixed-index.bin', './mixed.sqlite');

// Search for visual content
const imageResults = await search.search('diagram showing architecture');
console.log('Multimodal search results:');
for (const result of imageResults) {
  console.log(`${result.contentType}: ${result.document.source}`);
  console.log(`Score: ${result.score.toFixed(2)}`);
  if (result.metadata?.dimensions) {
    console.log(`Image: ${result.metadata.dimensions.width}x${result.metadata.dimensions.height}`);
  }
  console.log(result.content.substring(0, 100) + '...\n');
}

await search.cleanup();
```

### Mixed Content Workflow with Different Strategies

Example showing different reranking strategies:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Strategy 1: Text-derived reranking (converts images to text)
const textDerivedIngestion = new IngestionPipeline('./td.sqlite', './td-index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived'
});

await textDerivedIngestion.ingestDirectory('./content/');
await textDerivedIngestion.cleanup();

// Strategy 2: Metadata-based reranking (uses filenames and properties)
const metadataIngestion = new IngestionPipeline('./md.sqlite', './md-index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'metadata'
});

await metadataIngestion.ingestDirectory('./content/');
await metadataIngestion.cleanup();

// Compare results from different strategies
const textDerivedSearch = new SearchEngine('./td-index.bin', './td.sqlite');
const metadataSearch = new SearchEngine('./md-index.bin', './md.sqlite');

const query = 'flowchart showing process';

const tdResults = await textDerivedSearch.search(query, { top_k: 5 });
const mdResults = await metadataSearch.search(query, { top_k: 5 });

console.log('Text-derived reranking results:');
tdResults.forEach((r, i) => console.log(`${i+1}. ${r.document.source} (${r.score.toFixed(2)})`));

console.log('\nMetadata-based reranking results:');
mdResults.forEach((r, i) => console.log(`${i+1}. ${r.document.source} (${r.score.toFixed(2)})`));

await Promise.all([
  textDerivedSearch.cleanup(),
  metadataSearch.cleanup()
]);
```

### Environment-Based Configuration Workflow

Example using environment variables for different deployment scenarios:

```bash
#!/bin/bash
# setup-environments.sh

# Development environment - fast processing
export RAG_MODE="text"
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_RERANKING_STRATEGY="disabled"
export RAG_BATCH_SIZE="32"
export RAG_DB_FILE="dev.sqlite"
export RAG_INDEX_FILE="dev-index.bin"

echo "Development environment configured"
raglite ingest ./docs/
raglite search "quick test"

# Production environment - high quality
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="text-derived"
export RAG_BATCH_SIZE="8"
export RAG_DB_FILE="prod.sqlite"
export RAG_INDEX_FILE="prod-index.bin"

echo "Production environment configured"
raglite ingest ./content/
raglite search "architecture diagram"
```

### CLI-Based Workflow Examples

```bash
# Example 1: Documentation site with images
raglite ingest ./docs/ --mode multimodal --rerank-strategy text-derived
raglite search "screenshot showing login form"

# Example 2: API documentation (text-only)
raglite ingest ./api-docs/ --mode text --model Xenova/all-mpnet-base-v2
raglite search "authentication endpoints"

# Example 3: Mixed technical content
raglite ingest ./technical-guides/ --mode multimodal --rerank-strategy metadata
raglite search "network topology diagram"

# Example 4: Multiple collections
raglite ingest ./user-guides/ --mode text --db users.sqlite --index users-index.bin
raglite ingest ./admin-guides/ --mode multimodal --db admin.sqlite --index admin-index.bin

raglite search "user permissions" --db users.sqlite --index users-index.bin
raglite search "system architecture" --db admin.sqlite --index admin-index.bin
```

These examples demonstrate the flexibility of the Chameleon Architecture in adapting to different content types and use cases while maintaining a consistent, simple interface.