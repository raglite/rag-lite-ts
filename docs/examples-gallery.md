# Examples Gallery

*Simple, practical examples for RAG-lite TS - local-first semantic search*

This gallery provides straightforward examples for common use cases, focusing on simplicity and local development.

## Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Text Search Examples](#text-search-examples)
- [Multimodal Examples](#multimodal-examples)
- [Simple Integration Examples](#simple-integration-examples)

## Quick Start Examples

### Basic Document Search

The simplest way to get started with RAG-lite TS:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Ingest documents
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin');
await ingestion.ingestDirectory('./docs/');
await ingestion.cleanup();

// 2. Search documents
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('How to install?');

console.log(`Found ${results.length} results:`);
results.forEach((result, i) => {
  console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
  console.log(`   ${result.content.substring(0, 100)}...`);
});

await search.cleanup();
```

### CLI Quick Start

```bash
# Install globally
npm install -g rag-lite-ts

# Ingest your documents
raglite ingest ./docs/

# Search your content
raglite search "installation guide"
raglite search "API documentation" --rerank --top-k 5
```

## Text Search Examples

### Simple Documentation Search

Perfect for searching your local documentation, notes, or knowledge base:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// 1. Ingest your documentation
const ingestion = new IngestionPipeline('./docs.sqlite', './docs-index.bin');
await ingestion.ingestDirectory('./my-docs/');
await ingestion.cleanup();

// 2. Search your documents
const search = new SearchEngine('./docs-index.bin', './docs.sqlite');

const results = await search.search('how to authenticate', {
  top_k: 5,
  rerank: true
});

console.log('Found documents:');
results.forEach((result, i) => {
  console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
  console.log(`   ${result.content.substring(0, 100)}...`);
});

await search.cleanup();
```

### Personal Knowledge Base

Turn your notes and documents into a searchable knowledge base:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Ingest your personal notes
const ingestion = new IngestionPipeline('./knowledge.sqlite', './knowledge-index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2', // Higher quality for better search
  chunkSize: 300,
  chunkOverlap: 50
});

await ingestion.ingestDirectory('./my-notes/');
await ingestion.cleanup();

// Search your knowledge base
const search = new SearchEngine('./knowledge-index.bin', './knowledge.sqlite');

// Find information across all your notes
const results = await search.search('project ideas for machine learning', {
  top_k: 8,
  rerank: true
});

console.log('Found in your notes:');
results.forEach((result, i) => {
  console.log(`\n${i + 1}. ${result.document.source}`);
  console.log(`   Score: ${result.score.toFixed(2)}`);
  console.log(`   "${result.content.substring(0, 150)}..."`);
});

await search.cleanup();
```

## Multimodal Examples

### Documentation with Screenshots

Search across documentation that includes UI screenshots and diagrams:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

class VisualDocumentationSearch {
  private search: SearchEngine;
  
  constructor() {
    this.search = new SearchEngine('./visual-docs-index.bin', './visual-docs.sqlite');
  }
  
  async ingestVisualDocs(docsPath: string) {
    const ingestion = new IngestionPipeline('./visual-docs.sqlite', './visual-docs-index.bin', {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'text-derived', // Convert images to text for better search
      chunkSize: 300,
      chunkOverlap: 60
    });
    
    console.log('Ingesting visual documentation...');
    const result = await ingestion.ingestDirectory(docsPath);
    await ingestion.cleanup();
    
    console.log(`Processed ${result.documentsProcessed} documents`);
    console.log(`Text chunks: ${result.chunksCreated - result.imageChunks || 0}`);
    console.log(`Image chunks: ${result.imageChunks || 0}`);
    
    return result;
  }
  
  async searchVisualContent(query: string) {
    const results = await this.search.search(query, {
      top_k: 10,
      rerank: true
    });
    
    // Separate text and image results
    const textResults = results.filter(r => r.contentType === 'text');
    const imageResults = results.filter(r => r.contentType === 'image');
    
    return {
      textResults,
      imageResults,
      allResults: results
    };
  }
  
  async findScreenshots(query: string) {
    const results = await this.search.search(`screenshot ${query}`, {
      top_k: 5,
      rerank: true
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        path: r.metadata?.originalPath || r.document.source,
        description: r.content,
        score: r.score,
        dimensions: r.metadata?.dimensions
      }));
  }
  
  async cleanup() {
    await this.search.cleanup();
  }
}

// Usage
const visualDocs = new VisualDocumentationSearch();

// Ingest documentation with images
await visualDocs.ingestVisualDocs('./docs-with-screenshots/');

// Search for UI elements
const uiResults = await visualDocs.searchVisualContent('login form interface');
console.log('UI Search Results:');
console.log(`Found ${uiResults.textResults.length} text matches`);
console.log(`Found ${uiResults.imageResults.length} image matches`);

// Find specific screenshots
const screenshots = await visualDocs.findScreenshots('dashboard');
console.log('\nDashboard Screenshots:');
screenshots.forEach((screenshot, i) => {
  console.log(`${i + 1}. ${screenshot.path}`);
  console.log(`   Description: ${screenshot.description}`);
  console.log(`   Score: ${screenshot.score.toFixed(2)}`);
  if (screenshot.dimensions) {
    console.log(`   Size: ${screenshot.dimensions.width}x${screenshot.dimensions.height}`);
  }
});

await visualDocs.cleanup();
```

### Technical Diagram Search

Search through technical diagrams, flowcharts, and architectural drawings:

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

class TechnicalDiagramSearch {
  private search: SearchEngine;
  
  constructor() {
    this.search = new SearchEngine('./diagrams-index.bin', './diagrams.sqlite');
  }
  
  async ingestDiagrams(diagramsPath: string) {
    const ingestion = new IngestionPipeline('./diagrams.sqlite', './diagrams-index.bin', {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'metadata', // Use filename-based matching for technical diagrams
      chunkSize: 250,
      batchSize: 4 // Conservative for large diagrams
    });
    
    const result = await ingestion.ingestDirectory(diagramsPath);
    await ingestion.cleanup();
    
    return result;
  }
  
  async findDiagrams(type: string, topic: string) {
    const query = `${type} ${topic}`;
    const results = await this.search.search(query, {
      top_k: 8,
      rerank: true
    });
    
    // Filter for images and sort by relevance
    const diagrams = results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        filename: r.document.source.split('/').pop(),
        path: r.document.source,
        description: r.content,
        score: r.score,
        metadata: r.metadata
      }));
    
    return diagrams;
  }
  
  async searchByKeywords(keywords: string[]) {
    const results = new Map();
    
    for (const keyword of keywords) {
      const keywordResults = await this.search.search(keyword, {
        top_k: 5,
        rerank: true
      });
      
      keywordResults
        .filter(r => r.contentType === 'image')
        .forEach(result => {
          const path = result.document.source;
          if (!results.has(path)) {
            results.set(path, {
              path,
              filename: path.split('/').pop(),
              description: result.content,
              keywords: [],
              maxScore: 0
            });
          }
          
          const diagram = results.get(path);
          diagram.keywords.push({ keyword, score: result.score });
          diagram.maxScore = Math.max(diagram.maxScore, result.score);
        });
    }
    
    return Array.from(results.values())
      .sort((a, b) => b.maxScore - a.maxScore);
  }
  
  async cleanup() {
    await this.search.cleanup();
  }
}

