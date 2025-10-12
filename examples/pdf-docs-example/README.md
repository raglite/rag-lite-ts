# RAG-lite PDF & DOCX Example

This example demonstrates RAG-lite's support for PDF and DOCX document processing, showing how to ingest and search across multiple document formats.

## What This Example Does

This example shows RAG-lite's multi-format document processing:

1. **Create ingestion pipeline** using `new IngestionPipeline()` (simple constructor)
2. **Ingest PDF and DOCX documents** from the example-docs directory
3. **Create search engine** using `new SearchEngine()` (simple constructor)
4. **Search** across all document formats using semantic queries
5. **Display** search results with relevance scores and content snippets

## Sample Documents

The example includes:
- `sample-document.pdf` - A sample PDF document
- `raglite.docx` - A sample DOCX document

These demonstrate RAG-lite's ability to extract and index text from different document formats.

## Running the Example

```bash
# Install dependencies
npm install

# Run the example (uses existing database if present)
npm start

# Clean run (removes existing database and index files first)
npm run clean
```

## Expected Output

The example will:
- Process PDF and DOCX files from the example-docs directory
- Create embeddings for text extracted from both formats
- Run several sample search queries:
  - "documentation and examples"
  - "PDF processing capabilities" 
  - "text extraction methods"
  - "file format support"

Each search shows the top 3 results with relevance scores and content snippets from both PDF and DOCX sources.

## Key API Components

### IngestionPipeline
```javascript
const pipeline = new IngestionPipeline('./db.sqlite', './vector-index.bin');
await pipeline.ingestDirectory('./docs/');
```
Creates an ingestion pipeline that can process multiple document formats including PDF, DOCX, MD, TXT, and MDX.

### SearchEngine
```javascript
const searchEngine = new SearchEngine('./vector-index.bin', './db.sqlite');
const results = await searchEngine.search(query, { top_k: 3 });
```
Creates a search engine that can search across all ingested document formats seamlessly.

### Search Results Structure
```javascript
interface SearchResult {
  content: string;        // The text content extracted from the document
  score: number;          // Relevance score (0-1, higher is better)
  contentType: string;    // Content type (e.g., "text")
  document: {
    id: number;           // Document ID
    source: string;       // File path (shows .pdf or .docx extension)
    title: string;        // Document title (extracted from document)
    contentType: string;  // Document content type
  };
  metadata?: Record<string, any>; // Optional metadata
}
```

## Supported Document Formats

RAG-lite supports the following document formats:

- **PDF** (`.pdf`) - Text extraction using pdf-parse
- **DOCX** (`.docx`) - Text extraction using mammoth
- **Markdown** (`.md`) - Native support
- **Text** (`.txt`) - Native support
- **MDX** (`.mdx`) - Markdown with JSX components

## Document Processing Features

- **Text Extraction**: Automatically extracts text content from binary formats
- **Metadata Preservation**: Maintains document titles and source information
- **Unified Search**: Search across all formats with a single query
- **Format-Agnostic Results**: Results include content regardless of original format

## Sample Search Queries

Try these queries to explore the indexed documents:

- **General**: "documentation", "examples", "overview"
- **Technical**: "processing", "extraction", "format support"
- **Specific**: "PDF capabilities", "DOCX handling", "text analysis"

## Files Created

After running this example, you'll see:
- `example-docs/db.sqlite` - Document metadata and chunks from all formats
- `example-docs/vector-index.bin` - Vector embeddings for semantic search

## Next Steps

- Add your own PDF and DOCX files to the `example-docs/` folder
- Experiment with different search queries
- Try the configuration options for custom processing settings
- Explore the main CLI commands for larger document collections