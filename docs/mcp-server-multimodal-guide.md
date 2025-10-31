# RAG-lite MCP Server Multimodal Guide

## Overview

The RAG-lite MCP (Model Context Protocol) server provides a comprehensive interface for both text-only and multimodal document retrieval. The server automatically adapts its behavior based on the mode configuration stored during ingestion, implementing the Chameleon Architecture's polymorphic runtime system.

## Quick Start

### Basic Text Mode Usage

```json
{
  "name": "ingest",
  "arguments": {
    "path": "./documents",
    "mode": "text"
  }
}
```

**What happens:**
- Mode configuration stored in database as "text"
- Documents processed with sentence transformer model
- Cross-encoder reranking enabled by default
- Subsequent searches automatically detect text mode

### Multimodal Mode Usage

```json
{
  "name": "ingest",
  "arguments": {
    "path": "./mixed-content",
    "mode": "multimodal",
    "model": "Xenova/clip-vit-base-patch32",
    "rerank_strategy": "text-derived"
  }
}
```

**What happens:**
- Mode configuration stored in database as "multimodal"
- Text and images processed with CLIP model
- Images converted to text descriptions for reranking
- Image metadata extracted (dimensions, format, file size)
- Subsequent searches automatically detect multimodal mode

### Automatic Mode Detection

```json
{
  "name": "search",
  "arguments": {
    "query": "API documentation"
  }
}
```

**Chameleon Architecture behavior:**
- Mode automatically detected from database configuration
- Appropriate model and reranking strategy loaded
- Same search interface works across all modes
- No manual mode specification required

## Available Tools

### Core Operations

#### `ingest`
Ingest documents with automatic mode configuration and model selection.

**Parameters:**
- `path` (required): File or directory path to ingest
- `mode` (optional): `"text"` or `"multimodal"` (default: `"text"`)
- `model` (optional): Embedding model to use
- `rerank_strategy` (optional): Reranking strategy for multimodal mode
- `force_rebuild` (optional): Force rebuild of entire index

