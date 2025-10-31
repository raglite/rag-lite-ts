# Changelog

## [2.0.0] - 2025-01-19 - Chameleon Multimodal Architecture

### 🎉 Major Features

#### Chameleon Multimodal Architecture
- **Polymorphic Runtime System**: Automatically adapts behavior based on content type and stored configuration
- **Mode Persistence**: Configuration stored during ingestion, auto-detected during search operations
- **Unified API Interface**: Same search interface works seamlessly across text-only and multimodal modes
- **Content-Type Awareness**: Automatic handling of text, images, and mixed content collections

#### Multimodal Content Support
- **Image Processing**: Support for JPG, JPEG, PNG, GIF, and WebP image formats
- **Image-to-Text Generation**: Automatic description generation using Xenova/vit-gpt2-image-captioning
- **Image Metadata Extraction**: Automatic extraction of dimensions, format, file size, and creation date
- **Unified Embedding Space**: CLIP models (Xenova/clip-vit-base-patch32, Xenova/clip-vit-base-patch16) for text and image embeddings

#### Advanced Reranking Strategies
- **Text-Derived Reranking**: Convert images to text descriptions, then apply cross-encoder reranking
- **Metadata-Based Reranking**: Score based on filename patterns and image metadata
- **Hybrid Reranking**: Combine semantic and metadata signals with configurable weights
- **Strategy Auto-Selection**: Appropriate default strategy based on mode and content type

### 🔧 API Enhancements

#### Enhanced Constructors
- **IngestionPipeline**: New optional configuration object for mode, model, and reranking strategy
- **SearchEngine**: Automatic mode detection from database configuration
- **PolymorphicSearchFactory**: Advanced factory for runtime polymorphism

#### New Interfaces
- **UniversalEmbedder**: Unified interface supporting both text and multimodal models
- **RerankingStrategy**: Flexible interface for different reranking approaches
- **SystemInfo**: Mode and model configuration persistence

#### Simplified Creation Functions
- **createEmbedder()**: Simple function-based model creation with validation
- **createReranker()**: Conditional reranking strategy creation
- **Replaced complex factory patterns** with simple, maintainable functions

### 🖥️ CLI Improvements

#### New Parameters
- **--mode**: Specify text or multimodal mode during ingestion
- **--rerank-strategy**: Configure reranking strategy for multimodal mode
- **Automatic Mode Detection**: Search commands auto-detect mode from database

#### Enhanced Commands
- **Backward Compatibility**: All existing CLI usage patterns continue to work
- **Improved Help**: Updated help text with multimodal examples and model information
- **Better Error Messages**: Clear guidance for mode and model configuration issues

### 🗄️ Database Schema Evolution

#### New Tables
- **system_info**: Store mode, model, and reranking configuration
- **Enhanced documents**: Added content_type and metadata fields
- **Enhanced chunks**: Added content_type and metadata support

#### Migration Support
- **Automatic Migration**: Built-in database schema migration with backup
- **Backward Compatibility**: Existing databases work with compatibility mode
- **Migration Tools**: CLI commands for database migration and validation

### 🔍 Search Enhancements

#### Content-Type Filtering
- **Mixed Results**: Search across all content types by default
- **Type-Specific Search**: Filter results by content type (text, image, pdf, docx)
- **Relevance Scoring**: Unified scoring across different content types

#### Performance Optimizations
- **Lazy Loading**: Multimodal dependencies loaded only when needed
- **Batch Processing**: Efficient processing of large image collections
- **Memory Management**: Improved resource cleanup and garbage collection

### 📚 Documentation Overhaul

#### New Documentation
- **Migration Guide**: Comprehensive guide for upgrading from v1.x
- **Multimodal Troubleshooting**: Specific troubleshooting for multimodal issues
- **MCP Server Multimodal Guide**: Complete guide for MCP integration
- **API Examples**: Updated examples demonstrating multimodal capabilities

#### Enhanced Guides
- **Troubleshooting**: Updated with Chameleon Architecture specific issues
- **Configuration**: New multimodal configuration options and examples
- **Performance**: Optimization guidelines for different modes and content types

