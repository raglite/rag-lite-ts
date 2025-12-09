# Troubleshooting Guide

*For users experiencing issues or errors - solutions and diagnostics*

Complete troubleshooting guide for common issues, error messages, and solutions in RAG-lite TS.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Error Messages](#common-error-messages)
- [Installation Issues](#installation-issues)
- [Model Issues](#model-issues)
- [Multimodal Issues](#multimodal-issues)
- [Search Issues](#search-issues)
- [Performance Issues](#performance-issues)
- [File Processing Issues](#file-processing-issues)
- [Configuration Issues](#configuration-issues)
- [Debug Mode](#debug-mode)

## Quick Diagnostics

### Check System Status

```bash
# Verify installation
raglite help

# Check if database exists
ls -la *.sqlite

# Check if index exists  
ls -la *.bin

# Test basic functionality
raglite search "test" 2>&1 | head -5
```

### Environment Check

```bash
# Check Node.js version (requires 18+)
node --version

# Check available memory
free -h  # Linux/macOS
wmic OS get TotalVisibleMemorySize /value  # Windows

# Check disk space
df -h .  # Linux/macOS
dir  # Windows
```

## Common Error Messages

### "No database found"

**Error:**
```
Error: No database found at ./db.sqlite
```

**Cause:** No documents have been ingested yet.

**Solution:**
```bash
# Ingest documents first
raglite ingest ./docs/

# Then search
raglite search "your query"
```

### "Model mismatch detected"

**Error:**
```
Error: Model mismatch detected!
Current model: Xenova/all-mpnet-base-v2 (768 dimensions)
Index model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
Run 'raglite rebuild' to rebuild the index with the new model.
```

**Cause:** Embedding model changed after index was created.

**Solution:**
```bash
# Rebuild index with new model
raglite rebuild

# Or use CLI flag to auto-rebuild
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed
```

### "No documents found in path"

**Error:**
```
Error: No documents found in ./docs/
Supported formats: .md, .txt, .mdx, .pdf, .docx
```

**Cause:** Directory contains no supported file types.

**Solution:**
```bash
# Check directory contents
ls -la ./docs/

# Verify file extensions are supported
find ./docs/ -name "*.md" -o -name "*.txt" -o -name "*.mdx"

# Check file permissions
ls -la ./docs/*.md
```

### "Failed to load model"

**Error:**
```
Error: Failed to load model sentence-transformers/all-MiniLM-L6-v2
```

**Cause:** Model download failed or insufficient disk space.

**Solution:**
```bash
# Check internet connection
ping huggingface.co

# Check disk space (need >500MB free)
df -h ~/.raglite/models/

# Clear model cache and retry
rm -rf ~/.raglite/models/
raglite ingest ./docs/

# Try alternative model
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2
```

### "Out of memory"

**Error:**
```
Error: Cannot allocate memory
JavaScript heap out of memory
```

**Cause:** Insufficient RAM for current configuration.

**Solution:**
```bash
# Use smaller model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"

# Reduce batch size
export RAG_BATCH_SIZE="4"

# For multimodal mode, use conservative settings
export RAG_MODE="multimodal"
export RAG_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
export RAG_BATCH_SIZE="4"

# Process smaller batches
raglite ingest ./docs/batch1/
raglite ingest ./docs/batch2/

# Increase Node.js memory limit
node --max-old-space-size=8192 $(which raglite) ingest ./docs/
```

### "Mode mismatch detected"

**Error:**
```
Error: Mode mismatch detected!
Current mode: multimodal
Index mode: text
Run 'raglite rebuild' to rebuild the index with the new mode.
```

**Cause:** Trying to use multimodal search on text-only index or vice versa.

**Solution:**
```bash
# Rebuild index with correct mode
raglite rebuild

# Or re-ingest with desired mode
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed

# Check current mode
sqlite3 db.sqlite "SELECT mode FROM system_info;"
```

### "Image processing failed"

**Error:**
```
Error: Failed to process image ./image.png
Image-to-text model failed to load
```

**Cause:** Image-to-text model download failed or image file corrupted.

**Solution:**
```bash
# Check image file integrity
file ./image.png

# Clear model cache and retry
rm -rf ~/.raglite/models/
raglite ingest ./docs/ --mode multimodal

# Try with different image format
# Convert to supported format: JPG, PNG, GIF, WebP

# Check internet connection for model download
ping huggingface.co
```

## Installation Issues

### Global Installation Problems

**Problem:** `raglite` command not found after installation

**Solution:**
```bash
# Check if installed globally
npm list -g rag-lite-ts

# Reinstall globally
npm uninstall -g rag-lite-ts
npm install -g rag-lite-ts

# Check npm global path
npm config get prefix

# Add to PATH if needed (Linux/macOS)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Permission Issues

**Problem:** Permission denied during installation

**Solution:**
```bash
# Use sudo (Linux/macOS)
sudo npm install -g rag-lite-ts

# Or configure npm to use different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g rag-lite-ts
```

### Version Conflicts

**Problem:** Multiple versions installed

**Solution:**
```bash
# Check installed versions
npm list -g rag-lite-ts
which raglite

# Clean install
npm uninstall -g rag-lite-ts
npm cache clean --force
npm install -g rag-lite-ts@latest
```

## Model Issues

### Model Download Failures

**Problem:** Models fail to download

**Symptoms:**
- Timeout errors
- Network connection errors
- Partial downloads

**Solutions:**
```bash
# Check internet connection
curl -I https://huggingface.co

# Try again later (servers may be busy)
raglite ingest ./docs/

# Use different model
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2

# For multimodal mode, try alternative CLIP model
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch16

# Manual model setup (see models/README.md)
```

### Model Cache Issues

**Problem:** Corrupted model cache

**Symptoms:**
- Model loading errors
- Inconsistent results
- Unexpected crashes

**Solutions:**
```bash
# Clear model cache
rm -rf ~/.raglite/models/

# Re-download models
raglite ingest ./docs/

# Check cache location
echo $RAG_MODEL_CACHE_PATH
ls -la ~/.raglite/models/
```

### Model Compatibility

**Problem:** Model not compatible with transformers.js

**Solution:**
```bash
# Use supported text models
raglite ingest ./docs/ --model sentence-transformers/all-MiniLM-L6-v2
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2

# Use supported multimodal models
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch16

# Check model documentation for compatibility
```

## Multimodal Issues

### Chameleon Architecture Mode Detection Problems

**Problem:** System not automatically detecting mode from database

**Error:**
```
Warning: No mode information found in database, defaulting to text mode
```

**Cause:** Database created before Chameleon Architecture or mode not stored during ingestion.

**Diagnosis:**
```bash
# Check if system_info table exists with mode information
sqlite3 db.sqlite "SELECT mode, model_name, reranking_strategy FROM system_info;"

# Check database schema version
sqlite3 db.sqlite ".schema system_info"
```

**Solutions:**
```bash
# Re-ingest with explicit mode to store configuration
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed

# For existing databases, migrate to new schema
raglite migrate-database --backup

# Create fresh multimodal index
rm db.sqlite vector-index.bin
raglite ingest ./docs/ --mode multimodal
```

### Image Processing Problems

**Problem:** Images not being processed in multimodal mode

**Symptoms:**
- No image descriptions generated
- Images not appearing in search results
- "Image processing failed" errors

**Diagnosis:**
```bash
# Check if multimodal mode is enabled and stored
sqlite3 db.sqlite "SELECT mode FROM system_info;"

# Check for image files in directory
find ./docs/ -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp"

# Verify image content in database
sqlite3 db.sqlite "SELECT COUNT(*) FROM chunks WHERE content_type='image';"

# Enable debug mode to see processing details
DEBUG=1 raglite ingest ./docs/ --mode multimodal
```

**Solutions:**
```bash
# Ensure multimodal mode is specified and stored
raglite ingest ./docs/ --mode multimodal

# Check image file formats (supported: JPG, JPEG, PNG, GIF, WebP)
file ./docs/images/*

# Reduce batch size for large images
export RAG_BATCH_SIZE="4"
raglite ingest ./docs/ --mode multimodal

# Clear model cache if image-to-text model is corrupted
rm -rf ~/.raglite/models/
raglite ingest ./docs/ --mode multimodal

# Test with a single image first
raglite ingest ./single-image.png --mode multimodal
```

### Image-to-Text Model Issues

**Problem:** Image descriptions are poor quality or generic

**Symptoms:**
- All images described as "a picture" or similar generic text
- Descriptions don't match image content
- Search results for images are irrelevant

**Diagnosis:**
```bash
# Check which image-to-text model is being used
sqlite3 db.sqlite "SELECT reranking_model FROM system_info;"

# Test image-to-text generation directly
DEBUG=1 raglite ingest ./single-test-image.png --mode multimodal

# Check generated descriptions in database
sqlite3 db.sqlite "SELECT content, metadata FROM chunks WHERE content_type='image' LIMIT 3;"
```

**Solutions:**
```bash
# The system uses Xenova/vit-gpt2-image-captioning by default
# This is currently the best available transformers.js compatible model

# Try different reranking strategy that relies less on descriptions
raglite ingest ./docs/ --mode multimodal # metadata reranking removed

# Use descriptive filenames to improve metadata-based search
# Rename files: diagram.png -> architecture-diagram.png

# For better results, ensure images are clear and well-composed
# Avoid very small, blurry, or complex images

# Test with high-quality, simple images first
# Complex diagrams may not generate good descriptions

# Reranking is now automatic - hybrid strategy removed
raglite ingest ./docs/ --mode multimodal
```

### Mixed Content Search Issues

**Problem:** Search doesn't return expected mix of text and image results

**Symptoms:**
- Only text results returned for queries that should match images
- Only image results returned for text-focused queries
- Poor ranking of mixed results
- Chameleon Architecture not adapting properly to content type

**Diagnosis:**
```bash
# Check current mode and configuration
sqlite3 db.sqlite "SELECT mode, model_name, reranking_strategy FROM system_info;"

# Check content type distribution in database
sqlite3 db.sqlite "SELECT content_type, COUNT(*) FROM chunks GROUP BY content_type;"

# Test search with content type filtering
raglite search "architecture" --content-type text
raglite search "architecture" --content-type image
```

**Solutions:**
```bash
# Reranking is now automatic based on mode
raglite ingest ./docs/ --mode multimodal  # Uses text-derived reranking automatically

# Increase result count to see more diverse results
raglite search "architecture" --top-k 20

# Use more specific queries
raglite search "diagram showing architecture"  # Better for images
raglite search "architecture documentation"    # Better for text

# Test polymorphic runtime behavior
raglite search "architecture" --debug  # Should show mode auto-detection

# Ensure proper mode storage and detection
raglite ingest ./docs/ --mode multimodal --rebuild-if-needed
```

### Reranking Strategy Problems

**Problem:** Reranking strategy not working as expected

**Symptoms:**
- Results seem randomly ordered
- Images not ranked appropriately
- Performance is slower than expected

**Diagnosis:**
```bash
# Check current reranking strategy
sqlite3 db.sqlite "SELECT reranking_strategy FROM system_info;"

# Test with different strategies
raglite search "test query" --top-k 10
```

**Solutions:**
```bash
# Reranking is now automatic based on mode:

# Multimodal mode automatically uses text-derived reranking
raglite ingest ./docs/ --mode multimodal

# For maximum speed, disable reranking explicitly
raglite ingest ./docs/ --mode multimodal --no-rerank
```

### Chameleon Architecture Polymorphic Runtime Issues

**Problem:** System not adapting behavior based on stored mode configuration

**Symptoms:**
- Same search interface but unexpected behavior
- Mode not automatically detected during search
- Inconsistent results across sessions

**Diagnosis:**
```bash
# Check if mode is properly stored and detected
sqlite3 db.sqlite "SELECT mode, model_name, created_at FROM system_info;"

# Test polymorphic behavior
DEBUG=1 raglite search "test query"  # Should show mode detection

# Check if SearchFactory is being used
raglite search "test" --debug | grep -i "mode\|polymorphic"
```

**Solutions:**
```bash
# Ensure mode is stored during ingestion
raglite ingest ./docs/ --mode multimodal

# Test mode switching behavior
raglite ingest ./text-docs/ --mode text --db text.sqlite --index text.bin
raglite ingest ./mixed-docs/ --mode multimodal --db multimodal.sqlite --index multimodal.bin

# Verify automatic mode detection
raglite search "test" --db text.sqlite --index text.bin
raglite search "test" --db multimodal.sqlite --index multimodal.bin

# Check for database schema compatibility
raglite migrate-database --check
```

### Model Factory and Validation Issues

**Problem:** Model creation or validation failures in Chameleon Architecture

**Symptoms:**
- "Model not supported" errors for valid models
- Dimension mismatch errors
- Factory creation failures

**Diagnosis:**
```bash
# Check supported models for current mode
raglite list-models --mode text
raglite list-models --mode multimodal

# Verify model compatibility
raglite validate-model Xenova/clip-vit-base-patch32 --mode multimodal

# Check transformers.js version compatibility
npm list @huggingface/transformers
```

**Solutions:**
```bash
# Use validated models for each mode
# Text mode:
raglite ingest ./docs/ --mode text --model sentence-transformers/all-MiniLM-L6-v2
raglite ingest ./docs/ --mode text --model Xenova/all-mpnet-base-v2

# Multimodal mode:
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch32
raglite ingest ./docs/ --mode multimodal --model Xenova/clip-vit-base-patch16

# Clear model cache if validation fails
rm -rf ~/.raglite/models/
raglite ingest ./docs/ --mode multimodal

# Update to latest version for model compatibility
npm install -g rag-lite-ts@latest
```

### Content Type Detection Issues

**Problem:** Files not detected as correct content type

**Symptoms:**
- Images processed as text
- Text files not processed
- Unexpected file type errors

**Solutions:**
```bash
# Check file extensions are supported
ls -la ./docs/ | grep -E '\.(jpg|jpeg|png|gif|webp|md|txt|pdf|docx)$'

# Verify file types
file ./docs/*

# Use explicit file patterns if needed
raglite ingest ./docs/ --include "*.md,*.png,*.jpg"

# Check for hidden characters in filenames
ls -la ./docs/ | cat -A
```

### Memory Issues with Large Images

**Problem:** Out of memory when processing large images

**Symptoms:**
- Process crashes during image processing
- "JavaScript heap out of memory" errors
- System becomes unresponsive

**Solutions:**
```bash
# Reduce batch size significantly
export RAG_BATCH_SIZE="2"

# Process images in smaller groups
raglite ingest ./docs/images/batch1/ --mode multimodal
raglite ingest ./docs/images/batch2/ --mode multimodal

# Resize large images before processing
# Use tools like ImageMagick to reduce image size:
# mogrify -resize 1920x1080> ./docs/images/*.jpg

# Increase Node.js memory limit
node --max-old-space-size=8192 $(which raglite) ingest ./docs/ --mode multimodal
```

## Search Issues

### No Search Results

**Problem:** Search returns no results for known content

**Diagnosis:**
```bash
# Check if documents are indexed
raglite search "test" --top-k 1

# Check database contents
sqlite3 db.sqlite "SELECT COUNT(*) FROM documents;"
sqlite3 db.sqlite "SELECT COUNT(*) FROM chunks;"
```

**Solutions:**
```bash
# Re-ingest documents
raglite ingest ./docs/

# Try different search terms
raglite search "common word"

# Check preprocessing mode
export RAG_PREPROCESSING_MODE="balanced"
raglite rebuild
```

### Poor Search Quality

**Problem:** Search results not relevant

**Solutions:**
```bash
# Enable reranking
raglite search "query" --rerank

# Use higher quality model
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2 --rebuild-if-needed

# Adjust preprocessing
export RAG_PREPROCESSING_MODE="rich"
raglite rebuild

# Get more results
raglite search "query" --top-k 20
```

### Slow Search Performance

**Problem:** Search takes too long

**Solutions:**
```bash
# Use faster model
raglite ingest ./docs/ --model sentence-transformers/all-MiniLM-L6-v2 --rebuild-if-needed

# Disable reranking
raglite search "query" --no-rerank

# Reduce result count
raglite search "query" --top-k 5

# Check system resources
top  # Linux/macOS
taskmgr  # Windows
```

## Performance Issues

### Slow Ingestion

**Problem:** Document ingestion is very slow

**Diagnosis:**
```bash
# Check system resources during ingestion
DEBUG=1 raglite ingest ./docs/
```

**Solutions:**
```bash
# Use faster model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"

# Increase batch size (if memory allows)
export RAG_BATCH_SIZE="32"

# Reduce chunk size
export RAG_CHUNK_SIZE="200"

# Process in smaller batches
raglite ingest ./docs/folder1/
raglite ingest ./docs/folder2/
```

### High Memory Usage

**Problem:** Process uses too much memory

**Solutions:**
```bash
# Use smaller model
export RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"

# Reduce batch size
export RAG_BATCH_SIZE="4"

# Reduce chunk size
export RAG_CHUNK_SIZE="150"

# Monitor memory usage
DEBUG=1 raglite ingest ./docs/
```

### Disk Space Issues

**Problem:** Running out of disk space

**Solutions:**
```bash
# Check space usage
du -sh ~/.raglite/models/
du -sh *.sqlite *.bin

# Clean model cache
rm -rf ~/.raglite/models/

# Use smaller chunk sizes
export RAG_CHUNK_SIZE="200"

# Compress database
sqlite3 db.sqlite "VACUUM;"
```

## File Processing Issues

### PDF Processing Problems

**Problem:** PDF files not processing correctly

**Solutions:**
```bash
# Check PDF file integrity
file document.pdf

# Try with different PDF
raglite ingest ./simple.pdf

# Check file permissions
ls -la document.pdf

# Use alternative format if possible
# Convert PDF to text externally if needed
```

### DOCX Processing Problems

**Problem:** Word documents not processing

**Solutions:**
```bash
# Check file format
file document.docx

# Verify file is not corrupted
# Try opening in Word/LibreOffice

# Use alternative format
# Save as .txt or .md if possible
```

### MDX/JSX Processing Issues

**Problem:** MDX files causing errors

**Solutions:**
```bash
# Use stricter preprocessing
export RAG_PREPROCESSING_MDX="strip"
raglite rebuild

# Or use placeholder mode
export RAG_PREPROCESSING_MDX="placeholder"
raglite rebuild

# Check MDX syntax
# Ensure JSX components are properly closed
```

## Configuration Issues

### Environment Variables Not Working

**Problem:** Environment variables ignored

**Solutions:**
```bash
# Check variable names (must start with RAG_)
env | grep RAG_

# Export variables properly
export RAG_EMBEDDING_MODEL="Xenova/all-mpnet-base-v2"

# Check configuration loading
DEBUG=1 raglite ingest ./docs/
```

### Configuration File Issues

**Problem:** Config file not loaded

**Solutions:**
```bash
# Check file name and location
ls -la raglite.config.js

# Check syntax
node -c raglite.config.js

# Use ES modules syntax
# export const config = { ... };
```

### Path Issues

**Problem:** File paths not working correctly

**Solutions:**
```bash
# Use absolute paths for testing
raglite ingest /full/path/to/docs/

# Check current directory
pwd

# Verify path exists
ls -la ./docs/

# Check path strategy
export RAG_PATH_STORAGE_STRATEGY="absolute"
raglite rebuild
```

## Debug Mode

### Enable Debug Logging

```bash
# Enable debug mode
DEBUG=1 raglite ingest ./docs/
DEBUG=1 raglite search "query"

# Or set environment variable
export DEBUG=1
raglite ingest ./docs/
```

### Debug Output Analysis

**Look for these patterns in debug output:**

```bash
# Model loading
"Loading model: sentence-transformers/all-MiniLM-L6-v2"
"Model loaded successfully"

# File processing
"Processing file: ./docs/readme.md"
"Generated 5 chunks"

# Embedding generation
"Generating embeddings for batch of 10"
"Batch processed in 150ms"

# Search operations
"Query embedded in 25ms"
"Found 15 similar chunks"
```

### Performance Profiling

```bash
# Time operations
time raglite ingest ./docs/
time raglite search "query"

# Memory profiling (Linux)
/usr/bin/time -v raglite ingest ./docs/

# Node.js profiling
node --prof $(which raglite) ingest ./docs/
```

### Database Inspection

```bash
# Check database schema
sqlite3 db.sqlite ".schema"

# Count records
sqlite3 db.sqlite "SELECT COUNT(*) FROM documents;"
sqlite3 db.sqlite "SELECT COUNT(*) FROM chunks;"

# Check model version
sqlite3 db.sqlite "SELECT value FROM metadata WHERE key='model_version';"

# Sample data
sqlite3 db.sqlite "SELECT * FROM documents LIMIT 5;"
```

### Index Inspection

```bash
# Check index file size
ls -lh vector-index.bin

# Verify index exists and is readable
file vector-index.bin
```

## Getting Help

### Collect System Information

```bash
# System info
uname -a  # Linux/macOS
systeminfo  # Windows

# Node.js version
node --version
npm --version

# Package version
npm list -g rag-lite-ts

# Configuration
env | grep RAG_
cat raglite.config.js
```

### Create Minimal Reproduction

```bash
# Create test case
mkdir test-case
cd test-case

# Create simple test file
echo "# Test Document\nThis is a test." > test.md

# Test with minimal setup
raglite ingest test.md
raglite search "test"
```

### Report Issues

When reporting issues, include:

1. **Error message** (full text)
2. **System information** (OS, Node.js version)
3. **Command used** (exact command that failed)
4. **Configuration** (environment variables, config file)
5. **Debug output** (if applicable)
6. **Minimal reproduction** (if possible)

This troubleshooting guide covers the most common issues. For additional help, check the [GitHub issues](https://github.com/your-repo/rag-lite-ts/issues) or create a new issue with the information above.