# Model Selection Guide

Complete guide to embedding models, performance characteristics, and selection criteria for RAG-lite TS.

## Table of Contents

- [Quick Selection](#quick-selection)
- [Supported Models](#supported-models)
- [Performance Comparison](#performance-comparison)
- [Model Switching](#model-switching)
- [Configuration](#configuration)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)

## Quick Selection

**For most users (recommended):**
```bash
# Fast, efficient, good quality
raglite ingest ./docs/  # Uses sentence-transformers/all-MiniLM-L6-v2
```

**For highest quality:**
```bash
# Slower but better semantic understanding
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2
```

## Supported Models

### sentence-transformers/all-MiniLM-L6-v2 (Default)

**Best for**: Speed, efficiency, general-purpose search

- **Dimensions**: 384
- **Model Size**: ~23MB
- **Speed**: ~127 embeddings/second
- **Memory**: ~343MB total usage
- **Quality**: Good for most use cases

**Auto-configured settings:**
- Chunk size: 250 tokens
- Batch size: 16
- Overlap: 50 tokens

### Xenova/all-mpnet-base-v2 (High Quality)

**Best for**: Complex queries, technical content, research

- **Dimensions**: 768 (2x more semantic information)
- **Model Size**: ~110MB
- **Speed**: ~29 embeddings/second
- **Memory**: ~892MB total usage
- **Quality**: Excellent semantic understanding

**Auto-configured settings:**
- Chunk size: 400 tokens
- Batch size: 8
- Overlap: 80 tokens

## Performance Comparison

### Speed Benchmarks
| Metric | MiniLM-L6-v2 | MPNet-base-v2 | Difference |
|--------|--------------|---------------|------------|
| Single embedding | 16ms | 114ms | 7x slower |
| Batch (10 texts) | 79ms | 341ms | 4.3x slower |
| Throughput | 127/sec | 29/sec | 4.3x slower |
| Model loading | 460ms | 6,086ms | 13x slower |

### Memory Usage
| Metric | MiniLM-L6-v2 | MPNet-base-v2 | Difference |
|--------|--------------|---------------|------------|
| Processing | 1.6MB | 12.3MB | 7.5x more |
| Total memory | 343MB | 892MB | 2.6x more |
| Model cache | 23MB | 110MB | 4.8x larger |

### Quality Characteristics
| Aspect | MiniLM-L6-v2 | MPNet-base-v2 |
|--------|--------------|---------------|
| General search | ✅ Excellent | ✅ Excellent |
| Technical content | ✅ Good | ✅ Superior |
| Complex queries | ✅ Good | ✅ Excellent |
| Domain-specific | ✅ Moderate | ✅ Better |
| Semantic nuance | ✅ Good | ✅ Superior |

## Model Switching

### CLI Method (Recommended)

**Switch to high-quality model:**
```bash
# Automatically rebuilds index if needed
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed
raglite search "complex query"  # Uses MPNet automatically
```

**Switch back to fast model:**
```bash
# Automatically rebuilds index if needed
raglite ingest ./docs/ --model sentence-transformers/all-MiniLM-L6-v2 --rebuild-if-needed
raglite search "simple query"  # Uses MiniLM automatically
```

### Configuration File Method

1. **Update your config file:**
```javascript
// raglite.config.js
export const config = {
  embedding_model: 'Xenova/all-mpnet-base-v2',
  // Other settings auto-configured for this model
};
```

2. **Rebuild the index:**
```bash
raglite rebuild  # Required when changing models via config
```

### Environment Variable Method

```bash
# Set new model
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"

# Rebuild required
raglite rebuild
```

⚠️ **Important**: Model switching requires rebuilding the vector index because embeddings have different dimensions (384 vs 768).

## Configuration

### Model-Specific Auto-Configuration

The system automatically optimizes settings based on your chosen model:

#### MiniLM-L6-v2 Defaults
```javascript
{
  embedding_model: "sentence-transformers/all-MiniLM-L6-v2",
  chunk_size: 250,        // Optimized for 384D
  chunk_overlap: 50,
  batch_size: 16,         // Higher throughput
  dimensions: 384
}
```

#### MPNet-base-v2 Defaults
```javascript
{
  embedding_model: "Xenova/all-mpnet-base-v2",
  chunk_size: 400,        // Larger chunks for 768D
  chunk_overlap: 80,
  batch_size: 8,          // Lower for memory efficiency
  dimensions: 768
}
```

### Custom Overrides

You can override auto-configured values:

```bash
# Override batch size for MiniLM
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_BATCH_SIZE="32"  # Increase for more speed (if memory allows)

# Override chunk size for MPNet
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"
export RAG_CHUNK_SIZE="300"  # Smaller chunks for faster processing
```

## Use Cases

### Choose MiniLM-L6-v2 When:

**✅ Speed is critical**
- Real-time search applications
- Interactive user interfaces
- Large batch processing jobs

**✅ Resources are limited**
- Systems with < 4GB RAM
- Mobile or edge devices
- Shared hosting environments

**✅ General-purpose search**
- Documentation search
- FAQ systems
- Basic content discovery

**✅ High-volume processing**
- Processing thousands of documents
- Frequent re-indexing
- Continuous ingestion pipelines

### Choose MPNet-base-v2 When:

**✅ Quality is paramount**
- Research applications
- Technical documentation
- Complex domain knowledge

**✅ Complex semantic understanding**
- Scientific papers
- Legal documents
- Code documentation with context

**✅ Specialized content**
- Domain-specific terminology
- Technical specifications
- Academic literature

**✅ Sufficient resources**
- Systems with 8GB+ RAM
- Dedicated search servers
- Quality over speed requirements

## System Requirements

### Minimum Requirements
- **MiniLM**: 2GB RAM, any modern CPU
- **MPNet**: 4GB RAM, modern CPU with good single-thread performance

### Recommended Requirements
- **MiniLM**: 4GB+ RAM for optimal batch processing
- **MPNet**: 8GB+ RAM for comfortable operation

### Storage Requirements
- **Model cache**: 150MB for both models
- **Index storage**: ~2KB per chunk (MiniLM), ~4KB per chunk (MPNet)
- **Database**: ~1.5x original document size

## Model Management

### Automatic Downloads

Models are downloaded automatically on first use:

```bash
# First run downloads and caches model
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2
# Downloading model... (this may take a few minutes)
# Model cached at ~/.raglite/models/

# Subsequent runs use cached model
raglite search "query"  # Fast startup
```

### Cache Management

Models are cached globally and reused across projects:

```bash
# Check cache location
echo $HOME/.raglite/models/

# Clear cache if needed (will re-download on next use)
rm -rf ~/.raglite/models/
```

### Offline Setup

For offline environments, see the [GitHub models directory](https://github.com/raglite/rag-lite-ts/tree/main/models) for manual model setup instructions.

## Troubleshooting

### Model Loading Issues

**Problem**: Model fails to download
```bash
# Check internet connection
# Verify disk space (>500MB free)
# Try again later (Hugging Face servers may be busy)
```

**Problem**: Out of memory during loading
```bash
# Switch to smaller model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
raglite rebuild

# Or reduce batch size
export RAG_BATCH_SIZE="4"
```

### Performance Issues

**Problem**: Slow embedding generation
```bash
# Use faster model
raglite ingest ./docs/ --model sentence-transformers/all-MiniLM-L6-v2

# Increase batch size (if memory allows)
export RAG_BATCH_SIZE="32"

# Reduce chunk size
export RAG_CHUNK_SIZE="200"
```

**Problem**: High memory usage
```bash
# Use smaller model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"

# Reduce batch size
export RAG_BATCH_SIZE="8"

# Process in smaller batches
raglite ingest ./docs/batch1/
raglite ingest ./docs/batch2/
```

### Model Compatibility

**Problem**: "Model mismatch detected"
```bash
# The system shows current vs index model:
# Current: Xenova/all-mpnet-base-v2 (768 dimensions)
# Index: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)

# Solution: Rebuild with new model
raglite rebuild
```

**Problem**: Inconsistent search results after model change
```bash
# Ensure complete rebuild
raglite rebuild

# Re-ingest if needed
raglite ingest ./docs/
```

## Future Models

### Planned Support
- **sentence-transformers/all-mpnet-base-v2**: Original HuggingFace version
- **BAAI/bge-small-en-v1.5**: Competitive 384D alternative
- **intfloat/e5-small-v2**: Another quality option

### Evaluation Criteria
1. **transformers.js compatibility**
2. **Performance characteristics**
3. **Model size and memory usage**
4. **Community adoption**
5. **Quality benchmarks**

## Best Practices

### Development Workflow
1. **Start with MiniLM** for fast iteration
2. **Test with your actual content** to assess quality needs
3. **Switch to MPNet** if quality is insufficient
4. **Benchmark both models** with your specific use case

### Production Deployment
1. **Choose model based on requirements** (speed vs quality)
2. **Pre-download models** in deployment pipeline
3. **Monitor memory usage** and adjust batch sizes
4. **Set up model caching** for consistent performance

### Model Selection Decision Tree
```
Do you need the highest possible quality?
├─ Yes → Use MPNet-base-v2
└─ No → Do you have resource constraints?
   ├─ Yes → Use MiniLM-L6-v2
   └─ No → Do you process large volumes?
      ├─ Yes → Use MiniLM-L6-v2
      └─ No → Test both, choose based on results
```

This guide covers everything you need to know about model selection and management. For detailed performance benchmarks, see [EMBEDDING_MODELS_COMPARISON.md](EMBEDDING_MODELS_COMPARISON.md).