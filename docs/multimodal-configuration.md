# Advanced Multimodal Configuration

*Comprehensive configuration examples for multimodal RAG-lite TS deployments*

This guide provides detailed configuration examples for various multimodal use cases, from simple mixed content to complex production deployments with the simplified two-mode architecture. The system now provides reliable CLIP-based multimodal capabilities without complex fallback mechanisms.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Basic Multimodal Configurations](#basic-multimodal-configurations)
- [Environment-Specific Setups](#environment-specific-setups)

## Configuration Overview

The simplified two-mode architecture provides reliable multimodal capabilities:

1. **Mode Storage**: Set once during ingestion, automatically detected during search
2. **Model Selection**: Choose between text-only and multimodal models
3. **Reranking Strategies**: Multiple strategies for different content types
4. **Content Processing**: Optimized settings for mixed content
5. **No Fallbacks**: Each mode works reliably or fails clearly with actionable errors

### What's New in the Simplified Architecture

**Reliable CLIP Text Embedding:**
- CLIP text embedding now works without fallback mechanisms
- Predictable behavior for each mode

**True Cross-Modal Search:**
- Text queries find semantically similar images
- Image queries find related text content
- Unified embedding space for both content types

**Clear Mode Separation:**
- Text mode: Optimized for text-only content
- Multimodal mode: Unified CLIP embedding space for text and images
- No mixing of embedding approaches within a collection

### Key Configuration Parameters

The multimodal system uses the `IngestionFactoryOptions` interface for configuration:

```typescript
interface IngestionFactoryOptions {
  /** Embedding model name override */
  embeddingModel?: string;
  /** Embedding batch size override */
  batchSize?: number;
  /** Chunk size override */
  chunkSize?: number;
  /** Chunk overlap override */
  chunkOverlap?: number;
  /** Whether to force rebuild the index */
  forceRebuild?: boolean;
  /** Mode for the ingestion pipeline (text or multimodal) */
  mode?: 'text' | 'multimodal';
  /** Reranking strategy for multimodal mode */
  rerankingStrategy?: 'cross-encoder' | 'text-derived' | 'metadata' | 'hybrid' | 'disabled';
  /** Content system configuration */
  contentSystemConfig?: ContentSystemConfig;
}
```

## Basic Multimodal Configurations

### Documentation with Screenshots

Perfect for documentation sites with UI screenshots and diagrams:

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// Configure for multimodal processing
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 300,
  chunkOverlap: 60,
  batchSize: 8
});

await ingestion.ingestDirectory('./docs/');
await ingestion.cleanup();
```

**CLI Usage:**
```bash
# Ingest documentation with screenshots
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32

# Search works for both text and visual content
raglite search "login form screenshot"
raglite search "API authentication guide"
raglite search ./ui-mockup.png --content-type image  # Image-to-image search
```

### Mixed Content Knowledge Base

Comprehensive setup for mixed text and visual content:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// High-quality multimodal configuration
const config = {
  mode: 'multimodal' as const,
  embeddingModel: 'Xenova/clip-vit-base-patch16',
  rerankingStrategy: 'text-derived' as const,
  chunkSize: 350,
  chunkOverlap: 70,
  batchSize: 6
};

const ingestion = new IngestionPipeline('./kb.sqlite', './kb-index.bin', config);
await ingestion.ingestDirectory('./knowledge-base/');
await ingestion.cleanup();

// Search automatically detects multimodal mode
const search = new SearchEngine('./kb-index.bin', './kb.sqlite');
const results = await search.search('system architecture overview');
```

## Environment-Specific Setups

### Development Environment

Fast iteration with minimal resource usage:

```bash
#!/bin/bash
# dev-setup.sh

export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_BATCH_SIZE="16"
export RAG_CHUNK_SIZE="250"
export RAG_DB_FILE="dev.sqlite"
export RAG_INDEX_FILE="dev-index.bin"

echo "Development environment configured for fast iteration"
raglite ingest ./test-content/ --mode multimodal --no-rerank
```

### Staging Environment

Production-like setup with comprehensive testing:

```bash
#!/bin/bash
# staging-setup.sh

export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch16"
export RAG_BATCH_SIZE="4"
export RAG_CHUNK_SIZE="350"
export RAG_DB_FILE="staging.sqlite"
export RAG_INDEX_FILE="staging-index.bin"

echo "Staging environment configured for testing"
raglite ingest ./staging-content/ --mode multimodal --model Xenova/clip-vit-base-patch16

# Run comprehensive tests
echo "Testing multimodal search..."
raglite search "architecture diagram" --top-k 10
raglite search "API documentation" --top-k 10
raglite search "user interface mockup" --top-k 10
raglite search ./test-diagram.png --content-type image --top-k 5  # Image-to-image search
```
