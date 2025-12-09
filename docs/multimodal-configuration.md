# Advanced Multimodal Configuration

*Comprehensive configuration examples for multimodal RAG-lite TS deployments*

This guide provides detailed configuration examples for various multimodal use cases, from simple mixed content to complex production deployments with the simplified two-mode architecture. The system now provides reliable CLIP-based multimodal capabilities without complex fallback mechanisms.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Basic Multimodal Configurations](#basic-multimodal-configurations)
- [Production Configurations](#production-configurations)
- [Environment-Specific Setups](#environment-specific-setups)
- [Performance Tuning](#performance-tuning)
- [Integration Examples](#integration-examples)

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
- No more `pixel_values` errors or complex error recovery
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

```typescript
interface MultimodalConfig {
  // Core mode settings
  mode: 'text' | 'multimodal';
  embeddingModel: string;
  rerankingStrategy: 'cross-encoder' | 'text-derived' | 'metadata' | 'hybrid' | 'disabled';
  
  // Processing settings
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
  
  // Multimodal-specific
  imageProcessing?: {
    generateDescriptions: boolean;
    extractMetadata: boolean;
    imageToTextModel: string;
  };
}
```

## Basic Multimodal Configurations

### Documentation with Screenshots

Perfect for documentation sites with UI screenshots and diagrams:

```javascript
// raglite.config.js
export const config = {
  mode: 'multimodal',
  embedding_model: 'Xenova/clip-vit-base-patch32',
  reranking_strategy: 'text-derived',
  
  // Optimized for mixed content
  chunk_size: 300,
  chunk_overlap: 60,
  batch_size: 8,
  
  // Path strategy for web deployment
  path_storage_strategy: 'relative',
  
  // Preprocessing optimized for documentation
  preprocessing: {
    mode: 'balanced',
    overrides: {
      mdx: 'keep',        // Preserve JSX components
      mermaid: 'extract', // Extract diagram content
      code: 'keep',       // Keep code examples
      images: 'description-with-metadata'
    }
  }
};
```

**CLI Usage:**
```bash
# Ingest documentation with screenshots
raglite ingest ./docs/ --mode multimodal

# Search works for both text and visual content
raglite search "login form screenshot"
raglite search "API authentication guide"
raglite search ./ui-mockup.png --content-type image  # Image-to-image search
```

### Technical Diagrams Collection

Optimized for technical diagrams, flowcharts, and architectural drawings:

```javascript
// raglite.config.js
export const config = {
  mode: 'multimodal',
  embedding_model: 'Xenova/clip-vit-base-patch32',
  reranking_strategy: 'text-derived',  // Semantic understanding
  
  // Conservative settings for large diagrams
  chunk_size: 250,
  chunk_overlap: 50,
  batch_size: 4,
  
  preprocessing: {
    mode: 'rich',
    overrides: {
      mermaid: 'extract',  // Important for diagram content
      images: 'full-metadata'
    }
  }
};
```

**Environment Variables:**
```bash
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="text-derived"
export RAG_BATCH_SIZE="4"

# Text-derived reranking provides semantic understanding of diagrams
```

### Mixed Content Knowledge Base

Comprehensive setup for mixed text and visual content:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// High-quality multimodal configuration
const config = {
  mode: 'multimodal' as const,
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'hybrid' as const,
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

## Production Configurations

### High-Performance Production Setup

Optimized for production environments with large content collections:

```javascript
// raglite.config.js
export const config = {
  mode: 'multimodal',
  embedding_model: 'Xenova/clip-vit-base-patch32',
  reranking_strategy: 'text-derived',
  
  // Production-optimized settings
  chunk_size: 400,
  chunk_overlap: 80,
  batch_size: 12,  // Adjust based on available memory
  
  // Production paths
  db_file: '/data/production.sqlite',
  index_file: '/data/production-index.bin',
  model_cache_path: '/cache/models/',
  
  // Optimized preprocessing
  preprocessing: {
    mode: 'balanced',
    overrides: {
      mdx: 'placeholder',
      mermaid: 'extract',
      code: 'keep',
      images: 'enhanced-description'
    }
  }
};
```

**Docker Configuration:**
```dockerfile
# Dockerfile
FROM node:18-alpine

# Install dependencies
RUN npm install -g rag-lite-ts

# Set production environment
ENV RAG_MODE=multimodal
ENV RAG_EMBEDDING_MODEL=Xenova/clip-vit-base-patch32
ENV RAG_RERANKING_STRATEGY=text-derived
ENV RAG_BATCH_SIZE=8
ENV RAG_DB_FILE=/data/production.sqlite
ENV RAG_INDEX_FILE=/data/production-index.bin
ENV RAG_MODEL_CACHE_PATH=/cache/models/

# Create volumes
VOLUME ["/data", "/cache", "/content"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD raglite search "health check" --top-k 1 || exit 1

CMD ["raglite", "ingest", "/content"]
```

### Load-Balanced Production Deployment

Configuration for multiple instances with shared storage:

```yaml
# docker-compose.yml
version: '3.8'
services:
  rag-ingestion:
    image: rag-lite-ts:latest
    environment:
      - RAG_MODE=multimodal
      - RAG_EMBEDDING_MODEL=Xenova/clip-vit-base-patch32
      - RAG_RERANKING_STRATEGY=text-derived
      - RAG_BATCH_SIZE=8
      - RAG_DB_FILE=/shared/production.sqlite
      - RAG_INDEX_FILE=/shared/production-index.bin
    volumes:
      - shared-data:/shared
      - model-cache:/cache
      - ./content:/content
    command: ["raglite", "ingest", "/content"]
  
  rag-search-1:
    image: rag-lite-ts:latest
    environment:
      - RAG_DB_FILE=/shared/production.sqlite
      - RAG_INDEX_FILE=/shared/production-index.bin
    volumes:
      - shared-data:/shared:ro
      - model-cache:/cache:ro
    ports:
      - "3001:3000"
  
  rag-search-2:
    image: rag-lite-ts:latest
    environment:
      - RAG_DB_FILE=/shared/production.sqlite
      - RAG_INDEX_FILE=/shared/production-index.bin
    volumes:
      - shared-data:/shared:ro
      - model-cache:/cache:ro
    ports:
      - "3002:3000"

volumes:
  shared-data:
  model-cache:
```

## Environment-Specific Setups

### Development Environment

Fast iteration with minimal resource usage:

```bash
#!/bin/bash
# dev-setup.sh

export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="disabled"  # Fast development
export RAG_BATCH_SIZE="16"
export RAG_CHUNK_SIZE="250"
export RAG_DB_FILE="dev.sqlite"
export RAG_INDEX_FILE="dev-index.bin"

echo "Development environment configured for fast iteration"
raglite ingest ./test-content/
```

### Staging Environment

Production-like setup with comprehensive testing:

```bash
#!/bin/bash
# staging-setup.sh

export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="text-derived"
export RAG_BATCH_SIZE="8"
export RAG_CHUNK_SIZE="350"
export RAG_DB_FILE="staging.sqlite"
export RAG_INDEX_FILE="staging-index.bin"

echo "Staging environment configured for testing"
raglite ingest ./staging-content/

# Run comprehensive tests
echo "Testing multimodal search..."
raglite search "architecture diagram" --top-k 10
raglite search "API documentation" --top-k 10
raglite search "user interface mockup" --top-k 10
raglite search ./test-diagram.png --content-type image --top-k 5  # Image-to-image search
```

### Production Environment

High-quality, optimized for performance:

```bash
#!/bin/bash
# production-setup.sh

export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="text-derived"
export RAG_BATCH_SIZE="6"
export RAG_CHUNK_SIZE="400"
export RAG_CHUNK_OVERLAP="80"
export RAG_DB_FILE="/data/production.sqlite"
export RAG_INDEX_FILE="/data/production-index.bin"
export RAG_MODEL_CACHE_PATH="/cache/models/"

# Production ingestion with error handling
echo "Production ingestion starting..."
if raglite ingest /content/ --mode multimodal; then
    echo "Ingestion completed successfully"
    
    # Optimize database
    sqlite3 $RAG_DB_FILE "ANALYZE; VACUUM;"
    
    # Test search functionality
    raglite search "test query" --top-k 1 > /dev/null
    echo "Production deployment ready"
else
    echo "Ingestion failed, check logs"
    exit 1
fi
```

## Performance Tuning

### Memory-Optimized Configuration

For systems with limited RAM:

```javascript
// raglite.config.js - Memory optimized
export const config = {
  mode: 'multimodal',
  embedding_model: 'Xenova/clip-vit-base-patch32',  // Balanced memory usage
  reranking_strategy: 'metadata',  // Fastest reranking
  
  // Conservative memory settings
  chunk_size: 200,
  chunk_overlap: 40,
  batch_size: 4,  // Small batches
  
  preprocessing: {
    mode: 'strict',  // Minimal content processing
    overrides: {
      images: 'description-only'  // Skip metadata extraction
    }
  }
};
```

### Speed-Optimized Configuration

For maximum processing speed:

```bash
# Speed-optimized environment
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="disabled"  # Skip reranking
export RAG_BATCH_SIZE="32"  # Large batches if memory allows
export RAG_CHUNK_SIZE="200"  # Smaller chunks process faster
export RAG_PREPROCESSING_MODE="strict"  # Minimal preprocessing
```

### Quality-Optimized Configuration

For maximum search quality:

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

const qualityConfig = {
  mode: 'multimodal' as const,
  embeddingModel: 'Xenova/clip-vit-base-patch16',  // Higher quality model
  rerankingStrategy: 'text-derived' as const,  // Semantic reranking
  chunkSize: 500,  // Larger chunks for context
  chunkOverlap: 100,  // More overlap
  batchSize: 4  // Conservative for stability
};

const ingestion = new IngestionPipeline('./quality.sqlite', './quality-index.bin', qualityConfig);
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express';
import { SearchEngine } from 'rag-lite-ts';

const app = express();
app.use(express.json());

// Initialize search engine (mode auto-detected)
const search = new SearchEngine('./api.bin', './api.sqlite');

app.post('/search', async (req, res) => {
  try {
    const { query, top_k = 10 } = req.body;
    
    const results = await search.search(query, { 
      top_k,
      rerank: true 
    });
    
    // Format results with content type information
    const formattedResults = results.map(result => ({
      content: result.content,
      score: result.score,
      source: result.document.source,
      contentType: result.contentType,
      metadata: result.metadata
    }));
    
    res.json({ results: formattedResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Multimodal RAG API running on port 3000');
});
```

### Next.js Integration

```typescript
// pages/api/search.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { SearchEngine } from 'rag-lite-ts';

let searchEngine: SearchEngine | null = null;

async function getSearchEngine() {
  if (!searchEngine) {
    searchEngine = new SearchEngine(
      process.env.RAG_INDEX_FILE || './index.bin',
      process.env.RAG_DB_FILE || './db.sqlite'
    );
  }
  return searchEngine;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { query } = req.body;
    const search = await getSearchEngine();
    
    const results = await search.search(query, { 
      top_k: 10,
      rerank: true 
    });
    
    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Batch Processing Pipeline

```typescript
import { IngestionPipeline } from 'rag-lite-ts';
import { promises as fs } from 'fs';
import path from 'path';

class MultimodalBatchProcessor {
  private ingestion: IngestionPipeline;
  
  constructor(dbPath: string, indexPath: string) {
    this.ingestion = new IngestionPipeline(dbPath, indexPath, {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'text-derived',
      batchSize: 8
    });
  }
  
  async processBatch(directories: string[]) {
    const results = [];
    
    for (const dir of directories) {
      console.log(`Processing directory: ${dir}`);
      
      try {
        const result = await this.ingestion.ingestDirectory(dir);
        results.push({
          directory: dir,
          success: true,
          documentsProcessed: result.documentsProcessed,
          chunksCreated: result.chunksCreated
        });
        
        console.log(`✓ Processed ${result.documentsProcessed} documents`);
      } catch (error) {
        results.push({
          directory: dir,
          success: false,
          error: error.message
        });
        
        console.error(`✗ Failed to process ${dir}: ${error.message}`);
      }
    }
    
    return results;
  }
  
  async cleanup() {
    await this.ingestion.cleanup();
  }
}

// Usage
const processor = new MultimodalBatchProcessor('./batch.sqlite', './batch-index.bin');

const directories = [
  './content/docs/',
  './content/images/',
  './content/mixed/'
];

const results = await processor.processBatch(directories);
console.log('Batch processing results:', results);

await processor.cleanup();
```

### Monitoring and Health Checks

```typescript
import { SearchEngine } from 'rag-lite-ts';

class MultimodalHealthChecker {
  private search: SearchEngine;
  
  constructor(indexPath: string, dbPath: string) {
    this.search = new SearchEngine(indexPath, dbPath);
  }
  
  async checkHealth() {
    const health = {
      status: 'healthy',
      checks: {
        database: false,
        index: false,
        search: false,
        multimodal: false
      },
      stats: {}
    };
    
    try {
      // Check database connectivity
      const stats = await this.search.getStats();
      health.checks.database = true;
      health.stats = stats;
      
      // Check index accessibility
      if (stats.totalChunks > 0) {
        health.checks.index = true;
      }
      
      // Check search functionality
      const testResults = await this.search.search('health check', { top_k: 1 });
      health.checks.search = true;
      
      // Check multimodal capabilities
      if (stats.mode === 'multimodal') {
        health.checks.multimodal = true;
      }
      
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }
    
    return health;
  }
  
  async cleanup() {
    await this.search.cleanup();
  }
}

// Usage in Express.js
app.get('/health', async (req, res) => {
  const checker = new MultimodalHealthChecker('./index.bin', './db.sqlite');
  const health = await checker.checkHealth();
  await checker.cleanup();
  
  res.status(health.status === 'healthy' ? 200 : 500).json(health);
});
```

These configuration examples provide comprehensive setups for various multimodal use cases. Choose the configuration that best matches your requirements and adjust the parameters based on your specific content and performance needs.