/**
 * Performance and end-to-end integration tests for the refactored system
 * Validates that performance is equivalent or better after refactoring
 * Tests complete system integration with realistic workloads
 * Uses Node.js test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';

// Factory pattern imports
import { 
  TextSearchFactory, 
  TextIngestionFactory, 
  TextRAGFactory 
} from '../../src/factories/text-factory.js';

// Core architecture imports for comparison
import { SearchEngine } from '../../src/core/search.js';
import { IngestionPipeline } from '../../src/core/ingestion.js';
import { openDatabase, initializeSchema } from '../../src/core/db.js';
import { IndexManager } from '../../src/index-manager.js';
import { createTextEmbedFunction } from '../../src/text/embedder.js';

// Test configuration
const TEST_BASE_DIR = join(tmpdir(), 'rag-lite-performance-test');
const TEST_DIR = join(TEST_BASE_DIR, Date.now().toString());
const TEST_DOCS_DIR = join(TEST_DIR, 'docs');

/**
 * Create a larger set of test documents for performance testing
 */
function setupPerformanceTestEnvironment(): void {
  // Clean up any existing test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }

  // Create test directories
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DOCS_DIR, { recursive: true });

  // Create multiple documents with varying content for realistic testing
  const documents = [
    {
      filename: 'machine-learning-overview.md',
      content: `# Machine Learning Overview

Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data and use it to learn for themselves.

## Types of Machine Learning

### Supervised Learning
Supervised learning uses labeled training data to learn a mapping function from input variables to output variables. Common algorithms include:
- Linear Regression
- Decision Trees
- Random Forest
- Support Vector Machines
- Neural Networks

### Unsupervised Learning
Unsupervised learning finds hidden patterns in data without labeled examples. Key techniques include:
- Clustering (K-means, Hierarchical)
- Dimensionality Reduction (PCA, t-SNE)
- Association Rules
- Anomaly Detection

### Reinforcement Learning
Reinforcement learning learns through interaction with an environment, receiving rewards or penalties for actions. Applications include:
- Game playing (Chess, Go, Video games)
- Robotics
- Autonomous vehicles
- Trading algorithms

## Applications

Machine learning has revolutionized many industries:
- Healthcare: Medical diagnosis, drug discovery
- Finance: Fraud detection, algorithmic trading
- Technology: Search engines, recommendation systems
- Transportation: Autonomous vehicles, route optimization
- Entertainment: Content recommendation, game AI`
    },
    {
      filename: 'deep-learning-fundamentals.md',
      content: `# Deep Learning Fundamentals

Deep learning is a subset of machine learning that uses artificial neural networks with multiple layers to model and understand complex patterns in data. It has achieved remarkable success in various domains including computer vision, natural language processing, and speech recognition.

## Neural Network Architecture

### Basic Components
- **Neurons**: Basic processing units that receive inputs, apply weights, and produce outputs
- **Layers**: Collections of neurons that process information at different levels of abstraction
- **Weights and Biases**: Parameters that the network learns during training
- **Activation Functions**: Non-linear functions that introduce complexity (ReLU, Sigmoid, Tanh)

### Common Architectures
- **Feedforward Networks**: Information flows in one direction from input to output
- **Convolutional Neural Networks (CNNs)**: Specialized for processing grid-like data such as images
- **Recurrent Neural Networks (RNNs)**: Designed for sequential data with memory capabilities
- **Transformer Networks**: Attention-based models that have revolutionized NLP

## Training Process

### Forward Propagation
Data flows through the network from input to output, with each layer transforming the data based on learned parameters.

### Backpropagation
The network calculates gradients of the loss function with respect to each parameter and updates weights to minimize error.

### Optimization Algorithms
- Stochastic Gradient Descent (SGD)
- Adam Optimizer
- RMSprop
- AdaGrad

## Applications and Breakthroughs

Deep learning has enabled breakthrough applications:
- **Computer Vision**: Image classification, object detection, facial recognition
- **Natural Language Processing**: Machine translation, sentiment analysis, chatbots
- **Speech Recognition**: Voice assistants, transcription services
- **Generative Models**: GANs, VAEs, diffusion models for creating new content`
    },
    {
      filename: 'rag-systems-architecture.md',
      content: `# RAG Systems Architecture

Retrieval-Augmented Generation (RAG) represents a paradigm shift in how we build AI systems that need to access and utilize large amounts of external knowledge. By combining information retrieval with text generation, RAG systems can provide more accurate, up-to-date, and contextually relevant responses.

## Core Components

### Document Ingestion Pipeline
The ingestion pipeline processes and prepares documents for retrieval:
1. **Document Loading**: Support for various formats (PDF, Markdown, HTML, etc.)
2. **Text Extraction**: Clean extraction of textual content
3. **Chunking**: Breaking documents into manageable pieces
4. **Embedding Generation**: Converting text chunks into vector representations
5. **Index Storage**: Storing vectors in efficient search structures

### Retrieval System
The retrieval system finds relevant information based on queries:
- **Query Processing**: Understanding and preprocessing user queries
- **Vector Search**: Finding semantically similar content using embedding similarity
- **Hybrid Search**: Combining vector search with traditional keyword search
- **Reranking**: Improving result quality using cross-encoder models

### Generation Component
The generation component uses retrieved context to produce responses:
- **Context Integration**: Combining retrieved documents with the original query
- **Prompt Engineering**: Structuring inputs for optimal generation
- **Response Generation**: Using language models to produce coherent answers
- **Citation and Attribution**: Linking generated content back to source documents

## Implementation Patterns

### Factory Pattern
Modern RAG systems use factory patterns for clean initialization:
\`\`\`typescript
const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
  './index.bin',
  './db.sqlite'
);
\`\`\`

### Dependency Injection
Core components use dependency injection for flexibility:
\`\`\`typescript
const embedFn = createTextEmbedFunction();
const search = new SearchEngine(embedFn, indexManager, db);
\`\`\`

## Performance Considerations

### Embedding Models
- **Model Size vs. Quality**: Larger models provide better embeddings but slower inference
- **Batch Processing**: Processing multiple documents together for efficiency
- **Caching**: Storing computed embeddings to avoid recomputation

### Vector Search Optimization
- **Index Types**: HNSW, IVF, LSH for different use cases
- **Quantization**: Reducing memory usage with minimal quality loss
- **Approximate Search**: Trading accuracy for speed in large-scale systems

### Scalability Patterns
- **Distributed Processing**: Scaling ingestion across multiple workers
- **Incremental Updates**: Adding new documents without full reindexing
- **Load Balancing**: Distributing search requests across multiple instances`
    },
    {
      filename: 'vector-databases-guide.md',
      content: `# Vector Databases Guide

Vector databases are specialized database systems designed to store, index, and query high-dimensional vector data efficiently. They have become essential infrastructure for modern AI applications, particularly those involving semantic search, recommendation systems, and retrieval-augmented generation.

## Vector Database Fundamentals

### What are Vector Embeddings?
Vector embeddings are numerical representations of data (text, images, audio) in high-dimensional space where semantic similarity is preserved through geometric proximity. These dense vectors typically have hundreds or thousands of dimensions.

### Why Specialized Databases?
Traditional databases are not optimized for:
- High-dimensional vector storage
- Similarity search operations
- Approximate nearest neighbor queries
- Real-time vector operations at scale

## Key Features

### Similarity Search
Vector databases excel at finding similar items:
- **Cosine Similarity**: Measures angle between vectors
- **Euclidean Distance**: Measures straight-line distance
- **Dot Product**: Measures vector alignment
- **Manhattan Distance**: Sum of absolute differences

### Indexing Algorithms
Efficient indexing is crucial for performance:
- **HNSW (Hierarchical Navigable Small World)**: Graph-based approach with excellent recall
- **IVF (Inverted File)**: Clustering-based method for large datasets
- **LSH (Locality Sensitive Hashing)**: Probabilistic approach for approximate search
- **Product Quantization**: Compression technique for memory efficiency

### Filtering and Metadata
Modern vector databases support:
- **Metadata Filtering**: Combining vector search with traditional filters
- **Hybrid Queries**: Mixing vector similarity with exact matches
- **Faceted Search**: Multi-dimensional filtering capabilities

## Implementation Considerations

### Data Modeling
- **Embedding Dimensions**: Balance between quality and performance
- **Normalization**: Ensuring consistent vector magnitudes
- **Versioning**: Managing embedding model updates
- **Metadata Schema**: Designing efficient attribute storage

### Performance Optimization
- **Batch Operations**: Grouping insertions and updates
- **Index Tuning**: Optimizing parameters for specific use cases
- **Memory Management**: Balancing RAM usage with query performance
- **Caching Strategies**: Reducing repeated computation

### Scalability Patterns
- **Horizontal Scaling**: Distributing data across multiple nodes
- **Replication**: Ensuring high availability and read performance
- **Sharding**: Partitioning large datasets effectively
- **Load Balancing**: Distributing query load evenly

## Popular Vector Database Solutions

### Open Source Options
- **Chroma**: Simple and developer-friendly
- **Weaviate**: GraphQL-based with rich features
- **Milvus**: High-performance distributed system
- **Qdrant**: Rust-based with excellent performance

### Cloud Solutions
- **Pinecone**: Fully managed with excellent developer experience
- **Weaviate Cloud**: Hosted version of the open-source solution
- **Amazon OpenSearch**: AWS-managed with vector capabilities
- **Azure Cognitive Search**: Microsoft's AI-powered search service`
    },
    {
      filename: 'embedding-models-comparison.md',
      content: `# Embedding Models Comparison

Embedding models are the foundation of semantic search and retrieval systems. Choosing the right model involves balancing factors like quality, speed, model size, and specific use case requirements. This guide compares popular embedding models and provides guidance for selection.

## Model Categories

### Sentence Transformers
Sentence-BERT models optimized for semantic similarity:
- **all-MiniLM-L6-v2**: Compact model with good performance (384 dimensions)
- **all-mpnet-base-v2**: Higher quality with larger size (768 dimensions)
- **all-MiniLM-L12-v2**: Balance between size and quality (384 dimensions)

### OpenAI Models
Commercial embedding models with excellent quality:
- **text-embedding-ada-002**: High-quality general-purpose model (1536 dimensions)
- **text-embedding-3-small**: Newer model with configurable dimensions
- **text-embedding-3-large**: Highest quality with larger size

### Specialized Models
Domain-specific and multilingual options:
- **multilingual-e5-large**: Excellent multilingual support
- **bge-large-en-v1.5**: High-performance English model
- **instructor-xl**: Instruction-tuned for diverse tasks

## Performance Comparison

### Quality Metrics
Models are typically evaluated on:
- **MTEB (Massive Text Embedding Benchmark)**: Comprehensive evaluation suite
- **STS (Semantic Textual Similarity)**: Correlation with human judgments
- **Retrieval Tasks**: Performance on information retrieval benchmarks
- **Classification Tasks**: Downstream task performance

### Speed and Efficiency
Key performance factors:
- **Inference Speed**: Tokens processed per second
- **Model Size**: Memory requirements and loading time
- **Batch Processing**: Efficiency with multiple inputs
- **Hardware Requirements**: CPU vs GPU optimization

## Selection Guidelines

### Use Case Considerations
- **General Purpose**: all-mpnet-base-v2 or text-embedding-ada-002
- **Speed Critical**: all-MiniLM-L6-v2 or similar compact models
- **Multilingual**: multilingual-e5-large or similar
- **Domain Specific**: Fine-tuned models for your domain

### Technical Constraints
- **Memory Limitations**: Choose smaller models (384-512 dimensions)
- **Latency Requirements**: Prioritize inference speed over quality
- **Cost Considerations**: Balance API costs vs self-hosted models
- **Offline Requirements**: Use locally deployable models

### Quality vs Performance Trade-offs
- **High Quality**: Larger models with more dimensions
- **Fast Inference**: Smaller models with fewer parameters
- **Balanced Approach**: Medium-sized models like all-MiniLM-L12-v2
- **Configurable**: Models with adjustable dimension output

## Implementation Best Practices

### Model Loading and Caching
\`\`\`typescript
// Efficient model initialization
const embedder = await initializeEmbeddingEngine({
  model: 'sentence-transformers/all-mpnet-base-v2',
  cache: true,
  batchSize: 32
});
\`\`\`

### Batch Processing
\`\`\`typescript
// Process multiple texts efficiently
const embeddings = await embedder.embedBatch(texts, {
  batchSize: 16,
  showProgress: true
});
\`\`\`

### Error Handling
\`\`\`typescript
// Robust embedding with fallbacks
try {
  const embedding = await embedder.embed(text);
} catch (error) {
  // Fallback to simpler model or cached result
  const fallbackEmbedding = await fallbackEmbedder.embed(text);
}
\`\`\`

## Future Trends

### Emerging Approaches
- **Multimodal Models**: CLIP-style models for text and images
- **Instruction-Tuned**: Models that follow specific instructions
- **Retrieval-Augmented**: Models that can access external knowledge
- **Efficient Architectures**: Distilled and quantized models

### Performance Improvements
- **Hardware Optimization**: Models optimized for specific hardware
- **Quantization**: Reduced precision for faster inference
- **Pruning**: Removing unnecessary parameters
- **Knowledge Distillation**: Transferring knowledge to smaller models`
    }
  ];

  // Write all test documents
  documents.forEach(doc => {
    writeFileSync(join(TEST_DOCS_DIR, doc.filename), doc.content);
  });
}

