# Implementation Guide: Binary Index Format & Content-Type Filtering

**Status:** Ready for Implementation  
**Approach:** Clean Slate (No Backward Compatibility)  
**Estimated Time:** 12-18 hours

---

## Executive Summary

### Problem
1. JSON index format is 3.66x larger and 3.5x slower than binary
2. CLIP image→text search yields only 2.6% text results (13 out of 500)
3. Need efficient content-type filtering for multimodal search

### Solution
1. Convert index format from JSON to binary (universal improvement)
2. Add in-memory content-type map for fast filtering
3. Implement smart over-fetch strategy (40x for image→text)
4. Expose filtering via API, CLI, and MCP server

### Trade-offs
- ✅ 3.66x smaller files, 3.5x faster loading
- ✅ Solves CLIP bias problem (2.6% → 100% text results)
- ✅ Simple architecture (single unified index)
- ⚠️ Breaking change (users must re-ingest)
- ⚠️ Filtered search ~100ms vs ~50ms unfiltered

---

## Architecture Overview

### Current State (JSON)
```
.raglite/
├── db.sqlite (metadata)
└── index.bin (JSON text format, 216 MB for 30k vectors)
```

### Target State (Binary)
```
.raglite/
├── db.sqlite (metadata with content_type field)
└── index.bin (binary format, 59 MB for 30k vectors)

In-Memory:
└── contentTypeMap: Map<vectorId, 'text'|'image'> (720 KB)
```


## Phase 1: Binary Index Format

### 1.1 Create Binary Format Module

**File:** `src/core/binary-index-format.ts`

```typescript
export interface BinaryIndexData {
  dimensions: number;
  maxElements: number;
  M: number;
  efConstruction: number;
  seed: number;
  currentSize: number;
  vectors: Array<{ id: number; vector: Float32Array }>;
}

export class BinaryIndexFormat {
  static async save(indexPath: string, data: BinaryIndexData): Promise<void> {
    // Calculate total size
    const headerSize = 24; // 6 uint32 fields
    const vectorSize = 4 + (data.dimensions * 4); // id + vector
    const totalSize = headerSize + (data.currentSize * vectorSize);
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    let offset = 0;
    
    // Write header
    view.setUint32(offset, data.dimensions, true); offset += 4;
    view.setUint32(offset, data.maxElements, true); offset += 4;
    view.setUint32(offset, data.M, true); offset += 4;
    view.setUint32(offset, data.efConstruction, true); offset += 4;
    view.setUint32(offset, data.seed, true); offset += 4;
    view.setUint32(offset, data.currentSize, true); offset += 4;
    
    // Write vectors
    for (const item of data.vectors) {
      view.setUint32(offset, item.id, true); offset += 4;
      
      for (let i = 0; i < item.vector.length; i++) {
        view.setFloat32(offset, item.vector[i], true);
        offset += 4;
      }
    }
    
    writeFileSync(indexPath, Buffer.from(buffer));
  }
  
  static async load(indexPath: string): Promise<BinaryIndexData> {
    const buffer = readFileSync(indexPath);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    let offset = 0;
    
    // Read header
    const dimensions = view.getUint32(offset, true); offset += 4;
    const maxElements = view.getUint32(offset, true); offset += 4;
    const M = view.getUint32(offset, true); offset += 4;
    const efConstruction = view.getUint32(offset, true); offset += 4;
    const seed = view.getUint32(offset, true); offset += 4;
    const currentSize = view.getUint32(offset, true); offset += 4;
    
    // Read vectors
    const vectors: Array<{ id: number; vector: Float32Array }> = [];
    for (let i = 0; i < currentSize; i++) {
      const id = view.getUint32(offset, true); offset += 4;
      
      // Zero-copy Float32Array view
      const vector = new Float32Array(
        buffer.buffer,
        buffer.byteOffset + offset,
        dimensions
      );
      offset += dimensions * 4;
      
      vectors.push({ id, vector: new Float32Array(vector) }); // Copy to avoid buffer issues
    }
    
    return { dimensions, maxElements, M, efConstruction, seed, currentSize, vectors };
  }
}
```