**Supported Models:**
- Text mode: 
  - `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, fast)
  - `Xenova/all-mpnet-base-v2` (768 dimensions, accurate)
- Multimodal mode: 
  - `Xenova/clip-vit-base-patch32` (512 dimensions, balanced)
  - `Xenova/clip-vit-base-patch16` (512 dimensions, high accuracy)

**Supported File Types:**
- Text mode: `.md`, `.txt`
- Multimodal mode: `.md`, `.txt`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

**Processing Features:**
- **Text Mode**: Optimized text chunking, sentence-level embeddings, cross-encoder reranking
- **Multimodal Mode**: Image-to-text conversion, metadata extraction, unified embedding space, content-type aware reranking

#### `search`
Standard search with automatic mode detection from database.

**Parameters:**
- `query` (required): Search query string
- `top_k` (optional): Number of results (1-100, default: 10)
- `rerank` (optional): Enable reranking (default: false)

#### `multimodal_search`
Enhanced search with content type filtering and multimodal capabilities.

**Parameters:**
- `query` (required): Search query string
- `top_k` (optional): Number of results (1-100, default: 10)
- `rerank` (optional): Enable reranking (default: false)
- `content_type` (optional): Filter by content type (`"text"`, `"image"`, `"pdf"`, `"docx"`)

### Information and Configuration Tools

#### `get_mode_info`
Get current system mode and configuration information.

**Returns:**
- Current mode (text/multimodal)
- Model information and capabilities
- Reranking strategy configuration
- Supported content types and file formats

#### `list_supported_models`
List all supported embedding models with detailed capabilities.

**Parameters:**
- `model_type` (optional): Filter by type (`"sentence-transformer"`, `"clip"`)
- `content_type` (optional): Filter by supported content (`"text"`, `"image"`)

**Returns:**
- Model specifications and requirements
- Memory requirements and performance characteristics
- Supported content types and capabilities
- Usage recommendations

#### `list_reranking_strategies`
List all supported reranking strategies for different modes.

**Parameters:**
- `mode` (optional): Filter by mode (`"text"`, `"multimodal"`)

**Returns:**
- Strategy descriptions and requirements
- Performance impact and accuracy ratings
- Supported content types
- Use case recommendations

#### `get_system_stats`
Get comprehensive system statistics with mode-specific metrics.

**Parameters:**
- `include_performance` (optional): Include performance metrics
- `include_content_breakdown` (optional): Include content type breakdown

**Returns:**
- Database and index status
- Mode-specific configuration
- Content statistics by type
- Performance metrics (if requested)

### Utility Tools

#### `get_stats`
Get basic statistics about the search index.

#### `rebuild_index`
Rebuild the entire vector index from scratch.

## Mode Configuration

### Text Mode
Optimized for text-only content with high performance and accuracy.

**Default Configuration:**
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Reranking: Cross-encoder
- Content types: Text documents only
- File types: `.md`, `.txt`

**Use Cases:**
- Documentation repositories
- Academic papers and articles
- Code documentation
- Text-heavy content collections

### Multimodal Mode
Supports mixed text and image content with advanced reranking strategies.

**Default Configuration:**
- Model: `Xenova/clip-vit-base-patch32`
- Reranking: Text-derived (image-to-text + cross-encoder)
- Content types: Text and images
- File types: `.md`, `.txt`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

**Use Cases:**
- Technical documentation with diagrams
- Visual content collections
- Mixed media repositories
- Educational materials with images

## Reranking Strategies

### Text Mode Strategies

#### `cross-encoder`
- **Description**: Uses cross-encoder models for semantic relevance scoring
- **Performance**: High computational cost, high accuracy
- **Best for**: Text documents, academic content, technical documentation

#### `disabled`
- **Description**: No reranking, results ordered by vector similarity only
- **Performance**: Minimal computational cost, baseline accuracy
- **Best for**: Fast retrieval, development, simple similarity search

### Multimodal Mode Strategies

#### `text-derived` (Default)
- **Description**: Converts images to text descriptions, then applies cross-encoder reranking
- **Requirements**: Image-to-text model + cross-encoder model
- **Performance**: High computational cost, high accuracy
- **Best for**: Mixed content with meaningful images, visual documentation

#### `metadata`
- **Description**: Uses file metadata and filename patterns for scoring
- **Requirements**: None (file system metadata only)
- **Performance**: Low computational cost, medium accuracy
- **Best for**: Fast retrieval, filename-based search, content filtering

#### `hybrid`
- **Description**: Combines semantic and metadata signals with configurable weights
- **Requirements**: Text-derived reranker + metadata reranker
- **Performance**: High computational cost, very high accuracy
- **Best for**: Production systems, complex collections, maximum accuracy

#### `disabled`
- **Description**: No reranking, results ordered by vector similarity only
- **Performance**: Minimal computational cost, baseline accuracy
- **Best for**: Maximum performance, simple similarity search

## Model Selection Guide

### Performance vs. Accuracy Trade-offs

#### High Performance (Low Memory)
- **Text**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, ~256MB)
- **Multimodal**: `Xenova/clip-vit-base-patch32` (512 dimensions, ~1GB)

#### High Accuracy (Higher Memory)
- **Text**: `Xenova/all-mpnet-base-v2` (768 dimensions, ~512MB)
- **Multimodal**: `Xenova/clip-vit-base-patch16` (512 dimensions, ~1.5GB)

### Content Type Compatibility

| Model | Text | Images | Batch Size | Memory |
|-------|------|--------|------------|---------|
| `sentence-transformers/all-MiniLM-L6-v2` | ✅ | ❌ | 32 | 256MB |
| `Xenova/all-mpnet-base-v2` | ✅ | ❌ | 16 | 512MB |
| `Xenova/clip-vit-base-patch32` | ✅ | ✅ | 8 | 1GB |
| `Xenova/clip-vit-base-patch16` | ✅ | ✅ | 4 | 1.5GB |

## Error Handling

### Common Error Scenarios

#### Model Mismatch
When the configured model doesn't match the indexed data:
```json
{
  "error": "MODEL_MISMATCH",
  "message": "Cannot perform search due to model mismatch",
  "resolution": {
    "action": "manual_intervention_required",
    "options": [
      "Check if the model mismatch is intentional",
      "Run rebuild_index tool to rebuild with new model",
      "Verify model configuration matches indexing setup"
    ]
  }
}
```

#### Dimension Mismatch
When vector dimensions don't match between model and index:
```json
{
  "error": "DIMENSION_MISMATCH",
  "message": "Cannot perform search due to vector dimension mismatch",
  "resolution": {
    "action": "manual_intervention_required",
    "options": [
      "Check your model configuration",
      "Run rebuild_index tool if changing models",
      "Ensure consistency between indexing and search models"
    ]
  }
}
```

### Recovery Strategies

1. **Model Compatibility Issues**: Use `rebuild_index` tool to regenerate embeddings
2. **Mode Detection Failures**: Check database integrity and reinitialize if needed
3. **Reranking Failures**: System automatically falls back to vector similarity
4. **Memory Issues**: Switch to smaller models or increase available memory

## Best Practices

### Development Workflow

1. **Start Simple**: Begin with text mode and basic models
2. **Test Incrementally**: Add multimodal capabilities gradually
3. **Monitor Performance**: Use `get_system_stats` to track resource usage
4. **Validate Configuration**: Use `get_mode_info` to verify setup

### Production Deployment

1. **Choose Appropriate Mode**: Text for documents, multimodal for mixed content
2. **Select Models Carefully**: Balance performance vs. accuracy needs
3. **Configure Reranking**: Enable for better accuracy, disable for speed
4. **Monitor Resources**: Track memory usage and processing times

### Content Organization

1. **Consistent File Types**: Keep similar content types together
2. **Meaningful Filenames**: Use descriptive names for metadata-based reranking
3. **Image Quality**: Use clear, relevant images for better text-derived reranking
4. **Regular Maintenance**: Rebuild index when changing models or strategies

## Integration Examples

### Basic MCP Client Usage

```javascript
// Initialize MCP client
const client = new MCPClient();