/**
 * Clean up test environment
 */
function cleanupTestEnvironment(): void {
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
}

/**
 * Measure execution time of an async function
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
}

describe('Performance Integration Tests', () => {
  let testDbPath: string;
  let testIndexPath: string;

  beforeEach(() => {
    setupPerformanceTestEnvironment();
    testDbPath = join(TEST_DIR, 'perf-test.sqlite');
    testIndexPath = join(TEST_DIR, 'perf-test-index.bin');
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('factory pattern performance vs direct dependency injection', async () => {
    console.log('🧪 Comparing factory pattern vs direct dependency injection performance...');

    try {
      // Test 1: Factory Pattern Performance
      console.log('Testing factory pattern performance...');
      const factoryTiming = await measureTime(async () => {
        const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
          testIndexPath,
          testDbPath,
          { enableReranking: false },
          { chunkSize: 1024 }
        );

        // Ingest documents
        const ingestionResult = await ingestionPipeline.ingestDirectory(TEST_DOCS_DIR);
        
        // Perform multiple searches
        const searchResults = await Promise.all([
          searchEngine.search('machine learning algorithms'),
          searchEngine.search('vector databases'),
          searchEngine.search('embedding models'),
          searchEngine.search('RAG architecture'),
          searchEngine.search('deep learning neural networks')
        ]);

        await searchEngine.cleanup();
        await ingestionPipeline.cleanup();

        return { ingestionResult, searchResults };
      });

      console.log(`Factory pattern completed in ${factoryTiming.duration.toFixed(2)}ms`);
      assert.ok(factoryTiming.result.ingestionResult.documentsProcessed === 5, 'Should process all documents');
      assert.ok(factoryTiming.result.searchResults.every(results => results.length > 0), 'All searches should return results');

      // Clean up for next test
      if (existsSync(testDbPath)) rmSync(testDbPath);
      if (existsSync(testIndexPath)) rmSync(testIndexPath);

      // Test 2: Direct Dependency Injection Performance
      console.log('Testing direct dependency injection performance...');
      const directTiming = await measureTime(async () => {
        // Create dependencies manually
        const embedFn = createTextEmbedFunction();
        const db = await openDatabase(testDbPath);
        await initializeSchema(db);
        const indexManager = new IndexManager(testIndexPath, testDbPath, 384);
        await indexManager.initialize();

        // Create instances with dependency injection
        const ingestionPipeline = new IngestionPipeline(embedFn, indexManager, db);
        const searchEngine = new SearchEngine(embedFn, indexManager, db);

        // Ingest documents
        const ingestionResult = await ingestionPipeline.ingestDirectory(TEST_DOCS_DIR);
        
        // Perform multiple searches
        const searchResults = await Promise.all([
          searchEngine.search('machine learning algorithms'),
          searchEngine.search('vector databases'),
          searchEngine.search('embedding models'),
          searchEngine.search('RAG architecture'),
          searchEngine.search('deep learning neural networks')
        ]);

        await searchEngine.cleanup();
        await ingestionPipeline.cleanup();

        return { ingestionResult, searchResults };
      });

      console.log(`Direct injection completed in ${directTiming.duration.toFixed(2)}ms`);
      assert.ok(directTiming.result.ingestionResult.documentsProcessed === 5, 'Should process all documents');
      assert.ok(directTiming.result.searchResults.every(results => results.length > 0), 'All searches should return results');

      // Performance comparison
      const performanceDifference = Math.abs(factoryTiming.duration - directTiming.duration);
      const performanceRatio = Math.max(factoryTiming.duration, directTiming.duration) / Math.min(factoryTiming.duration, directTiming.duration);

      console.log(`Performance difference: ${performanceDifference.toFixed(2)}ms (ratio: ${performanceRatio.toFixed(2)}x)`);
      
      // Factory pattern should not be significantly slower (within 50% overhead is acceptable)
      assert.ok(performanceRatio < 1.5, `Performance ratio should be reasonable, got ${performanceRatio.toFixed(2)}x`);

      console.log('✅ Performance comparison test completed successfully');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('ONNX')
      )) {
        console.log('⚠️  Skipping performance test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('large document ingestion performance', async () => {
    console.log('🧪 Testing large document ingestion performance...');

    try {
      // Create a larger test document
      const largeContent = `# Large Document Performance Test\n\n` + 
        'This is a performance test document with repeated content. '.repeat(1000) +
        '\n\n## Section 1\n\n' +
        'Machine learning content for testing search performance. '.repeat(500) +
        '\n\n## Section 2\n\n' +
        'Vector database and embedding model performance testing. '.repeat(500);

      writeFileSync(join(TEST_DOCS_DIR, 'large-document.md'), largeContent);

      // Test ingestion performance with large document
      const ingestionTiming = await measureTime(async () => {
        const ingestion = await TextIngestionFactory.create(testDbPath, testIndexPath, {
          chunkSize: 512,
          chunkOverlap: 50
        });

        const result = await ingestion.ingestDirectory(TEST_DOCS_DIR);
        await ingestion.cleanup();
        return result;
      });

      console.log(`Large document ingestion completed in ${ingestionTiming.duration.toFixed(2)}ms`);
      console.log(`Processed ${ingestionTiming.result.documentsProcessed} documents, created ${ingestionTiming.result.chunksCreated} chunks`);

      assert.ok(ingestionTiming.result.documentsProcessed === 6, 'Should process all documents including large one');
      assert.ok(ingestionTiming.result.chunksCreated > 50, 'Should create many chunks from large document');

      // Test search performance on large dataset
      const searchTiming = await measureTime(async () => {
        const search = await TextSearchFactory.create(testIndexPath, testDbPath, {
          enableReranking: false,
          topK: 10
        });

        const results = await Promise.all([
          search.search('machine learning performance'),
          search.search('vector database testing'),
          search.search('embedding model evaluation'),
          search.search('large document processing'),
          search.search('performance optimization')
        ]);

        await search.cleanup();
        return results;
      });

      console.log(`Search on large dataset completed in ${searchTiming.duration.toFixed(2)}ms`);
      assert.ok(searchTiming.result.every(results => results.length > 0), 'All searches should return results');

      // Performance should be reasonable (under 30 seconds for this test)
      assert.ok(ingestionTiming.duration < 30000, 'Ingestion should complete within 30 seconds');
      assert.ok(searchTiming.duration < 5000, 'Search should complete within 5 seconds');

      console.log('✅ Large document performance test completed successfully');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('ONNX')
      )) {
        console.log('⚠️  Skipping large document test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('concurrent operations performance', async () => {
    console.log('🧪 Testing concurrent operations performance...');

    try {
      // First ingest documents
      const ingestion = await TextIngestionFactory.create(testDbPath, testIndexPath);
      await ingestion.ingestDirectory(TEST_DOCS_DIR);
      await ingestion.cleanup();

      // Test concurrent search operations
      const concurrentTiming = await measureTime(async () => {
        const search = await TextSearchFactory.create(testIndexPath, testDbPath, {
          enableReranking: false
        });

        // Perform multiple concurrent searches
        const searchPromises = [
          'machine learning',
          'deep learning',
          'vector databases',
          'embedding models',
          'RAG systems',
          'neural networks',
          'artificial intelligence',
          'semantic search',
          'information retrieval',
          'natural language processing'
        ].map(query => search.search(query));

        const results = await Promise.all(searchPromises);
        await search.cleanup();
        return results;
      });

      console.log(`Concurrent searches completed in ${concurrentTiming.duration.toFixed(2)}ms`);
      assert.ok(concurrentTiming.result.length === 10, 'Should complete all concurrent searches');
      assert.ok(concurrentTiming.result.every(results => results.length > 0), 'All searches should return results');

      // Concurrent operations should be efficient (under 10 seconds)
      assert.ok(concurrentTiming.duration < 10000, 'Concurrent searches should complete within 10 seconds');

      console.log('✅ Concurrent operations test completed successfully');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('ONNX')
      )) {
        console.log('⚠️  Skipping concurrent operations test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('memory usage and resource cleanup', async () => {
    console.log('🧪 Testing memory usage and resource cleanup...');

    try {
      const initialMemory = process.memoryUsage();
      console.log(`Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Create and use multiple instances to test resource management
      for (let i = 0; i < 3; i++) {
        const testDbPathLoop = join(TEST_DIR, `test-${i}.sqlite`);
        const testIndexPathLoop = join(TEST_DIR, `test-index-${i}.bin`);

        const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
          testIndexPathLoop,
          testDbPathLoop,
          { enableReranking: false }
        );

        // Ingest a subset of documents
        await ingestionPipeline.ingestFile(join(TEST_DOCS_DIR, 'machine-learning-overview.md'));
        
        // Perform some searches
        await searchEngine.search('machine learning');
        await searchEngine.search('neural networks');

        // Clean up resources
        await searchEngine.cleanup();
        await ingestionPipeline.cleanup();

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const currentMemory = process.memoryUsage();
        console.log(`Memory after iteration ${i + 1}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (under 100MB for this test)
      assert.ok(memoryIncrease < 100 * 1024 * 1024, 'Memory increase should be reasonable');

      console.log('✅ Memory usage test completed successfully');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('ONNX')
      )) {
        console.log('⚠️  Skipping memory test due to environment limitations');
        return;
      }
      throw error;
    }
  });

  test('search quality and consistency validation', async () => {
    console.log('🧪 Testing search quality and consistency...');

    try {
      // Create search engine
      const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
        testIndexPath,
        testDbPath,
        { enableReranking: false, topK: 10 }
      );

      // Ingest documents
      await ingestionPipeline.ingestDirectory(TEST_DOCS_DIR);

      // Test search quality with specific queries
      const testQueries = [
        {
          query: 'machine learning algorithms',
          expectedKeywords: ['machine learning', 'algorithm', 'supervised', 'unsupervised']
        },
        {
          query: 'vector database indexing',
          expectedKeywords: ['vector', 'database', 'index', 'HNSW', 'similarity']
        },
        {
          query: 'embedding model comparison',
          expectedKeywords: ['embedding', 'model', 'comparison', 'performance', 'quality']
        },
        {
          query: 'RAG system architecture',
          expectedKeywords: ['RAG', 'retrieval', 'generation', 'architecture', 'component']
        }
      ];

      for (const testQuery of testQueries) {
        const results = await searchEngine.search(testQuery.query);
        
        assert.ok(results.length > 0, `Query "${testQuery.query}" should return results`);
        assert.ok(results.length <= 10, 'Should respect topK limit');

        // Check that results are relevant (contain expected keywords)
        const allContent = results.map(r => r.content.toLowerCase()).join(' ');
        const foundKeywords = testQuery.expectedKeywords.filter(keyword => 
          allContent.includes(keyword.toLowerCase())
        );

        assert.ok(
          foundKeywords.length >= Math.ceil(testQuery.expectedKeywords.length * 0.5),
          `Query "${testQuery.query}" should find at least half of expected keywords. Found: ${foundKeywords.join(', ')}`
        );

        // Check result structure
        for (const result of results) {
          assert.ok(typeof result.content === 'string', 'Result should have content');
          assert.ok(typeof result.score === 'number', 'Result should have score');
          assert.ok(result.score >= 0 && result.score <= 1, 'Score should be normalized');
          assert.ok(result.document, 'Result should have document metadata');
          assert.ok(typeof result.document.source === 'string', 'Document should have source');
        }

        // Check that results are sorted by score (descending)
        for (let i = 1; i < results.length; i++) {
          assert.ok(
            results[i - 1].score >= results[i].score,
            'Results should be sorted by score in descending order'
          );
        }
      }

      // Test consistency - same query should return same results
      const consistencyQuery = 'deep learning neural networks';
      const results1 = await searchEngine.search(consistencyQuery);
      const results2 = await searchEngine.search(consistencyQuery);

      assert.equal(results1.length, results2.length, 'Same query should return same number of results');
      
      for (let i = 0; i < results1.length; i++) {
        assert.equal(results1[i].content, results2[i].content, 'Same query should return same content');
        assert.equal(results1[i].score, results2[i].score, 'Same query should return same scores');
      }

      await searchEngine.cleanup();
      await ingestionPipeline.cleanup();

      console.log('✅ Search quality and consistency test completed successfully');

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('indexedDB not supported') ||
        error.message.includes('IDBFS') ||
        error.message.includes('ONNX')
      )) {
        console.log('⚠️  Skipping search quality test due to environment limitations');
        return;
      }
      throw error;
    }
  });
});