### 1.2 Update VectorIndex Class

**File:** `src/core/vector-index.ts`

**Changes:**
1. Remove all JSON-related code
2. Replace with binary format calls
3. Simplify save/load methods

```typescript
import { BinaryIndexFormat } from './binary-index-format.js';

export class VectorIndex {
  // ... existing properties ...
  
  async saveIndex(): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    try {
      const vectors = Array.from(this.vectorStorage.entries()).map(([id, vector]) => ({
        id,
        vector
      }));
      
      await BinaryIndexFormat.save(this.indexPath, {
        dimensions: this.options.dimensions,
        maxElements: this.options.maxElements,
        M: this.options.M || 16,
        efConstruction: this.options.efConstruction || 200,
        seed: this.options.seed || 100,
        currentSize: this.currentSize,
        vectors
      });
      
      console.log(`Saved HNSW index with ${this.currentSize} vectors to ${this.indexPath}`);
    } catch (error) {
      throw new Error(`Failed to save index to ${this.indexPath}: ${error}`);
    }
  }

  async loadIndex(): Promise<void> {
    if (!existsSync(this.indexPath)) {
      throw createMissingFileError(this.indexPath, 'index', {
        operationContext: 'VectorIndex.loadIndex'
      });
    }

    try {
      // Load hnswlib module (existing code)
      if (!this.hnswlib) {
        // ... existing hnswlib loading code ...
      }
      
      // Create new HNSW index
      this.index = new this.hnswlib.HierarchicalNSW('cosine', this.options.dimensions, '');
      
      // Load from binary format
      const data = await BinaryIndexFormat.load(this.indexPath);
      
      // Check dimension compatibility
      if (data.dimensions !== this.options.dimensions) {
        throw createDimensionMismatchError(
          this.options.dimensions,
          data.dimensions,
          'vector index loading',
          { operationContext: 'VectorIndex.loadIndex' }
        );
      }
      
      // Update options from stored data
      this.options.maxElements = data.maxElements;
      this.options.M = data.M;
      this.options.efConstruction = data.efConstruction;
      this.options.seed = data.seed;
      
      // Initialize index
      this.index.initIndex(
        this.options.maxElements,
        this.options.M,
        this.options.efConstruction,
        this.options.seed
      );
      
      // Clear and repopulate vector storage
      this.vectorStorage.clear();
      
      // Add all stored vectors
      for (const item of data.vectors) {
        this.index.addPoint(item.vector, item.id, false);
        this.vectorStorage.set(item.id, item.vector);
      }
      
      this.currentSize = data.currentSize;
      console.log(`Loaded HNSW index with ${this.currentSize} vectors from ${this.indexPath}`);
    } catch (error) {
      throw new Error(`Failed to load index from ${this.indexPath}: ${error}`);
    }
  }
}
```


---

## Phase 2: Content-Type Filtering

### 2.1 Add Content-Type Map to IndexManager

**File:** `src/index-manager.ts`

**Add properties:**
```typescript
export class IndexManager {
  // ... existing properties ...
  private contentTypeMap: Map<number, string> = new Map();
  
  // ... existing methods ...
}
```

**Update initialize method:**
```typescript
async initialize(skipModelCheck: boolean = false, forceRecreate: boolean = false): Promise<void> {
  if (this.isInitialized) {
    return;
  }

  try {
    // Open database connection
    this.db = await openDatabase(this.dbPath);

    // ... existing model compatibility check ...

    // Load or create index
    if (forceRecreate || !this.vectorIndex.indexExists()) {
      console.log('Creating new vector index...');
      await this.vectorIndex.initialize();
    } else {
      console.log('Loading existing vector index...');
      await this.vectorIndex.loadIndex();
    }

    // Populate embedding ID mapping
    const existingChunks = await this.db.all('SELECT embedding_id FROM chunks ORDER BY id');
    for (const chunk of existingChunks) {
      this.hashEmbeddingId(chunk.embedding_id);
    }

    // NEW: Build content-type map from database
    await this.buildContentTypeMap();

    this.isInitialized = true;
    console.log(`Index manager initialized with ${this.vectorIndex.getCurrentCount()} vectors`);
  } catch (error) {
    throw new Error(`Failed to initialize index manager: ${error}`);
  }
}

private async buildContentTypeMap(): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }

  const chunks = await this.db.all('SELECT embedding_id, content_type FROM chunks');
  
  this.contentTypeMap.clear();
  for (const chunk of chunks) {
    const vectorId = this.embeddingIdToHash.get(chunk.embedding_id);
    if (vectorId !== undefined) {
      this.contentTypeMap.set(vectorId, chunk.content_type || 'text');
    }
  }
  
  console.log(`✓ Content-type map loaded: ${this.contentTypeMap.size} entries`);
}
```

