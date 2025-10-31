#!/usr/bin/env node

/**
 * PDF and DOCX Example: Demonstrates RAG-lite's unified content system
 * Shows filesystem ingestion, memory ingestion, and format-adaptive content retrieval
 */

import { IngestionPipeline, SearchEngine } from 'rag-lite-ts';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStandardRagLitePaths } from 'rag-lite-ts';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const docsDir = join(__dirname, 'example-docs');

  console.log('📄 RAG-lite Unified Content System Example');
  console.log('==========================================\n');

  let pipeline = null;
  let searchEngine = null;
  let ragLitePaths = null;

  try {
    // 1. Get standardized .raglite paths
    console.log('🏗️  Setting up standardized .raglite directory structure...');
    ragLitePaths = getStandardRagLitePaths(__dirname);
    console.log(`   Database: ${ragLitePaths.dbPath}`);
    console.log(`   Index: ${ragLitePaths.indexPath}`);
    console.log(`   Content: ${ragLitePaths.contentDir}\n`);

    // 2. Initialize ingestion pipeline with standardized paths
    console.log('📥 Initializing ingestion pipeline...');
    pipeline = new IngestionPipeline(
      ragLitePaths.dbPath,
      ragLitePaths.indexPath
    );

    // 2. Filesystem ingestion (existing functionality)
    console.log('📁 Ingesting PDF and DOCX documents from filesystem...');
    const filesystemResults = await pipeline.ingestDirectory(docsDir);
    console.log(`✅ Filesystem: ${filesystemResults.documentsProcessed} documents, ${filesystemResults.chunksCreated} chunks\n`);

    // 3. Memory ingestion (new unified content system feature)
    console.log('💾 Demonstrating memory-based ingestion...');
    
    // Simulate content from an AI agent or API
    const agentContent = Buffer.from(`
# Agent-Generated Document

This document was created by an AI agent and ingested directly from memory without filesystem access.

## Key Features
- Memory-based ingestion for AI workflows
- Content deduplication
- Format-adaptive retrieval
- MCP server integration

## Use Cases
- AI agent document processing
- Dynamic content generation
- API-based document ingestion
- Temporary document analysis
    `.trim());

    const contentId = await pipeline.ingestFromMemory(agentContent, {
      displayName: 'agent-generated-content.md',
      contentType: 'text/markdown'
    });

    console.log(`✅ Memory ingestion: Content ID ${contentId}`);
    console.log(`   Content successfully stored in unified content system\n`);

    // 4. Initialize search engine with standardized paths
    console.log('🔍 Initializing search engine...');
    searchEngine = new SearchEngine(
      ragLitePaths.indexPath,
      ragLitePaths.dbPath
    );
    console.log('✅ Search engine ready!\n');

    // 5. Enhanced search with content retrieval
    const queries = [
      'documentation and examples',
      'PDF processing capabilities',
      'agent generated content',
      'memory ingestion features'
    ];

    console.log('🔍 Running enhanced searches with content retrieval:');
    console.log('===================================================\n');

    for (const query of queries) {
      console.log(`Query: "${query}"`);
      console.log('-'.repeat(50));

      const searchResults = await searchEngine.search(query, { top_k: 2 });

      if (searchResults.length === 0) {
        console.log('No results found.\n');
        continue;
      }

      for (const [index, result] of searchResults.entries()) {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   Source: ${result.document.source}`);
        console.log(`   Title: ${result.document.title}`);
        console.log(`   Content ID: ${result.document.contentId}`);
        console.log(`   Content: ${result.content.substring(0, 100)}...`);
        
        // Demonstrate content retrieval in different formats
        if (result.document.contentId) {
          try {
            // File format (for CLI clients)
            const filePath = await searchEngine.getContent(result.document.contentId, 'file');
            console.log(`   📁 File access: ${filePath}`);
            
            // Base64 format (for MCP clients)
            const base64Content = await searchEngine.getContent(result.document.contentId, 'base64');
            console.log(`   📋 Base64 length: ${base64Content.length} chars`);
          } catch (error) {
            console.log(`   ⚠️  Content retrieval: ${error.message}`);
          }
        } else {
          console.log(`   📄 Legacy content (no content ID) - use document source: ${result.document.source}`);
        }
        
        console.log();
      }
    }

    // 6. Demonstrate batch content retrieval
    console.log('📦 Demonstrating batch content retrieval:');
    console.log('=========================================\n');

    const allResults = await searchEngine.search('content', { top_k: 5 });
    const contentIds = allResults.filter(r => r.document.contentId).map(r => r.document.contentId);

    if (contentIds.length > 0) {
      console.log(`Retrieving ${contentIds.length} content items with IDs in batch...`);
      
      try {
        const batchContent = await searchEngine.getContentBatch(contentIds, 'base64');
        batchContent.forEach((content, index) => {
          console.log(`${index + 1}. Content ID: ${contentIds[index]}`);
          console.log(`   Base64 length: ${content.length} chars`);
        });
      } catch (error) {
        console.log(`⚠️  Batch retrieval error: ${error.message}`);
      }
    } else {
      console.log('No content with unified content system IDs found.');
      console.log('This is expected for filesystem-ingested content in the current version.');
      console.log('Memory-ingested content will have content IDs for retrieval.');
    }

    // 7. Demonstrate the dual storage strategy
    console.log('\n🏗️  Unified Content System Architecture:');
    console.log('==========================================\n');
    
    console.log('📁 Filesystem content (PDF/DOCX):');
    console.log('   - Stored in original locations');
    console.log('   - Accessed via file paths');
    console.log('   - No duplication needed');
    
    console.log('\n💾 Memory content (from agents/APIs):');
    console.log('   - Stored in .raglite/content/ directory');
    console.log('   - Accessed via content IDs');
    console.log('   - Enables MCP integration');
    
    console.log(`\n📊 Content storage summary:`);
    console.log(`   - Database: ${ragLitePaths.dbPath}`);
    console.log(`   - Vector index: ${ragLitePaths.indexPath}`);
    console.log(`   - Content directory: ${ragLitePaths.contentDir}`);
    console.log(`   - Memory content file: ${contentId}.md`);

    console.log('\n✅ Example completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   - Add your own documents to example-docs/');
    console.log('   - Try memory ingestion with your own content');
    console.log('   - Integrate with MCP servers for AI agent workflows');
    console.log('   - Notice how filesystem and memory content coexist seamlessly');

    // Clean up resources
    console.log('\n🧹 Cleaning up resources...');
    try {
      await pipeline.cleanup();
      await searchEngine.cleanup();
      console.log('✅ Resources cleaned up successfully');
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }

    // Explicit successful exit
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to clean up resources even on error
    try {
      if (pipeline) await pipeline.cleanup();
      if (searchEngine) await searchEngine.cleanup();
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup during error handling failed:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

main();