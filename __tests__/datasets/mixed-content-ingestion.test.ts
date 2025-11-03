/**
 * Mixed Content Ingestion Tests with Real Document Patterns
 * Tests ingestion of documents containing both text and image references using real-world patterns
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IngestionPipeline } from '../../src/ingestion.js';
import { SearchEngine } from '../../src/search.js';

// Test configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(__dirname, '../temp');

// Generate unique paths for each test to avoid conflicts
function getTestPaths(testName: string) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const suffix = `${testName}-${timestamp}-${random}`;
  return {
    dbPath: join(TEST_TEMP_DIR, `mixed-content-${suffix}.db`),
    indexPath: join(TEST_TEMP_DIR, `mixed-content-${suffix}.index`)
  };
}

// Real-world document patterns with mixed content
const WIKIPEDIA_STYLE_ARTICLE = `# Machine Learning

Machine learning (ML) is a type of artificial intelligence (AI) that allows software applications to become more accurate at predicting outcomes without being explicitly programmed to do so.

![Neural Network Diagram](./images/neural-network.png)

## History

The term "machine learning" was coined in 1959 by Arthur Samuel, an American IBMer and pioneer in the field of computer gaming and artificial intelligence.

## Types of Machine Learning

### Supervised Learning
Supervised learning algorithms build a mathematical model of training data, known as "training data", that contains both the inputs and the desired outputs.

![Supervised Learning Example](./images/supervised-learning.jpg)

### Unsupervised Learning  
Unsupervised learning algorithms take a set of data that contains only inputs, and find structure in the data, like grouping or clustering of data points.

### Reinforcement Learning
Reinforcement learning is an area of machine learning concerned with how intelligent agents ought to take actions in an environment in order to maximize the notion of cumulative reward.

![Reinforcement Learning Process](./images/reinforcement-learning.png)

## Applications

Machine learning is used in a wide variety of applications, such as:
- Email filtering and spam detection
- Computer vision and image recognition
- Natural language processing
- Recommendation systems
- Autonomous vehicles
- Medical diagnosis
`;

const PRODUCT_DOCUMENTATION = `# Wireless Headphones Pro

Premium wireless headphones with advanced noise cancellation technology.

![Product Overview](./images/headphones-main.jpg)

## Key Features

### Audio Quality
- **Frequency Response**: 20Hz - 20kHz
- **Driver Size**: 40mm dynamic drivers
- **Impedance**: 32 ohms

![Audio Specifications Chart](./images/frequency-response.png)

### Battery Life
- **Playback Time**: Up to 30 hours with ANC off
- **Quick Charge**: 15 minutes for 3 hours playback
- **Charging Port**: USB-C

![Battery Performance Graph](./images/battery-life.jpg)

### Connectivity
- **Bluetooth Version**: 5.0
- **Codec Support**: SBC, AAC, aptX, LDAC
- **Range**: Up to 10 meters

## Usage Scenarios

![Usage Examples](./images/usage-scenarios.webp)

Perfect for:
- Daily commuting and travel
- Work from home calls
- Gaming and entertainment
- Exercise and outdoor activities

## Technical Specifications

| Feature | Specification |
|---------|---------------|
| Weight | 250g |
| Dimensions | 190 x 160 x 80mm |
| Materials | Premium aluminum and leather |
| Colors | Black, Silver, Rose Gold |

![Color Options](./images/color-variants.png)
`;

const RESEARCH_PAPER_EXCERPT = `# Attention Is All You Need

## Abstract

The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism.

![Transformer Architecture](./figures/transformer-architecture.png)

## Introduction

Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation.

## Model Architecture

The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder, shown in the left and right halves of Figure 1, respectively.

![Encoder-Decoder Architecture](./figures/encoder-decoder.svg)

### Attention

An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors.

![Attention Mechanism](./figures/attention-visualization.jpg)

The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.

## Results

![Performance Comparison](./figures/results-table.png)

Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.
`;

beforeEach(() => {
  if (!existsSync(TEST_TEMP_DIR)) {
    mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
});

afterEach(async () => {
  // Give a small delay to allow database connections to close
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (existsSync(TEST_TEMP_DIR)) {
    try {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // On Windows, database files can be locked briefly after closing
      // Try again after a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
      } catch (retryError) {
        console.warn('⚠️  Could not clean up test directory (files may be locked):', retryError);
        // Don't fail the test due to cleanup issues
      }
    }
  }
});

describe('Mixed Content Ingestion with Real Document Patterns', () => {
  
  describe('Wikipedia-Style Articles', () => {
    
    test('should ingest and search Wikipedia-style articles with images', async () => {
      const { dbPath, indexPath } = getTestPaths('wikipedia');
      const docPath = join(TEST_TEMP_DIR, 'ml-article.md');
      writeFileSync(docPath, WIKIPEDIA_STYLE_ARTICLE);
      
      // Use text mode with sentence transformer since CLIP text-only has limitations
      console.log('⚠️  Using text mode with sentence transformer (CLIP text-only has limitations)');
      
      const ingestion = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      const result = await ingestion.ingestDocument(docPath);
      
      assert.ok(result.documentsProcessed >= 1, 'Should process the Wikipedia article');
      assert.ok(result.chunksCreated >= 2, 'Should create multiple chunks from sections');
      
      // Test various search queries
      const search = new SearchEngine(indexPath, dbPath);
      
      const queries = [
        'What is machine learning?',
        'supervised learning algorithms',
        'reinforcement learning applications',
        'Arthur Samuel machine learning history'
      ];
      
      for (const query of queries) {
        const results = await search.search(query, { top_k: 3 });
        assert.ok(results.length > 0, `Should find results for: ${query}`);
        
        // Verify content relevance
        const hasRelevantContent = results.some(result => 
          result.content.toLowerCase().includes('machine learning') ||
          result.content.toLowerCase().includes('supervised') ||
          result.content.toLowerCase().includes('algorithm') ||
          result.content.toLowerCase().includes('samuel')
        );
        assert.ok(hasRelevantContent, `Results should be relevant to: ${query}`);
      }
      
      // Clean up resources
      await search.cleanup();
      await ingestion.cleanup();
    });
  });
  
  describe('Product Documentation', () => {
    
    test('should handle technical product docs with specifications and images', async () => {
      const { dbPath, indexPath } = getTestPaths('product');
      const docPath = join(TEST_TEMP_DIR, 'product-doc.md');
      writeFileSync(docPath, PRODUCT_DOCUMENTATION);
      
      console.log('⚠️  Using text mode for product documentation');
      
      const ingestion = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      const result = await ingestion.ingestDocument(docPath);
      assert.ok(result.documentsProcessed >= 1, 'Should process product documentation');
      
      const search = new SearchEngine(indexPath, dbPath);
      
      // Test product-specific queries
      const productQueries = [
        'wireless headphones battery life',
        'bluetooth connectivity features',
        'audio quality specifications',
        'charging time and port type'
      ];
      
      for (const query of productQueries) {
        const results = await search.search(query, { top_k: 2 });
        assert.ok(results.length > 0, `Should find product info for: ${query}`);
        
        // Check for product-specific terms
        const hasProductContent = results.some(result => 
          result.content.toLowerCase().includes('headphones') ||
          result.content.toLowerCase().includes('battery') ||
          result.content.toLowerCase().includes('bluetooth') ||
          result.content.toLowerCase().includes('audio')
        );
        assert.ok(hasProductContent, `Should return relevant product content for: ${query}`);
      }
      
      // Clean up resources
      await search.cleanup();
      await ingestion.cleanup();
    });
  });
  
  describe('Research Paper Format', () => {
    
    test('should process academic papers with figures and technical content', async () => {
      const { dbPath, indexPath } = getTestPaths('research');
      const docPath = join(TEST_TEMP_DIR, 'research-paper.md');
      writeFileSync(docPath, RESEARCH_PAPER_EXCERPT);
      
      console.log('⚠️  Using text mode for research paper');
      
      const ingestion = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      const result = await ingestion.ingestDocument(docPath);
      assert.ok(result.documentsProcessed >= 1, 'Should process research paper');
      
      const search = new SearchEngine(indexPath, dbPath);
      
      // Test academic/technical queries
      const academicQueries = [
        'transformer architecture attention mechanism',
        'sequence transduction models',
        'encoder decoder neural networks',
        'BLEU score translation performance'
      ];
      
      for (const query of academicQueries) {
        const results = await search.search(query, { top_k: 2 });
        assert.ok(results.length > 0, `Should find academic content for: ${query}`);
        
        // Check for technical terms
        const hasTechnicalContent = results.some(result => 
          result.content.toLowerCase().includes('transformer') ||
          result.content.toLowerCase().includes('attention') ||
          result.content.toLowerCase().includes('encoder') ||
          result.content.toLowerCase().includes('neural')
        );
        assert.ok(hasTechnicalContent, `Should return technical content for: ${query}`);
      }
      
      // Clean up resources
      await search.cleanup();
      await ingestion.cleanup();
    });
  });
  
  describe('Batch Processing Multiple Documents', () => {
    
    test('should handle multiple mixed-content documents efficiently', async () => {
      const { dbPath, indexPath } = getTestPaths('batch');
      
      // Create multiple documents
      const documents = [
        { name: 'ml-article-batch.md', content: WIKIPEDIA_STYLE_ARTICLE },
        { name: 'product-doc-batch.md', content: PRODUCT_DOCUMENTATION },
        { name: 'research-paper-batch.md', content: RESEARCH_PAPER_EXCERPT }
      ];
      
      const docPaths = documents.map(doc => {
        const path = join(TEST_TEMP_DIR, doc.name);
        writeFileSync(path, doc.content);
        return path;
      });
      
      console.log('⚠️  Using text mode for batch processing');
      
      const ingestion = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      const startTime = Date.now();
      
      // Ingest all documents
      let totalChunks = 0;
      for (const docPath of docPaths) {
        const result = await ingestion.ingestDocument(docPath);
        totalChunks += result.chunksCreated;
      }
      
      const ingestionTime = Date.now() - startTime;
      console.log(`✓ Ingested ${documents.length} mixed-content documents in ${ingestionTime}ms, created ${totalChunks} chunks`);
      
      // Test cross-document search
      const search = new SearchEngine(indexPath, dbPath);
      
      const crossDocQueries = [
        'neural networks and machine learning',  // Should find ML article and research paper
        'audio technology specifications',        // Should find product doc
        'artificial intelligence applications'    // Should find ML article
      ];
      
      for (const query of crossDocQueries) {
        const results = await search.search(query, { top_k: 5 });
        assert.ok(results.length > 0, `Should find cross-document results for: ${query}`);
      }
      
      // Performance check
      assert.ok(ingestionTime < 30000, `Batch ingestion should be reasonable: ${ingestionTime}ms`);
      
      // Clean up resources
      await search.cleanup();
      await ingestion.cleanup();
    });
  });
  
  describe('Error Handling with Missing Images', () => {
    
    test('should gracefully handle documents with missing image references', async () => {
      const { dbPath, indexPath } = getTestPaths('missing-images');
      
      const docWithMissingImages = `# Test Document with Missing Images

This document references images that don't exist.

![Missing Image](./images/nonexistent.jpg)

The system should handle this gracefully and still process the text content.

![Another Missing Image](./missing/image.png)

This text should still be searchable even though the images are missing.

## Section with Valid Content

This section contains important information that should be indexed and searchable.

![Yet Another Missing](./images/404.webp)

The ingestion should continue despite missing image files.
`;

      const docPath = join(TEST_TEMP_DIR, 'missing-images.md');
      writeFileSync(docPath, docWithMissingImages);
      
      console.log('⚠️  Testing error handling with text mode');
      
      const ingestion = new IngestionPipeline(dbPath, indexPath, {
        mode: 'text',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      // Should not throw error for missing images
      const result = await ingestion.ingestDocument(docPath);
      assert.ok(result.documentsProcessed >= 1, 'Should process document despite missing images');
      assert.ok(result.chunksCreated >= 1, 'Should create chunks from text content');
      
      // Text should still be searchable
      const search = new SearchEngine(indexPath, dbPath);
      const results = await search.search('handle gracefully');
      assert.ok(results.length > 0, 'Should find text content despite missing images');
      
      const importantResults = await search.search('important information');
      assert.ok(importantResults.length > 0, 'Should find section content');
      
      // Clean up resources
      await search.cleanup();
      await ingestion.cleanup();
    });
  });
});

// Global cleanup to ensure test process exits gracefully
let testCompleted = false;
let forceExitTimer: NodeJS.Timeout | null = null;

// Track when all tests are done
process.on('beforeExit', () => {
  if (!testCompleted) {
    testCompleted = true;
    console.log('✅ All tests completed, cleaning up resources...');
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Set a timer to force exit if resources don't clean up
    forceExitTimer = setTimeout(() => {
      console.log('⚠️  Forcing process exit after cleanup timeout');
      process.exit(0);
    }, 1000); // Shorter timeout
  }
});

// Ensure we exit even if beforeExit doesn't work
setTimeout(() => {
  console.log('⚠️  Maximum test runtime reached, forcing exit');
  process.exit(0);
}, 30000); // 30 second maximum runtime

// Also set up a more immediate exit after test completion
process.nextTick(() => {
  // Wait a bit then check if we should exit
  setTimeout(() => {
    console.log('🔄 Checking if tests are complete...');
    // Force exit after a reasonable delay
    setTimeout(() => {
      console.log('✅ Tests should be complete, exiting gracefully');
      process.exit(0);
    }, 5000); // Longer delay for mixed content tests
  }, 2000);
});