# Multimodal Dataset Testing

This directory contains tests that validate rag-lite-ts multimodal functionality using real-world dataset samples.

## Current Implementation

### Embedded Test Data Approach
- **No external files**: Test data is embedded directly in test code
- **Small samples**: 5-10 examples per test to keep tests fast
- **Self-contained**: All tests run without network dependencies
- **Real data**: Uses actual samples from public datasets (COCO, Flickr8k, etc.)

### Test Structure

```
__tests__/datasets/
├── text-quality-validation.test.ts    # CLIP text embedding with real captions
├── mixed-content-processing.test.ts   # Documents with text + image references  
└── README.md                          # This file
```

## Test Categories

### 1. Text Quality Validation (`text-quality-validation.test.ts`)
- **Purpose**: Validate CLIP text embeddings using real image captions
- **Data**: MS COCO caption samples embedded in test code
- **Tests**: Caption similarity, cross-model comparison, dimension validation
- **Current Status**: Tests text-only CLIP capabilities

### 2. Mixed Content Processing (`mixed-content-processing.test.ts`)
- **Purpose**: Test ingestion of documents with text + image references
- **Data**: Realistic documents created in test (Wikipedia-style, technical docs)
- **Tests**: Multimodal ingestion, text search, error handling with missing images
- **Current Status**: Tests text portions of multimodal documents

## Sample Data Sources

All embedded samples are derived from public datasets:
- **MS COCO**: Image captions for similarity testing
- **Flickr8k**: Diverse caption styles
- **Wikipedia**: Mixed content document structure
- **Technical docs**: Real-world multimodal document patterns

## Usage

```bash
# Run all dataset validation tests
npm run test __tests__/datasets/

# Run specific test category
npm run test __tests__/datasets/text-quality-validation.test.ts
```

## Current Capabilities Tested

✅ **CLIP text embedding** with real captions  
✅ **Caption similarity** validation  
✅ **Mixed document ingestion** (text portions)  
✅ **Multimodal mode configuration**  
✅ **Error handling** with missing images  
⏳ **Image embedding** (placeholder - not yet implemented)  
⏳ **Cross-modal similarity** (requires image embedding)  

## Future Expansion Recommendations

When image embedding is implemented, consider expanding to:

### Phase 1: Cross-Modal Validation
```
__tests__/datasets/
├── cross-modal-similarity.test.ts     # Text-image alignment tests
├── image-embedding-quality.test.ts    # Image embedding validation
└── multimodal-retrieval.test.ts       # Cross-modal search tests
```

### Phase 2: Larger Dataset Integration
```
__tests__/datasets/
├── external-data/                     # Optional external dataset support
│   ├── coco-subset/                   # Small COCO subset (< 10MB)
│   ├── flickr8k-subset/               # Flickr8k samples
│   └── download-datasets.js           # Optional dataset downloader
└── benchmarks/                        # Performance benchmarking
    ├── retrieval-benchmarks.test.ts   # Standard IR benchmarks
    └── similarity-benchmarks.test.ts  # Cross-modal similarity benchmarks
```

### Phase 3: Comprehensive Validation
- **Large-scale testing**: Support for 100MB+ datasets
- **Performance benchmarking**: Compare against established baselines
- **Multilingual support**: Test with non-English datasets
- **Domain-specific**: Medical images, scientific diagrams, etc.

## Expansion Guidelines

### When to Add External Files
- Only when embedded data becomes too large (> 1MB per test)
- When testing requires diverse samples (> 50 examples)
- For performance benchmarking with established datasets

### Dataset Selection Criteria
- **Public domain** or **Creative Commons** licensed
- **Established benchmarks** with known baselines
- **Diverse content** representing real-world use cases
- **Reasonable size** for CI/CD environments

### Implementation Principles
- **Start simple**: Embedded data first, external files only when needed
- **Fast tests**: Keep validation tests under 30 seconds total
- **Clear fallbacks**: Graceful handling when datasets unavailable
- **Documentation**: Clear capability/limitation documentation

## Contributing

When adding new dataset tests:
1. **Start with embedded data** in test files
2. **Use existing test patterns** (Node.js test runner, ESM imports)
3. **Keep samples small** (< 10 examples per test)
4. **Document data sources** and licensing
5. **Test current capabilities** only, not planned features