**Update addVectors method:**
```typescript
async addVectors(embeddings: EmbeddingResult[]): Promise<void> {
  if (!this.isInitialized) {
    throw new Error('Index manager not initialized');
  }

  if (embeddings.length === 0) {
    return;
  }

  const vectors: Array<{ id: number; vector: Float32Array }> = [];

  for (const embedding of embeddings) {
    const hash = this.hashEmbeddingId(embedding.embedding_id);
    vectors.push({
      id: hash,
      vector: embedding.vector
    });
    
    // NEW: Update content-type map
    const contentType = embedding.contentType || 'text';
    this.contentTypeMap.set(hash, contentType);
  }

  this.vectorIndex.addVectors(vectors);
  await this.vectorIndex.saveIndex();
}
```


### 2.2 Add Filtered Search to IndexManager

**File:** `src/index-manager.ts`

**Add new method:**
```typescript
/**
 * Search with optional content-type filtering
 * Uses over-fetch strategy to compensate for CLIP same-modality bias
 */
async searchWithFilter(
  queryVector: Float32Array,
  topK: number,
  contentTypeFilter?: string
): Promise<{ embeddingIds: string[]; distances: number[] }> {
  if (!contentTypeFilter) {
    // No filter: use standard search
    return this.search(queryVector, topK);
  }

  // Calculate over-fetch multiplier
  const multiplier = this.calculateOverFetchMultiplier(contentTypeFilter);
  const fetchCount = Math.min(topK * multiplier, this.vectorIndex.getCurrentCount());

  console.log(`Filtered search: fetching ${fetchCount} results (${multiplier}x) to get ${topK} ${contentTypeFilter} results`);

  // Fetch over-fetched results
  const searchResult = this.vectorIndex.search(queryVector, fetchCount);

  // Filter by content type
  const filteredResults: { embeddingIds: string[]; distances: number[] } = {
    embeddingIds: [],
    distances: []
  };

  for (let i = 0; i < searchResult.neighbors.length; i++) {
    const vectorId = searchResult.neighbors[i];
    const contentType = this.contentTypeMap.get(vectorId);

    if (contentType === contentTypeFilter) {
      const embeddingId = this.hashToEmbeddingId.get(vectorId);
      if (embeddingId) {
        filteredResults.embeddingIds.push(embeddingId);
        filteredResults.distances.push(searchResult.distances[i]);
      }

      // Stop when we have enough results
      if (filteredResults.embeddingIds.length >= topK) {
        break;
      }
    }
  }

  // Log effectiveness
  const effectiveness = filteredResults.embeddingIds.length / topK;
  if (effectiveness < 0.8) {
    console.warn(
      `⚠️  Over-fetch yielded only ${filteredResults.embeddingIds.length}/${topK} ${contentTypeFilter} results. ` +
      `Consider running: raglite optimize`
    );
  }

  return filteredResults;
}

private calculateOverFetchMultiplier(contentTypeFilter: string): number {
  // Get corpus statistics
  const stats = this.getContentTypeStats();
  
  // For CLIP image→text: empirical 40x multiplier
  // This is based on observed 2.6% text results in COCO dataset
  if (contentTypeFilter === 'text') {
    return 40;
  }
  
  // For image filtering: use corpus ratio with safety margin
  const ratio = stats[contentTypeFilter] / stats.total;
  return Math.max(2, Math.ceil(1 / ratio) * 2);
}

private getContentTypeStats(): { text: number; image: number; total: number } {
  const stats = { text: 0, image: 0, total: 0 };
  
  for (const contentType of this.contentTypeMap.values()) {
    if (contentType === 'text') {
      stats.text++;
    } else if (contentType === 'image') {
      stats.image++;
    }
    stats.total++;
  }
  
  return stats;
}
```


