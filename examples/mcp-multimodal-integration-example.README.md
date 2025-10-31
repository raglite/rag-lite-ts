# RAG-lite MCP Multimodal Integration Example

This example demonstrates comprehensive integration between RAG-lite's Chameleon Architecture and MCP (Model Context Protocol) for tool-based multimodal document retrieval.

## Overview

The example showcases:

- **Text Mode Workflow**: Traditional document processing with sentence transformers
- **Multimodal Mode Workflow**: Mixed text and image processing with CLIP models  
- **System Management**: Configuration, monitoring, and statistics via MCP tools
- **Error Handling**: Recovery strategies and troubleshooting via MCP interface
- **Chameleon Architecture**: Automatic mode detection and polymorphic runtime behavior

## Prerequisites

1. **Node.js 18+**: Required for MCP client and RAG-lite
2. **RAG-lite MCP Server**: Must be running and accessible
3. **Sample Content**: Text documents and images for testing

## Setup

```bash
# Install dependencies
npm install

# Ensure RAG-lite MCP server is running
# (Adjust server path in the example code as needed)

# Create sample content directories
mkdir -p docs mixed-content sample-images

# Add some sample files for testing
echo "# Sample Documentation" > docs/sample.md
echo "This is sample content for testing." >> docs/sample.md
```

## Running the Example

```bash
# Run the complete integration example
npm start

# Or run directly
node mcp-multimodal-integration-example.js

# Clean up generated files
npm run clean
```

## Example Workflows

### 1. Text Mode Workflow

```javascript
// Check available text models
const textModels = await client.callTool('list_supported_models', {
  content_type: 'text'
});

// Ingest text content
await client.callTool('ingest', {
  path: './docs',
  mode: 'text',
  model: 'sentence-transformers/all-MiniLM-L6-v2'
});

// Search with automatic mode detection
const results = await client.callTool('search', {
  query: 'documentation',
  top_k: 5,
  rerank: true
});
```

### 2. Multimodal Mode Workflow

```javascript
// Check available multimodal models
const multimodalModels = await client.callTool('list_supported_models', {
  content_type: 'image'
});

// Ingest mixed content
await client.callTool('ingest', {
  path: './mixed-content',
  mode: 'multimodal',
  model: 'Xenova/clip-vit-base-patch32',
  rerank_strategy: 'text-derived'
});

// Search with content type filtering
const imageResults = await client.callTool('multimodal_search', {
  query: 'architecture diagram',
  content_type: 'image',
  rerank: true
});
```

### 3. System Management

```javascript
// Get comprehensive system statistics
const stats = await client.callTool('get_system_stats', {
  include_performance: true,
  include_content_breakdown: true
});

// Check current mode and configuration
const modeInfo = await client.callTool('get_mode_info', {});

// List all reranking strategies
const strategies = await client.callTool('list_reranking_strategies', {});
```

## Key Features Demonstrated

### Chameleon Architecture Benefits

- **Mode Persistence**: Configuration stored during ingestion, auto-detected during search
- **Polymorphic Runtime**: Same API interface adapts behavior based on stored mode
- **Seamless Switching**: No manual mode specification required for search operations
- **Content-Type Awareness**: Automatic handling of text, images, and mixed content

### MCP Integration Advantages

- **Tool-Based Interface**: Structured interaction with RAG-lite capabilities
- **Comprehensive Monitoring**: System statistics, performance metrics, content breakdown
- **Error Recovery**: Structured error handling with actionable recovery suggestions
- **Configuration Management**: Model selection, strategy comparison, capability discovery

### Multimodal Processing Features

- **Unified Embedding Space**: CLIP models handle both text and images
- **Image-to-Text Conversion**: Automatic description generation for reranking
- **Metadata Extraction**: Image dimensions, format, file size automatically captured
- **Content-Type Filtering**: Search specific content types or across all types

## Error Handling Examples

The example demonstrates robust error handling for common scenarios:

### Model Validation Errors
```javascript
try {
  await client.callTool('ingest', {
    path: './docs',
    model: 'unsupported-model'
  });
} catch (error) {
  // Get supported alternatives
  const models = await client.callTool('list_supported_models', {
    content_type: 'text'
  });
}
```

### Dimension Mismatch Recovery
```javascript
try {
  const results = await client.callTool('search', { query: 'test' });
} catch (error) {
  if (error.code === 'DIMENSION_MISMATCH') {
    // Rebuild index with correct model
    await client.callTool('rebuild_index', {});
  }
}
```

## Performance Considerations

### Model Selection Guidelines

- **Fast Processing**: Use `sentence-transformers/all-MiniLM-L6-v2` for text, `Xenova/clip-vit-base-patch32` for multimodal
- **High Accuracy**: Use `Xenova/all-mpnet-base-v2` for text, `Xenova/clip-vit-base-patch16` for multimodal
- **Memory Constraints**: Prefer smaller models and disable reranking for maximum performance

### Reranking Strategy Impact

- **cross-encoder**: High accuracy, high computational cost (text mode)
- **text-derived**: High accuracy, high computational cost (multimodal mode)
- **metadata**: Low computational cost, medium accuracy (multimodal mode)
- **disabled**: Minimal computational cost, baseline accuracy (all modes)

## Troubleshooting

### Common Issues

1. **MCP Server Connection**: Ensure the RAG-lite MCP server is running and accessible
2. **Model Loading**: Check transformers.js compatibility and available memory
3. **File Permissions**: Ensure read access to content directories and write access for database files
4. **Memory Usage**: Monitor system resources, especially with larger models

### Debug Information

The example provides comprehensive logging:
- MCP tool call results and errors
- System configuration and mode detection
- Performance metrics and resource usage
- Content processing statistics

## Next Steps

- Integrate with your own MCP client applications
- Experiment with different model and reranking combinations
- Test with your own content collections
- Explore advanced configuration options
- Monitor performance characteristics for your use case

## Related Documentation

- [RAG-lite MCP Server Multimodal Guide](../docs/mcp-server-multimodal-guide.md)
- [Chameleon Architecture Documentation](../CHAMELEON_ARCHITECTURE.md)
- [API Reference](../docs/api-reference.md)
- [Configuration Guide](../docs/configuration.md)