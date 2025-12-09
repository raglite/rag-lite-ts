# Multimodal Tutorial

*Step-by-step guide to using RAG-lite TS with mixed text and image content*

This tutorial walks you through setting up and using the Chameleon Multimodal Architecture to search across both text documents and images using natural language queries.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Setting Up Multimodal Mode](#setting-up-multimodal-mode)
- [Processing Mixed Content](#processing-mixed-content)
- [Advanced Reranking Strategies](#advanced-reranking-strategies)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Overview

The simplified multimodal architecture enables RAG-lite TS to:

- **Process mixed content**: Text documents (Markdown, PDF, DOCX) and images (JPG, PNG, GIF, WebP)
- **Cross-modal search**: Find images using text queries and text using image descriptions
- **Automatic mode detection**: Set mode once during ingestion, automatically detected during search
- **Intelligent reranking**: Multiple strategies for optimal search results across content types
- **Seamless experience**: Same CLI commands work for both text-only and multimodal content
- **Reliable operation**: No fallback mechanisms - each mode works predictably or fails clearly

### Supported Content Types

**Text Content:**
- Markdown files (`.md`, `.mdx`)
- Text files (`.txt`)
- PDF documents (`.pdf`)
- Word documents (`.docx`)

**Image Content (Multimodal Mode):**
- JPEG images (`.jpg`, `.jpeg`)
- PNG images (`.png`)
- GIF images (`.gif`)
- WebP images (`.webp`)

## Quick Start

### 1. Basic Multimodal Setup

```bash
# Ingest mixed content in multimodal mode
raglite ingest ./mixed-content/ --mode multimodal

# Search across both text and images (mode auto-detected)
raglite search "architecture diagram"
raglite search "user interface mockup"
raglite search "API documentation"
```

### 2. Programmatic Usage

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Ingest mixed content
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived'
});

await ingestion.ingestDirectory('./mixed-content/');
await ingestion.cleanup();

// 2. Search (mode auto-detected from database)
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('system architecture');

// Results include both text and image matches
for (const result of results) {
  console.log(`${result.contentType}: ${result.document.source}`);
  console.log(`Score: ${result.score.toFixed(2)}`);
  if (result.metadata?.dimensions) {
    console.log(`Image: ${result.metadata.dimensions.width}x${result.metadata.dimensions.height}`);
  }
}

await search.cleanup();
```

## Setting Up Multimodal Mode

### CLI Configuration

```bash
# Basic multimodal ingestion
raglite ingest ./docs/ --mode multimodal

# With specific model and reranking strategy
raglite ingest ./docs/ --mode multimodal \
  --model Xenova/clip-vit-base-patch32 \
  # Reranking automatically uses text-derived for multimodal mode

# Search automatically detects multimodal mode
raglite search "flowchart showing process"
```

### Environment Variables

```bash
# Set multimodal defaults
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_RERANKING_STRATEGY="text-derived"

# Ingest and search
raglite ingest ./content/
raglite search "diagram"
```

### Configuration File

```javascript
// raglite.config.js
export const config = {
  mode: 'multimodal',
  embedding_model: 'Xenova/clip-vit-base-patch32',
  reranking_strategy: 'text-derived',
  chunk_size: 300,
  chunk_overlap: 60,
  batch_size: 8
};
```

## Processing Mixed Content

### Directory Structure Example

```
content/
├── docs/
│   ├── api-guide.md
│   ├── user-manual.pdf
│   └── setup-instructions.docx
├── images/
│   ├── architecture-diagram.png
│   ├── ui-mockup.jpg
│   └── flowchart.gif
└── mixed/
    ├── tutorial.md
    ├── screenshot1.png
    └── screenshot2.png
```

### Processing Workflow

```bash
# Ingest entire directory structure
raglite ingest ./content/ --mode multimodal

# The system will:
# 1. Process text files normally (chunking, embedding)
# 2. Generate descriptions for images using image-to-text models
# 3. Extract image metadata (dimensions, file size, format)
# 4. Store everything with appropriate content types
```

### What Happens During Processing

**Text Files:**
- Chunked into optimal sizes
- Embedded using CLIP text encoder
- Stored with `content_type='text'`

**Image Files:**
- Described using `Xenova/vit-gpt2-image-captioning`
- Metadata extracted using Sharp
- Embedded as single chunks with `content_type='image'`
- Original image path preserved in metadata

### Example Processing Output

```bash
raglite ingest ./content/ --mode multimodal

# Output:
# Processing text files...
# - docs/api-guide.md: 15 chunks created
# - docs/user-manual.pdf: 23 chunks created
# 
# Processing images...
# - images/architecture-diagram.png: "A diagram showing system architecture with connected components"
# - images/ui-mockup.jpg: "A user interface mockup showing login form and navigation"
# 
# Summary:
# - 45 text chunks processed
# - 8 images processed with descriptions
# - Mode 'multimodal' stored in database
```

## Advanced Reranking Strategies

Multimodal mode supports several reranking strategies to optimize search results:

### Text-Derived Reranking (Default)

Converts images to text descriptions, then applies cross-encoder reranking:

```bash
raglite ingest ./content/ --mode multimodal
```

**How it works:**
1. Images converted to text using `Xenova/vit-gpt2-image-captioning`
2. Cross-encoder reranking applied to all text (including image descriptions)
3. Original image content restored in results

**Best for:** High-quality semantic matching across text and images

### Disabled Reranking

Uses only vector similarity scores:

```bash
raglite ingest ./content/ --mode multimodal --no-rerank
```

**Best for:** Maximum speed when reranking quality isn't critical

### Comparing Strategies

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Test different strategies
const strategies = ['text-derived', 'disabled'];

for (const strategy of strategies) {
  const ingestion = new IngestionPipeline(
    `./db-${strategy}.sqlite`, 
    `./index-${strategy}.bin`, 
    {
      mode: 'multimodal',
      rerankingStrategy: strategy
    }
  );
  
  await ingestion.ingestDirectory('./content/');
  await ingestion.cleanup();
  
  const search = new SearchEngine(`./index-${strategy}.bin`, `./db-${strategy}.sqlite`);
  const results = await search.search('system architecture diagram');
  
  console.log(`\n${strategy} strategy results:`);
  results.slice(0, 3).forEach((r, i) => {
    console.log(`${i+1}. ${r.document.source} (${r.score.toFixed(2)})`);
  });
  
  await search.cleanup();
}
```

## Performance Optimization

### Model Selection

**For Speed:**
```bash
# Use CLIP patch32 (faster, good quality)
raglite ingest ./content/ --mode multimodal --model Xenova/clip-vit-base-patch32
```

**For Quality:**
```bash
# Use CLIP patch16 (slower, better quality)
raglite ingest ./content/ --mode multimodal --model Xenova/clip-vit-base-patch16
```

### Batch Processing

```bash
# Optimize batch sizes for your system
export RAG_BATCH_SIZE="8"  # Conservative for multimodal
export RAG_BATCH_SIZE="16" # Aggressive if you have enough RAM
```

### Memory Management

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

// Process large collections in batches
const directories = ['./batch1/', './batch2/', './batch3/'];

for (const dir of directories) {
  const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
    mode: 'multimodal',
    batchSize: 8  // Conservative batch size
  });
  
  await ingestion.ingestDirectory(dir);
  await ingestion.cleanup(); // Important: cleanup between batches
}
```

### Content-Type Optimization

```bash
# Process only specific content types
raglite ingest ./docs/ --mode multimodal --include "*.md,*.png,*.jpg"

