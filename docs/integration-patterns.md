# Integration Patterns

*Simple integration patterns for RAG-lite TS - local-first semantic search*

This guide shows simple ways to integrate RAG-lite TS into your local development workflow and simple applications.

## Table of Contents

- [Local Development Patterns](#local-development-patterns)
- [Simple Web Integration](#simple-web-integration)
- [CLI and Script Patterns](#cli-and-script-patterns)
- [Multimodal Integration Patterns](#multimodal-integration-patterns)
- [Basic Optimization](#basic-optimization)

## Local Development Patterns

### Project-Specific Search

Keep search indexes alongside your project:

```typescript
// project-search.ts
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import path from 'path';

class ProjectSearch {
  private dbPath = './project-search.sqlite';
  private indexPath = './project-search.bin';
  
  async indexProject() {
    const ingestion = new IngestionPipeline(this.dbPath, this.indexPath);
    
    // Index your project documentation
    await ingestion.ingestDirectory('./docs/');
    await ingestion.ingestDirectory('./README.md');
    await ingestion.cleanup();
    
    console.log('Project indexed successfully!');
  }
  
  async search(query: string) {
    const search = new SearchEngine(this.indexPath, this.dbPath);
    const results = await search.search(query, { top_k: 5 });
    await search.cleanup();
    
    return results;
  }
}

// Usage
const projectSearch = new ProjectSearch();
await projectSearch.indexProject();
const results = await projectSearch.search('how to deploy');
```

### Development Workflow Integration

Add search to your development scripts:

```json
// package.json
{
  "scripts": {
    "docs:index": "node scripts/index-docs.js",
    "docs:search": "node scripts/search-docs.js"
  }
}
```

```javascript
// scripts/index-docs.js
const { IngestionPipeline } = require('rag-lite-ts');

async function indexDocs() {
  const ingestion = new IngestionPipeline('./docs.sqlite', './docs-index.bin');
  await ingestion.ingestDirectory('./docs/');
  await ingestion.cleanup();
  console.log('Documentation indexed!');
}

indexDocs().catch(console.error);
```

```javascript
// scripts/search-docs.js
const { SearchEngine } = require('rag-lite-ts');

async function searchDocs() {
  const query = process.argv[2];
  if (!query) {
    console.log('Usage: npm run docs:search "your query"');
    return;
  }
  
  const search = new SearchEngine('./docs-index.bin', './docs.sqlite');
  const results = await search.search(query, { top_k: 3 });
  
  console.log(`Results for "${query}":`);
  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.document.source}`);
    console.log(`   ${result.content.substring(0, 100)}...`);
  });
  
  await search.cleanup();
}

searchDocs().catch(console.error);
```

## Simple Web Integration

### Basic Express.js Setup

Simple local web interface for your documents:

```javascript
// server.js
const express = require('express');
const { SearchEngine } = require('rag-lite-ts');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const search = new SearchEngine('./docs-index.bin', './docs.sqlite');

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    const results = await search.search(query, { top_k: 5 });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Search server running at http://localhost:3000');
});
```

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Document Search</title>
</head>
<body>
    <h1>Search Your Documents</h1>
    <input type="text" id="query" placeholder="Enter your search query">
    <button onclick="search()">Search</button>
    <div id="results"></div>

    <script>
        async function search() {
            const query = document.getElementById('query').value;
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            
            const data = await response.json();
            const resultsDiv = document.getElementById('results');
            
            resultsDiv.innerHTML = data.results.map(result => `
                <div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc;">
                    <strong>${result.document.source}</strong> (${result.score.toFixed(2)})
                    <p>${result.content.substring(0, 200)}...</p>
                </div>
            `).join('');
        }
    </script>
</body>
</html>
```

### Simple Next.js Integration

Add search to your Next.js app:

```typescript
// pages/api/search.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./docs-index.bin', './docs.sqlite');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { query } = req.body;
  const results = await search.search(query, { top_k: 5 });
  res.json({ results });
}
```

## CLI and Script Patterns

### Personal Knowledge Search

Create a personal search command:

```javascript
#!/usr/bin/env node
// search-notes.js

const { SearchEngine } = require('rag-lite-ts');
const path = require('path');

async function searchNotes() {
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.log('Usage: search-notes <query>');
    console.log('Example: search-notes "machine learning concepts"');
    return;
  }
  
  const notesPath = path.join(process.env.HOME, '.notes');
  const search = new SearchEngine(
    path.join(notesPath, 'index.bin'),
    path.join(notesPath, 'notes.sqlite')
  );
  
  try {
    const results = await search.search(query, { top_k: 5, rerank: true });
    
    if (results.length === 0) {
      console.log('No results found.');
      return;
    }
    
    console.log(`Found ${results.length} results:\n`);
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.document.source} (${result.score.toFixed(2)})`);
      console.log(`   ${result.content.substring(0, 150)}...\n`);
    });
  } catch (error) {
    console.error('Search failed:', error.message);
  } finally {
    await search.cleanup();
  }
}

searchNotes();
```

Make it executable:
```bash
chmod +x search-notes.js
ln -s $(pwd)/search-notes.js /usr/local/bin/search-notes
```

## Multimodal Integration Patterns

### Cross-Modal Document Search

Search across text documents and images in a unified embedding space:

```typescript
// multimodal-search.ts
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import path from 'path';

class MultimodalDocumentSearch {
  private dbPath = './multimodal-docs.sqlite';
  private indexPath = './multimodal-docs.bin';
  private search: SearchEngine;
  
  async ingestContent(contentPath: string) {
    const ingestion = new IngestionPipeline(this.dbPath, this.indexPath, {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'text-derived'
    });
    
    console.log('Ingesting multimodal content...');
    const result = await ingestion.ingestDirectory(contentPath);
    await ingestion.cleanup();
    
    console.log(`Processed ${result.documentsProcessed} documents`);
    console.log(`Text chunks: ${result.chunksCreated - (result.imageChunks || 0)}`);
    console.log(`Image chunks: ${result.imageChunks || 0}`);
    
    return result;
  }
  
  async searchAcrossContentTypes(query: string, options = {}) {
    if (!this.search) {
      this.search = new SearchEngine(this.indexPath, this.dbPath);
    }
    
    const results = await this.search.search(query, {
      top_k: 10,
      rerank: true,
      ...options
    });
    
    // Separate results by content type
    const textResults = results.filter(r => r.contentType === 'text');
    const imageResults = results.filter(r => r.contentType === 'image');
    
    return {
      all: results,
      text: textResults,
      images: imageResults
    };
  }
  
  async findImages(textQuery: string) {
    if (!this.search) {
      this.search = new SearchEngine(this.indexPath, this.dbPath);
    }
    
    const results = await this.search.search(textQuery, {
      top_k: 10,
      rerank: true
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        path: r.document.source,
        description: r.content,
        score: r.score,
        metadata: r.metadata
      }));
  }
  
  async cleanup() {
    if (this.search) {
      await this.search.cleanup();
    }
  }
}

// Usage
const multimodalSearch = new MultimodalDocumentSearch();

// Ingest documentation with images
await multimodalSearch.ingestContent('./docs-with-images/');

// Search across both text and images
const results = await multimodalSearch.searchAcrossContentTypes('authentication flow');
console.log(`Found ${results.text.length} text results and ${results.images.length} image results`);

// Find images using text query
const diagrams = await multimodalSearch.findImages('system architecture diagram');
console.log('Found diagrams:');
diagrams.forEach((diagram, i) => {
  console.log(`${i + 1}. ${diagram.path} (${diagram.score.toFixed(2)})`);
  console.log(`   ${diagram.description}`);
});

await multimodalSearch.cleanup();
```

### Visual Asset Management

Organize and search visual assets with text descriptions:

```typescript
// asset-manager.ts
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import fs from 'fs';
import path from 'path';

class VisualAssetManager {
  private dbPath: string;
  private indexPath: string;
  private search: SearchEngine;
  
  constructor(assetLibraryPath: string) {
    this.dbPath = path.join(assetLibraryPath, 'assets.sqlite');
    this.indexPath = path.join(assetLibraryPath, 'assets.bin');
  }
  
  async indexAssets(assetsPath: string) {
    const ingestion = new IngestionPipeline(this.dbPath, this.indexPath, {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'metadata', // Use filename-based matching
      batchSize: 4 // Conservative for large images
    });
    
    const result = await ingestion.ingestDirectory(assetsPath);
    await ingestion.cleanup();
    
    return result;
  }
  
