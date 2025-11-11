# RAG-lite MCP Server Multimodal Guide

## Overview

The RAG-lite MCP (Model Context Protocol) server provides a comprehensive interface for both text-only and multimodal document retrieval. The server automatically adapts its behavior based on the mode configuration stored during ingestion, implementing the Chameleon Architecture's polymorphic runtime system.

## Key Features

### Dynamic Tool Descriptions (NEW)

The MCP server now **automatically detects and advertises its capabilities** based on the actual database content. When you connect multiple MCP server instances to different databases, each server will describe what it actually contains:

**Text-only database:**
```
[TEXT MODE] Search indexed documents using semantic similarity. 
This database contains 150 text documents. Supports .md and .txt files only.
```

**Multimodal database with images:**
```
[MULTIMODAL MODE] Search indexed documents using semantic similarity. 
This database contains 200 documents. Contains both text and image content. 
Image results include base64-encoded data for display. 
Supports cross-modal search (text queries can find images).
```

**Benefits:**
- **Intelligent routing**: AI assistants can choose the right database based on the query
- **Self-documenting**: Each server advertises its actual capabilities
- **No guesswork**: Clear indication of what content types are available
- **Multi-instance support**: Run multiple servers with different content types seamlessly

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
Standard search with automatic mode detection from database. In multimodal mode, image results automatically include base64-encoded image data for display in MCP clients.

**Parameters:**
- `query` (required): Search query string
- `top_k` (optional): Number of results (1-100, default: 10)
- `rerank` (optional): Enable reranking (default: false)

**Response Format:**
```json
{
  "query": "red car",
  "results_count": 5,
  "search_time_ms": 150,
  "results": [
    {
      "rank": 1,
      "score": 0.85,
      "content_type": "image",
      "document": {
        "id": 1,
        "title": "red-sports-car.jpg",
        "source": "./images/red-sports-car.jpg",
        "content_type": "image"
      },
      "text": "a red sports car parked on the street",
      "image_data": "/9j/4AAQSkZJRg...", // Base64-encoded image data
      "image_format": "base64"
    }
  ]
}
```

**Image Content Retrieval:**
- Image results automatically include `image_data` field with base64-encoded content
- `image_format` field indicates encoding type (always "base64")
- If image retrieval fails, `image_error` field contains error message
- Text results do not include image data fields

#### `multimodal_search`
Enhanced search with content type filtering and multimodal capabilities. Image results automatically include base64-encoded image data for display in MCP clients.

**Parameters:**
- `query` (required): Search query string
- `top_k` (optional): Number of results (1-100, default: 10)
- `rerank` (optional): Enable reranking (default: false)
- `content_type` (optional): Filter by content type (`"text"`, `"image"`, `"pdf"`, `"docx"`)

**Cross-Modal Search Examples:**
- Text query finding images: `"red sports car"` → Returns images of red cars
- Text query with image filter: `"architecture diagram"` + `content_type: "image"` → Only diagram images
- Mixed results: `"installation guide"` → Returns both text docs and instructional images

**Response Format:**
Same as `search` tool, with automatic base64 encoding for image content. See `search` tool documentation for response structure.

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

### Image-Specific Tools

#### `ingest_image`
Specialized tool for ingesting individual images from local files or URLs. Automatically sets mode to multimodal and uses CLIP embeddings.

**Parameters:**
- `source` (required): Image file path or URL
  - Local file: `"./images/diagram.jpg"`
  - Remote URL: `"https://example.com/image.jpg"`
- `model` (optional): CLIP model to use (default: `"Xenova/clip-vit-base-patch32"`)
- `rerank_strategy` (optional): Reranking strategy (default: `"text-derived"`)
- `title` (optional): Custom title for the image
- `metadata` (optional): Additional metadata object

**Supported Image Formats:**
- JPEG/JPG
- PNG
- GIF
- WebP

**Example - Local File:**
```json
{
  "name": "ingest_image",
  "arguments": {
    "source": "./docs/images/architecture.png",
    "title": "System Architecture Diagram",
    "metadata": {
      "category": "architecture",
      "tags": ["microservices", "cloud", "diagram"]
    }
  }
}
```

