# Multimodal Dataset Examples

This directory contains examples demonstrating rag-lite-ts capabilities with real-world multimodal datasets and document patterns.

## Examples Overview

### 1. COCO Caption Similarity (`coco-caption-demo.js`)
- Demonstrates text embedding quality using real COCO image captions
- Shows how similar captions cluster together in embedding space
- Tests cross-modal text alignment capabilities

### 2. Wikipedia Article Processing (`wikipedia-demo.js`)
- Processes Wikipedia-style articles with mixed text and image content
- Demonstrates content chunking and search across different sections
- Shows handling of structured documents with images

### 3. Technical Documentation (`tech-docs-demo.js`)
- Processes product documentation and research papers
- Demonstrates search across technical specifications and academic content
- Shows performance with domain-specific terminology

## Running the Examples

```bash
# Install dependencies
npm install

# Run individual examples
node examples/multimodal-datasets/coco-caption-demo.js
node examples/multimodal-datasets/wikipedia-demo.js
node examples/multimodal-datasets/tech-docs-demo.js

# Or run all examples
npm run examples:multimodal
```

## Expected Output

Each example will:
1. Process the sample content using current multimodal capabilities
2. Demonstrate search functionality across different content types
3. Show performance metrics and similarity scores
4. Provide insights into embedding quality and retrieval accuracy

## Current Limitations

- Image embedding is not yet implemented (CLIP text-only)
- Examples focus on text portions of multimodal documents
- Cross-modal similarity testing is limited to text-text comparisons

## Future Enhancements

When image embedding is implemented, these examples will be extended to:
- Test true text-image similarity
- Demonstrate cross-modal retrieval (text query → image results)
- Show multimodal document understanding capabilities