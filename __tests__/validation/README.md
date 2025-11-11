# Validation Scripts

This directory contains validation scripts used during development to verify technical approaches before integration.

## Scripts

### clip-validation.ts

**Purpose**: Validates the CLIPTextModelWithProjection approach for text-only embedding.

**What it tests**:
- CLIP text embedding without pixel_values errors
- Correct embedding dimensions (512D)
- Valid numerical values in embeddings
- Embedding consistency for same input
- Semantic similarity between related texts
- Edge cases (empty strings, long text, special characters)

**When to use**:
- Before making changes to CLIP text embedding implementation
- To verify CLIP model compatibility
- To debug CLIP text embedding issues

**How to run**:
```bash
npx tsx __tests__/validation/clip-validation.ts
```

### unified-embedding-space-validation.ts

**Purpose**: Validates that CLIP text and image embeddings exist in a unified embedding space.

**What it tests**:
- Text and image embeddings have same dimensions
- Cross-modal cosine similarity computation
- Semantic similarity between related text and images
- Semantic dissimilarity between unrelated content
- Embedding space mathematical properties (normalization, non-zero vectors)

**When to use**:
- To verify cross-modal search capabilities
- To test CLIP multimodal functionality
- To debug semantic similarity issues
- To validate unified embedding space properties

**How to run**:
```bash
# Requires a test image at __tests__/test-data/images/cat.jpg
npx tsx __tests__/validation/unified-embedding-space-validation.ts
```

## Notes

- These scripts are **not** part of the automated test suite
- They are **manual validation tools** for development
- They include comprehensive console output for debugging
- They test technical approaches before integration
- They can be run independently without affecting production code

## Development Workflow

1. **Before implementing**: Run validation to verify technical approach
2. **During development**: Use for debugging and verification
3. **After changes**: Re-run to ensure nothing broke
4. **Documentation**: Scripts serve as examples of correct usage

## Why These Are Here

These scripts were moved from `src/` because:
- They're not production code
- They're not library exports
- They're development/testing utilities
- They shouldn't be compiled to `dist/`
- They're valuable for future development but belong with tests

## Related Documentation

- [CLIP Implementation](../../docs/clip-implementation.md)
- [Multimodal Architecture](../../docs/multimodal-architecture.md)
- [Testing Guidelines](../../.kiro/steering/testing-guidelines.md)
