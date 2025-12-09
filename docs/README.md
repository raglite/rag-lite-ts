# Overview

Welcome to the RAG-lite TS documentation hub. This directory contains comprehensive guides for all aspects of using RAG-lite TS.

## Quick Start

New to RAG-lite TS? Start with the [CLI Reference](cli-reference.md) for installation and basic usage, then explore the guides below.

## Documentation Guides

### 📚 Core Guides

- **[CLI Reference](cli-reference.md)** - Complete command-line interface documentation
  - All commands and options
  - Usage examples and workflows
  - MCP server integration
  - **NEW**: Multimodal mode support with `--mode` and automatic reranking parameters

- **[API Reference](api-reference.md)** - Comprehensive programmatic API documentation
  - Simple constructors and factory patterns
  - Core classes and methods
  - Type definitions and interfaces
  - Usage patterns and examples
  - **NEW**: Chameleon Multimodal Architecture with UniversalEmbedder interface and polymorphic runtime

- **[Unified Content System](unified-content-system.md)** - Memory ingestion and format-adaptive retrieval
  - Memory-based content ingestion for MCP integration
  - Format-adaptive retrieval (file paths vs base64)
  - Dual storage strategy and content management
  - Performance optimization and troubleshooting
  - **NEW**: Complete guide for modern AI workflow integration

- **[Migration Guide](unified-content-migration-guide.md)** - Upgrading to unified content system
  - Backward compatibility and zero breaking changes
  - New memory ingestion and content retrieval features
  - Configuration updates and troubleshooting
  - **NEW**: Seamless migration path for existing users

- **[Configuration Guide](configuration.md)** - Advanced configuration options
  - Configuration file setup
  - Environment variables
  - Multi-environment deployment
  - **NEW**: Mode persistence and multimodal configuration options

### 🔧 Specialized Guides

- **[Model Selection Guide](model-guide.md)** - Embedding models and performance
  - Model comparison and benchmarks
  - Selection criteria and use cases
  - Switching between models
  - **NEW**: Multimodal models (CLIP) with text and image support

- **[Path Storage Strategies](path-strategies.md)** - Document path management
  - Relative vs absolute paths
  - Portability and URL generation
  - Multi-environment deployment

- **[Document Preprocessing](preprocessing.md)** - Content processing and optimization
  - File type handling (MDX, PDF, DOCX)
  - Preprocessing modes and configuration
  - Content extraction strategies
  - **NEW**: Multimodal content processing with image-to-text conversion and metadata extraction

- **[Troubleshooting Guide](troubleshooting.md)** - Common issues and solutions
  - Error message explanations
  - Performance optimization
  - Debug mode and diagnostics
  - **NEW**: Multimodal-specific troubleshooting and model compatibility issues

- **[Unified Content Troubleshooting](unified-content-troubleshooting.md)** - Specialized troubleshooting for unified content system
  - Memory ingestion issues and solutions
  - Content retrieval problems and recovery
  - Storage management and cleanup procedures
  - Performance optimization for large content operations
  - **NEW**: Complete diagnostic and recovery procedures

### 🎨 Multimodal Capabilities (NEW)

- **[Multimodal Configuration](multimodal-configuration.md)** - Multimodal mode setup and configuration
  - Setting up multimodal mode with CLIP models
  - Processing mixed content (text + images)
  - Reranking strategies for multimodal content
  - Mode persistence and automatic detection

- **[Multimodal Tutorial](multimodal-tutorial.md)** - Step-by-step multimodal guide
  - Getting started with multimodal mode
  - Cross-modal search examples
  - Content type filtering
  - Best practices and workflows

- **[MCP Server Multimodal Guide](mcp-server-multimodal-guide.md)** - MCP integration for multimodal content
  - Multimodal MCP tools and capabilities
  - Image content retrieval through MCP
  - Cross-modal search via MCP interface
  - Configuration and usage examples

### 📊 Technical References

- **[Embedding Models Comparison](EMBEDDING_MODELS_COMPARISON.md)** - Detailed model benchmarks
  - Performance metrics and analysis
  - System requirements
  - Technical implementation details
  - **NEW**: Multimodal model performance and capabilities matrix

## Documentation Structure

### By User Type

**New Users:**
1. [CLI Reference](cli-reference.md) - Quick start and installation
2. [Configuration Guide](configuration.md) - Setup options
3. [API Reference](api-reference.md) - Programmatic usage

**Developers:**
1. [API Reference](api-reference.md) - Programmatic usage
2. [Unified Content System](unified-content-system.md) - Memory ingestion and MCP integration
3. [Model Guide](model-guide.md) - Model selection
4. [Preprocessing Guide](preprocessing.md) - Content handling

**System Administrators:**
1. [Configuration Guide](configuration.md) - Environment setup
2. [Path Strategies](path-strategies.md) - Deployment patterns
3. [Troubleshooting Guide](troubleshooting.md) - Issue resolution