### 🧪 Examples and Integration

#### API Examples
- **Text Mode Example**: Optimized text-only workflow demonstration
- **Multimodal Example**: Comprehensive mixed content processing
- **Mode Switching Example**: Chameleon Architecture behavior demonstration
- **Updated Package Configuration**: New scripts and dependencies

#### MCP Server Integration
- **Multimodal MCP Tools**: New tools for multimodal search and configuration
- **Configuration Examples**: Comprehensive MCP server configuration examples
- **Integration Examples**: Complete MCP client integration demonstrations

### 🛠️ Technical Improvements

#### Architecture Refinements
- **Core Layer Purity**: Model-agnostic core with clean separation of concerns
- **Implementation Layer**: Separate text and multimodal implementations
- **Public API Layer**: Simple, intuitive interface hiding internal complexity

#### Error Handling
- **Model Validation**: Comprehensive validation with clear error messages
- **Transformers.js Compatibility**: Version checking and compatibility validation
- **Graceful Fallbacks**: Automatic fallback mechanisms for failed operations

#### Performance
- **Resource Management**: Improved memory usage and cleanup
- **Batch Optimization**: Efficient processing for large content collections
- **Model Caching**: Optimized model loading and caching strategies

### 🔄 Breaking Changes

#### Database Schema
- **New system_info table**: Required for mode persistence (automatic migration available)
- **Enhanced table schemas**: New fields for content type and metadata support

#### Model Support
- **Transformers.js Only**: All models must be compatible with transformers.js ecosystem
- **Validated Model List**: Only tested and validated models are supported
- **Dimension Consistency**: Strict validation of embedding dimensions

### 📦 Dependencies

#### New Dependencies
- **@huggingface/transformers**: Updated to latest version for multimodal support
- **Sharp**: Enhanced image processing capabilities (existing dependency)

#### Updated Dependencies
- **Core dependencies**: Updated for better performance and compatibility
- **Development dependencies**: Enhanced testing and build tools

### 🐛 Bug Fixes

#### Search Issues
- **Relevance Scoring**: Improved scoring consistency across content types
- **Memory Leaks**: Fixed memory leaks in embedding generation
- **Error Recovery**: Better error handling and recovery mechanisms

#### Processing Issues
- **File Type Detection**: Improved content type detection accuracy
- **Batch Processing**: Fixed issues with large batch processing
- **Path Handling**: Better cross-platform path handling

### 🚀 Performance Improvements

#### Speed Optimizations
- **Faster Model Loading**: Optimized model initialization and caching
- **Batch Processing**: More efficient batch processing for embeddings
- **Search Performance**: Improved search speed with better indexing

#### Memory Optimizations
- **Reduced Memory Usage**: Lower memory footprint for text mode
- **Efficient Image Processing**: Optimized memory usage for image processing
- **Garbage Collection**: Better memory cleanup and resource management

### 📋 Migration Notes

#### Recommended Migration Path
1. **Backup existing data**: Create backups of database and index files
2. **Update to v2.0.0**: Install latest version with npm
3. **Run migration**: Use built-in migration tools or fresh ingestion
4. **Test functionality**: Verify search and ingestion work correctly
5. **Explore multimodal**: Try new multimodal capabilities if applicable

#### Compatibility
- **API Compatibility**: Existing API usage continues to work
- **CLI Compatibility**: Existing CLI commands remain functional
- **Database Migration**: Automatic migration with rollback support

### 🔮 Future Roadmap

#### Planned Features
- **Additional Content Types**: PDF and DOCX multimodal processing
- **Advanced Models**: Support for newer transformers.js compatible models
- **Enhanced Reranking**: More sophisticated reranking strategies
- **Performance Optimizations**: Continued performance improvements

#### Community
- **Feedback Welcome**: Community feedback on multimodal features
- **Contribution Guidelines**: Updated guidelines for multimodal contributions
- **Documentation**: Ongoing documentation improvements and examples

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