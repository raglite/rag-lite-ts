# Image-Based Search in CLI

## Overview

The CLI now supports image-based search queries in multimodal mode, enabling true image-to-image and image-to-text search capabilities. Users can provide an image file path as the search query, and the system will find semantically similar content.

## Features

### 1. Automatic Image Detection
- CLI automatically detects if the query is an image file path
- Supports common image formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`
- Falls back to text search for non-image queries

### 2. Mode Validation
- Validates that the database is in multimodal mode before attempting image search
- Provides clear error messages if image search is attempted in text-only mode
- Suggests re-ingestion with multimodal mode if needed

### 3. Cross-Modal Search
- Image queries can find both similar images and related text
- Leverages CLIP's unified embedding space for semantic similarity
- Works seamlessly with existing search options (`--top-k`, `--rerank`, `--content-type`)

## Usage

### Basic Image Search
```bash
# Search with an image file
raglite search ./photo.jpg

# Find top 5 similar items
raglite search ./image.png --top-k 5

# Search for similar images only
raglite search ./photo.jpg --content-type image

# Search for related text content
raglite search ./diagram.png --content-type text
```

### Prerequisites
1. Database must be ingested in multimodal mode:
   ```bash
   raglite ingest ./docs/ --mode multimodal
   ```

2. Image file must exist and be in a supported format

### Error Handling

#### Image Search in Text Mode
```bash
$ raglite search ./photo.jpg

Error: Image search is only supported in multimodal mode

Your database is configured for text-only mode.
To enable image search:
1. Re-ingest your documents with multimodal mode:
   raglite ingest <path> --mode multimodal
2. Then search with images:
   raglite search ./photo.jpg
```

#### Invalid Image File
```bash
$ raglite search ./nonexistent.jpg

Error: Search query cannot be empty

Usage: raglite search <query>
       raglite search <image-path>
```

## Implementation Details

### Architecture

The implementation follows the two-tier architecture pattern:

**Public API (CLI)**:
- Simple, intuitive interface: `raglite search <image-path>`
- Automatic image detection and validation
- Clear error messages with actionable guidance

**Internal Implementation**:
- Uses `SearchEngine.searchWithVector()` for direct vector search
- Creates embedder on-demand for image embedding
- Validates mode compatibility before processing

### Key Components

1. **Image Detection** (`src/cli/search.ts`):
   ```typescript
   function isImageFile(query: string): boolean {
     // Check file existence and extension
   }
   ```

2. **Vector-Based Search** (`src/core/search.ts`):
   ```typescript
   async searchWithVector(
     queryVector: Float32Array,
     options?: SearchOptions,
     originalQuery?: string
   ): Promise<SearchResult[]>
   ```

3. **Mode Validation**:
   - Checks system mode from database
   - Validates embedder supports images
   - Provides clear error messages

### Search Pipeline

For image queries:
1. **Detect** image file path
2. **Validate** multimodal mode is enabled
3. **Create** embedder for the configured model
4. **Embed** the image using `embedder.embedImage()`
5. **Search** with the image vector using `searchWithVector()`
6. **Return** results (images and/or text based on filters)

For text queries:
1. **Detect** text query (not a file path)
2. **Search** using standard text embedding pipeline
3. **Return** results

## Examples

### Find Similar Images
```bash
# Ingest with multimodal mode
raglite ingest ./photos/ --mode multimodal

# Find images similar to a reference image
raglite search ./reference.jpg --content-type image --top-k 10
```

### Cross-Modal Search
```bash
# Find text descriptions related to an image
raglite search ./diagram.png --content-type text

# Find all content (images and text) related to an image
raglite search ./photo.jpg --content-type all
```

### Combined with Other Options
```bash
# Image search with custom result count (reranking disabled to preserve visual similarity)
raglite search ./photo.jpg --top-k 10

# Image search with custom result count
raglite search ./image.png --top-k 20
```

## Benefits

1. **Intuitive Interface**: No special flags needed - just provide the image path
2. **Unified Experience**: Same CLI command for text and image search
3. **Cross-Modal Capabilities**: Leverage CLIP's unified embedding space
4. **Flexible Filtering**: Use `--content-type` to filter results by type
5. **Clear Validation**: Helpful error messages guide users to correct usage

## Limitations

1. **Multimodal Mode Only**: Image search requires database to be in multimodal mode
2. **File-Based Only**: Currently supports local image files, not URLs or base64
3. **Supported Formats**: Limited to common image formats (jpg, png, gif, webp, bmp)
4. **Model Dependency**: Requires CLIP model to be available

## Future Enhancements

Potential improvements for future versions:
- Support for image URLs
- Support for base64-encoded images
- Batch image search
- Image preprocessing options
- Custom similarity thresholds

## Testing

The feature includes comprehensive tests:
- Unit tests for `searchWithVector()` method
- Integration tests for image detection
- Error handling tests for mode validation
- Vector dimension validation tests

Run tests:
```bash
npm run test
```

## Related Documentation

- [Multimodal Configuration](./multimodal-configuration.md)
- [CLI Reference](./cli-reference.md)
- [CLIP Model Guide](./model-guide.md)
- [Cross-Modal Search Patterns](./integration-patterns.md)