### By Use Case

**Basic Document Search:**
- [CLI Reference](cli-reference.md) → [Configuration Guide](configuration.md)

**MCP Integration & Memory Ingestion:**
- [Unified Content System](unified-content-system.md) → [API Reference](api-reference.md)

**Technical Documentation:**
- [Preprocessing Guide](preprocessing.md) → [Model Guide](model-guide.md)

**Multi-Environment Deployment:**
- [Configuration Guide](configuration.md) → [Path Strategies](path-strategies.md)

**Performance Optimization:**
- [Model Guide](model-guide.md) → [Troubleshooting Guide](troubleshooting.md)

**Integration Development:**
- [API Reference](api-reference.md) → [Unified Content System](unified-content-system.md)

## Quick Reference

### Common Tasks

| Task | Primary Guide | Supporting Guides |
|------|---------------|-------------------|
| Install and setup | [CLI Reference](cli-reference.md) | [Configuration Guide](configuration.md) |
| Ingest documents | [CLI Reference](cli-reference.md) | [Preprocessing](preprocessing.md) |
| Memory ingestion (MCP) | [Unified Content System](unified-content-system.md) | [API Reference](api-reference.md) |
| Content retrieval | [Unified Content System](unified-content-system.md) | [Unified Content Troubleshooting](unified-content-troubleshooting.md) |
| Migrate to unified system | [Migration Guide](unified-content-migration-guide.md) | [Unified Content System](unified-content-system.md) |
| Search documents | [CLI Reference](cli-reference.md) | [Model Guide](model-guide.md) |
| Choose embedding model | [Model Guide](model-guide.md) | [Configuration](configuration.md) |
| Configure for production | [Configuration Guide](configuration.md) | [Path Strategies](path-strategies.md) |
| Handle different file types | [Preprocessing Guide](preprocessing.md) | [Troubleshooting](troubleshooting.md) |
| Optimize performance | [Model Guide](model-guide.md) | [Troubleshooting](troubleshooting.md) |
| Deploy across environments | [Path Strategies](path-strategies.md) | [Configuration](configuration.md) |
| Integrate with applications | [API Reference](api-reference.md) | [Unified Content System](unified-content-system.md) |
| Resolve issues | [Troubleshooting Guide](troubleshooting.md) | All guides |

### Configuration Quick Links

- **Models**: [Model Guide](model-guide.md#configuration) → [Configuration](configuration.md#model-and-processing-settings)
- **Paths**: [Path Strategies](path-strategies.md#configuration) → [Configuration](configuration.md#path-storage-configuration)
- **Preprocessing**: [Preprocessing](preprocessing.md#configuration) → [Configuration](configuration.md#preprocessing-settings)
- **Environment Variables**: [Configuration](configuration.md#environment-variables)

### Troubleshooting Quick Links

- **Installation Issues**: [Troubleshooting](troubleshooting.md#installation-issues)
- **Model Problems**: [Troubleshooting](troubleshooting.md#model-issues) → [Model Guide](model-guide.md#troubleshooting)
- **Search Quality**: [Troubleshooting](troubleshooting.md#search-issues) → [Model Guide](model-guide.md#use-cases)
- **Performance**: [Troubleshooting](troubleshooting.md#performance-issues) → [Model Guide](model-guide.md#performance-comparison)
- **File Processing**: [Troubleshooting](troubleshooting.md#file-processing-issues) → [Preprocessing](preprocessing.md#troubleshooting)

## Contributing to Documentation

### Documentation Standards

- **Clear structure**: Use consistent headings and organization
- **Practical examples**: Include working code and command examples
- **Cross-references**: Link to related sections and guides
- **User-focused**: Write for the user's goals and context

### Updating Documentation

When updating RAG-lite TS:

1. **Update relevant guides** for new features
2. **Add examples** to demonstrate new functionality
3. **Update cross-references** if structure changes
4. **Test all examples** to ensure they work
5. **Update this index** if adding new guides

### Documentation Feedback

Found an issue or have suggestions? Please:

1. Check the [Troubleshooting Guide](troubleshooting.md) first
2. Search existing [GitHub issues](https://github.com/your-repo/rag-lite-ts/issues)
3. Create a new issue with:
   - Which guide has the problem
   - What you expected vs what you found
   - Suggestions for improvement

## External Resources

- **[Main Repository](https://github.com/your-repo/rag-lite-ts)** - Source code and issues
- **[NPM Package](https://www.npmjs.com/package/rag-lite-ts)** - Package information
- **[transformers.js](https://github.com/xenova/transformers.js)** - Underlying ML library
- **[Hugging Face Models](https://huggingface.co/models)** - Available embedding models

---

This documentation is designed to be comprehensive yet accessible. Start with the guide that matches your immediate needs, then explore related guides as you become more familiar with RAG-lite TS.