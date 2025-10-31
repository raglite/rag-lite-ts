# Unified Content System Guide

The unified content system enables RAG-lite to handle content from multiple sources - both filesystem and memory - while providing format-adaptive retrieval for different client types. This system enables MCP (Model Context Protocol) integration while maintaining RAG-lite's simple, local-first philosophy.

## Table of Contents

- [Overview](#overview)
- [Memory Ingestion](#memory-ingestion)
- [Content Retrieval](#content-retrieval)
- [Configuration](#configuration)
- [Storage Management](#storage-management)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

### What is the Unified Content System?

The unified content system extends RAG-lite's capabilities to support:

- **Memory-based ingestion**: Process content directly from buffers without temporary files
- **Format-adaptive retrieval**: Serve content as file paths (CLI) or base64 data (MCP)
- **Dual storage strategy**: Keep filesystem content in place, store memory content efficiently
- **Universal content IDs**: Stable identifiers for all content regardless of source

### Key Benefits

- **MCP Integration**: Enables real-time content processing for AI agents
- **Backward Compatibility**: Existing code continues to work unchanged
- **Simple API**: No ceremony - same easy patterns as existing RAG-lite
- **Local-First**: All content stored locally with no external dependencies

## Memory Ingestion

### Basic Memory Ingestion

```typescript
import { IngestionPipeline } from 'rag-lite-ts';

const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin');

// Ingest content from memory buffer
const content = Buffer.from('# Machine Learning Guide\n\nThis is a comprehensive guide...');
const contentId = await ingestion.ingestFromMemory(content, {
  displayName: 'ML Guide.md',
  contentType: 'text/markdown'
});

console.log(`Content ingested with ID: ${contentId}`);
```

### Advanced Memory Ingestion

```typescript
// Ingest with full metadata
const contentId = await ingestion.ingestFromMemory(imageBuffer, {
  displayName: 'architecture-diagram.png',
  contentType: 'image/png',
  originalPath: '/uploads/diagrams/architecture.png' // Optional reference
});

// Ingest JSON configuration
const configBuffer = Buffer.from(JSON.stringify({
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  chunkSize: 400
}));

const configId = await ingestion.ingestFromMemory(configBuffer, {
  displayName: 'config.json',
  contentType: 'application/json'
});
```

### Content Type Detection

The system automatically detects content types using:

1. **Magic number detection** (most reliable)
2. **Extension-based detection** (from display name)
3. **Content analysis** (for text content)

```typescript
// Automatic detection from buffer content
const contentId = await ingestion.ingestFromMemory(pdfBuffer, {
  displayName: 'document.pdf'
  // contentType automatically detected as 'application/pdf'
});

// Explicit content type (recommended for accuracy)
const contentId = await ingestion.ingestFromMemory(htmlBuffer, {
  displayName: 'page.html',
  contentType: 'text/html'
});
```

### Supported Content Types

**Text Formats:**
- `text/plain`, `text/markdown`, `text/html`
- `application/json`, `application/xml`
- `text/csv`, `application/javascript`

**Document Formats:**
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- `application/msword` (DOC)

**Image Formats:**
- `image/jpeg`, `image/png`, `image/gif`
- `image/webp`, `image/bmp`, `image/tiff`
- `image/svg+xml`

## Content Retrieval

### Basic Content Retrieval

```typescript
import { SearchEngine } from 'rag-lite-ts';

const search = new SearchEngine('./vector-index.bin', './db.sqlite');

// Search returns content IDs
const results = await search.search('machine learning concepts');

// Retrieve content in different formats
for (const result of results) {
  const contentId = result.document.contentId;
  
  // For CLI clients - get file path
  const filePath = await search.getContent(contentId, 'file');
  console.log(`File available at: ${filePath}`);
  
  // For MCP clients - get base64 data
  const base64Data = await search.getContent(contentId, 'base64');
  console.log(`Base64 length: ${base64Data.length}`);
}
```

### Batch Content Retrieval

```typescript
// Efficient batch retrieval for multiple items
const contentIds = results.map(r => r.document.contentId);

const batchResults = await search.getContentBatch(
  contentIds.map(id => ({ contentId: id, format: 'base64' }))
);

batchResults.forEach(result => {
  if (result.success) {
    console.log(`Content ${result.contentId}: ${result.content?.length} bytes`);
  } else {
    console.error(`Failed to retrieve ${result.contentId}: ${result.error}`);
  }
});
```

### Content Metadata

```typescript
// Get content information without loading the full content
const metadata = await search.getContentMetadata(contentId);

console.log({
  displayName: metadata.displayName,
  contentType: metadata.contentType,
  fileSize: metadata.fileSize,
  storageType: metadata.storageType,
  createdAt: metadata.createdAt
});
```

## Configuration

### Basic Configuration

```typescript
import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';

// Configure content system during ingestion
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin', {
  contentSystem: {
    maxFileSize: '100MB',           // Individual file limit
    maxContentDirSize: '5GB',       // Total content directory limit
    contentDir: '.raglite/content', // Storage location
    enableDeduplication: true       // Hash-based deduplication
  }
});
```

### Configuration Options

```typescript
interface ContentSystemConfig {
  // Size limits (accepts strings like "50MB", "2GB" or numbers in bytes)
  maxFileSize: number | string;        // Default: "50MB"
  maxContentDirSize: number | string;  // Default: "2GB"
  
  // Storage settings
  contentDir: string;                  // Default: ".raglite/content"
  enableDeduplication: boolean;        // Default: true
  enableStorageTracking: boolean;      // Default: true
  
  // Storage thresholds (percentages)
  storageWarningThreshold: number;     // Default: 75 (warn at 75% full)
  storageErrorThreshold: number;       // Default: 95 (reject at 95% full)
}
```

### Environment-Specific Configuration

```typescript
// Development configuration
const devConfig = {
  contentSystem: {
    maxFileSize: '10MB',
    maxContentDirSize: '500MB',
    storageWarningThreshold: 80
  }
};

// Production configuration
const prodConfig = {
  contentSystem: {
    maxFileSize: '100MB',
    maxContentDirSize: '10GB',
    storageWarningThreshold: 70,
    storageErrorThreshold: 90
  }
};
```

## Storage Management

### Storage Statistics

```typescript
import { ContentManager } from 'rag-lite-ts/core';

const contentManager = new ContentManager(db, config);

// Get comprehensive storage statistics
const stats = await contentManager.getStorageStats();

console.log({
  contentDirectory: {
    files: stats.contentDirectory.totalFiles,
    sizeMB: stats.contentDirectory.totalSizeMB,
    averageFileSize: stats.contentDirectory.averageFileSize
  },
  filesystemReferences: {
    count: stats.filesystemReferences.totalRefs,
    sizeMB: stats.filesystemReferences.totalSizeMB
  },
  limits: {
    usagePercent: stats.limits.currentUsagePercent,
    remainingMB: stats.limits.remainingSpaceMB
  }
});
```

### Storage Cleanup

```typescript
// Remove orphaned files (files without metadata references)
const orphanedResult = await contentManager.removeOrphanedFiles();
console.log(`Removed ${orphanedResult.removedFiles.length} orphaned files`);
console.log(`Freed ${orphanedResult.freedSpace} bytes`);

// Remove duplicate content (same hash, different files)
const duplicateResult = await contentManager.removeDuplicateContent();
console.log(`Removed ${duplicateResult.removedFiles.length} duplicate files`);
console.log(`Freed ${duplicateResult.freedSpace} bytes`);
```

### Storage Monitoring

```typescript
// Get storage limit status and recommendations
const status = await contentManager.getStorageLimitStatus();

console.log(`Storage usage: ${status.currentUsagePercent}%`);
console.log(`Can accept new content: ${status.canAcceptContent}`);

if (status.isNearWarningThreshold) {
  console.log('⚠️ Storage recommendations:');
  status.recommendations.forEach(rec => console.log(`  ${rec}`));
}
```

### Generate Storage Report

```typescript
// Human-readable storage report
const report = await contentManager.generateStorageReport();
console.log(report);

// Output:
// === RAG-lite Content Storage Report ===
// 
// Content Directory:
//   Files: 42
//   Size: 156.7 MB
//   Average file size: 3.7 MB
// 
// Filesystem References:
//   References: 128
//   Total size: 2.1 GB
// 
// Overall Usage:
//   Total content items: 170
//   Total storage used: 2.3 GB
//   Storage efficiency: 100%
// 
// Storage Limits:
//   Content directory limit: 2048.0 MB
//   Current usage: 7.7%
//   Remaining space: 1891.3 MB
```

## Error Handling

### Common Error Scenarios

#### Content Not Found

```typescript
try {
  const content = await search.getContent(contentId, 'file');
} catch (error) {
  if (error.message.includes('Content not found')) {
    console.log('Content may have been moved or deleted. Please re-ingest.');
    // Handle re-ingestion workflow
  }
}
```

#### Storage Limit Exceeded

```typescript
try {
  const contentId = await ingestion.ingestFromMemory(largeBuffer, metadata);
} catch (error) {
  if (error.message.includes('Storage limit exceeded')) {
    console.log('Storage full. Running cleanup...');
    await contentManager.removeOrphanedFiles();
    await contentManager.removeDuplicateContent();
    
    // Retry ingestion
    const contentId = await ingestion.ingestFromMemory(largeBuffer, metadata);
  }
}
```

#### Invalid Content Format

```typescript
try {
  const content = await search.getContent(contentId, 'xml'); // Invalid format
} catch (error) {
  if (error.message.includes('Unsupported format')) {
    console.log('Use "file" or "base64" format');
    const content = await search.getContent(contentId, 'base64');
  }
}
```

### Error Recovery Patterns

```typescript
// Robust content retrieval with fallback
async function getContentSafely(contentId: string, preferredFormat: 'file' | 'base64') {
  try {
    return await search.getContent(contentId, preferredFormat);
  } catch (error) {
    if (error.message.includes('Content not found')) {
      // Try to get metadata for better error reporting
      try {
        const metadata = await search.getContentMetadata(contentId);
        throw new Error(`Content "${metadata.displayName}" is no longer available. Please re-ingest.`);
      } catch {
        throw new Error(`Content ${contentId} not found. Please re-ingest.`);
      }
    }
    throw error; // Re-throw other errors
  }
}
```

## Performance Optimization

### Memory Management

```typescript
// The system automatically manages memory for large content
// No special handling needed, but be aware of these optimizations:

// Large files (>10MB) use streaming operations automatically
const contentId = await ingestion.ingestFromMemory(largeBuffer, {
  displayName: 'large-document.pdf'
  // Streaming operations used automatically
});

// Batch operations are optimized for performance
const results = await search.getContentBatch(requests);
// Uses concurrent processing with resource limits
```

### Performance Statistics

```typescript
// Monitor performance for optimization
const perfStats = contentManager.getPerformanceStats();

console.log({
  hashCache: {
    hitRate: perfStats.hashCache.hitRate,
    size: perfStats.hashCache.size
  },
  operations: {
    averageDuration: perfStats.operations.averageDuration,
    averageSpeed: perfStats.operations.averageSpeed,
    errorRate: perfStats.operations.errorRate
  }
});

// Clear caches if needed (e.g., after bulk operations)
contentManager.clearPerformanceCaches();
```

### Optimization Guidelines

1. **Use batch operations** for multiple content retrievals
2. **Enable deduplication** to save storage space
3. **Monitor storage usage** and run cleanup regularly
4. **Use appropriate size limits** for your use case
5. **Prefer streaming** for large content (handled automatically)

## Troubleshooting

### Common Issues

#### High Memory Usage

**Symptoms:** System becomes slow during content operations
**Causes:** Large files, many concurrent operations
**Solutions:**
```typescript
// Reduce batch size for large operations
const smallBatches = chunkArray(contentIds, 10); // Process 10 at a time
for (const batch of smallBatches) {
  await search.getContentBatch(batch.map(id => ({ contentId: id, format: 'base64' })));
}

// Clear performance caches periodically
contentManager.clearPerformanceCaches();
```

#### Storage Directory Issues

**Symptoms:** "Failed to create content directory" errors
**Causes:** Permission issues, disk space, invalid paths
**Solutions:**
```typescript
// Check and fix permissions
import { access, mkdir } from 'fs/promises';
import { constants } from 'fs';

try {
  await access('.raglite/content', constants.W_OK);
} catch {
  await mkdir('.raglite/content', { recursive: true, mode: 0o755 });
}
```

#### Content Retrieval Failures

**Symptoms:** "Content not found" errors for existing content
**Causes:** Moved files, corrupted metadata, storage issues
**Solutions:**
```typescript
// Verify content exists before retrieval
const exists = await search.verifyContentExists(contentId);
if (!exists) {
  console.log('Content needs to be re-ingested');
  // Implement re-ingestion logic
}

// Check storage statistics for issues
const stats = await contentManager.getStorageStats();
if (stats.contentDirectory.totalFiles === 0) {
  console.log('Content directory may be corrupted or moved');
}
```

### Debug Mode

```typescript
// Enable detailed logging for troubleshooting
process.env.DEBUG = 'rag-lite:content';

// This will log:
// - Content ingestion operations
// - Storage operations
// - Performance metrics
// - Error details
```

### Performance Troubleshooting

```typescript
// Monitor operation timing
const startTime = Date.now();
const contentId = await ingestion.ingestFromMemory(buffer, metadata);
const duration = Date.now() - startTime;

if (duration > 5000) { // Slow operation (>5s)
  console.log(`Slow ingestion detected: ${duration}ms`);
  console.log(`Buffer size: ${buffer.length} bytes`);
  
  // Check performance stats
  const stats = contentManager.getPerformanceStats();
  console.log(`Cache hit rate: ${stats.hashCache.hitRate}%`);
}
```

## API Reference

### IngestionPipeline Methods

```typescript
class IngestionPipeline {
  // Memory ingestion
  async ingestFromMemory(
    content: Buffer, 
    metadata: MemoryContentMetadata
  ): Promise<string>;
  
  // Existing methods (unchanged)
  async ingestDirectory(path: string, options?: IngestionOptions): Promise<IngestionResult>;
  async ingestFile(path: string, options?: IngestionOptions): Promise<IngestionResult>;
}

interface MemoryContentMetadata {
  displayName: string;        // User-friendly name
  contentType?: string;       // MIME type (auto-detected if not provided)
  originalPath?: string;      // Optional reference to original location
}
```

### SearchEngine Methods

```typescript
class SearchEngine {
  // Content retrieval
  async getContent(contentId: string, format?: 'file' | 'base64'): Promise<string>;
  async getContentBatch(requests: ContentRequest[]): Promise<ContentResult[]>;
  async getContentMetadata(contentId: string): Promise<ContentMetadata>;
  async verifyContentExists(contentId: string): Promise<boolean>;
  
  // Existing methods (unchanged)
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

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
```

### ContentManager Methods (Internal)

```typescript
class ContentManager {
  // Storage management
  async getStorageStats(): Promise<StorageStats>;
  async getStorageLimitStatus(): Promise<StorageLimitStatus>;
  async generateStorageReport(): Promise<string>;
  
  // Cleanup operations
  async removeOrphanedFiles(): Promise<CleanupResult>;
  async removeDuplicateContent(): Promise<CleanupResult>;
  
  // Performance monitoring
  getPerformanceStats(): PerformanceStats;
  clearPerformanceCaches(): void;
}
```

### Enhanced SearchResult

```typescript
interface SearchResult {
  text: string;
  score: number;
  document: {
    id: number;
    source: string;        // Display name (backward compatibility)
    title: string;
    contentId: string;     // Universal content identifier (NEW)
  };
}
```

---

The unified content system provides a powerful foundation for modern AI workflows while maintaining RAG-lite's core philosophy of simplicity and local-first operation. It enables seamless integration with MCP clients while preserving full backward compatibility with existing code.