**Example - Remote URL:**
```json
{
  "name": "ingest_image",
  "arguments": {
    "source": "https://example.com/product-photo.jpg",
    "model": "Xenova/clip-vit-base-patch16",
    "metadata": {
      "product_id": "12345",
      "category": "electronics"
    }
  }
}
```

**Response:**
```json
{
  "source": "./docs/images/architecture.png",
  "source_type": "file",
  "mode": "multimodal",
  "model": "Xenova/clip-vit-base-patch32",
  "reranking_strategy": "text-derived",
  "documents_processed": 1,
  "chunks_created": 1,
  "embeddings_generated": 1,
  "content_type": "image",
  "success": true
}
```

**Use Cases:**
- Adding individual images to existing collections
- Ingesting images from web URLs
- Building image-only search indexes
- Programmatic image ingestion workflows

### Utility Tools

#### `get_stats`
Get basic statistics about the search index.

#### `rebuild_index`
Rebuild the entire vector index from scratch.

## Image Content Retrieval

### Automatic Base64 Encoding

The MCP server automatically encodes image content as base64 for display in MCP clients. This feature works seamlessly with both `search` and `multimodal_search` tools.

**How It Works:**
1. Search returns results with `contentId` for image content
2. MCP server automatically retrieves image data using `contentId`
3. Image is encoded as base64 and included in response
4. MCP clients can directly display the image data

**Example Response with Image Data:**
```json
{
  "rank": 1,
  "score": 0.92,
  "content_type": "image",
  "document": {
    "id": 5,
    "title": "architecture-diagram.png",
    "source": "./docs/images/architecture-diagram.png",
    "content_type": "image",
    "contentId": "a1b2c3d4e5f6..."
  },
  "text": "system architecture diagram showing microservices",
  "image_data": "iVBORw0KGgoAAAANSUhEUgAA...",
  "image_format": "base64",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "png",
    "size": 245760
  }
}
```

**Error Handling:**
If image retrieval fails, the response includes an error field instead:
```json
{
  "rank": 1,
  "score": 0.92,
  "content_type": "image",
  "document": { ... },
  "text": "system architecture diagram",
  "image_error": "Content file not found: ./docs/images/missing.png"
}
```

### Cross-Modal Search Capabilities

Multimodal mode enables true cross-modal search where text queries can find images and vice versa.

**Text Query → Image Results:**
```javascript
// Find images using text descriptions
const results = await client.callTool('multimodal_search', {
  query: 'red sports car on highway',
  content_type: 'image',
  top_k: 10
});

// Results include images with base64 data
results.forEach(result => {
  console.log(`Found: ${result.document.title}`);
  console.log(`Description: ${result.text}`);
  console.log(`Image data: ${result.image_data.substring(0, 50)}...`);
  // Display image using result.image_data
});
```

**Mixed Content Results:**
```javascript
// Search returns both text and images ranked by relevance
const results = await client.callTool('search', {
  query: 'installation instructions',
  top_k: 20,
  rerank: true
});

// Process different content types
results.forEach(result => {
  if (result.content_type === 'image') {
    // Display image with base64 data
    displayImage(result.image_data, result.document.title);
  } else {
    // Display text content
    displayText(result.text, result.document.title);
  }
});
```

**Content Type Filtering:**
```javascript
// Get only images related to query
const imageResults = await client.callTool('multimodal_search', {
  query: 'system architecture',
  content_type: 'image'
});

// Get only text documents
const textResults = await client.callTool('multimodal_search', {
  query: 'system architecture',
  content_type: 'text'
});

// Get all content types (default)
const allResults = await client.callTool('multimodal_search', {
  query: 'system architecture'
});
```

### Performance Considerations

**Base64 Encoding:**
- Small images (&lt;1MB): Instant encoding
- Medium images (1-10MB): Optimized streaming encoding
- Large images (&gt;10MB): Streaming with progress tracking
- Timeout: 30 seconds for standard files, 5 minutes for large files

