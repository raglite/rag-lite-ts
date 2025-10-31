# Unified Content System Examples

This directory contains comprehensive examples demonstrating RAG-lite's unified content system capabilities, including memory ingestion and format-adaptive content retrieval.

## Overview

The unified content system enables RAG-lite to handle content from multiple sources while providing format-adaptive retrieval for different client types. These examples show how to:

- **Ingest content from memory** (perfect for MCP integration)
- **Retrieve content in different formats** (file paths for CLI, base64 for MCP)
- **Handle multiple content types** (markdown, JSON, HTML, images)
- **Manage storage efficiently** with deduplication and cleanup
- **Integrate with different client types** (CLI and MCP workflows)

## Running the Examples

### Prerequisites

```bash
# Install RAG-lite TS
npm install -g rag-lite-ts

# Or install locally for development
npm install rag-lite-ts
```

### Run All Examples

```bash
# Run the complete example suite
node unified-content-system-examples.js
```

### Individual Example Functions

```javascript
import { 
  runUnifiedContentExamples,
  mcpIntegrationExample,
  cliIntegrationExample 
} from './unified-content-system-examples.js';

// Run specific examples
await runUnifiedContentExamples();
await mcpIntegrationExample();
await cliIntegrationExample();
```

## Example Breakdown

### 1. Memory Ingestion from Different Sources

Demonstrates ingesting various content types directly from memory:

```javascript
// Markdown content
const markdownContent = Buffer.from('# Machine Learning Guide\n...');
const mlGuideId = await ingestion.ingestFromMemory(markdownContent, {
  displayName: 'Machine Learning Guide.md',
  contentType: 'text/markdown'
});

// JSON configuration
const configContent = Buffer.from(JSON.stringify({...}));
const configId = await ingestion.ingestFromMemory(configContent, {
  displayName: 'rag-config.json',
  contentType: 'application/json'
});

// HTML documentation
const htmlContent = Buffer.from('<!DOCTYPE html>...');
const apiDocsId = await ingestion.ingestFromMemory(htmlContent, {
  displayName: 'api-docs.html',
  contentType: 'text/html'
});
```

**Key Features:**
- Automatic content type detection
- Hash-based content IDs for stable identification
- Support for multiple content formats

### 2. Format-Adaptive Content Retrieval

Shows how the same content can be retrieved in different formats:

```javascript
const results = await search.search('machine learning neural networks');

for (const result of results) {
  const contentId = result.document.contentId;
  
  // CLI-style retrieval (file path)
  const filePath = await search.getContent(contentId, 'file');
  console.log(`File path: ${filePath}`);
  
  // MCP-style retrieval (base64 data)
  const base64Data = await search.getContent(contentId, 'base64');
  console.log(`Base64 data: ${base64Data.length} chars`);
}
```

**Key Features:**
- Same content, different formats based on client needs
- Automatic format conversion
- Error handling for missing content

### 3. Batch Content Retrieval

Demonstrates efficient batch operations for multiple content items:

```javascript
const batchRequests = contentIds.map(id => ({ 
  contentId: id, 
  format: 'base64' 
}));

const batchResults = await search.getContentBatch(batchRequests);

batchResults.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.contentId}: ${result.content.length} chars`);
  } else {
    console.log(`❌ ${result.contentId}: ${result.error}`);
  }
});
```

**Key Features:**
- Concurrent processing for better performance
- Partial success handling
- Resource management for large batches

### 4. Content Metadata and Verification

Shows how to work with content metadata and verify content availability:

```javascript
const metadata = await search.getContentMetadata(contentId);
const exists = await search.verifyContentExists(contentId);

console.log({
  displayName: metadata.displayName,
  contentType: metadata.contentType,
  fileSize: metadata.fileSize,
  storageType: metadata.storageType,
  exists: exists
});
```

**Key Features:**
- Rich metadata without loading full content
- Content verification before retrieval
- Storage type transparency

### 5. Deduplication Demo

Demonstrates automatic content deduplication based on content hash:

```javascript
// Ingest the same content with different metadata
const originalId = await ingestion.ingestFromMemory(content, {
  displayName: 'Original.md'
});

const duplicateId = await ingestion.ingestFromMemory(content, {
  displayName: 'Copy.md'  // Different name, same content
});