---

## Phase 3: API Updates

### 3.1 Update SearchOptions Interface

**File:** `src/core/types.ts`

```typescript
export interface SearchOptions {
  top_k?: number;
  rerank?: boolean;
  contentType?: string;
  resultTypes?: ('text' | 'image')[]; // NEW: Filter by content type
}
```

### 3.2 Update SearchEngine

**File:** `src/core/search.ts`

**Update search method:**
```typescript
async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const startTime = performance.now();
  const topK = options.top_k || config.top_k || 10;
  const shouldRerank = options.rerank !== undefined ? options.rerank : (this.rerankFn !== undefined);
  const contentTypeFilter = options.resultTypes?.[0]; // Use first type if specified

  try {
    // Step 1: Build query embedding
    const embeddingStartTime = performance.now();
    const queryEmbedding = await this.embedFn(query);
    const embeddingTime = performance.now() - embeddingStartTime;

    // Step 2: Search with optional content-type filter
    const searchStartTime = performance.now();
    let searchResult;
    
    if (contentTypeFilter) {
      // Use filtered search with over-fetch
      searchResult = await this.indexManager.searchWithFilter(
        queryEmbedding.vector,
        topK,
        contentTypeFilter
      );
    } else {
      // Standard search
      searchResult = this.indexManager.search(queryEmbedding.vector, topK);
    }
    
    const vectorSearchTime = performance.now() - searchStartTime;

    // ... rest of existing search logic ...
  }
}
```


### 3.3 Update CLI

**File:** `src/cli/search.ts`

**Add CLI option:**
```typescript
// In CLI command definition (wherever that is)
.option('--result-type <type>', 'Filter results by content type (text|image|all)', 'all')

// In runSearch function
export async function runSearch(query: string, options: Record<string, any> = {}): Promise<void> {
  // ... existing code ...
  
  // Prepare search options
  const searchOptions: SearchOptions = {};
  
  if (options['top-k'] !== undefined) {
    searchOptions.top_k = options['top-k'];
  }
  
  if (options.rerank !== undefined) {
    searchOptions.rerank = options.rerank;
  }
  
  // NEW: Add result type filter
  if (options['result-type'] && options['result-type'] !== 'all') {
    searchOptions.resultTypes = [options['result-type']];
  }
  
  // Perform search
  const results = await searchEngine.search(query, searchOptions);
  
  // ... existing display code ...
}
```

### 3.4 Update MCP Server

**File:** `src/mcp-server.ts`

**Update search tool schema:**
```typescript
{
  name: "search",
  description: "Search the knowledge base",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      },
      top_k: {
        type: "number",
        description: "Number of results to return",
        default: 10
      },
      result_types: {
        type: "array",
        items: {
          type: "string",
          enum: ["text", "image"]
        },
        description: "Filter results by content type (multimodal mode only)"
      }
    },
    required: ["query"]
  }
}
```

**Update search handler:**
```typescript
async handleSearch(args: any) {
  const searchOptions: SearchOptions = {
    top_k: args.top_k || 10
  };
  
  // Add result type filter if specified
  if (args.result_types && Array.isArray(args.result_types)) {
    searchOptions.resultTypes = args.result_types;
  }
  
  const results = await this.searchEngine.search(args.query, searchOptions);
  
  // ... format and return results ...
}
```


---

## Phase 4: Testing

### 4.1 Binary Format Tests

**File:** `tests/binary-index-format.test.ts`

