# Multimodal Dataset Testing Plan

## Overview
Validate rag-lite-ts multimodal functionality using publicly available datasets, focusing on current text-only capabilities while preparing for future image embedding support.

## Current State Analysis
- CLIP embedder exists but only supports text embedding (image embedding is placeholder)
- Multimodal mode configuration exists in ingestion and search
- Architecture supports mixed content ingestion
- Need to validate text quality and system behavior with real multimodal datasets

## Goals
1. Validate CLIP text embedding quality using real image captions
2. Test mixed content document ingestion and search
3. Verify multimodal architecture works with real-world data
4. Establish baseline for future image embedding validation

## Implementation Plan

### Phase 1: Text Quality Validation with Real Captions
**Location**: `__tests__/datasets/text-quality-validation.test.ts`

**Approach**:
1. Use small subset of MS COCO image captions (5-10 images, 2-3 captions each)
2. Embed captions using CLIP text embedder
3. Validate that multiple captions for same image have high similarity
4. Compare CLIP vs sentence-transformer performance on same captions

**Test Data Structure**:
```
__tests__/test-data/coco-subset/
├── captions.json          # Image ID -> multiple captions mapping
└── metadata.json          # Dataset info, licensing
```

**Sample Data** (embedded in test file, not external files):
```javascript
const cocoSample = [
  {
    image_id: "cat_001",
    captions: [
      "A fluffy orange cat sitting by the window",
      "An orange tabby cat looking outside", 
      "Cat resting near a bright window"
    ]
  },
  // 4-5 more examples
];
```

**Tests**:
- CLIP text embeddings produce expected dimensions (512)
- Related captions have similarity > 0.6
- Different image captions have similarity < 0.4
- Compare CLIP vs sentence-transformer caption similarity

### Phase 2: Mixed Content Document Processing
**Location**: `__tests__/datasets/mixed-content-processing.test.ts`

**Approach**:
1. Create realistic documents with text + image references
2. Test ingestion in both text and multimodal modes
3. Validate search works on text portions
4. Test error handling with missing images

**Test Documents** (created in test, not external files):
- Wikipedia-style article with images
- Technical documentation with diagrams
- Product catalog with photos
- Blog post with embedded images

**Tests**:
- Documents ingest successfully in multimodal mode
- Text content is searchable despite image references
- Missing images don't break ingestion
- Search results include relevant text from mixed documents

### Phase 3: Real-World Workflow Examples
**Location**: `examples/multimodal-datasets/`

**Approach**:
1. Demonstrate complete workflows with realistic data
2. Show performance characteristics
3. Document current capabilities and limitations
4. Provide templates for future image embedding tests

**Examples**:
- `coco-captions-demo.js` - Process COCO captions and measure similarity
- `wikipedia-articles-demo.js` - Ingest and search Wikipedia-style content
- `mixed-content-benchmark.js` - Performance measurement with mixed documents

## Technical Implementation Details

### Test Framework Compliance
- Use Node.js test runner (`import { test, describe } from 'node:test'`)
- Use Node.js assert (`import { strict as assert } from 'node:assert'`)
- ESM imports only (`.js` extensions)
- Follow existing test patterns in repo

### Interface Usage
**Before writing tests, examine**:
- `src/core/embedder-factory.ts` - `createEmbedder()` function signature
- `src/ingestion.ts` - `IngestionPipeline` constructor and methods
- `src/search.ts` - `SearchEngine` constructor and search methods
- Existing test files for import patterns and setup/teardown

### Data Management
- **No large external files** - embed small datasets in test code
- **No network dependencies** - all data self-contained
- **Licensing compliance** - use public domain or fair use samples
- **Size limits** - Keep test data < 1MB total

### Error Handling Strategy
- Graceful fallback when CLIP text embedding fails
- Clear skip messages for unimplemented features
- Test both success and failure paths
- Document known limitations

## Success Criteria

### Phase 1 Success
- [ ] CLIP text embedder works with real captions
- [ ] Caption similarity validation passes
- [ ] Performance comparison with sentence-transformer
- [ ] Tests run in < 10 seconds

### Phase 2 Success  
- [ ] Mixed documents ingest successfully
- [ ] Text search works on multimodal documents
- [ ] Error handling works for missing images
- [ ] Both text and multimodal modes tested

### Phase 3 Success
- [ ] Complete workflow examples work
- [ ] Performance measurements documented
- [ ] Clear capability/limitation documentation
- [ ] Templates ready for future image embedding

## Risk Mitigation

### Known Issues to Handle
- CLIP text-only embedding may have limitations in transformers.js
- Multimodal mode may fall back to text mode
- Missing image files should not break processing

### Fallback Strategies
- If CLIP fails, test with sentence-transformer
- If multimodal mode fails, validate text mode works
- If external data unavailable, use synthetic examples

### Testing Philosophy
- **Simple over complex** - basic validation, not enterprise testing
- **Current capabilities** - test what exists, not what's planned
- **Real data validation** - use actual dataset samples, not synthetic
- **Architecture validation** - ensure system ready for image embedding

## Timeline
- **Phase 1**: 1-2 days (text quality validation)
- **Phase 2**: 1-2 days (mixed content processing) 
- **Phase 3**: 1-2 days (examples and documentation)
- **Total**: ~1 week for complete validation

## Future Extensions
When image embedding is implemented:
- Add cross-modal similarity tests to Phase 1
- Add image search tests to Phase 2  
- Add full multimodal benchmarks to Phase 3
- Compare with established multimodal baselines