**Memory Management:**
- Safe buffer handling prevents memory leaks
- Automatic cleanup after encoding
- Batch operations supported for multiple images

**Optimization Tips:**
1. Use `content_type` filter to reduce unnecessary image encoding
2. Limit `top_k` when expecting many image results
3. Consider image file sizes when designing content structure
4. Monitor memory usage with large image collections

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

### Complete Cross-Modal Search Example

This example demonstrates the full workflow of multimodal ingestion and cross-modal search with image retrieval:

```javascript
// Step 1: Ingest mixed content (text + images)
console.log('Ingesting multimodal content...');
await client.callTool('ingest', {
  path: './product-catalog',
  mode: 'multimodal',
  model: 'Xenova/clip-vit-base-patch32',
  rerank_strategy: 'text-derived'
});

// Step 2: Ingest additional images from URLs
console.log('Adding product images from URLs...');
await client.callTool('ingest_image', {
  source: 'https://example.com/products/laptop.jpg',
  metadata: {
    product: 'laptop',
    category: 'electronics',
    price: 999
  }
});

// Step 3: Verify multimodal mode is active
const modeInfo = await client.callTool('get_mode_info', {});
console.log(`Mode: ${modeInfo.current_mode}`); // "multimodal"
console.log(`Model: ${modeInfo.model_name}`); // "Xenova/clip-vit-base-patch32"
console.log(`Content types: ${modeInfo.supported_content_types.join(', ')}`); // "text, image"

// Step 4: Cross-modal search - Text query finding images
console.log('\n=== Text Query → Image Results ===');
const imageResults = await client.callTool('multimodal_search', {
  query: 'silver laptop with backlit keyboard',
  content_type: 'image',
  top_k: 5,
  rerank: true
});

console.log(`Found ${imageResults.results_count} images`);
imageResults.results.forEach(result => {
  console.log(`\n${result.rank}. ${result.document.title} (score: ${result.score})`);
  console.log(`   Description: ${result.text}`);
  console.log(`   Image data: ${result.image_data ? 'Available' : 'Not available'}`);
  
  if (result.image_data) {
    // Display image in MCP client
    displayBase64Image(result.image_data, result.document.title);
  }
  
  if (result.metadata) {
    console.log(`   Metadata:`, result.metadata);
  }
});

// Step 5: Mixed content search - Both text and images
console.log('\n=== Mixed Content Search ===');
const mixedResults = await client.callTool('search', {
  query: 'laptop specifications and photos',
  top_k: 10,
  rerank: true
});

console.log(`Found ${mixedResults.results_count} results (mixed content)`);
mixedResults.results.forEach(result => {
  const contentIcon = result.content_type === 'image' ? '🖼️' : '📄';
  console.log(`\n${contentIcon} ${result.rank}. ${result.document.title}`);
  console.log(`   Type: ${result.content_type}`);
  console.log(`   Score: ${result.score}`);
  
  if (result.content_type === 'image' && result.image_data) {
    console.log(`   Image: ${result.image_data.length} bytes (base64)`);
    displayBase64Image(result.image_data, result.document.title);
  } else {
    console.log(`   Text: ${result.text.substring(0, 100)}...`);
  }
});

// Step 6: Content type filtering
console.log('\n=== Content Type Filtering ===');

// Only text documents
const textOnly = await client.callTool('multimodal_search', {
  query: 'laptop',
  content_type: 'text',
  top_k: 5
});
console.log(`Text documents: ${textOnly.results_count}`);

// Only images
const imagesOnly = await client.callTool('multimodal_search', {
  query: 'laptop',
  content_type: 'image',
  top_k: 5
});
console.log(`Images: ${imagesOnly.results_count}`);

// Step 7: Get system statistics
const stats = await client.callTool('get_system_stats', {
  include_content_breakdown: true
});

console.log('\n=== Content Statistics ===');
console.log(`Total documents: ${stats.total_documents}`);
console.log(`Total chunks: ${stats.total_chunks}`);
console.log('Content breakdown:', stats.content_breakdown);

// Helper function to display base64 images
function displayBase64Image(base64Data, title) {
  // In a real MCP client, this would render the image
  // For example, in a web-based client:
  // const img = document.createElement('img');
  // img.src = `data:image/jpeg;base64,${base64Data}`;
  // img.alt = title;
  // container.appendChild(img);
  
  console.log(`   [Image would be displayed here: ${title}]`);
}
```