```typescript
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { BinaryIndexFormat } from '../src/core/binary-index-format.js';

describe('BinaryIndexFormat', () => {
  test('should save and load binary index', async () => {
    const testData = {
      dimensions: 512,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 3,
      vectors: [
        { id: 1, vector: new Float32Array([0.1, 0.2, 0.3]) },
        { id: 2, vector: new Float32Array([0.4, 0.5, 0.6]) },
        { id: 3, vector: new Float32Array([0.7, 0.8, 0.9]) }
      ]
    };
    
    const testPath = './test-index.bin';
    
    // Save
    await BinaryIndexFormat.save(testPath, testData);
    
    // Load
    const loaded = await BinaryIndexFormat.load(testPath);
    
    // Verify
    assert.strictEqual(loaded.dimensions, testData.dimensions);
    assert.strictEqual(loaded.currentSize, testData.currentSize);
    assert.strictEqual(loaded.vectors.length, testData.vectors.length);
    
    // Cleanup
    unlinkSync(testPath);
  });
  
  test('should handle large indices', async () => {
    // Test with 10k vectors
    const vectors = [];
    for (let i = 0; i < 10000; i++) {
      vectors.push({
        id: i,
        vector: new Float32Array(512).fill(Math.random())
      });
    }
    
    const testData = {
      dimensions: 512,
      maxElements: 10000,
      M: 16,
      efConstruction: 200,
      seed: 100,
      currentSize: 10000,
      vectors
    };
    
    const testPath = './test-large-index.bin';
    
    const saveStart = Date.now();
    await BinaryIndexFormat.save(testPath, testData);
    const saveTime = Date.now() - saveStart;
    
    const loadStart = Date.now();
    const loaded = await BinaryIndexFormat.load(testPath);
    const loadTime = Date.now() - loadStart;
    
    console.log(`Save time: ${saveTime}ms, Load time: ${loadTime}ms`);
    assert.ok(loadTime < 1000, 'Load should be fast (<1s for 10k vectors)');
    
    // Cleanup
    unlinkSync(testPath);
  });
});
```


### 4.2 Content-Type Filtering Tests

**File:** `tests/content-type-filtering.test.ts`

```typescript
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('Content-Type Filtering', () => {
  test('should filter text results from mixed corpus', async () => {
    // Setup: Create index with mixed content
    const indexManager = new IndexManager('./test.index', './test.db', 512);
    await indexManager.initialize();
    
    // Add mixed vectors
    await indexManager.addVectors([
      { embedding_id: 'text1', vector: new Float32Array(512), contentType: 'text' },
      { embedding_id: 'image1', vector: new Float32Array(512), contentType: 'image' },
      { embedding_id: 'text2', vector: new Float32Array(512), contentType: 'text' },
    ]);
    
    // Search with text filter
    const queryVector = new Float32Array(512).fill(0.5);
    const results = await indexManager.searchWithFilter(queryVector, 10, 'text');
    
    // Verify only text results
    assert.ok(results.embeddingIds.every(id => id.startsWith('text')));
  });
  
  test('should use correct over-fetch multiplier', async () => {
    const indexManager = new IndexManager('./test.index', './test.db', 512);
    
    // Test text filter (should use 40x)
    const textMultiplier = indexManager['calculateOverFetchMultiplier']('text');
    assert.strictEqual(textMultiplier, 40);
    
    // Test image filter (should use corpus ratio)
    const imageMultiplier = indexManager['calculateOverFetchMultiplier']('image');
    assert.ok(imageMultiplier >= 2);
  });
});
```

### 4.3 Integration Tests

**File:** `tests/integration/filtered-search.test.ts`

```typescript
describe('Filtered Search Integration', () => {
  test('should perform image→text search', async () => {
    // Ingest mixed content
    const ingestion = await IngestionFactory.create('./test.db', './test.index', {
      mode: 'multimodal'
    });
    
    await ingestion.ingestFile('./test-image.jpg');
    await ingestion.ingestFile('./test-text.txt');
    
    // Search with text filter
    const search = await SearchFactory.create('./test.index', './test.db');
    const results = await search.search('./test-image.jpg', {
      top_k: 10,
      resultTypes: ['text']
    });
    
    // Verify all results are text
    assert.ok(results.every(r => r.contentType === 'text'));
    assert.ok(results.length > 0, 'Should return text results');
  });
});
```


---

## Phase 5: Documentation

### 5.1 Breaking Change Notice

**File:** `CHANGELOG.md`

