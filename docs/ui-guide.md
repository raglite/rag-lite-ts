# UI Guide

*Web-based interface for RAG-lite TS - Visual ingestion and search*

Complete guide to using the RAG-lite TS web interface for document ingestion and semantic search through your browser.

## Table of Contents

- [Introduction](#introduction)
- [Installation & Setup](#installation--setup)
- [Quick Start](#quick-start)
- [Ingestion Tab](#ingestion-tab)
- [Search Tab](#search-tab)
- [Advanced Features](#advanced-features)
- [Comparison: UI vs CLI](#comparison-ui-vs-cli)
- [Troubleshooting](#troubleshooting)

## Introduction

The RAG-lite TS UI provides a modern web-based interface for managing your semantic search knowledge base. It offers the same powerful features as the CLI but with a visual, interactive experience.

### What is the UI?

The UI consists of two main components:
- **Frontend**: React-based web interface (Vite + TypeScript)
- **Backend**: Express API server that interfaces with the RAG-lite TS core library

Both components run locally on your machine - your data never leaves your computer.

### When to Use UI vs CLI

**Use the UI when:**
- You prefer visual interfaces over command-line
- You want to see real-time ingestion progress
- You need to upload files interactively
- You want to search with image uploads
- You're exploring or learning the system

**Use the CLI when:**
- You're scripting or automating workflows
- You need batch processing
- You're working in headless environments
- You prefer terminal-based workflows
- You're integrating with other tools

### Architecture Overview

```
┌─────────────────┐
│   Browser       │
│  (Frontend)     │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Express API     │
│  (Backend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RAG-lite TS     │
│  Core Library    │
└─────────────────┘
```

The UI backend uses the same core library as the CLI, ensuring feature parity and consistent behavior.

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- RAG-lite TS installed globally: `npm install -g rag-lite-ts`
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Starting the UI

Simply run:

```bash
raglite ui
```

This command:
1. Starts the backend API server (default: port 3001)
2. Starts the frontend dev server (default: port 3000)
3. Opens your browser automatically (if configured)

### Port Configuration

By default:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`

If ports are in use, the UI will attempt to use alternative ports or show an error.

### First-Time Setup

1. **Launch the UI:**
   ```bash
   raglite ui
   ```

2. **Wait for servers to start:**
   You'll see output like:
   ```
   🚀 Launching RAG-lite TS UI...
   📡 Starting backend on port 3001...
   🎨 Starting frontend on port 3000...
   
   ✨ UI Access:
      Frontend: http://localhost:3000
      Backend:  http://localhost:3001
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000` (or the URL shown)

4. **Start ingesting:**
   Go to the "Ingest" tab and upload your first documents

### Working Directory

The UI uses the **current working directory** where you run `raglite ui` as the base for:
- Database file: `db.sqlite` (or `RAG_DB_FILE` env var)
- Index file: `vector-index.bin` (or `RAG_INDEX_FILE` env var)

**Tip:** Run `raglite ui` from the directory where you want your knowledge base files.

## Quick Start

### 1. Launch the UI

```bash
cd /path/to/your/documents
raglite ui
```

### 2. Ingest Your First Document

1. Click the **"Ingest"** tab
2. Drag and drop a file (or click to select)
3. Configure options (or use defaults):
   - **Mode**: Text (for documents) or Multimodal (for text + images)
   - **Model**: Choose based on your needs
4. Click **"Start Ingestion"**
5. Watch real-time progress

### 3. Perform Your First Search

1. Click the **"Search"** tab
2. Type your query in the search box
3. Click **"Search"** or press Enter
4. View results with relevance scores

### 4. View Knowledge Base Stats

The **Knowledge Base Stats** card shows:
- Total documents and chunks
- Current model and dimensions
- Reranking status
- Content type distribution
- Database and index file locations

## Ingestion Tab

The Ingestion tab provides a visual interface for adding documents to your knowledge base.

### File Upload

#### Drag & Drop Interface

1. **Drag files** onto the upload area
2. **Or click** to open file picker
3. **Or select folder** using the folder button

**Supported file types:**
- **Text Mode**: `.md`, `.txt`, `.mdx`, `.pdf`, `.docx`
- **Multimodal Mode**: All text types + `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

#### Folder Upload

The UI supports uploading entire folder structures:
- Click the **folder icon** button
- Select a directory
- All supported files in the directory (and subdirectories) will be processed
- Folder structure is preserved in relative paths

#### Progress Tracking

During ingestion, you'll see:
- **Real-time progress**: Documents processed, chunks created, embeddings generated
- **Current file**: Which file is being processed
- **Errors**: Any files that failed to process
- **Time elapsed**: Total processing time

### Configuration Options

#### Basic Configuration

**Processing Mode:**
- **Text**: Optimized for text-only documents (faster, smaller models)
- **Multimodal**: Enables image processing and cross-modal search (CLIP models)

**Embedding Model:**
- **Text Mode Models:**
  - `sentence-transformers/all-MiniLM-L6-v2` (384D, fastest, default)
  - `Xenova/all-mpnet-base-v2` (768D, higher quality)
- **Multimodal Mode Models:**
  - `Xenova/clip-vit-base-patch32` (512D, balanced, default)
  - `Xenova/clip-vit-base-patch16` (512D, more accurate)

#### Advanced Configuration

**Chunk Configuration:**
- **Chunk Size**: Number of tokens per chunk (default: 250)
  - Larger chunks = more context, fewer chunks
  - Smaller chunks = more granular, more chunks
  - Recommended: 200-300 tokens
- **Chunk Overlap**: Tokens shared between adjacent chunks (default: ~20% of chunk size)
  - Ensures context continuity
  - Recommended: ~20% of chunk size

**Reranking Strategy:**
- **Text Mode:**
  - `cross-encoder`: Uses transformer models for improved relevance (default)
  - `disabled`: No reranking, vector similarity only
- **Multimodal Mode:**
  - `text-derived`: Converts images to text, then applies cross-encoder reranking (default)
  - `disabled`: No reranking, vector similarity only

**Note:** Reranking strategy is set during ingestion and cannot be changed at search time. If disabled during ingestion, reranking won't be available in search.

**Path Storage Strategy:**
- **Relative**: Paths stored relative to base directory (portable across systems)
- **Absolute**: Paths stored as absolute paths (system-specific but explicit)

**Preprocessing Options:**
- **MDX Processing**: Extract and process JSX components from MDX files
- **Mermaid Extraction**: Extract and process Mermaid diagrams from markdown

**Index Management:**
- **Force Rebuild**: ⚠️ **DESTRUCTIVE** - Wipes database and index, rebuilds from scratch
  - Use when switching models
  - Use when you want a clean rebuild
  - Shows confirmation dialog before proceeding

### Directory Ingestion

For ingesting local directories (server-side):

1. Enter the **directory path** in the "Local Directory" section
2. Path must be accessible by the server process
3. Click **"Ingest Path"**
4. All supported files in the directory will be processed

**Note:** Directory ingestion uses the same configuration options as file upload.

## Search Tab

The Search tab provides semantic search capabilities with support for both text and image queries.

### Text Search

#### Basic Text Search

1. Enter your query in the search box
2. Click **"Search"** or press Enter
3. Results appear below with:
   - Relevance score
   - Document title and source
   - Content preview
   - Metadata

#### Search Options

**Reranking:**
- Toggle to enable/disable reranking
- **Note:** Only available if reranking was enabled during ingestion
- Automatically disabled for image searches (preserves visual similarity)

**Results Count (topK):**
- Slider to adjust number of results (1-50)
- Default: 10 results

**Content Type Filter:**
- **All**: Search across all content types
- **Text**: Only text documents
- **Image**: Only images

**Custom Paths:**
- Optionally specify custom database and index paths
- Useful for working with multiple knowledge bases

### Image Search

#### Upload Image to Search

1. Click **"Image Search"** button
2. Select an image file
3. Image preview appears
4. Click **"Search"** to find similar content

#### How Image Search Works

- **Image-to-Image**: Finds visually similar images using CLIP embeddings
- **Image-to-Text**: Finds text documents that match the image content
- **Cross-Modal**: Works in unified embedding space (CLIP)

**Note:** Image search requires:
- Multimodal mode was used during ingestion
- CLIP model was used (not text-only models)

#### Image Search Behavior

- **Reranking is automatically disabled** for image searches
- This preserves visual similarity (CLIP embeddings are optimized for this)
- Text-to-image searches can still use reranking if enabled

### Search Results

Results are displayed with:

- **Relevance Score**: Higher = more relevant
- **Document Title**: From source file
- **Source Path**: File location
- **Content Preview**: Highlighted matching text
- **Content Type Badge**: Text or Image indicator
- **Metadata**: Additional file information

Click any result to see full content preview.

### Knowledge Base Stats

The **Knowledge Base Stats** card shows:

- **Documents**: Total number of documents ingested
- **Chunks**: Total number of text chunks created
- **Model**: Current embedding model and dimensions
- **Mode**: Text or Multimodal
- **Reranking**: Whether reranking is enabled
- **Created**: When the knowledge base was created
- **File Sizes**: Database and index file sizes
- **Content Types**: Distribution of text vs image content
- **Data Locations**: Paths to database and index files

## Advanced Features

### Custom Database/Index Paths

You can specify custom paths for database and index files:

1. Click the **settings icon** (⚙️) in Search tab
2. Expand **"Path Configuration"**
3. Enter custom paths:
   - **Database Path**: Custom SQLite file location
   - **Index Path**: Custom vector index file location
4. Paths can be absolute or relative to working directory

**Use cases:**
- Multiple knowledge bases
- Testing with separate databases
- Custom file locations

### Path Storage Strategies

**Relative Paths (Default):**
- Portable across systems
- Paths stored relative to base directory
- Good for: Development, portability

**Absolute Paths:**
- System-specific
- Explicit file locations
- Good for: Production, fixed deployments

### Working Directory Behavior

The UI respects the working directory where `raglite ui` was launched:

- Database and index files are created/accessed relative to this directory
- Environment variables (`RAG_DB_FILE`, `RAG_INDEX_FILE`) override defaults
- Directory ingestion paths are resolved from this directory

**Best Practice:** Always run `raglite ui` from the directory containing (or where you want) your knowledge base files.

### Theme Switching

The UI supports dark/light theme:
- Click the **theme toggle** button (moon/sun icon) in the header
- Preference is saved in browser local storage

## Comparison: UI vs CLI

### Feature Parity

| Feature | UI | CLI |
|---------|----|----|
| Text ingestion | ✅ | ✅ |
| Image ingestion | ✅ | ✅ |
| Text search | ✅ | ✅ |
| Image search | ✅ | ✅ |
| Reranking | ✅ | ✅ |
| Mode selection | ✅ | ✅ |
| Model selection | ✅ | ✅ |
| Configuration | ✅ | ✅ |
| Progress tracking | ✅ Visual | ✅ Console |
| Batch processing | ✅ | ✅ |

### UI Advantages

- **Visual feedback**: Real-time progress bars and stats
- **File upload**: Drag & drop interface
- **Image preview**: See images before searching
- **Interactive**: No need to remember command syntax
- **Exploratory**: Easy to try different configurations

### CLI Advantages

- **Scriptable**: Easy to automate and integrate
- **Headless**: Works without GUI
- **Faster**: No browser overhead
- **Terminal-friendly**: Works in remote sessions
- **Batch operations**: Better for large-scale processing

### When to Use Each

**Use UI for:**
- Learning and exploration
- Interactive document management
- Visual search with images
- Quick one-off operations
- When you prefer GUIs

**Use CLI for:**
- Automation and scripting
- CI/CD pipelines
- Server deployments
- Batch processing
- Terminal-based workflows

## Troubleshooting

### Server Won't Start

**Problem:** UI servers fail to start

**Solutions:**
1. **Check ports:**
   - Ensure ports 3000 and 3001 are available
   - Close other applications using these ports
   - Check firewall settings

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **Check dependencies:**
   ```bash
   cd ui/backend && npm install
   cd ../frontend && npm install
   ```

### Files Won't Upload

**Problem:** File upload fails or files are rejected

**Solutions:**
1. **Check file type:** Ensure file extension is supported
2. **Check file size:** Large files (>100MB) may fail
3. **Check browser:** Use modern browser (Chrome, Firefox, Edge, Safari)
4. **Check console:** Browser DevTools may show errors

### Search Returns No Results

**Problem:** Search queries return empty results

**Solutions:**
1. **Check ingestion:** Ensure documents were successfully ingested
2. **Check knowledge base stats:** Verify documents and chunks exist
3. **Check mode:** Ensure search mode matches ingestion mode
4. **Try different query:** Some queries may not match content

### Image Search Not Working

**Problem:** Image search fails or returns errors

**Solutions:**
1. **Check mode:** Must be in multimodal mode
2. **Check model:** Must use CLIP model (not text-only)
3. **Check ingestion:** Images must have been ingested in multimodal mode
4. **Check file format:** Supported: JPG, PNG, GIF, WebP, BMP

### Reranking Not Available

**Problem:** Reranking toggle is disabled or doesn't work

**Solutions:**
1. **Check ingestion:** Reranking must be enabled during ingestion
2. **Check mode:** Image searches automatically disable reranking
3. **Re-ingest:** If reranking was disabled, re-ingest with reranking enabled

### Performance Issues

**Problem:** UI is slow or unresponsive

**Solutions:**
1. **Check browser:** Close other tabs, clear cache
2. **Check file sizes:** Large files take longer to process
3. **Check model:** Larger models (MPNet, CLIP) are slower
4. **Check system resources:** Ensure sufficient RAM and CPU

### Database Lock Errors

**Problem:** "Database is locked" or "EBUSY" errors

**Solutions:**
1. **Close other instances:** Don't run multiple UI or CLI instances
2. **Wait for operations:** Let current ingestion/search complete
3. **Use force rebuild carefully:** May cause locks during reset
4. **Check file permissions:** Ensure write access to database file

### Browser Compatibility

**Supported Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Not Supported:**
- Internet Explorer
- Very old browser versions

### Getting Help

If issues persist:

1. **Check console:** Browser DevTools (F12) for errors
2. **Check backend logs:** Terminal output shows backend errors
3. **Check documentation:** See [Troubleshooting Guide](troubleshooting.md)
4. **Check GitHub issues:** Search for similar problems

## Next Steps

- **[CLI Reference](cli-reference.md)** - Learn command-line interface
- **[Multimodal Tutorial](multimodal-tutorial.md)** - Advanced multimodal workflows
- **[API Reference](api-reference.md)** - Programmatic integration
- **[Configuration Guide](configuration.md)** - Advanced configuration

---

**Note:** The UI is currently marked as "Experimental" and is actively being developed. Features may change between versions.