**Expected Output:**
```
Ingesting multimodal content...
✓ Ingested 50 documents (30 text, 20 images)

Adding product images from URLs...
✓ Image ingested successfully

Mode: multimodal
Model: Xenova/clip-vit-base-patch32
Content types: text, image

=== Text Query → Image Results ===
Found 5 images

1. laptop-silver-backlit.jpg (score: 0.89)
   Description: silver laptop with illuminated keyboard on desk
   Image data: Available
   Metadata: { product: 'laptop', category: 'electronics' }

2. macbook-pro-keyboard.jpg (score: 0.85)
   Description: close-up of laptop keyboard with backlight
   Image data: Available

=== Mixed Content Search ===
Found 10 results (mixed content)

📄 1. laptop-specs.md
   Type: text
   Score: 0.92
   Text: Technical specifications for our laptop lineup including processor, RAM, storage...

🖼️ 2. laptop-front-view.jpg
   Type: image
   Score: 0.88
   Image: 15234 bytes (base64)

=== Content Type Filtering ===
Text documents: 5
Images: 5

=== Content Statistics ===
Total documents: 51
Total chunks: 75
Content breakdown: { text: 30, image: 21 }
```

## Running Multiple MCP Server Instances

### Overview

You can run multiple MCP server instances simultaneously, each connected to a different database. This is useful for:
- Separating text-only and multimodal content
- Managing different projects or knowledge bases
- Isolating different content domains (docs, code, images, etc.)

### Configuration Example

Configure multiple servers in your MCP client (e.g., Claude Desktop, Cline):

```json
{
  "mcpServers": {
    "rag-lite-text-docs": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./text-docs/db.sqlite",
        "RAG_INDEX_FILE": "./text-docs/index.bin"
      }
    },
    "rag-lite-multimodal-images": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./mixed-content/db.sqlite",
        "RAG_INDEX_FILE": "./mixed-content/index.bin"
      }
    },
    "rag-lite-project-a": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./projects/project-a/db.sqlite",
        "RAG_INDEX_FILE": "./projects/project-a/index.bin"
      }
    }
  }
}
```

### How It Works

**Each server instance:**
- Runs independently with its own database and index
- Detects its mode (text/multimodal) from the database
- Advertises its capabilities through dynamic tool descriptions
- Maintains its own configuration and state

**The MCP client sees:**
```
Available tools:

rag-lite-text-docs::search
  [TEXT MODE] Search indexed documents using semantic similarity. 
  This database contains 150 text documents. Supports .md and .txt files only.

rag-lite-multimodal-images::search
  [MULTIMODAL MODE] Search indexed documents using semantic similarity. 
  This database contains 200 documents. Contains both text and image content. 
  Image results include base64-encoded data for display. 
  Supports cross-modal search (text queries can find images).

rag-lite-project-a::search
  [TEXT MODE] Search indexed documents using semantic similarity. 
  This database contains 75 text documents. Supports .md and .txt files only.
```

### Intelligent Routing

With dynamic tool descriptions, AI assistants can intelligently choose which server to query:

**User query:** "Find images of architecture diagrams"
- AI sees `[MULTIMODAL MODE]` in `rag-lite-multimodal-images::search` description
- AI sees "Contains both text and image content"
- AI automatically calls `rag-lite-multimodal-images::search`

**User query:** "Search the API documentation"
- AI sees `[TEXT MODE]` in `rag-lite-text-docs::search` description
- AI sees "150 text documents"
- AI automatically calls `rag-lite-text-docs::search`

### Best Practices