```markdown
# v0.x.0 - Binary Index Format & Content-Type Filtering

## Breaking Changes

### Index Format Migration

The vector index format has changed from JSON to binary.

**Action Required:**
```bash
# Remove old index
rm -rf .raglite/

# Re-ingest your documents
raglite ingest ./docs
```

**Why this change:**
- 3.66x smaller index files (216 MB → 59 MB for 30k vectors)
- 3.5x faster loading (350ms → 100ms)
- Enables future optimizations (partial loading, clustering)

## New Features

### Content-Type Filtering (Multimodal Mode)

Filter search results by content type:

```bash
# Find text descriptions of an image
raglite search ./photo.jpg --result-type text

# Find images matching text query
raglite search "red car" --result-type image
```

**MCP Server:**
```json
{
  "query": "red car",
  "result_types": ["text"]
}
```

### Performance Characteristics

- Unfiltered search: ~50ms
- Text-filtered search: ~100ms (uses 40x over-fetch for CLIP bias)
- Image-filtered search: ~60ms (uses 2x over-fetch)
```


### 5.2 User Guide

**File:** `docs/MULTIMODAL_SEARCH.md`

```markdown
# Multimodal Search Guide

## Content-Type Filtering

When using multimodal mode with CLIP embeddings, you can filter search results by content type.

### Why Filter?

CLIP embeddings exhibit same-modality bias:
- Image queries tend to return mostly images
- Text queries tend to return mostly text

Filtering ensures you get the content type you want.

### CLI Usage

```bash
# Find text descriptions of an image
raglite search ./photo.jpg --result-type text --top-k 20

# Find images matching text description
raglite search "sunset over mountains" --result-type image --top-k 10

# Search all content types (default)
raglite search "machine learning" --result-type all
```

### MCP Server Usage

```json
{
  "name": "search",
  "arguments": {
    "query": "./photo.jpg",
    "top_k": 20,
    "result_types": ["text"]
  }
}
```

### Performance Notes

Filtered searches use over-fetching to compensate for CLIP's same-modality bias:

- **Text filtering:** Fetches 40x results, filters to requested count
  - Example: Request 10 text results → fetch 400 mixed → filter to 10 text
  - Time: ~100ms (vs ~50ms unfiltered)

- **Image filtering:** Fetches 2x results, filters to requested count
  - Example: Request 10 image results → fetch 20 mixed → filter to 10 images
  - Time: ~60ms (vs ~50ms unfiltered)

### Troubleshooting

If you get fewer results than requested:

```
⚠️  Over-fetch yielded only 8/10 text results.
```

This means the over-fetch multiplier wasn't sufficient. Solutions:
1. Increase `top_k` to get more results
2. Run `raglite optimize` to improve index organization
3. Ingest more content of the desired type
```


---

## Implementation Checklist

### Phase 1: Binary Format ✓
- [ ] Create `src/core/binary-index-format.ts`
- [ ] Implement `BinaryIndexFormat.save()`
- [ ] Implement `BinaryIndexFormat.load()`
- [ ] Update `VectorIndex.saveIndex()` to use binary format
- [ ] Update `VectorIndex.loadIndex()` to use binary format
- [ ] Remove all JSON-related code from `VectorIndex`
- [ ] Test binary format with small dataset (100 vectors)
- [ ] Test binary format with large dataset (10k vectors)
- [ ] Verify file size reduction (should be ~3.66x smaller)
- [ ] Verify loading speed improvement (should be ~3.5x faster)

### Phase 2: Content-Type Filtering ✓
- [ ] Add `contentTypeMap` property to `IndexManager`
- [ ] Implement `buildContentTypeMap()` method
- [ ] Update `initialize()` to build content-type map
- [ ] Update `addVectors()` to update content-type map
- [ ] Implement `searchWithFilter()` method
- [ ] Implement `calculateOverFetchMultiplier()` method
- [ ] Implement `getContentTypeStats()` method
- [ ] Test content-type map building
- [ ] Test filtered search with text filter
- [ ] Test filtered search with image filter
- [ ] Test over-fetch effectiveness logging

