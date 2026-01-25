# Changelog

## [2.3.1] - 2026-01-25

### Features
- **Experimental LLM-enabled response generation**: Generate responses from retrieved search chunks using an LLM
  - Uses chunks returned from semantic search as context for LLM-based answer generation
- **CLI and UI support**: CLI and web UI updated to support the new response generation feature

## [2.3.0] - 2026-01-23

### Features
- **Web Interface (UI)**: Added visual web-based interface for document ingestion and search
  - Launch with `raglite ui` command
  - Drag & drop file upload with real-time progress tracking
  - Interactive search with text and image query support
  - Knowledge base statistics and management
  - Full feature parity with CLI including multimodal support

## [2.2.0] - 2026-01-01

### Features
- **Dual Package Support (ESM + CommonJS)**: Package now supports both ESM (`import`) and CommonJS (`require`) import styles
  - Separate builds for ESM (`dist/esm/`) and CommonJS (`dist/cjs/`)
  - Automatic module resolution via `package.json` `exports` field
  - Node.js automatically selects the correct format based on import style
  - Both import styles fully tested and verified

### Improvements
- **Build System**: Enhanced build process with separate TypeScript configurations for ESM and CommonJS
  - `tsconfig.esm.json` for ESM builds
  - `tsconfig.cjs.json` for CommonJS builds (using NodeNext module system)
  - Updated build scripts: `build:esm` and `build:cjs` for individual builds
- **Package Configuration**: Updated `package.json` exports field for proper dual package routing
  - Supports both `import` and `require` conditions
  - Separate type definitions for each format
  - Maintains backward compatibility

### Technical Details
- Uses `NodeNext` module system for CommonJS build to handle `import.meta` usage
- Type assertions added for dynamic imports to ensure compatibility
- Both builds output successfully and are fully functional

## [2.1.1] - 2025-12-11

Improved multimodal search for more accurate, content-type–specific results

## [2.1.0] - 2025-12-07

### Breaking Changes
- **Removed `--rerank-strategy` option entirely**: Reranking strategy now automatically selected based on mode (text: cross-encoder, multimodal: text-derived). Use `--rerank`/`--no-rerank` to control reranking instead.
- **Changed default reranking behavior**: Reranking is now disabled by default. Use `--rerank` to enable reranking explicitly.
- **Disabled reranking for image-to-image searches**: Image searches now use pure CLIP visual similarity to preserve accuracy.

### Improvements
- **Simplified multimodal reranking**: Removed complex metadata and hybrid strategies, keeping only text-derived and disabled options
- **Better image-to-image search quality**: Automatic reranking disable prevents text-conversion artifacts from interfering with visual similarity
- **Cleaner CLI interface**: Fewer options with automatic smart defaults

### Bug Fixes
- **Fixed reranking interference with image similarity**: Text-derived reranking no longer degrades image-to-image search results


---

## [2.0.5] - 2025-12-03

### Bug Fixes
- **Fixed critical database connection issue in MCP server**: Path normalization bug causing "Database is closed" errors

---

## [2.0.4] - 2025-01-22

### Breaking Changes
- **Removed legacy factory functions**: `createTextEmbedder()` and `createTextReranker()` removed in favor of unified `createEmbedder()` and `createReranker()` APIs
- **Removed legacy database functions**: `getEmbeddingModel()`, `getDimensions()`, `getRerankingModel()`, `getMode()` consolidated into `getSystemInfo()`
- **Removed type aliases**: Use direct types instead of deprecated aliases
- **Removed deprecated content manager method**: `_getContentPath()` removed from internal API

---

## [2.0.3] - 2025-01-21

### Improvements
- Auto-select default CLIP model (`Xenova/clip-vit-base-patch32`) when `--mode multimodal` is specified without `--model` parameter
- Updated CLI to enable all supported file formats while ingesting a single file

---

## [2.0.2] - 2025-11-20

### Bug Fixes
- Fixed CLIP tokenizer handling: corrected maxTextLength to 77 tokens (not characters) and removed incorrect character truncation
- Fixed image-to-text pipeline failing during ingestion by properly loading images as RawImage objects
- Fixed mode parameter not propagating from public API to core pipeline, causing incorrect text chunking in multimodal mode
- Fixed pipeline loading race condition causing multiple simultaneous model loads and hangs with async locking
- Fixed inverted memory thresholds in batch processor (512MB for images, 256MB for text)

