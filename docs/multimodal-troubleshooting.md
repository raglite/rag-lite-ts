# Multimodal Troubleshooting

Quick fixes for common multimodal issues.

## Quick Check

```bash
# Test search
raglite search "test" --top-k 5
```

## Common Issues

### No Images Found
```bash
# Check for image files
find ./docs/ -name "*.jpg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp"

# Re-ingest with multimodal mode
raglite ingest ./docs/ --mode multimodal --force-rebuild
```

### Model Not Supported
```bash
# Use correct CLIP model
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32
```

### Slow Performance
```bash
# Reduce batch size
export RAG_BATCH_SIZE="4"

# Disable reranking for speed
raglite ingest ./docs/ --mode multimodal --no-rerank
```

### Cross-Modal Search Not Working
```bash
# Ensure multimodal mode was used
raglite ingest ./docs/ --mode multimodal --force-rebuild

# Use descriptive queries
raglite search "red sports car" --content-type image
```

For general RAG-lite TS issues, see [main troubleshooting guide](troubleshooting.md).