### Phase 3: API Updates ✓
- [ ] Add `resultTypes` to `SearchOptions` interface
- [ ] Update `SearchEngine.search()` to use filtered search
- [ ] Add `--result-type` flag to CLI
- [ ] Update CLI `runSearch()` to pass result type filter
- [ ] Update MCP server search tool schema
- [ ] Update MCP server search handler
- [ ] Test CLI with `--result-type text`
- [ ] Test CLI with `--result-type image`
- [ ] Test MCP server with `result_types` parameter

### Phase 4: Testing ✓
- [ ] Write binary format unit tests
- [ ] Write content-type filtering unit tests
- [ ] Write integration tests for filtered search
- [ ] Test with COCO dataset (verify 500 text results from image query)
- [ ] Test incremental ingestion with filtering
- [ ] Test performance benchmarks
- [ ] Verify no memory leaks in content-type map

### Phase 5: Documentation ✓
- [ ] Write breaking change notice in CHANGELOG
- [ ] Create multimodal search guide
- [ ] Document performance characteristics
- [ ] Add troubleshooting section
- [ ] Update README with new features
- [ ] Add migration instructions


---

## Verification Steps

### 1. Binary Format Verification

```bash
# Before implementation
ls -lh .raglite/index.bin
# Expected: ~216 MB for 30k vectors (JSON)

# After implementation
ls -lh .raglite/index.bin
# Expected: ~59 MB for 30k vectors (binary)

# Verify loading speed
time raglite search "test query"
# Expected: Index loading should be ~3.5x faster
```

### 2. Content-Type Filtering Verification

```bash
# Ingest mixed content
raglite ingest ./test-data/mixed/

# Test text filtering
raglite search ./test-image.jpg --result-type text --top-k 500

# Verify:
# - All results should be text content
# - Should get close to 500 results (not just 13!)
# - Search time should be ~100ms
```

### 3. MCP Server Verification

```json
// Test filtered search via MCP
{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "./photo.jpg",
      "top_k": 100,
      "result_types": ["text"]
    }
  }
}

// Verify:
// - All results have contentType: "text"
// - Results count is close to 100
// - Response time is reasonable (~100ms)
```

### 4. Performance Benchmarks

```typescript
// Run performance tests
npm run test:performance

// Expected results:
// - Binary save: <500ms for 30k vectors
// - Binary load: <100ms for 30k vectors
// - Filtered search (text): <150ms
// - Filtered search (image): <80ms
// - Memory usage: <1 GB for 30k vectors + map
```


---

## Common Issues & Solutions

### Issue 1: Binary Format Endianness

**Problem:** Binary files not portable across different architectures.

**Solution:** Always use little-endian (true parameter in DataView methods):
```typescript
view.setUint32(offset, value, true);  // ← true = little-endian
view.setFloat32(offset, value, true); // ← true = little-endian
```

### Issue 2: Buffer Alignment

**Problem:** Float32Array requires 4-byte alignment.

**Solution:** Ensure proper offset alignment:
```typescript
// Ensure offset is 4-byte aligned
if (offset % 4 !== 0) {
  throw new Error(`Offset ${offset} is not 4-byte aligned`);
}
```

### Issue 3: Memory Leaks in Content-Type Map

**Problem:** Map grows indefinitely with incremental ingestion.

**Solution:** Map is rebuilt from database on startup, so it's always in sync:
```typescript
// On initialize: rebuild from database
await this.buildContentTypeMap();

// On addVectors: update map
this.contentTypeMap.set(vectorId, contentType);
```

### Issue 4: Over-Fetch Returns Fewer Results

**Problem:** Over-fetch multiplier insufficient for corpus.

**Solution:** Log warning and suggest optimization:
```typescript
if (effectiveness < 0.8) {
  console.warn(
    `⚠️  Over-fetch yielded only ${filtered.length}/${topK} results. ` +
    `Consider running: raglite optimize`
  );
}
```

### Issue 5: Large Binary Files

**Problem:** Binary files still large for huge corpora.

**Solution:** This is expected. For 100k vectors:
- Binary: ~200 MB (vs ~720 MB JSON)
- Still 3.66x improvement
- Future: implement compression if needed