---

## [2.0.1] - 2025-11-18

### Features
- **SearchEngine Chameleon Architecture**: `SearchEngine` now automatically detects mode (text/multimodal) from database and adapts accordingly
  - Simple constructor works for all modes: `new SearchEngine(indexPath, dbPath)`
  - No need for `SearchFactory` in basic usage
  - Mode detection happens transparently on first search

### Performance
- Binary index format: 3.6x smaller files, 3.5x faster loading
- Zero-copy Float32Array views for efficient deserialization

### Breaking Changes
- Index files now use binary format (not backward compatible with v2.0.0)
- **Migration required**: Remove old index files and re-ingest
  ```bash
  rm .raglite/*.index && raglite ingest ./docs
  ```
- Database content preserved (no data loss)


---

## [2.0.0] - 2025-11-11 - Chameleon Multimodal Architecture

### Release Summary

This release includes comprehensive multimodal support with the following completed features:

#### Core Architecture Improvements ✅ COMPLETED
- **Layered Architecture Refactoring**: Clean separation between core, text, and multimodal layers
- **Abstract Base Classes**: Model-agnostic shared functionality in `BaseUniversalEmbedder`
- **Simplified Creation Functions**: `createEmbedder()` and `createReranker()` replace complex factory patterns
- **Mode Persistence Infrastructure**: Database schema with `system_info` table for configuration storage
- **Content-Type Support**: Database schema supports `content_type` field for mixed content

#### Multimodal Foundation ✅ COMPLETED
- **CLIP Embedder Implementation**: `CLIPEmbedder` class with full text and image embedding support
  - Text embedding using `CLIPTextModelWithProjection`
  - Image embedding using `CLIPVisionModelWithProjection`
  - Unified 512-dimensional embedding space
  - Batch processing optimization
- **Model Registry**: Support for CLIP models (Xenova/clip-vit-base-patch32, Xenova/clip-vit-base-patch16)
- **Resource Management**: Proper cleanup and lifecycle management for ML models

#### Image Processing & Metadata ✅ COMPLETED
- **Image-to-Text Generation**: Automatic description generation using `Xenova/vit-gpt2-image-captioning`
  - `generateImageDescription()` for single images
  - `generateImageDescriptionsBatch()` for batch processing
  - Optimized batch processing with `BatchProcessingOptimizer`
- **Image Metadata Extraction**: Comprehensive metadata extraction
  - Dimensions, format, file size, creation date
  - `extractImageMetadata()` with Sharp integration
  - Fallback metadata extraction without Sharp
- **Image File Processing**: Complete pipeline for image ingestion
  - `processImageFile()` combines description + metadata
  - Support for JPG, JPEG, PNG, GIF, WebP formats

#### Multimodal Reranking Strategies ✅ COMPLETED
- **Text-Derived Reranking**: `TextDerivedRerankingStrategy` class
  - Converts images to text descriptions using image-to-text models
  - Applies cross-encoder reranking on generated descriptions
  - Supports both text and image content types
- **Metadata-Based Reranking**: `MetadataRerankingStrategy` class
  - Scores based on filename patterns and metadata
  - Configurable weights for different metadata signals
  - Supports all content types (text, image, pdf, docx)
- **Hybrid Reranking**: `createHybridRerankFunction()` implementation
  - Combines text-derived and metadata strategies
  - Configurable weights for semantic and metadata signals
  - Error recovery for individual strategy failures
- **Strategy Factory**: `createReranker()` with automatic fallback and error recovery

#### CLI Multimodal Support ✅ COMPLETED
- **Mode Selection**: `--mode multimodal` flag for ingestion
- **Reranking Strategy**: `--rerank-strategy` option (text-derived, metadata, hybrid, disabled)
- **Content-Type Filtering**: `--content-type` filter for search results
- **Model Validation**: Automatic validation of CLIP models for multimodal mode
- **Help Documentation**: Comprehensive help text with multimodal examples

#### Unified Content System ✅ COMPLETED
- **Memory-Based Ingestion**: `ingestFromMemory()` for AI agent integration
- **Format-Adaptive Retrieval**: `getContent()` with 'file' and 'base64' output formats
- **Content Management**: Hash-based deduplication, storage limits, cleanup operations
- **Batch Operations**: `getContentBatch()` for efficient multi-content retrieval
- **MCP Integration Ready**: Content system designed for Model Context Protocol servers

