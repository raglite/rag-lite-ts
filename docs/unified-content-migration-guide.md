# Migration Guide: Unified Content System

This guide helps you migrate to RAG-lite TS's unified content system, which introduces memory-based ingestion and format-adaptive content retrieval for enhanced MCP integration and AI agent workflows.

## Table of Contents

- [Overview](#overview)
- [What's New](#whats-new)
- [Breaking Changes](#breaking-changes)
- [Migration Steps](#migration-steps)
- [New Features](#new-features)
- [API Changes](#api-changes)
- [Configuration Updates](#configuration-updates)
- [Troubleshooting](#troubleshooting)

## Overview

The unified content system introduces:

- **Memory-based ingestion**: Ingest content directly from buffers without filesystem access
- **Format-adaptive retrieval**: Serve content as file paths or base64 based on client needs
- **Dual storage strategy**: Efficient handling of both filesystem and memory content
- **Enhanced MCP integration**: Seamless integration with AI agents and MCP servers

## What's New

### New Methods

#### SearchEngine
- `getContent(contentId: string, format?: 'file' | 'base64'): Promise<string>`
- `getContentBatch(requests: ContentRequest[]): Promise<ContentResult[]>`

#### IngestionPipeline
- `ingestFromMemory(content: Buffer, metadata: MemoryContentMetadata): Promise<ContentIngestionResult>`

### New Types

```typescript
interface ContentRequest {
  contentId: string;
  format: 'file' | 'base64';
}

interface ContentResult {
  contentId: string;
  success: boolean;
  content?: string;
  error?: string;
}

interface MemoryContentMetadata {
  displayName: string;
  contentType?: string;
  originalPath?: string;
}

interface ContentIngestionResult {
  contentId: string;
  wasDeduped: boolean;
  storageType: 'filesystem' | 'content_dir';
  contentPath: string;
}
```

## Breaking Changes

### None for Existing APIs

The unified content system is **fully backward compatible**. All existing APIs continue to work exactly as before:

- `ingestDirectory()` and `ingestFile()` work unchanged
- `search()` returns the same results with additional `contentId` field
- All configuration options remain the same

### New Search Result Format

Search results now include a `contentId` field for content retrieval:

```typescript
// Before
interface SearchResult {
  content: string;
  score: number;
  source: string;
  // ... other fields
}

// After (backward compatible)
interface SearchResult {
  content: string;
  score: number;
  source: string;
  contentId: string;  // NEW: for content retrieval
  // ... other fields
}
```

## Migration Steps

### Step 1: Update Dependencies

```bash
npm update rag-lite-ts
```

### Step 2: No Code Changes Required

Your existing code continues to work without changes:

```typescript
// This code works exactly the same
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');
await pipeline.ingestDirectory('./docs');

const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query');
```

### Step 3: Optional - Use New Features

Add new capabilities when needed:

```typescript
// Add memory ingestion for MCP integration
const content = Buffer.from('New content from agent');
await pipeline.ingestFromMemory(content, {
  displayName: 'agent-content.txt'
});

// Add content retrieval for enhanced workflows
const contentId = results[0].contentId;
const filePath = await search.getContent(contentId, 'file');
```

## New Features

### Memory-Based Ingestion

Perfect for MCP servers and AI agent integration:

```typescript
// Ingest content from memory without filesystem access
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin');

// From string content
const textContent = Buffer.from('Document content from AI agent');
await pipeline.ingestFromMemory(textContent, {
  displayName: 'agent-document.txt',
  contentType: 'text/plain'
});

// From binary content (e.g., PDF from agent)
const pdfBuffer = await fetchFromAgent('/document.pdf');
await pipeline.ingestFromMemory(pdfBuffer, {
  displayName: 'agent-document.pdf',
  contentType: 'application/pdf'
});
```

### Format-Adaptive Content Retrieval

Serve content in the format that works best for each client:

```typescript
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query');
const contentId = results[0].contentId;

// For CLI tools and local applications
const filePath = await search.getContent(contentId, 'file');
console.log(`Access file at: ${filePath}`);

// For web applications and MCP clients
const base64Content = await search.getContent(contentId, 'base64');
console.log(`Embedded content: data:text/plain;base64,${base64Content}`);
```

### Batch Content Retrieval

Efficiently retrieve multiple content items:

```typescript
// Prepare batch requests
const requests = results.slice(0, 5).map(result => ({
  contentId: result.contentId,
  format: 'base64' as const
}));

// Retrieve all content in one operation
const batchResults = await search.getContentBatch(requests);

// Handle partial failures gracefully
batchResults.forEach(result => {
  if (result.success) {
    console.log(`Content ${result.contentId}: ${result.content?.length} bytes`);
  } else {
    console.error(`Failed to retrieve ${result.contentId}: ${result.error}`);
  }
});
```

## API Changes

### SearchEngine Enhancements

```typescript
// New methods added (existing methods unchanged)
class SearchEngine {
  // Existing methods work the same
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // New content retrieval methods
  async getContent(contentId: string, format?: 'file' | 'base64'): Promise<string>;
  async getContentBatch(requests: ContentRequest[]): Promise<ContentResult[]>;
}
```

### IngestionPipeline Enhancements

```typescript
// New methods added (existing methods unchanged)
class IngestionPipeline {
  // Existing methods work the same
  async ingestDirectory(path: string, options?: IngestionOptions): Promise<IngestionResult>;
  async ingestFile(filePath: string, options?: IngestionOptions): Promise<IngestionResult>;
  
  // New memory ingestion method
  async ingestFromMemory(content: Buffer, metadata: MemoryContentMetadata): Promise<ContentIngestionResult>;
}
```

## Configuration Updates

### No Configuration Changes Required

All existing configuration continues to work. The unified content system uses sensible defaults:

```typescript
// Existing configuration works unchanged
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  chunkSize: 400,
  chunkOverlap: 80
});
```

### Optional Content System Configuration

You can optionally configure content storage limits and behavior:

```typescript
// Advanced content system configuration
const pipeline = new IngestionPipeline('./db.sqlite', './index.bin', {
  // Existing options work the same
  embeddingModel: 'Xenova/all-mpnet-base-v2',
  
  // New optional content system settings
  contentSystemConfig: {
    maxFileSize: '50MB',           // Maximum file size for ingestion
    maxContentDirSize: '2GB',      // Maximum content directory size
    enableDeduplication: true,     // Enable content deduplication
    storageWarningThreshold: 75,   // Warn at 75% storage usage
    storageErrorThreshold: 95      // Reject at 95% storage usage
  }
});
```

## Troubleshooting

### Common Migration Issues

#### Issue: Search results missing contentId

**Symptom**: `contentId` field is undefined in search results

**Solution**: Re-run ingestion to update the database schema:

```bash
# Re-ingest your documents to update schema
raglite ingest ./docs --rebuild-if-needed
```

#### Issue: Content retrieval fails

**Symptom**: `getContent()` throws "Content not found" errors

**Cause**: Content was ingested before the unified content system

**Solution**: Re-ingest affected content:

```typescript
// Re-ingest specific files
await pipeline.ingestFile('./path/to/file.txt');

// Or re-ingest entire directory
await pipeline.ingestDirectory('./docs');
```

#### Issue: Memory ingestion fails with large files

**Symptom**: Out of memory errors during `ingestFromMemory()`

**Solution**: Check file size limits and use streaming for large content:

```typescript
// Check content size before ingestion
const maxSize = 50 * 1024 * 1024; // 50MB
if (content.length > maxSize) {
  console.warn(`Content too large: ${content.length} bytes`);
  // Consider chunking or alternative processing
}
```

### Performance Considerations

#### Storage Management

The unified content system includes automatic storage management:

```typescript
// Monitor storage usage
const stats = await pipeline.getStorageStats();
console.log(`Storage usage: ${stats.usagePercent}%`);

// Clean up orphaned files if needed
if (stats.usagePercent > 80) {
  await pipeline.cleanup();
}
```

#### Batch Operations

Use batch operations for better performance:

```typescript
// Instead of multiple individual calls
for (const result of results) {
  const content = await search.getContent(result.contentId, 'base64');
  // Process content...
}

// Use batch retrieval
const requests = results.map(r => ({ contentId: r.contentId, format: 'base64' as const }));
const batchResults = await search.getContentBatch(requests);
```

### Getting Help

If you encounter issues during migration:

1. **Check the logs**: Enable debug mode for detailed error information
2. **Verify file permissions**: Ensure the content directory is writable
3. **Check storage limits**: Monitor storage usage and clean up if needed
4. **Review error messages**: The system provides actionable guidance for most issues

For additional help:

- **[Unified Content System Guide](unified-content-system.md)** - Complete feature documentation
- **[Troubleshooting Guide](unified-content-troubleshooting.md)** - Specific issue resolution
- **[API Reference](api-reference.md)** - Complete API documentation
- **[GitHub Issues](https://github.com/your-repo/rag-lite-ts/issues)** - Report bugs or get support

## Summary

The unified content system migration is designed to be seamless:

- ✅ **Zero breaking changes** - existing code works unchanged
- ✅ **Backward compatible** - all existing APIs preserved
- ✅ **Incremental adoption** - use new features when needed
- ✅ **Automatic upgrades** - database schema updates automatically
- ✅ **Enhanced capabilities** - memory ingestion and content retrieval

You can migrate immediately and adopt new features at your own pace.