1. **Use descriptive server names** that indicate the content type or domain
2. **Separate by content type** - text-only vs multimodal databases
3. **Separate by domain** - docs, code, images, projects, etc.
4. **Monitor resource usage** - each server instance uses memory
5. **Use consistent paths** - organize databases in a clear directory structure

### Example: Multi-Project Setup

```json
{
  "mcpServers": {
    "docs-text": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./knowledge/docs/db.sqlite",
        "RAG_INDEX_FILE": "./knowledge/docs/index.bin"
      }
    },
    "images-multimodal": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./knowledge/images/db.sqlite",
        "RAG_INDEX_FILE": "./knowledge/images/index.bin"
      }
    },
    "code-examples": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./knowledge/code/db.sqlite",
        "RAG_INDEX_FILE": "./knowledge/code/index.bin"
      }
    }
  }
}
```

### Limitations

- **No automatic federation**: Each query goes to one server at a time
- **No cross-database search**: Results are not automatically merged across servers
- **Manual orchestration**: AI assistant handles routing, not the MCP servers
- **Resource usage**: Each server instance uses memory and CPU

### Advanced: Cross-Database Search

If you need to search across multiple databases, you can:

1. **Sequential queries**: Call multiple servers and combine results in your code
2. **Custom orchestration**: Build a wrapper that queries all servers and merges results
3. **Unified database**: Ingest all content into a single multimodal database

Example of sequential queries:
```javascript
// Query all servers
const textResults = await client.callTool('rag-lite-text-docs', 'search', {
  query: 'authentication'
});

const imageResults = await client.callTool('rag-lite-multimodal-images', 'search', {
  query: 'authentication'
});

// Combine and present results
console.log('Text results:', textResults.results_count);
console.log('Image results:', imageResults.results_count);
```

## Troubleshooting

### Performance Issues
- Use smaller models for faster processing
- Disable reranking for maximum speed
- Reduce batch sizes for memory-constrained environments
- Limit `top_k` when expecting many image results to reduce base64 encoding overhead

### Accuracy Issues
- Enable reranking for better results
- Use larger, more accurate models
- Try hybrid reranking strategy for multimodal content
- Ensure images are clear and relevant for better text-derived reranking

### Memory Issues
- Switch to smaller models (MiniLM vs. MPNet, patch32 vs. patch16)
- Reduce batch sizes in model configuration
- Monitor memory usage with system stats
- Be mindful of large image files (>10MB) which use streaming encoding

### Content Issues
- Verify file types are supported for the selected mode
- Check image formats for multimodal mode (jpg, png, gif, webp)
- Ensure text encoding is UTF-8 for text content
- Validate image URLs are accessible when using `ingest_image` with remote sources

### Image Retrieval Issues

**Problem:** Image results missing `image_data` field
- **Cause:** Content file may have been moved or deleted
- **Solution:** Check `image_error` field for details, re-ingest if needed

**Problem:** Base64 encoding timeout
- **Cause:** Very large image files (>50MB)
- **Solution:** Resize images before ingestion, or increase timeout settings

**Problem:** Image quality issues in MCP client
- **Cause:** Base64 encoding/decoding issues
- **Solution:** Verify base64 data integrity, check MCP client image rendering

**Problem:** Cross-modal search not finding relevant images
- **Cause:** CLIP model limitations or poor image quality
- **Solution:** 
  - Use more descriptive text queries
  - Try different CLIP models (patch16 for higher accuracy)
  - Enable reranking with text-derived strategy
  - Ensure images are clear and well-lit

### Mode Detection Issues

**Problem:** Search using wrong mode after ingestion
- **Cause:** Database mode configuration not updated
- **Solution:** Use `get_mode_info` to verify mode, re-ingest with correct mode if needed

**Problem:** Cannot switch between modes
- **Cause:** Mode is stored in database and persists
- **Solution:** Use `force_rebuild: true` when ingesting with new mode to rebuild index

For additional support and advanced configuration options, refer to the main RAG-lite documentation and the Chameleon Architecture specification.