#### Documentation ✅ COMPLETED
- **Architecture Guidelines**: Comprehensive steering rules for core layer architecture
- **API Design Principles**: Guidelines for simple, intuitive API design
- **Testing Guidelines**: Node.js native test runner patterns and ML resource cleanup
- **Unified Content System Docs**: Complete guide for memory ingestion and content retrieval

#### MCP Server Multimodal Support ✅ COMPLETED
- **Multimodal Search Tool**: `multimodal_search` with content-type filtering
- **Image Ingestion Tool**: `ingest_image` with URL download support
- **Base64 Image Delivery**: Automatic base64 encoding for MCP clients
- **Mode Detection**: Automatic detection and display of multimodal mode
- **Model Information Tools**: `list_supported_models` with content-type filtering
- **Strategy Information Tools**: `list_reranking_strategies` with mode filtering
- **Comprehensive Documentation**: Complete MCP multimodal guide

#### Migration Tools ✅ COMPLETED
- **Path Migration**: `migrateToRagLiteStructure()` for standardized paths
- **Migration Documentation**: Unified content migration guide

### Breaking Changes

**Database Schema Updates:**
- New `system_info` table for mode persistence and configuration storage
- Enhanced `documents` table with `content_type` and `content_id` fields
- Enhanced `chunks` table with `content_type` and metadata support
- New `content_metadata` table for unified content system

**Migration Required:**
- Existing databases will need migration to support new schema
- Automatic migration available via `migrateToRagLiteStructure()` function
- Alternatively, re-ingest content with new version

**API Changes:**
- `IngestionPipeline` constructor now accepts optional configuration object
- `SearchEngine` automatically detects mode from database
- New `getContent()` and `getContentBatch()` methods for content retrieval

### � Current Status Summary

**Version 2.0.0 - Fully Implemented and Ready for Release**

All planned features for the Chameleon Multimodal Architecture release are complete:

**Core Features:**
- Core architecture refactoring with clean layer separation
- CLIP embedder for text and image embedding (unified 512D space)
- Image-to-text generation with vit-gpt2-image-captioning
- Image metadata extraction (dimensions, format, file size)
- Multimodal reranking strategies (text-derived, metadata, hybrid)
- CLI multimodal support (--mode, --rerank-strategy, --content-type)
- MCP server multimodal tools (multimodal_search, ingest_image, base64 delivery)
- Unified content system for memory ingestion and format-adaptive retrieval
- Database schema with mode persistence and content-type support
- Migration tools for path standardization

**Testing & Validation:**
- Integration tests for multimodal workflows (6 test files)
- Performance benchmarks and validation (5 test files)
- MCP server multimodal integration tests
- Cross-modal search validation tests
- Model compatibility and performance validation

**Documentation:**
- 4 comprehensive multimodal guides
- Complete MCP server multimodal guide
- Architecture and API design guidelines
- Testing guidelines and troubleshooting docs

**Release Status:** All features implemented, tested, and documented. Ready for v2.0.0 release.

### 📦 Dependencies (Current)
- **@huggingface/transformers**: ^3.7.5 (supports CLIP models)
- **@modelcontextprotocol/sdk**: ^1.18.2 (MCP integration)
- **hnswlib-wasm**: ^0.8.2 (vector search)
- **sqlite3**: ^5.1.6 (database)
- **sharp**: ^0.34.5 (optional, for image processing)

### 🔗 Related Documentation
- [Core Layer Architecture Guidelines](.kiro/steering/core-layer-architecture.md)
- [API Design Principles](.kiro/steering/api-design-principles.md)
- [Testing Guidelines](.kiro/steering/testing-guidelines.md)
- [Architecture Refactoring Summary](ARCHITECTURE_REFACTORING_SUMMARY.md)

---

## [1.0.2] - 2025-10-12

### Documentation
- Updated API reference with simplified constructor patterns
- Improved documentation structure for better user onboarding
- Added comprehensive configuration examples

### Architecture
- Refined layered architecture with cleaner separation of concerns
- Enhanced factory patterns for advanced use cases
- Improved progressive disclosure in public API

## [1.0.1] - Previous Release

Initial stable release with core functionality.