# Embedding Models Comparison and Selection Guide

## Overview

This document provides a comprehensive comparison of embedding models supported by RAG-lite, including performance benchmarks, use case recommendations, and configuration guidelines to help you choose the right model for your needs.

## Test Environment

All performance benchmarks were conducted on the following system:

### System Specifications
- **OS**: Microsoft Windows 11 Home Single Language (Build 26100)
- **CPU**: 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00GHz
- **RAM**: 7,991 MB (~8GB)
- **Node.js**: v20.19.2
- **Runtime**: Single-threaded JavaScript execution
- **Storage**: SSD (model caching enabled)

### Test Methodology
- **Sample Size**: 10 text samples for batch testing, 50 for performance testing
- **Measurements**: Average of multiple runs
- **Memory**: Process memory usage during embedding generation
- **Consistency**: Multiple runs with identical inputs to verify deterministic behavior

## Supported Models

### 1. sentence-transformers/all-MiniLM-L6-v2 (Current Default)

#### Specifications
- **Dimensions**: 384
- **Architecture**: MiniLM (distilled BERT)
- **Model Size**: ~23MB
- **Quantization**: Available

#### Performance Metrics
- **Single Embedding**: 16.18ms average
- **Batch Processing (10 texts)**: 78.97ms total
- **Average per Embedding**: 7.90ms
- **Throughput**: 126.63 embeddings/second
- **Memory Usage**: 1.64MB during processing
- **Total Memory**: 342.93MB
- **Load Time**: 460ms (cached)

#### Recommended Configuration
```javascript
{
  embedding_model: "sentence-transformers/all-MiniLM-L6-v2",
  chunk_size: 250,
  chunk_overlap: 50,
  batch_size: 16,
  dimensions: 384
}
```

### 2. Xenova/all-mpnet-base-v2 (High-Quality Alternative)

#### Specifications
- **Dimensions**: 768
- **Architecture**: MPNet (Masked and Permuted Pre-training)
- **Model Size**: ~110MB
- **Quantization**: Available

#### Performance Metrics
- **Single Embedding**: 113.57ms average
- **Batch Processing (10 texts)**: 341.10ms total
- **Average per Embedding**: 34.11ms
- **Throughput**: 29.32 embeddings/second
- **Memory Usage**: 12.27MB during processing
- **Total Memory**: 892.22MB
- **Load Time**: 6,086ms (cached), ~41s (first download)

#### Recommended Configuration
```javascript
{
  embedding_model: "Xenova/all-mpnet-base-v2",
  chunk_size: 400,
  chunk_overlap: 80,
  batch_size: 8,
  dimensions: 768
}
```

## Performance Comparison

### Speed Analysis
| Metric | MiniLM-L6-v2 | MPNet-base-v2 | Ratio |
|--------|--------------|---------------|-------|
| Avg Time/Embedding | 7.90ms | 34.11ms | 4.3x slower |
| Throughput | 126.63/sec | 29.32/sec | 4.3x slower |
| Load Time | 460ms | 6,086ms | 13.2x slower |

### Memory Analysis
| Metric | MiniLM-L6-v2 | MPNet-base-v2 | Ratio |
|--------|--------------|---------------|-------|
| Processing Memory | 1.64MB | 12.27MB | 7.5x more |
| Total Memory | 342.93MB | 892.22MB | 2.6x more |
| Model Size | ~23MB | ~110MB | 4.8x larger |

### Quality Analysis
| Aspect | MiniLM-L6-v2 | MPNet-base-v2 |
|--------|--------------|---------------|
| Dimensions | 384 | 768 (2x more) |
| Semantic Richness | Good | Excellent |
| Domain Adaptation | Moderate | Better |
| Fine-tuning Potential | Limited | Higher |

## Use Case Recommendations

### Choose MiniLM-L6-v2 When:
- ✅ **Speed is critical** (real-time applications)
- ✅ **Memory is limited** (< 4GB RAM systems)
- ✅ **Processing large volumes** (batch document ingestion)
- ✅ **General purpose search** (good enough quality)
- ✅ **Resource-constrained environments**
- ✅ **Frequent model loading/unloading**

