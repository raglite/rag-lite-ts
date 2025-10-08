# RAG-lite API Example

A simple example demonstrating how to use the RAG-lite TypeScript API for document indexing and semantic search.

## What This Example Does

This example shows the basic RAG-lite workflow:

1. **Initialize** the embedding engine
2. **Ingest** documents (uses the main README.md as sample content)
3. **Search** the indexed documents using the API
4. **Display** search results with scores and snippets

## Running the Example

```bash
# Run the example
node index.js
```

## Expected Output

The example will:
- Index the document using RAG-lite's ingestion pipeline
- Run several sample search queries:
  - "How to install raglite?"
  - "What embedding models are supported?"
  - "TypeScript API usage examples"
  - "MCP server integration"

Each search shows the top 3 results with relevance scores and text snippets.

## Key API Components

### EmbeddingEngine
```javascript
const embedder = await initializeEmbeddingEngine();
```
Initializes the embedding model (downloads if needed).

### IngestionPipeline
```javascript
const embedder = await initializeEmbeddingEngine();
const pipeline = new IngestionPipeline('./', embedder);
await pipeline.ingestDirectory('./docs/');
```
Processes and indexes documents from a directory.

### SearchEngine
```javascript
const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search(query, { top_k: 3 });
```
Performs semantic search over indexed documents.

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