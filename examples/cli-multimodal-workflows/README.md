# CLI Multimodal Workflows Examples

This directory contains practical examples demonstrating how to use the RAG-lite CLI for multimodal workflows, including text-only mode, multimodal mode, and cross-modal search capabilities.

## Overview

RAG-lite supports two distinct modes:
- **Text Mode**: Optimized for text-only content with sentence-transformer models
- **Multimodal Mode**: Unified CLIP embedding space for text and image content with cross-modal search

## Quick Start

### Text Mode (Default)
```bash
# Ingest text documents
raglite ingest ./docs/

# Search text content
raglite search "machine learning tutorial"
```

### Multimodal Mode
```bash
# Ingest mixed content (text + images)
raglite ingest ./content/ --mode multimodal --model Xenova/clip-vit-base-patch32

# Search across text and images
raglite search "red sports car"

# Filter to only images
raglite search "red sports car" --content-type image
```

## Examples in This Directory

1. **`text-mode-workflow.sh`** - Complete text-only workflow
2. **`multimodal-ingestion.sh`** - Multimodal content ingestion
3. **`cross-modal-search.sh`** - Cross-modal search examples
4. **`content-type-filtering.sh`** - Filtering results by content type
5. **`advanced-workflows.sh`** - Advanced usage patterns

## Prerequisites

- RAG-lite installed: `npm install -g rag-lite-ts`
- Sample content (provided in `sample-content/` directory)

## Sample Content Structure

```
sample-content/
├── text/
│   ├── machine-learning.md
│   ├── web-development.md
│   └── data-science.txt
└── images/
    ├── red-car.jpg
    ├── blue-ocean.jpg
    └── mountain-sunset.jpg
```

## Running the Examples

Each script is self-contained and can be run independently:

```bash
# Make scripts executable (Unix/Mac)
chmod +x *.sh

# Run an example
./text-mode-workflow.sh

# Or run with bash
bash multimodal-ingestion.sh
```

For Windows users, PowerShell equivalents are provided with `.ps1` extension.

## Learn More

- [CLI Reference](../../docs/cli-reference.md)
- [Multimodal Tutorial](../../docs/multimodal-tutorial.md)
- [Configuration Guide](../../docs/configuration.md)