### Choose MPNet-base-v2 When:
- ✅ **Quality is paramount** (research, analysis)
- ✅ **Complex semantic understanding** needed
- ✅ **Technical/specialized content** (code, scientific papers)
- ✅ **Small to medium datasets** (< 10k documents)
- ✅ **Sufficient system resources** (8GB+ RAM)
- ✅ **Infrequent model loading** (long-running processes)

## Configuration Guidelines

### System Resource Considerations

#### Low-End Systems (< 4GB RAM)
```javascript
// Use MiniLM with conservative settings
{
  embedding_model: "sentence-transformers/all-MiniLM-L6-v2",
  batch_size: 8,
  chunk_size: 200
}
```

#### Mid-Range Systems (4-8GB RAM)
```javascript
// MiniLM with standard settings or MPNet with reduced batch
{
  embedding_model: "sentence-transformers/all-MiniLM-L6-v2", // or MPNet
  batch_size: 16, // or 4 for MPNet
  chunk_size: 250  // or 300 for MPNet
}
```

#### High-End Systems (8GB+ RAM)
```javascript
// Either model with optimal settings
{
  embedding_model: "Xenova/all-mpnet-base-v2",
  batch_size: 8,
  chunk_size: 400
}
```

### Performance Optimization Tips

#### For Speed-Critical Applications
1. Use MiniLM-L6-v2
2. Increase batch_size to 32 (if memory allows)
3. Reduce chunk_size to 200
4. Enable model quantization
5. Pre-load model at startup

#### For Quality-Critical Applications
1. Use MPNet-base-v2
2. Increase chunk_size to 500
3. Use overlap of 100-120
4. Reduce batch_size to 4-6
5. Ensure sufficient memory headroom

## Migration Guide

### Switching Between Models

⚠️ **Important**: Switching models requires rebuilding the vector index as embeddings have different dimensions.

#### From MiniLM to MPNet
```bash
# 1. Update configuration
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"
export RAG_BATCH_SIZE="8"
export RAG_CHUNK_SIZE="400"

# 2. Rebuild index
raglite rebuild
```

#### From MPNet to MiniLM
```bash
# 1. Update configuration
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
export RAG_BATCH_SIZE="16"
export RAG_CHUNK_SIZE="250"

# 2. Rebuild index
raglite rebuild
```

## Technical Implementation Notes

### Model Loading
Both models use the same transformers.js pipeline:
```javascript
const model = await pipeline('feature-extraction', modelName, {
  local_files_only: false,
  revision: 'main',
  quantized: false
});
```

### Embedding Generation
Consistent API across models:
```javascript
const embeddings = await model(texts, {
  pooling: 'mean',
  normalize: true
});
```

### Compatibility Matrix
| Feature | MiniLM-L6-v2 | MPNet-base-v2 |
|---------|--------------|---------------|
| transformers.js | ✅ | ✅ |
| Quantization | ✅ | ✅ |
| Batch Processing | ✅ | ✅ |
| Browser Support | ✅ | ✅ |
| Node.js Support | ✅ | ✅ |

## Future Model Support

### Planned Additions
- **sentence-transformers/all-mpnet-base-v2**: Original HuggingFace version
- **BAAI/bge-small-en-v1.5**: Competitive 384D alternative
- **intfloat/e5-small-v2**: Another quality option

### Evaluation Criteria
1. **Performance**: Speed and memory efficiency
2. **Quality**: Semantic understanding capability
3. **Compatibility**: transformers.js support
4. **Size**: Model download and storage requirements
5. **Community**: Adoption and maintenance status

## Troubleshooting

### Common Issues

#### Model Loading Failures
- Ensure internet connection for first download
- Check available disk space (>500MB free)
- Verify Node.js version compatibility

#### Memory Issues
- Reduce batch_size
- Use smaller chunk_size
- Switch to MiniLM model
- Close other applications

#### Performance Issues
- Check system resources
- Verify model is cached locally
- Consider model quantization
- Optimize batch and chunk sizes

## Conclusion

Both models are production-ready and serve different use cases:

- **MiniLM-L6-v2**: Excellent balance of speed and quality for most applications
- **MPNet-base-v2**: Superior quality for demanding semantic understanding tasks

Choose based on your specific requirements for speed vs. quality, and system resource constraints. The system supports seamless switching between models with a simple rebuild process.

**Last Updated**: Based on validation testing completed during multi-model support implementation
**Test Environment**: Windows 11, Intel i3-1115G4, 8GB RAM, Node.js v20.19.2