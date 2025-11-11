# Changelog

## [Unreleased] - 2.0.0 - Chameleon Multimodal Architecture

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

## [1.0.2] - 2025-01-12

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