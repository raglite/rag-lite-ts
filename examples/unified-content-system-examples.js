/**
 * Unified Content System Examples
 * Demonstrates memory ingestion and format-adaptive content retrieval
 * 
 * Run with: node examples/unified-content-system-examples.js
 */

import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Example configuration
const DB_PATH = './examples/unified-content-demo.sqlite';
const INDEX_PATH = './examples/unified-content-demo.bin';

async function runUnifiedContentExamples() {
  console.log('🚀 RAG-lite Unified Content System Examples\n');

  // Initialize with content system configuration
  const ingestion = new IngestionPipeline(DB_PATH, INDEX_PATH, {
    contentSystem: {
      maxFileSize: '50MB',
      maxContentDirSize: '1GB',
      contentDir: './examples/.raglite/content',
      enableDeduplication: true
    }
  });

  const search = new SearchEngine(INDEX_PATH, DB_PATH);

  // Example 1: Memory Ingestion from Different Sources
  console.log('📝 Example 1: Memory Ingestion from Different Sources');
  
  // Ingest markdown content from memory
  const markdownContent = Buffer.from(`# Machine Learning Guide

## Introduction
Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task.

## Key Concepts
- **Supervised Learning**: Learning with labeled examples
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Neural Networks**: Computing systems inspired by biological neural networks
- **Deep Learning**: Neural networks with multiple layers

## Applications
Machine learning powers many modern applications including:
- Image recognition and computer vision
- Natural language processing and translation
- Recommendation systems
- Autonomous vehicles
- Medical diagnosis and drug discovery
`);

  const mlGuideId = await ingestion.ingestFromMemory(markdownContent, {
    displayName: 'Machine Learning Guide.md',
    contentType: 'text/markdown'
  });
  console.log(`✅ Ingested ML Guide: ${mlGuideId}`);

  // Ingest JSON configuration from memory
  const configContent = Buffer.from(JSON.stringify({
    "model": "sentence-transformers/all-MiniLM-L6-v2",
    "settings": {
      "chunkSize": 400,
      "chunkOverlap": 50,
      "enableReranking": true
    },
    "features": {
      "multimodal": false,
      "memoryIngestion": true,
      "formatAdaptiveRetrieval": true
    }
  }, null, 2));

  const configId = await ingestion.ingestFromMemory(configContent, {
    displayName: 'rag-config.json',
    contentType: 'application/json'
  });
  console.log(`✅ Ingested Config: ${configId}`);

  // Ingest HTML documentation from memory
  const htmlContent = Buffer.from(`<!DOCTYPE html>
<html>
<head>
    <title>RAG-lite API Documentation</title>
</head>
<body>
    <h1>RAG-lite TypeScript API</h1>
    
    <h2>SearchEngine Class</h2>
    <p>The SearchEngine class provides semantic search capabilities over your document collection.</p>
    
    <h3>Methods</h3>
    <ul>
        <li><code>search(query: string, options?: SearchOptions)</code> - Perform semantic search</li>
        <li><code>getContent(contentId: string, format?: 'file' | 'base64')</code> - Retrieve content by ID</li>
        <li><code>getContentBatch(requests: ContentRequest[])</code> - Batch content retrieval</li>
    </ul>
    
    <h2>IngestionPipeline Class</h2>
    <p>The IngestionPipeline class handles document ingestion and preprocessing.</p>
    
    <h3>Methods</h3>
    <ul>
        <li><code>ingestDirectory(path: string)</code> - Ingest all documents in a directory</li>
        <li><code>ingestFile(path: string)</code> - Ingest a single file</li>
        <li><code>ingestFromMemory(content: Buffer, metadata: MemoryContentMetadata)</code> - Ingest from memory</li>
    </ul>
</body>
</html>`);

  const apiDocsId = await ingestion.ingestFromMemory(htmlContent, {
    displayName: 'api-docs.html',
    contentType: 'text/html'
  });
  console.log(`✅ Ingested API Docs: ${apiDocsId}\n`);

  // Example 2: Format-Adaptive Content Retrieval
  console.log('🔄 Example 2: Format-Adaptive Content Retrieval');

  // Search for content
  const results = await search.search('machine learning neural networks', { top_k: 5 });
  console.log(`Found ${results.length} results`);

  for (const result of results.slice(0, 2)) {
    const contentId = result.document.contentId;
    console.log(`\n📄 Result: ${result.document.source} (Score: ${result.score.toFixed(3)})`);
    console.log(`Content ID: ${contentId}`);
    
    // CLI-style retrieval (file path)
    try {
      const filePath = await search.getContent(contentId, 'file');
      console.log(`📁 File path: ${filePath}`);
    } catch (error) {
      console.log(`❌ File access failed: ${error.message}`);
    }
    
    // MCP-style retrieval (base64 data)
    try {
      const base64Data = await search.getContent(contentId, 'base64');
      const sizeKB = Math.round(base64Data.length * 0.75 / 1024); // Approximate original size
      console.log(`📦 Base64 data: ${base64Data.length} chars (~${sizeKB}KB original)`);
      console.log(`📝 Preview: ${base64Data.substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ Base64 conversion failed: ${error.message}`);
    }
  }

  // Example 3: Batch Content Retrieval
  console.log('\n📦 Example 3: Batch Content Retrieval');

  const allContentIds = results.map(r => r.document.contentId);
  const batchRequests = allContentIds.map(id => ({ contentId: id, format: 'base64' }));
  
  const batchResults = await search.getContentBatch(batchRequests);
  
  console.log(`Batch retrieval results:`);
  let successCount = 0;
  let totalSize = 0;
  
  batchResults.forEach((result, index) => {
    if (result.success && result.content) {
      successCount++;
      const sizeKB = Math.round(result.content.length * 0.75 / 1024);
      totalSize += sizeKB;
      console.log(`  ✅ ${result.contentId}: ${sizeKB}KB`);
    } else {
      console.log(`  ❌ ${result.contentId}: ${result.error}`);
    }
  });
  
  console.log(`📊 Batch summary: ${successCount}/${batchResults.length} successful, ${totalSize}KB total`);

  // Example 4: Content Metadata and Verification
  console.log('\n📋 Example 4: Content Metadata and Verification');

  for (const contentId of allContentIds.slice(0, 2)) {
    try {
      const metadata = await search.getContentMetadata(contentId);
      const exists = await search.verifyContentExists(contentId);
      
      console.log(`\n📄 Content: ${metadata.displayName}`);
      console.log(`  ID: ${metadata.id}`);
      console.log(`  Type: ${metadata.contentType}`);
      console.log(`  Size: ${Math.round(metadata.fileSize / 1024)}KB`);
      console.log(`  Storage: ${metadata.storageType}`);
      console.log(`  Created: ${metadata.createdAt.toISOString()}`);
      console.log(`  Exists: ${exists ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`❌ Failed to get metadata for ${contentId}: ${error.message}`);
    }
  }

  // Example 5: Deduplication Demo
  console.log('\n🔄 Example 5: Deduplication Demo');

  // Ingest the same content again
  console.log('Ingesting duplicate content...');
  const duplicateId = await ingestion.ingestFromMemory(markdownContent, {
    displayName: 'ML Guide Copy.md', // Different name, same content
    contentType: 'text/markdown'
  });

  console.log(`Original ID: ${mlGuideId}`);
  console.log(`Duplicate ID: ${duplicateId}`);
  console.log(`Same content ID: ${mlGuideId === duplicateId ? '✅ Deduplicated' : '❌ Not deduplicated'}`);

  // Example 6: Error Handling Patterns
  console.log('\n⚠️  Example 6: Error Handling Patterns');

  // Try to retrieve non-existent content
  try {
    await search.getContent('non-existent-id', 'file');
  } catch (error) {
    console.log(`Expected error for missing content: ${error.message}`);
  }

  // Try invalid format
  try {
    await search.getContent(mlGuideId, 'xml'); // Invalid format
  } catch (error) {
    console.log(`Expected error for invalid format: ${error.message}`);
  }

  // Example 7: Mixed Content Search
  console.log('\n🔍 Example 7: Mixed Content Search');

  // Search across all ingested content types
  const mixedResults = await search.search('API documentation configuration', { top_k: 10 });
  
  console.log(`Mixed content search results:`);
  mixedResults.forEach((result, index) => {
    const contentType = result.document.source.split('.').pop() || 'unknown';
    console.log(`  ${index + 1}. ${result.document.source} (${contentType}) - Score: ${result.score.toFixed(3)}`);
  });

  console.log('\n✨ Unified Content System Examples Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('  ✅ Memory ingestion from multiple content types');
  console.log('  ✅ Format-adaptive retrieval (file paths vs base64)');
  console.log('  ✅ Batch content operations');
  console.log('  ✅ Content metadata and verification');
  console.log('  ✅ Automatic deduplication');
  console.log('  ✅ Comprehensive error handling');
  console.log('  ✅ Mixed content type search');
}

// MCP Integration Example
async function mcpIntegrationExample() {
  console.log('\n🤖 MCP Integration Example');
  
  const search = new SearchEngine(INDEX_PATH, DB_PATH);
  
  // Simulate MCP server handling file upload
  async function handleFileUpload(fileData, fileName, mimeType) {
    try {
      const ingestion = new IngestionPipeline(DB_PATH, INDEX_PATH);
      
      const contentId = await ingestion.ingestFromMemory(fileData, {
        displayName: fileName,
        contentType: mimeType
      });
      
      return {
        success: true,
        contentId,
        message: `Successfully ingested ${fileName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Simulate MCP server providing content for display
  async function getContentForDisplay(contentId) {
    try {
      const base64Data = await search.getContent(contentId, 'base64');
      const metadata = await search.getContentMetadata(contentId);
      
      return {
        success: true,
        content: base64Data,
        metadata: {
          name: metadata.displayName,
          type: metadata.contentType,
          size: metadata.fileSize
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Demo the MCP workflow
  const sampleFile = Buffer.from('# Sample Document\n\nThis is a sample document uploaded via MCP.');
  
  console.log('📤 Simulating file upload via MCP...');
  const uploadResult = await handleFileUpload(sampleFile, 'sample.md', 'text/markdown');
  console.log(`Upload result:`, uploadResult);
  
  if (uploadResult.success) {
    console.log('📥 Simulating content retrieval for MCP display...');
    const displayResult = await getContentForDisplay(uploadResult.contentId);
    
    if (displayResult.success) {
      console.log(`Display metadata:`, displayResult.metadata);
      console.log(`Content preview: ${displayResult.content.substring(0, 100)}...`);
    } else {
      console.log(`Display error:`, displayResult.error);
    }
  }
}

// CLI Integration Example  
async function cliIntegrationExample() {
  console.log('\n💻 CLI Integration Example');
  
  const search = new SearchEngine(INDEX_PATH, DB_PATH);
  
  // Simulate CLI command: raglite search "machine learning"
  console.log('🔍 Simulating CLI search command...');
  const results = await search.search('machine learning', { top_k: 3 });
  
  console.log(`Found ${results.length} results:`);
  
  for (const [index, result] of results.entries()) {
    console.log(`\n${index + 1}. ${result.document.source}`);
    console.log(`   Score: ${result.score.toFixed(3)}`);
    console.log(`   Preview: ${result.text.substring(0, 100)}...`);
    
    // CLI can access files directly
    try {
      const filePath = await search.getContent(result.document.contentId, 'file');
      console.log(`   📁 Available at: ${filePath}`);
    } catch (error) {
      console.log(`   ❌ File access error: ${error.message}`);
    }
  }
}

// Run all examples
async function main() {
  try {
    // Ensure examples directory exists
    mkdirSync('./examples/.raglite', { recursive: true });
    
    await runUnifiedContentExamples();
    await mcpIntegrationExample();
    await cliIntegrationExample();
    
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runUnifiedContentExamples,
  mcpIntegrationExample,
  cliIntegrationExample
};