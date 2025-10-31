# Integration Patterns

*Simple integration patterns for RAG-lite TS - local-first semantic search*

This guide shows simple ways to integrate RAG-lite TS into your local development workflow and simple applications.

## Table of Contents

- [Local Development Patterns](#local-development-patterns)
- [Simple Web Integration](#simple-web-integration)
- [CLI and Script Patterns](#cli-and-script-patterns)
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