// Ingest multimodal content with automatic configuration storage
await client.callTool('ingest', {
  path: './docs',
  mode: 'multimodal',
  model: 'Xenova/clip-vit-base-patch32',
  rerank_strategy: 'text-derived'
});

// Search with automatic mode detection
const results = await client.callTool('search', {
  query: 'architecture diagram'
});
// Mode automatically detected from database - no manual specification needed

// Search with content type filtering
const imageResults = await client.callTool('multimodal_search', {
  query: 'system architecture',
  content_type: 'image',
  rerank: true
});

// Get system information and verify Chameleon Architecture behavior
const modeInfo = await client.callTool('get_mode_info', {});
console.log(`Current mode: ${modeInfo.mode}`); // "multimodal"
console.log(`Auto-detected model: ${modeInfo.model_name}`); // "Xenova/clip-vit-base-patch32"
```

### Chameleon Architecture Demonstration

```javascript
// Step 1: Set up text mode
await client.callTool('ingest', {
  path: './text-docs',
  mode: 'text',
  model: 'sentence-transformers/all-MiniLM-L6-v2'
});

// Step 2: Search automatically uses text mode
const textResults = await client.callTool('search', {
  query: 'installation guide'
});
// Uses sentence transformer + cross-encoder reranking

// Step 3: Switch to multimodal mode
await client.callTool('ingest', {
  path: './mixed-content',
  mode: 'multimodal',
  model: 'Xenova/clip-vit-base-patch32',
  rerank_strategy: 'text-derived'
});

// Step 4: Same search interface, different behavior
const multimodalResults = await client.callTool('search', {
  query: 'installation guide'
});
// Now uses CLIP + text-derived reranking, can find images too
```

### Configuration Management

```javascript
// Check all supported models with detailed specifications
const models = await client.callTool('list_supported_models', {});
models.forEach(model => {
  console.log(`${model.name}: ${model.dimensions}D, ${model.supported_content_types.join('+')}`);
});

// Compare reranking strategies for multimodal mode
const strategies = await client.callTool('list_reranking_strategies', {
  mode: 'multimodal'
});
strategies.forEach(strategy => {
  console.log(`${strategy.name}: ${strategy.description} (${strategy.performance_impact})`);
});

// Monitor system performance and content breakdown
const stats = await client.callTool('get_system_stats', {
  include_performance: true,
  include_content_breakdown: true
});
console.log(`Content breakdown:`, stats.content_breakdown);
console.log(`Performance metrics:`, stats.performance_metrics);
```

### Error Handling and Recovery

```javascript
try {
  // Attempt operation that might fail
  await client.callTool('ingest', {
    path: './docs',
    model: 'unsupported-model'
  });
} catch (error) {
  if (error.code === 'MODEL_VALIDATION_ERROR') {
    // Get supported alternatives
    const models = await client.callTool('list_supported_models', {
      content_type: 'text'
    });
    console.log('Supported models:', models.map(m => m.name));
  }
}

// Handle model mismatch scenarios
try {
  const results = await client.callTool('search', { query: 'test' });
} catch (error) {
  if (error.code === 'DIMENSION_MISMATCH') {
    // Rebuild index with correct model
    await client.callTool('rebuild_index', {});
    // Retry search
    const results = await client.callTool('search', { query: 'test' });
  }
}
```

## Troubleshooting

### Performance Issues
- Use smaller models for faster processing
- Disable reranking for maximum speed
- Reduce batch sizes for memory-constrained environments

### Accuracy Issues
- Enable reranking for better results
- Use larger, more accurate models
- Try hybrid reranking strategy for multimodal content

### Memory Issues
- Switch to smaller models (MiniLM vs. MPNet, patch32 vs. patch16)
- Reduce batch sizes in model configuration
- Monitor memory usage with system stats

### Content Issues
- Verify file types are supported for the selected mode
- Check image formats for multimodal mode
- Ensure text encoding is UTF-8 for text content

For additional support and advanced configuration options, refer to the main RAG-lite documentation and the Chameleon Architecture specification.