// Usage
const diagramSearch = new TechnicalDiagramSearch();

// Ingest technical diagrams
await diagramSearch.ingestDiagrams('./technical-diagrams/');

// Find specific types of diagrams
const architectureDiagrams = await diagramSearch.findDiagrams('architecture', 'system design');
console.log('Architecture Diagrams:');
architectureDiagrams.forEach((diagram, i) => {
  console.log(`${i + 1}. ${diagram.filename} (${diagram.score.toFixed(2)})`);
  console.log(`   Description: ${diagram.description}`);
});

// Search by multiple keywords
const networkDiagrams = await diagramSearch.searchByKeywords([
  'network topology',
  'infrastructure',
  'connectivity'
]);

console.log('\nNetwork-related Diagrams:');
networkDiagrams.forEach((diagram, i) => {
  console.log(`${i + 1}. ${diagram.filename}`);
  console.log(`   Matching keywords: ${diagram.keywords.map(k => k.keyword).join(', ')}`);
  console.log(`   Best score: ${diagram.maxScore.toFixed(2)}`);
});

await diagramSearch.cleanup();
```

## Simple Integration Examples

### Basic Express.js API

Simple local API for your documents:

```typescript
import express from 'express';
import { SearchEngine } from 'rag-lite-ts';

const app = express();
app.use(express.json());

// Initialize search engine
const search = new SearchEngine('./docs-index.bin', './docs.sqlite');

// Simple search endpoint
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    const results = await search.search(query, { top_k: 5 });
    
    res.json({
      query,
      results: results.map(r => ({
        content: r.content,
        score: r.score,
        source: r.document.source
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Local search API running on http://localhost:3000');
});
```

### Simple Node.js Script

Quick script to search your local files:

```javascript
// search-my-docs.js
const { IngestionPipeline, SearchEngine } = require('rag-lite-ts');

async function searchDocs() {
  // First time: ingest your documents
  console.log('Indexing documents...');
  const ingestion = new IngestionPipeline('./my-docs.sqlite', './my-docs-index.bin');
  await ingestion.ingestDirectory('./documents/');
  await ingestion.cleanup();
  
  // Search your documents
  console.log('Searching...');
  const search = new SearchEngine('./my-docs-index.bin', './my-docs.sqlite');
  
  const query = process.argv[2] || 'getting started';
  const results = await search.search(query, { top_k: 3 });
  
  console.log(`\nFound ${results.length} results for "${query}":\n`);
  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
    console.log(`   ${result.content.substring(0, 100)}...\n`);
  });
  
  await search.cleanup();
}

searchDocs().catch(console.error);
```

```bash
# Usage
node search-my-docs.js "how to install"
node search-my-docs.js "configuration options"
```

This simple approach is perfect for RAG-lite's local-first philosophy - no complex infrastructure needed, just your documents and a simple script.