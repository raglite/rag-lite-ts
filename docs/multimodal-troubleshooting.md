# Multimodal Troubleshooting Guide

*Specific troubleshooting for multimodal mode issues and model compatibility*

This guide covers troubleshooting specific to the simplified multimodal architecture, including image processing, mode detection, and multimodal model compatibility issues. The system now provides reliable CLIP-based multimodal capabilities without complex fallback mechanisms.

## Table of Contents

- [Quick Multimodal Diagnostics](#quick-multimodal-diagnostics)
- [Mode Detection Issues](#mode-detection-issues)
- [Image Processing Problems](#image-processing-problems)
- [Model Compatibility Issues](#model-compatibility-issues)
- [Reranking Strategy Problems](#reranking-strategy-problems)
- [Performance Issues](#performance-issues)
- [Content Type Detection](#content-type-detection)
- [Debug Mode for Multimodal](#debug-mode-for-multimodal)

## Simplified Architecture Benefits

The updated multimodal implementation eliminates many common issues:

**No More Fallback Complexity:**
- CLIP text embedding works reliably without `pixel_values` errors
- No complex error recovery mechanisms
- Clear, actionable error messages

**Predictable Behavior:**
- Each mode has consistent, documented behavior
- No unexpected fallbacks to different models
- Errors indicate actual problems, not expected limitations

**True Cross-Modal Capabilities:**
- Text queries reliably find semantically similar images
- Unified embedding space for both content types
- No conversion between content types in multimodal mode

## Quick Multimodal Diagnostics

### Check Multimodal Setup

```bash
# Verify multimodal mode is stored in database
sqlite3 db.sqlite "SELECT mode, model_name, reranking_strategy FROM system_info;"

# Check for image content in database
sqlite3 db.sqlite "SELECT COUNT(*) FROM chunks WHERE content_type='image';"

# List supported image files in directory
find ./docs/ -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp"

# Test multimodal search
raglite search "test" --top-k 10 | grep -E "(image|text)"
```

### Environment Check for Multimodal

```bash
# Check multimodal-specific environment variables
env | grep RAG_ | grep -E "(MODE|RERANK)"

# Verify transformers.js models cache
ls -la ~/.raglite/models/

# Check available memory (multimodal needs more)
free -h  # Linux/macOS
```

## Mode Detection Issues

### "Mode not found in database"

**Error:**
```
Warning: No mode information found in database, defaulting to text mode
```

**Cause:** Database created before multimodal architecture or mode not stored during ingestion.

**Solution:**
```bash
# Re-ingest with explicit mode
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed

# Or check if database has system_info table
sqlite3 db.sqlite ".schema system_info"

# If table missing, rebuild completely
rm db.sqlite vector-index.bin
raglite ingest ./docs/ --mode multimodal
```

### "Mode mismatch between ingestion and search"

**Error:**
```
Error: Cannot search multimodal content with text-only index
```

**Cause:** Index created in text mode, trying to search with multimodal expectations.

**Solution:**
```bash
# Check current mode
sqlite3 db.sqlite "SELECT mode FROM system_info;"

# Rebuild with correct mode
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed

# Or create separate multimodal index
raglite ingest ./docs/ --mode multimodal --db multimodal.sqlite --index multimodal.bin
```

### "Automatic mode detection failed"

**Error:**
```
Error: Failed to detect mode from database
Database may be corrupted
```

**Cause:** Database corruption or missing system_info table.

**Solution:**
```bash
# Check database integrity
sqlite3 db.sqlite "PRAGMA integrity_check;"

# Check if system_info table exists
sqlite3 db.sqlite ".tables" | grep system_info

# If corrupted, rebuild from scratch
rm db.sqlite vector-index.bin
raglite ingest ./docs/ --mode multimodal
```

## Image Processing Problems

### "No images processed despite multimodal mode"

**Problem:** Multimodal mode enabled but no images found in results.

**Diagnosis:**
```bash
# Check if images exist in source directory
find ./docs/ -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" \)

# Check if images were processed
sqlite3 db.sqlite "SELECT source, content_type FROM documents WHERE content_type='image';"

# Enable debug mode to see processing
DEBUG=1 raglite ingest ./docs/ --mode multimodal
```

**Solutions:**
```bash
# Ensure images are in supported formats
file ./docs/images/*

# Check file permissions
ls -la ./docs/images/

# Try with a single test image
echo "Test image" > test.txt
cp test.txt test.jpg  # Create test image file
raglite ingest . --mode multimodal

# Verify image processing is working
raglite search "test" --top-k 5
```

### "Image-to-text generation failed"

**Problem:** Images processed but descriptions are empty or generic.

**Symptoms:**
- All images described as "a picture" or empty descriptions
- Image search returns no relevant results
- Debug output shows "Failed to generate description"

**Solutions:**
```bash
# Clear model cache and re-download image-to-text model
rm -rf ~/.raglite/models/
raglite ingest ./docs/ --mode multimodal

# Check internet connection for model download
ping huggingface.co

# Try with simpler, clearer images
# Avoid very small, blurry, or complex images

# Test with known good image
wget https://via.placeholder.com/300x200/blue/white?text=Test+Image -O test-image.png
raglite ingest . --mode multimodal
raglite search "test image"
```

### "Image metadata extraction failed"

**Problem:** Images processed but no metadata (dimensions, file size) extracted.

**Diagnosis:**
```bash
# Check if Sharp library is working
node -e "const sharp = require('sharp'); console.log('Sharp working');"

# Check image metadata in database
sqlite3 db.sqlite "SELECT metadata FROM chunks WHERE content_type='image' LIMIT 1;"
```

**Solutions:**
```bash
# Reinstall dependencies
npm install -g rag-lite-ts

# Try with different image format
convert image.png image.jpg  # Using ImageMagick
raglite ingest . --mode multimodal

# Check if images are corrupted
file ./docs/images/*
```

## Model Compatibility Issues

### "CLIP model not supported"

**Error:**
```
Error: Model Xenova/clip-vit-base-patch32 not supported
Available models: sentence-transformers/all-MiniLM-L6-v2, Xenova/all-mpnet-base-v2
```

**Cause:** Using text-only model list or outdated version.

**Solution:**
```bash
# Update to latest version
npm install -g rag-lite-ts@latest

# Use supported multimodal models
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32

# Check available models
raglite help | grep -A 10 "Supported models"
```

### "CLIP text embedding requires multimodal mode"

**Error:**
```
Error: CLIP model requires multimodal mode. Use mode: 'multimodal' in options.
```

**Cause:** Trying to use a CLIP model without specifying multimodal mode.

**Solution:**
```bash
# Always specify multimodal mode with CLIP models
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32

# Or in code
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal',
  embeddingModel: 'Xenova/clip-vit-base-patch32'
});
```

### "Cross-modal search not working"

**Problem:** Text queries don't find relevant images or vice versa.

**Diagnosis:**
```bash
# Check if mode is actually multimodal
sqlite3 db.sqlite "SELECT mode, model_name FROM system_info;"

# Verify both content types exist
sqlite3 db.sqlite "SELECT content_type, COUNT(*) FROM chunks GROUP BY content_type;"

# Test with known content
raglite search "test" --top-k 20
```

**Solutions:**
```bash
# Ensure multimodal mode was used during ingestion
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed

# Use descriptive queries
raglite search "red sports car" --content-type image  # Good
raglite search "car" --content-type image  # Less specific

# Enable reranking for better results
raglite search "architecture diagram" --rerank
```

### "Transformers.js compatibility error"

**Error:**
```
Error: Model requires transformers.js version 2.x but 1.x is installed
```

**Cause:** Outdated transformers.js version.

**Solution:**
```bash
# Update transformers.js (handled automatically by rag-lite-ts)
npm install -g rag-lite-ts@latest

# Clear model cache
rm -rf ~/.raglite/models/

# Retry ingestion
raglite ingest ./docs/ --mode multimodal
```

### "Model dimensions mismatch"

**Error:**
```
Error: Expected 512 dimensions but got 384
Index was built with different model
```

**Cause:** Switching between models with different embedding dimensions.

**Solution:**
```bash
# Rebuild index with new model
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32 --rebuild-if-needed

# Or check current model
sqlite3 db.sqlite "SELECT model_name, model_dimensions FROM system_info;"

# Use consistent model
raglite ingest ./docs/ --mode multimodal --model sentence-transformers/all-MiniLM-L6-v2  # 384D
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32  # 512D
```

## Reranking Strategy Problems

### "Text-derived reranking failed"

**Problem:** Text-derived reranking strategy not working properly.

**Symptoms:**
- Images not reranked appropriately
- Search results seem random
- Performance much slower than expected

**Diagnosis:**
```bash
# Check current reranking strategy
sqlite3 db.sqlite "SELECT reranking_strategy FROM system_info;"

# Test with reranking disabled
raglite search "test query" --no-rerank

# Enable debug mode to see reranking process
DEBUG=1 raglite search "test query" --rerank
```

**Solutions:**
```bash
# Try different reranking strategy
raglite ingest ./docs/ --mode multimodal

# Or disable reranking for speed
raglite ingest ./docs/ --mode multimodal --no-rerank

# For hybrid approach
raglite ingest ./docs/ --mode multimodal  # hybrid reranking removed
```

### "Metadata reranking not effective"

**Problem:** Metadata-based reranking doesn't improve results.

**Cause:** Filenames not descriptive or metadata not extracted properly.

**Solutions:**
```bash
# Use descriptive filenames
mv diagram.png architecture-diagram.png
mv chart.jpg user-flow-chart.jpg

# Check metadata extraction
sqlite3 db.sqlite "SELECT source, metadata FROM chunks WHERE content_type='image' LIMIT 3;"

# Try text-derived reranking instead
raglite ingest ./docs/ --mode multimodal  # text-derived reranking automatic
```

### "Hybrid reranking too slow"

**Problem:** Hybrid reranking strategy causes performance issues.

**Solutions:**
```bash
# Use simpler strategy
raglite ingest ./docs/ --mode multimodal

# Or disable reranking
raglite ingest ./docs/ --mode multimodal --no-rerank

# Reduce batch size to manage memory
export RAG_BATCH_SIZE="4"
raglite ingest ./docs/ --mode multimodal  # hybrid reranking removed
```

## Performance Issues

### "Multimodal ingestion very slow"

**Problem:** Image processing takes much longer than expected.

**Solutions:**
```bash
# Reduce batch size for image processing
export RAG_BATCH_SIZE="4"  # Conservative for images

# Process images separately from text
raglite ingest ./docs/text/ --mode text
raglite ingest ./docs/images/ --mode multimodal

# Use faster CLIP model
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32  # Faster
# Instead of: Xenova/clip-vit-base-patch16  # Slower but higher quality

# Skip reranking during ingestion for speed
raglite ingest ./docs/ --mode multimodal --no-rerank
```

### "High memory usage with images"

**Problem:** Memory usage spikes during image processing.

**Solutions:**
```bash
# Reduce batch size significantly
export RAG_BATCH_SIZE="2"

# Process smaller directories at a time
raglite ingest ./docs/batch1/ --mode multimodal
raglite ingest ./docs/batch2/ --mode multimodal

# Increase Node.js memory limit
node --max-old-space-size=8192 $(which raglite) ingest ./docs/ --mode multimodal

# Resize large images before processing
mogrify -resize 1920x1080> ./docs/images/*.jpg
```

### "Search slower in multimodal mode"

**Problem:** Search performance degraded compared to text mode.

**Solutions:**
```bash
# Disable reranking for faster search
raglite search "query" --no-rerank

# Use metadata reranking (faster than text-derived)
raglite ingest ./docs/ --mode multimodal

# Reduce result count
raglite search "query" --top-k 5

# Check if index is optimized
sqlite3 db.sqlite "ANALYZE;"
```

## Content Type Detection

### "Images processed as text"

**Problem:** Image files being processed as text documents.

**Diagnosis:**
```bash
# Check file extensions
ls -la ./docs/images/ | grep -E '\.(jpg|jpeg|png|gif|webp)$'

# Check file types
file ./docs/images/*

# Check database content types
sqlite3 db.sqlite "SELECT source, content_type FROM documents WHERE source LIKE '%.png';"
```

**Solutions:**
```bash
# Ensure proper file extensions
mv image.JPG image.jpg  # Use lowercase extensions
mv picture.JPEG picture.jpeg

# Remove hidden characters from filenames
rename 's/[^a-zA-Z0-9._-]//g' ./docs/images/*

# Re-ingest with clean filenames
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed
```

### "Text files not processed in multimodal mode"

**Problem:** Text documents ignored when using multimodal mode.

**Cause:** Multimodal mode should process both text and images.

**Solutions:**
```bash
# Verify multimodal mode processes both content types
DEBUG=1 raglite ingest ./docs/ --mode multimodal

# Check for both content types in database
sqlite3 db.sqlite "SELECT content_type, COUNT(*) FROM chunks GROUP BY content_type;"

# Ensure text files have proper extensions
ls -la ./docs/ | grep -E '\.(md|txt|pdf|docx)$'
```

## Debug Mode for Multimodal

### Enable Comprehensive Debug Logging

```bash
# Enable debug mode for multimodal operations
DEBUG=1 raglite ingest ./docs/ --mode multimodal

# Look for these patterns in output:
# "Mode detection: multimodal"
# "Processing image: ./image.png"
# "Generated description: A diagram showing..."
# "Extracted metadata: {width: 1920, height: 1080}"
# "Reranking strategy: text-derived"
```

### Analyze Debug Output

**Successful multimodal processing should show:**
```
Mode detection: multimodal
Loading CLIP model: Xenova/clip-vit-base-patch32
Processing text files...
- docs/readme.md: 5 chunks created
Processing images...
- images/diagram.png: Generated description: "A technical diagram showing system architecture"
- images/chart.jpg: Generated description: "A bar chart displaying performance metrics"
Reranking strategy: text-derived initialized
```

**Problem indicators:**
```
# Mode detection issues
Mode detection: text (should be multimodal)

# Image processing issues
Processing images...
- images/diagram.png: Failed to generate description
- images/chart.jpg: Error: Image processing failed

# Model loading issues
Error: Failed to load CLIP model
Error: Image-to-text model not available
```

### Database Inspection for Multimodal

```bash
# Check system info
sqlite3 db.sqlite "SELECT * FROM system_info;"

# Check content type distribution
sqlite3 db.sqlite "SELECT content_type, COUNT(*) FROM chunks GROUP BY content_type;"

# Sample image chunks
sqlite3 db.sqlite "SELECT source, content, metadata FROM chunks WHERE content_type='image' LIMIT 3;"

# Check reranking configuration
sqlite3 db.sqlite "SELECT reranking_strategy, reranking_model FROM system_info;"
```

### Performance Profiling for Multimodal

```bash
# Time multimodal operations
time raglite ingest ./docs/ --mode multimodal
time raglite search "architecture diagram"

# Memory profiling during image processing
/usr/bin/time -v raglite ingest ./docs/ --mode multimodal

# Monitor resource usage
top -p $(pgrep -f raglite) &
raglite ingest ./docs/ --mode multimodal
```

This troubleshooting guide covers the most common multimodal-specific issues. For general RAG-lite TS troubleshooting, see the main [Troubleshooting Guide](troubleshooting.md).