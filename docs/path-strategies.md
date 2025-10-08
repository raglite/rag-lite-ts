# Path Storage Strategies

Complete guide to document path storage strategies in RAG-lite TS for portable and flexible document indexing.

## Table of Contents

- [Overview](#overview)
- [Path Strategies](#path-strategies)
- [Configuration](#configuration)
- [Use Cases](#use-cases)
- [Migration](#migration)
- [Best Practices](#best-practices)

## Overview

RAG-lite TS supports flexible path storage strategies to make your document indexes portable across different environments and suitable for various deployment scenarios.

### Why Path Strategies Matter

- **Portability**: Move indexes between machines and environments
- **Team Collaboration**: Consistent paths for all team members
- **URL Generation**: Convert document paths to web URLs
- **Version Control**: Stable paths regardless of checkout location
- **Deployment**: Adapt to different server configurations

## Path Strategies

### Relative Paths (Default - Recommended)

Stores document paths relative to the ingestion directory, making indexes portable across environments.

**How it works:**
- Calculates paths relative to the ingestion base directory
- Stores only the relative portion in the database
- Reconstructs full paths when needed for file operations

**Example:**
```bash
# Ingesting from /project/docs/
raglite ingest ./docs/

# File: /project/docs/api/authentication.md
# Stored as: "api/authentication.md"
# Search results show: "api/authentication.md"
```

**Benefits:**
- ✅ **Portable**: Works across different machines and environments
- ✅ **Version control friendly**: Same paths regardless of checkout location
- ✅ **Team collaboration**: Consistent paths for all team members
- ✅ **URL generation**: Easy to convert to web URLs
- ✅ **Docker friendly**: Works with mounted volumes

### Absolute Paths (Legacy)

Stores complete system paths for backward compatibility with existing systems.

**How it works:**
- Stores the full file system path in the database
- No path transformation during storage or retrieval

**Example:**
```bash
# Ingesting from /project/docs/
raglite ingest ./docs/ --path-strategy absolute

# File: /project/docs/api/authentication.md
# Stored as: "/project/docs/api/authentication.md"
# Search results show: "/project/docs/api/authentication.md"
```

**Benefits:**
- ✅ **Direct file access**: No path reconstruction needed
- ✅ **Legacy compatibility**: Works with existing absolute-path systems
- ✅ **Debugging**: Clear file locations in results

**Limitations:**
- ❌ **Not portable**: Breaks when moved between systems
- ❌ **Environment specific**: Different paths on different machines
- ❌ **Version control issues**: Paths vary by checkout location

## Configuration

### CLI Configuration

**Use relative paths (default):**
```bash
raglite ingest ./docs/
# or explicitly
raglite ingest ./docs/ --path-strategy relative
```

**Use absolute paths:**
```bash
raglite ingest ./docs/ --path-strategy absolute
```

**Custom base directory for relative paths:**
```bash
raglite ingest ./docs/ --path-strategy relative --path-base /project
```

### Environment Variables

```bash
# Set default strategy
export RAG_PATH_STORAGE_STRATEGY="relative"  # or "absolute"

# Use with ingestion
raglite ingest ./docs/
```

### Configuration File

```javascript
// raglite.config.js
export const config = {
  path_storage_strategy: 'relative',  // 'relative' or 'absolute'
  
  // Other settings
  embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
  db_file: 'db.sqlite',
  index_file: 'vector-index.bin'
};
```

### Programmatic Configuration

```typescript
import { IngestionPipeline, initializeEmbeddingEngine } from 'rag-lite-ts';

const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./', embedder);

// Configure path storage strategy
pipeline.setPathStorageStrategy('relative', '/project/base');

// Ingest with custom path handling
await pipeline.ingestDirectory('./docs/');
```

## Use Cases

### Web Documentation Mirroring

Perfect for local mirrors of web documentation that need URL generation:

```bash
# Ingest local mirror of web docs
raglite ingest ./local-docs/ --path-strategy relative

# Search returns relative paths
raglite search "authentication"
# Result: "api/authentication.md"

# In your application, convert to web URLs:
# Base URL: "https://docs.example.com/"
# Document path: "api/authentication.md"
# Final URL: "https://docs.example.com/api/authentication.md"
```

**Implementation example:**
```typescript
import { SearchEngine } from 'rag-lite-ts';

const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search('authentication');

// Convert relative paths to URLs
const webResults = results.map(result => ({
  ...result,
  url: `https://docs.example.com/${result.document.source}`
}));
```

### Multi-Environment Deployment

Consistent paths across development, staging, and production:

```bash
# Development environment
cd ~/dev/project/
raglite ingest ./docs/ --path-strategy relative
# Paths: "api/auth.md", "guides/setup.md"

# Production environment  
cd /var/www/project/
raglite ingest ./docs/ --path-strategy relative
# Same paths: "api/auth.md", "guides/setup.md"
```

### Team Collaboration

Consistent results regardless of where team members check out the code:

```bash
# Team member A (Windows)
C:\Users\alice\project> raglite ingest ./docs/ --path-strategy relative

# Team member B (macOS)  
/Users/bob/project$ raglite ingest ./docs/ --path-strategy relative

# Team member C (Linux)
/home/charlie/project$ raglite ingest ./docs/ --path-strategy relative

# All get identical relative paths in search results
```

### Docker Deployments

Works seamlessly with mounted volumes:

```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install -g rag-lite-ts

# Docker run with volume mount
# docker run -v /host/docs:/app/docs myapp
# raglite ingest ./docs/ --path-strategy relative
# Paths work regardless of host directory structure
```

### Legacy System Integration

For systems that require absolute paths:

```bash
# Legacy system expects full paths
raglite ingest ./docs/ --path-strategy absolute

# Search results include full system paths
raglite search "config"
# Result: "/var/www/project/docs/config/settings.md"
```

### Content Management Systems

Different strategies for different content types:

```bash
# Public documentation (relative for URLs)
raglite ingest ./public-docs/ --path-strategy relative --db public.sqlite

# Internal documentation (absolute for direct access)
raglite ingest ./internal-docs/ --path-strategy absolute --db internal.sqlite
```

## Migration

### From Absolute to Relative Paths

1. **Export existing data** (optional backup):
```bash
# Backup current database
cp db.sqlite db-absolute-backup.sqlite
```

2. **Change configuration**:
```bash
export RAG_PATH_STORAGE_STRATEGY="relative"
```

3. **Rebuild and re-ingest**:
```bash
raglite rebuild
raglite ingest ./docs/
```

### From Relative to Absolute Paths

1. **Change configuration**:
```bash
export RAG_PATH_STORAGE_STRATEGY="absolute"
```

2. **Rebuild and re-ingest**:
```bash
raglite rebuild
raglite ingest ./docs/
```

### Changing Base Directory

For relative paths, you can change the base directory:

```bash
# Current setup with base /old/project
raglite ingest ./docs/ --path-strategy relative --path-base /old/project

# Migrate to new base /new/project
raglite ingest ./docs/ --path-strategy relative --path-base /new/project
```

## Best Practices

### Choosing a Strategy

**Use Relative Paths When:**
- ✅ Building portable applications
- ✅ Working in teams with different environments
- ✅ Deploying across multiple environments
- ✅ Generating web URLs from document paths
- ✅ Using version control systems
- ✅ Working with Docker containers

**Use Absolute Paths When:**
- ✅ Integrating with legacy systems
- ✅ Single-machine deployments
- ✅ Direct file system access required
- ✅ Debugging and development (clearer paths)

### Configuration Management

**Project-level defaults:**
```javascript
// raglite.config.js - committed to version control
export const config = {
  path_storage_strategy: 'relative',  // Team default
  // ... other settings
};
```

**Environment-specific overrides:**
```bash
# .env.development
RAG_PATH_STORAGE_STRATEGY=relative

# .env.production  
RAG_PATH_STORAGE_STRATEGY=relative

# .env.legacy
RAG_PATH_STORAGE_STRATEGY=absolute
```

### URL Generation Patterns

**Static site generators:**
```typescript
// Convert relative paths to site URLs
const baseUrl = 'https://docs.mysite.com';
const searchResults = await searchEngine.search(query);

const urlResults = searchResults.map(result => ({
  ...result,
  url: `${baseUrl}/${result.document.source}`,
  // "api/auth.md" → "https://docs.mysite.com/api/auth.md"
}));
```

**API endpoints:**
```typescript
// Convert to API endpoints
const apiBase = '/api/docs';
const searchResults = await searchEngine.search(query);

const apiResults = searchResults.map(result => ({
  ...result,
  endpoint: `${apiBase}/${result.document.source}`,
  // "guides/setup.md" → "/api/docs/guides/setup.md"
}));
```

### Testing Strategies

**Test both strategies:**
```bash
# Test relative paths
raglite ingest ./test-docs/ --path-strategy relative --db test-rel.sqlite
raglite search "test" --db test-rel.sqlite

# Test absolute paths  
raglite ingest ./test-docs/ --path-strategy absolute --db test-abs.sqlite
raglite search "test" --db test-abs.sqlite

# Compare results and choose based on requirements
```

### Performance Considerations

Both strategies have similar performance characteristics:
- **Storage**: Relative paths are typically shorter (less storage)
- **Processing**: No significant difference in search speed
- **Memory**: Minimal difference in memory usage

### Troubleshooting

**Problem**: Paths not working after environment change
```bash
# Check current strategy
raglite search "test" | head -5

# If using absolute paths, switch to relative
export RAG_PATH_STORAGE_STRATEGY="relative"
raglite rebuild
raglite ingest ./docs/
```

**Problem**: URLs not generating correctly
```bash
# Ensure using relative paths for URL generation
raglite ingest ./docs/ --path-strategy relative

# Verify relative paths in results
raglite search "test" | grep "Source:"
# Should show: "Source: api/auth.md" (not "/full/path/api/auth.md")
```

**Problem**: File not found errors
```bash
# Check if files moved or paths changed
# For relative paths, ensure ingesting from correct base directory
# For absolute paths, verify files still exist at stored locations
```

This guide covers all aspects of path storage strategies. Choose relative paths for most use cases, especially when portability and URL generation are important.