  async findAssetsByDescription(description: string, options = {}) {
    if (!this.search) {
      this.search = new SearchEngine(this.indexPath, this.dbPath);
    }
    
    const results = await this.search.search(description, {
      top_k: 20,
      rerank: true,
      ...options
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        filename: path.basename(r.document.source),
        path: r.document.source,
        description: r.content,
        score: r.score,
        dimensions: r.metadata?.dimensions,
        format: r.metadata?.format
      }));
  }
  
  async findSimilarAssets(referencePath: string, topK = 10) {
    // In a real implementation, you would embed the reference image
    // and search for similar vectors. For now, use filename as query.
    const filename = path.basename(referencePath, path.extname(referencePath));
    return await this.findAssetsByDescription(filename, { top_k: topK });
  }
  
  async searchByTags(tags: string[]) {
    const results = new Map();
    
    for (const tag of tags) {
      const tagResults = await this.findAssetsByDescription(tag, { top_k: 10 });
      
      tagResults.forEach(asset => {
        if (!results.has(asset.path)) {
          results.set(asset.path, {
            ...asset,
            matchingTags: [],
            maxScore: 0
          });
        }
        
        const existing = results.get(asset.path);
        existing.matchingTags.push({ tag, score: asset.score });
        existing.maxScore = Math.max(existing.maxScore, asset.score);
      });
    }
    
    return Array.from(results.values())
      .sort((a, b) => b.maxScore - a.maxScore);
  }
  
  async cleanup() {
    if (this.search) {
      await this.search.cleanup();
    }
  }
}

// Usage
const assetManager = new VisualAssetManager('./asset-library');

// Index your visual assets
await assetManager.indexAssets('./images/');

// Find assets by description
const redCars = await assetManager.findAssetsByDescription('red sports car');
console.log('Red car images:');
redCars.forEach((asset, i) => {
  console.log(`${i + 1}. ${asset.filename} (${asset.score.toFixed(2)})`);
  if (asset.dimensions) {
    console.log(`   Size: ${asset.dimensions.width}x${asset.dimensions.height}`);
  }
});

// Search by multiple tags
const natureAssets = await assetManager.searchByTags(['ocean', 'sunset', 'landscape']);
console.log('\nNature-themed assets:');
natureAssets.forEach((asset, i) => {
  console.log(`${i + 1}. ${asset.filename}`);
  console.log(`   Tags: ${asset.matchingTags.map(t => t.tag).join(', ')}`);
  console.log(`   Score: ${asset.maxScore.toFixed(2)}`);
});

await assetManager.cleanup();
```

### Technical Documentation with Diagrams

Search technical documentation that includes diagrams and screenshots:

```typescript
// tech-docs-search.ts
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

class TechnicalDocsSearch {
  private search: SearchEngine;
  
  constructor(
    private dbPath = './tech-docs.sqlite',
    private indexPath = './tech-docs.bin'
  ) {}
  
  async ingestDocs(docsPath: string) {
    const ingestion = new IngestionPipeline(this.dbPath, this.indexPath, {
      mode: 'multimodal',
      embeddingModel: 'Xenova/clip-vit-base-patch32',
      rerankingStrategy: 'text-derived',
      chunkSize: 300,
      chunkOverlap: 60
    });
    
    const result = await ingestion.ingestDirectory(docsPath);
    await ingestion.cleanup();
    
    return result;
  }
  
  async searchDocs(query: string) {
    if (!this.search) {
      this.search = new SearchEngine(this.indexPath, this.dbPath);
    }
    
    const results = await this.search.search(query, {
      top_k: 10,
      rerank: true
    });
    
    return {
      text: results.filter(r => r.contentType === 'text'),
      diagrams: results.filter(r => r.contentType === 'image')
    };
  }
  
  async findDiagrams(topic: string) {
    if (!this.search) {
      this.search = new SearchEngine(this.indexPath, this.dbPath);
    }
    
    const results = await this.search.search(`${topic} diagram`, {
      top_k: 8,
      rerank: true
    });
    
    return results
      .filter(r => r.contentType === 'image')
      .map(r => ({
        filename: r.document.source.split('/').pop(),
        path: r.document.source,
        description: r.content,
        score: r.score
      }));
  }
  
  async cleanup() {
    if (this.search) {
      await this.search.cleanup();
    }
  }
}

// Usage
const techDocs = new TechnicalDocsSearch();