---

## Future Optimizations (Optional)

### 1. Index Clustering by Content Type

**When:** After 1000+ incremental additions

**How:**
```typescript
async optimizeIndex() {
  console.log('Optimizing index (clustering by content type)...');
  
  // Load all vectors
  const allVectors = await this.loadAllVectors();
  
  // Sort by content type
  const sorted = allVectors.sort((a, b) => {
    const typeA = this.contentTypeMap.get(a.id) || 'text';
    const typeB = this.contentTypeMap.get(b.id) || 'text';
    return typeA.localeCompare(typeB);
  });
  
  // Rebuild index with clustering
  await this.rebuildIndex(sorted);
  
  console.log('✓ Index optimized');
}
```

**Benefit:** Improves cache locality, slightly faster filtered searches

### 2. Partial Index Loading

**When:** Very large indices (>100k vectors)

**How:**
```typescript
async loadTextVectorsOnly() {
  const metadata = await this.loadIndexMetadata();
  const textRange = metadata.contentTypeRanges.text;
  
  // Seek to text vector range in binary file
  const fd = openSync(this.indexPath, 'r');
  const startOffset = 24 + (textRange.start * vectorSize);
  const bytesToRead = (textRange.end - textRange.start + 1) * vectorSize;
  
  // Read only text vectors
  const buffer = Buffer.alloc(bytesToRead);
  readSync(fd, buffer, 0, bytesToRead, startOffset);
  closeSync(fd);
  
  // Build HNSW from text vectors only
  return this.buildHNSWFromBuffer(buffer);
}
```

**Benefit:** Faster filtered search startup (load only needed vectors)

### 3. Adaptive Multiplier Tuning

**When:** After collecting search statistics

**How:**
```typescript
private adaptiveMultiplier(contentType: string): number {
  // Track actual effectiveness over time
  const stats = this.getFilterEffectivenessStats(contentType);
  
  // Adjust multiplier based on observed effectiveness
  if (stats.averageEffectiveness < 0.8) {
    return Math.ceil(this.baseMultiplier * 1.5);
  }
  
  return this.baseMultiplier;
}
```

**Benefit:** Self-tuning system that adapts to corpus characteristics


---

## Summary

### What This Implementation Achieves

1. **Binary Index Format**
   - 3.66x smaller files (216 MB → 59 MB for 30k vectors)
   - 3.5x faster loading (350ms → 100ms)
   - Foundation for future optimizations

2. **Content-Type Filtering**
   - Solves CLIP same-modality bias (2.6% → 100% text results)
   - Smart over-fetch strategy (40x for image→text)
   - In-memory filtering (fast, 720 KB overhead)

3. **Clean Architecture**
   - Single unified index (simple, maintainable)
   - No separate indices (no storage overhead)
   - Supports incremental ingestion (no rebuild needed)

4. **User-Facing Features**
   - CLI: `--result-type` flag
   - MCP: `result_types` parameter
   - Performance monitoring and warnings

### Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Save index (30k vectors) | ~400ms | Binary format |
| Load index (30k vectors) | ~100ms | 3.5x faster than JSON |
| Unfiltered search | ~50ms | Standard HNSW search |
| Text-filtered search | ~100ms | 40x over-fetch |
| Image-filtered search | ~60ms | 2x over-fetch |
| Memory overhead | 720 KB | Content-type map |

### Trade-offs Accepted

- ⚠️ Filtered search slower than unfiltered (~100ms vs ~50ms)
- ⚠️ Over-fetch may not always yield full top_k results
- ⚠️ Breaking change (users must re-ingest)

### What We're NOT Doing

- ❌ Separate indices per content type (too complex)
- ❌ Backward compatibility with JSON (clean slate)
- ❌ Search-time HNSW building (too slow)
- ❌ Clustering by default (optional optimization)

---

## Ready to Implement

This guide provides everything needed to implement binary index format and content-type filtering. Follow the phases in order, test thoroughly, and document the breaking change clearly.

**Estimated time:** 12-18 hours  
**Complexity:** Medium  
**Impact:** High (solves major CLIP bias problem)

Good luck! 🚀
