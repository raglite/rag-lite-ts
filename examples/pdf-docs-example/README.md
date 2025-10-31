# RAG-lite PDF & DOCX Example

This example demonstrates RAG-lite's unified content system with PDF and DOCX document processing, showing both filesystem and memory-based ingestion with format-adaptive content retrieval.

## What This Example Does

This example showcases RAG-lite's enhanced document processing capabilities:

1. **Create ingestion pipeline** using `new IngestionPipeline()` (simple constructor)
2. **Ingest PDF and DOCX documents** from filesystem and memory
3. **Create search engine** using `new SearchEngine()` (simple constructor)
4. **Search** across all document formats using semantic queries
5. **Retrieve content** in different formats (file paths vs base64)
6. **Display** enhanced search results with content IDs and retrieval options

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

# Clean up .raglite directory only
npm run clean

# Clean and run (removes .raglite directory then runs example)
npm run clean:run
```

## Expected Output

The example demonstrates:
- **Filesystem ingestion**: Process PDF and DOCX files from the example-docs directory
- **Memory ingestion**: Ingest content directly from buffers (simulated agent content)
- **Enhanced search**: Run semantic queries with content ID tracking
- **Content retrieval**: Demonstrate both file path and base64 content access
- **Batch operations**: Efficiently retrieve multiple content items

Sample search queries include:
- "documentation and examples"
- "PDF processing capabilities" 
- "text extraction methods"
- "file format support"

Each search shows results with content IDs and demonstrates different content retrieval formats.

## Key API Components

### Standardized Path Setup
```javascript
import { getStandardRagLitePaths } from 'rag-lite-ts';

// Get standardized .raglite paths
const paths = getStandardRagLitePaths(); // Uses current directory
// Results in: .raglite/db.sqlite, .raglite/index.bin, .raglite/content/
```

### IngestionPipeline
```javascript
// Filesystem ingestion with standardized paths
const pipeline = new IngestionPipeline(paths.dbPath, paths.indexPath);
await pipeline.ingestDirectory('./docs/');

// Memory ingestion (new unified content system)
const content = Buffer.from('Document content from agent');
await pipeline.ingestFromMemory(content, {
  displayName: 'agent-document.txt',
  contentType: 'text/plain'
});
```
Creates an ingestion pipeline supporting both filesystem and memory-based content ingestion.

### SearchEngine
```javascript
// Search with standardized paths
const searchEngine = new SearchEngine(paths.indexPath, paths.dbPath);
const results = await searchEngine.search(query, { top_k: 3 });

// Content retrieval in different formats
const contentId = results[0].document.contentId;
const filePath = await searchEngine.getContent(contentId, 'file');     // For CLI clients
const base64Data = await searchEngine.getContent(contentId, 'base64'); // For MCP clients
```
Creates a search engine with format-adaptive content retrieval capabilities.

### Enhanced Search Results Structure
```javascript
interface SearchResult {
  content: string;        // The text content extracted from the document
  score: number;          // Relevance score (0-1, higher is better)
  contentType: string;    // Content type (e.g., "text")
  document: {
    id: number;           // Document ID
    source: string;       // File path or display name
    title: string;        // Document title (extracted from document)
    contentType: string;  // Document content type
    contentId?: string;   // NEW: Content ID for retrieval (memory-ingested content)
  };
  metadata?: Record<string, any>; // Optional metadata
}
```

**Note**: Content IDs are available for both filesystem and memory-ingested content, enabling unified content retrieval across all sources.

## Supported Document Formats

RAG-lite supports the following document formats:

- **PDF** (`.pdf`) - Text extraction using pdf-parse
- **DOCX** (`.docx`) - Text extraction using mammoth
- **Markdown** (`.md`) - Native support
- **Text** (`.txt`) - Native support
- **MDX** (`.mdx`) - Markdown with JSX components

## Document Processing Features

### Core Processing
- **Text Extraction**: Automatically extracts text content from binary formats
- **Metadata Preservation**: Maintains document titles and source information
- **Unified Search**: Search across all formats with a single query
- **Format-Agnostic Results**: Results include content regardless of original format

### Unified Content System
- **Dual Storage Strategy**: Efficient handling of filesystem and memory content
- **Content Deduplication**: Automatic deduplication for memory-ingested content
- **Format-Adaptive Retrieval**: Serve content as file paths or base64 based on client needs
- **Batch Operations**: Efficient retrieval of multiple content items
- **MCP Integration**: Seamless integration with AI agents and MCP servers

## Sample Search Queries

Try these queries to explore the indexed documents:

- **General**: "documentation", "examples", "overview"
- **Technical**: "processing", "extraction", "format support"
- **Specific**: "PDF capabilities", "DOCX handling", "text analysis"
- **Content System**: "memory ingestion", "content retrieval", "agent integration"

## Files Created

After running this example, you'll see:

### Standardized .raglite Directory Structure
```
.raglite/
├── db.sqlite                    # Document metadata and chunks from all formats
├── index.bin                    # Vector embeddings for semantic search
└── content/                     # Directory for memory-ingested content
    └── {contentId}.md          # Memory-ingested content files
```

### Architecture Notes
- **Standardized structure** follows RAG-lite design specification
- **Filesystem content** (PDF, DOCX) remains in original locations
- **Memory content** (from agents, APIs) stored in `.raglite/content/`
- **Database and index** centralized in `.raglite/` directory
- **No duplication** for filesystem content, efficient storage for memory content

## Next Steps

### Basic Usage
- Add your own PDF and DOCX files to the `example-docs/` folder
- Experiment with different search queries
- Try the configuration options for custom processing settings

### Advanced Features
- Implement memory-based ingestion for AI agent workflows
- Use content retrieval APIs for enhanced applications
- Integrate with MCP servers for agent-based document processing
- Explore batch content operations for performance optimization

### Integration Examples
- **CLI Applications**: Use file-based content retrieval
- **Web Applications**: Use base64 content retrieval for embedded display
- **AI Agents**: Combine memory ingestion with content retrieval
- **MCP Servers**: Leverage format-adaptive content serving