// Ingest technical documentation
await techDocs.ingestDocs('./technical-docs/');

// Search for specific topics
const authResults = await techDocs.searchDocs('authentication and authorization');
console.log('Authentication Documentation:');
console.log(`Text sections: ${authResults.text.length}`);
console.log(`Diagrams: ${authResults.diagrams.length}`);

// Find specific diagrams
const architectureDiagrams = await techDocs.findDiagrams('system architecture');
console.log('\nArchitecture Diagrams:');
architectureDiagrams.forEach((diagram, i) => {
  console.log(`${i + 1}. ${diagram.filename} (${diagram.score.toFixed(2)})`);
  console.log(`   ${diagram.description}`);
});

await techDocs.cleanup();
```

### Mode Selection Pattern

Choose the right mode for your use case:

```typescript
// mode-selection.ts
import { IngestionPipeline } from 'rag-lite-ts';

class AdaptiveContentPipeline {
  static async createForContent(contentPath: string, dbPath: string, indexPath: string) {
    // Detect content types in directory
    const hasImages = await this.detectImages(contentPath);
    const hasText = await this.detectText(contentPath);
    
    if (hasImages && hasText) {
      // Mixed content: use multimodal mode
      console.log('Detected mixed content, using multimodal mode');
      return new IngestionPipeline(dbPath, indexPath, {
        mode: 'multimodal',
        embeddingModel: 'Xenova/clip-vit-base-patch32',
        rerankingStrategy: 'text-derived'
      });
    } else if (hasText) {
      // Text only: use text mode
      console.log('Detected text-only content, using text mode');
      return new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'Xenova/all-mpnet-base-v2'
      });
    } else {
      throw new Error('No supported content found');
    }
  }
  
  private static async detectImages(contentPath: string): Promise<boolean> {
    // Implementation to detect image files
    // Return true if .jpg, .png, etc. files found
    return false; // Placeholder
  }
  
  private static async detectText(contentPath: string): Promise<boolean> {
    // Implementation to detect text files
    // Return true if .txt, .md, etc. files found
    return false; // Placeholder
  }
}

// Usage
const pipeline = await AdaptiveContentPipeline.createForContent(
  './my-content/',
  './content.sqlite',
  './content.bin'
);

await pipeline.ingestDirectory('./my-content/');
await pipeline.cleanup();
```

### Batch Processing Script

Process multiple directories:

```javascript
// batch-index.js
const { IngestionPipeline } = require('rag-lite-ts');
const fs = require('fs');
const path = require('path');

async function batchIndex() {
  const directories = [
    './projects/project-a/docs',
    './projects/project-b/docs',
    './notes',
    './references'
  ];
  
  const ingestion = new IngestionPipeline('./all-docs.sqlite', './all-docs-index.bin');
  
  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      console.log(`Indexing ${dir}...`);
      try {
        await ingestion.ingestDirectory(dir);
        console.log(`✓ Indexed ${dir}`);
      } catch (error) {
        console.log(`✗ Failed to index ${dir}: ${error.message}`);
      }
    }
  }
  
  await ingestion.cleanup();
  console.log('Batch indexing complete!');
}

batchIndex().catch(console.error);
```

## Basic Optimization

### Simple Caching

Add basic caching for repeated queries:

```javascript
// cached-search.js
const { SearchEngine } = require('rag-lite-ts');

class CachedSearch {
  constructor(indexPath, dbPath) {
    this.search = new SearchEngine(indexPath, dbPath);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  async search(query, options = {}) {
    const cacheKey = JSON.stringify({ query, options });
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.results;
    }
    
    const results = await this.search.search(query, options);
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    return results;
  }
  
  async cleanup() {
    await this.search.cleanup();
  }
}

module.exports = CachedSearch;
```

### Environment-Based Configuration

Simple configuration for different environments:

```javascript
// config.js
const path = require('path');

const config = {
  development: {
    dbPath: './dev-docs.sqlite',
    indexPath: './dev-docs-index.bin',
    model: 'sentence-transformers/all-MiniLM-L6-v2' // Faster for dev
  },
  production: {
    dbPath: './docs.sqlite',
    indexPath: './docs-index.bin',
    model: 'Xenova/all-mpnet-base-v2' // Better quality
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
```

These patterns focus on RAG-lite's strength as a local-first, simple solution for semantic search without the complexity of production-grade vector databases.