# Exclude large files that might cause memory issues
raglite ingest ./content/ --mode multimodal --exclude "*.gif,*.webp"
```

## Troubleshooting

### Common Issues

#### "Image processing failed"

**Cause:** Image file corrupted or unsupported format

**Solution:**
```bash
# Check image files
file ./images/*.png

# Try with known good images
raglite ingest ./test-data/images/ --mode multimodal

# Check supported formats: JPG, PNG, GIF, WebP
```

#### "Out of memory during image processing"

**Cause:** Large images or too many processed simultaneously

**Solution:**
```bash
# Reduce batch size
export RAG_BATCH_SIZE="4"

# Process smaller directories
raglite ingest ./images/batch1/ --mode multimodal
raglite ingest ./images/batch2/ --mode multimodal
```

#### "Mode mismatch detected"

**Cause:** Trying to search multimodal content with text-only index

**Solution:**
```bash
# Rebuild with multimodal mode
raglite ingest ./content/ --mode multimodal --rebuild-if-needed
```

#### "No image descriptions generated"

**Cause:** Image-to-text model failed to load

**Solution:**
```bash
# Clear model cache and retry
rm -rf ~/.raglite/models/
raglite ingest ./content/ --mode multimodal

# Check internet connection for model download
ping huggingface.co
```

### Debug Mode

```bash
# Enable debug logging for multimodal processing
DEBUG=1 raglite ingest ./content/ --mode multimodal

# Look for these patterns:
# "Processing image: ./image.png"
# "Generated description: A diagram showing..."
# "Extracted metadata: {width: 1920, height: 1080}"
```

### Performance Monitoring

```bash
# Monitor memory usage during processing
top -p $(pgrep -f raglite)

# Time multimodal operations
time raglite ingest ./content/ --mode multimodal
time raglite search "architecture diagram"
```

### Validation

```bash
# Verify multimodal content was processed
raglite search "test" --top-k 20

# Check for both text and image results
# Look for content_type in results
```

## Cross-Modal Search Examples

### Finding Images with Text Queries

The power of multimodal mode is the ability to find images using natural language descriptions:

```bash
# Ingest mixed content in multimodal mode
raglite ingest ./content/ --mode multimodal

# Find images using text descriptions
raglite search "red sports car" --content-type image
raglite search "mountain sunset landscape" --content-type image
raglite search "architecture diagram" --content-type image
```

### Image-to-Image Search

You can also search using image files directly to find semantically similar images:

```bash
# Find images similar to a reference image
raglite search ./reference-photo.jpg

# Find similar images with custom result count
raglite search ./diagram.png --top-k 10

# Image search with content type filtering
raglite search ./photo.jpg --content-type image

# Image search works with standard options (reranking disabled to preserve visual similarity)
raglite search ./reference.png --content-type image --top-k 10
```

**Key Features:**
- **Direct image queries**: Use image files as search input instead of text
- **Find similar images**: System finds semantically similar images in your collection
- **Cross-modal results**: Can return both images and related text content
- **All options supported**: Works with `--top-k`, `--content-type`, `--rerank`, etc.

**Programmatic usage:**
```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./multimodal.bin', './multimodal.sqlite');

// Find images using text query
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

### Searching Across Both Content Types

Search for content regardless of type, then separate results:

```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./multimodal.bin', './multimodal.sqlite');

// Search for content about vehicles
const results = await search.search('vehicles and transportation', {
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

### Understanding Semantic Similarity

CLIP models understand semantic concepts across modalities:

```bash
# These queries work because CLIP understands visual and semantic concepts

# Color-based search
raglite search "bright red color" --content-type image

# Abstract concepts
raglite search "adventure and exploration"

# Visual attributes
raglite search "modern minimalist design" --content-type image

# Compositional concepts
raglite search "person standing on mountain peak" --content-type image
```

## Advanced Examples

### Documentation Site with Screenshots

```bash
# Perfect for documentation with UI screenshots
raglite ingest ./docs/ --mode multimodal

# Search for UI elements
raglite search "login button screenshot"
raglite search "navigation menu example"
```

### Technical Diagrams Collection

```bash
# Optimize for technical diagrams and flowcharts
raglite ingest ./diagrams/ --mode multimodal

# Search works with semantic understanding
raglite search "database schema diagram"
raglite search "network topology chart"
```

### Mixed Content Knowledge Base

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Complete knowledge base with text and visual content
const ingestion = new IngestionPipeline('./kb.sqlite', './kb-index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32',
  rerankingStrategy: 'text-derived',
  chunkSize: 300,
  chunkOverlap: 60
});

// Ingest everything
await ingestion.ingestDirectory('./knowledge-base/');
await ingestion.cleanup();

// Intelligent search across all content
const search = new SearchEngine('./kb-index.bin', './kb.sqlite');

// These queries work across both text and images
const queries = [
  'user authentication flow',
  'system architecture overview', 
  'API endpoint documentation',
  'error handling examples'
];

for (const query of queries) {
  console.log(`\nSearching: "${query}"`);
  const results = await search.search(query, { top_k: 5 });
  
  results.forEach((result, i) => {
    console.log(`${i+1}. [${result.contentType}] ${result.document.source}`);
    console.log(`   Score: ${result.score.toFixed(2)}`);
    console.log(`   Preview: ${result.content.substring(0, 100)}...`);
  });
}

await search.cleanup();
```

This tutorial covers the complete multimodal workflow. Start with the [Quick Start](#quick-start) section, then explore the advanced features as needed for your specific use case.