console.log(`Same ID: ${originalId === duplicateId}`); // true
```

**Key Features:**
- Hash-based deduplication
- Storage efficiency
- Consistent content IDs

### 6. Error Handling Patterns

Shows comprehensive error handling for common scenarios:

```javascript
// Handle missing content
try {
  await search.getContent('non-existent-id', 'file');
} catch (error) {
  console.log(`Expected error: ${error.message}`);
}

// Handle invalid formats
try {
  await search.getContent(contentId, 'xml'); // Invalid format
} catch (error) {
  console.log(`Format error: ${error.message}`);
}
```

**Key Features:**
- Clear error messages
- Graceful failure handling
- Recovery guidance

### 7. Mixed Content Search

Demonstrates searching across different content types:

```javascript
const mixedResults = await search.search('API documentation configuration');

mixedResults.forEach((result, index) => {
  const contentType = result.document.source.split('.').pop();
  console.log(`${index + 1}. ${result.document.source} (${contentType})`);
});
```

**Key Features:**
- Unified search across content types
- Content type identification
- Relevance scoring

## Integration Examples

### MCP Integration

Shows how to integrate with Model Context Protocol servers:

```javascript
// Simulate MCP server handling file upload
async function handleFileUpload(fileData, fileName, mimeType) {
  const contentId = await ingestion.ingestFromMemory(fileData, {
    displayName: fileName,
    contentType: mimeType
  });
  
  return { success: true, contentId };
}

// Simulate MCP server providing content for display
async function getContentForDisplay(contentId) {
  const base64Data = await search.getContent(contentId, 'base64');
  const metadata = await search.getContentMetadata(contentId);
  
  return { content: base64Data, metadata };
}
```

### CLI Integration

Shows how CLI clients can work with the unified content system:

```javascript
// CLI search with file access
const results = await search.search('machine learning');

for (const result of results) {
  const filePath = await search.getContent(result.document.contentId, 'file');
  console.log(`File available at: ${filePath}`);
}
```

## Configuration Examples

The examples use various configuration options:

```javascript
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin', {
  contentSystem: {
    maxFileSize: '50MB',           // Individual file limit
    maxContentDirSize: '1GB',      // Total content directory limit
    contentDir: './examples/.raglite/content',
    enableDeduplication: true      // Hash-based deduplication
  }
});
```

## Expected Output

When you run the examples, you'll see output like:

```
🚀 RAG-lite Unified Content System Examples

📝 Example 1: Memory Ingestion from Different Sources
✅ Ingested ML Guide: a1b2c3d4e5f6...
✅ Ingested Config: f6e5d4c3b2a1...
✅ Ingested API Docs: 9z8y7x6w5v4u...

🔄 Example 2: Format-Adaptive Content Retrieval
Found 3 results

📄 Result: Machine Learning Guide.md (Score: 0.892)
Content ID: a1b2c3d4e5f6...
📁 File path: .raglite/content/a1b2c3d4e5f6.md
📦 Base64 data: 1248 chars (~936KB original)

📦 Example 3: Batch Content Retrieval
Batch retrieval results:
  ✅ a1b2c3d4e5f6...: 936KB
  ✅ f6e5d4c3b2a1...: 245KB
  ✅ 9z8y7x6w5v4u...: 1.2MB
📊 Batch summary: 3/3 successful, 2.4MB total

...
```

## Cleanup

To clean up example files:

```bash
# Remove generated files
npm run clean

# Or manually
rm -rf .raglite *.sqlite *.bin
```

## Next Steps

After running these examples:

1. **Read the full documentation**: [Unified Content System Guide](../docs/unified-content-system.md)
2. **Check troubleshooting**: [Unified Content Troubleshooting](../docs/unified-content-troubleshooting.md)
3. **Explore MCP integration**: See how to build MCP servers with RAG-lite
4. **Build your own integration**: Use these patterns in your applications

## Key Takeaways

These examples demonstrate:

- **Simple API**: Memory ingestion is as easy as `ingestFromMemory(buffer, metadata)`
- **Format Flexibility**: Same content, different formats based on client needs
- **Performance**: Efficient batch operations and automatic optimizations
- **Reliability**: Comprehensive error handling and recovery patterns
- **Integration Ready**: Perfect foundation for MCP servers and AI agents

The unified content system makes RAG-lite a powerful platform for modern AI workflows while maintaining its core philosophy of simplicity and local-first operation.