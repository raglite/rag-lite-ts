# RAG-lite API Example

A simple example demonstrating how to use the RAG-lite TypeScript API for document indexing and semantic search.

## What This Example Does

This example shows the basic RAG-lite workflow using the simple constructor API:

1. **Create ingestion pipeline** using `new IngestionPipeline()` (simple constructor)
2. **Ingest documents** from the docs directory (processes README.md as sample content)
3. **Create search engine** using `new SearchEngine()` (simple constructor)
4. **Search** the indexed documents using semantic queries
5. **Display** search results with relevance scores and content snippets

The simple constructor API provides an intuitive interface that "just works" with sensible defaults while allowing configuration when needed.

## Running the Example

```bash
# Run the example (uses existing database if present)
node index.js

# Or use npm scripts
npm start

# Clean run (removes existing database and index files first)
npm run clean
```

## Expected Output

The example will:
- Index the document using RAG-lite's ingestion pipeline
- Run several sample search queries:
  - "How to install raglite?"
  - "What embedding models are supported?"
  - "TypeScript API usage examples"
  - "MCP server integration"

Each search shows the top 3 results with relevance scores and content snippets.

## Key API Components

### IngestionPipeline
```javascript
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin');
await ingestion.ingestDirectory('./docs/');
```
Creates an ingestion pipeline and processes documents from a directory. The constructor handles embedding model initialization automatically.

### SearchEngine
```javascript
const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search(query, { top_k: 3 });
```
Creates a search engine and performs semantic search over indexed documents. The constructor automatically detects and loads the correct embedding model.

### Search Results Structure
```javascript
interface SearchResult {
  content: string;        // The text content of the chunk
  score: number;          // Relevance score (0-1, higher is better)
  contentType: string;    // Content type (e.g., "text")
  document: {
    id: number;           // Document ID
    source: string;       // File path
    title: string;        // Document title
    contentType: string;  // Document content type
  };
  metadata?: Record<string, any>; // Optional metadata
}
```

## Sample Search Queries

Try these queries to explore the indexed README content:

- **Installation**: "npm install", "getting started", "quick start"
- **Features**: "local first", "semantic search", "typescript"
- **Models**: "embedding models", "MiniLM", "mpnet", "dimensions"
- **CLI**: "command line", "ingest", "search options"
- **API**: "programmatic usage", "SearchEngine", "IngestionPipeline"
- **Configuration**: "config file", "environment variables"
- **Performance**: "speed", "memory usage", "requirements"

## Files Created

After running this example, you'll see:
- `db.sqlite` - Document metadata and chunks
- `vector-index.bin` - Vector embeddings for search

## Next Steps

- Try indexing your own documents by placing them in the `docs/` folder
- Experiment with different search queries
- Explore the CLI commands for more advanced usage
- Check out the main README.md for comprehensive documentation