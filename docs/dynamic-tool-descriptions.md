# Dynamic Tool Descriptions for MCP Server

## Overview

The RAG-lite MCP server features **dynamic tool descriptions** that automatically detect and advertise the actual capabilities of each database instance. This enables AI assistants to intelligently route queries to the appropriate database when running multiple MCP server instances.

## What It Does

Dynamic tool descriptions provide **self-documenting MCP servers** where each instance automatically:

1. **Detects its database mode** (text-only or multimodal) from stored configuration
2. **Analyzes content** to determine what types of documents are indexed
3. **Generates descriptive labels** that clearly indicate capabilities
4. **Advertises specific features** available for that database

This creates a seamless experience where AI assistants can make informed decisions about which database to query based on the user's request.

## How Tool Descriptions Adapt

### Text-Only Database
When connected to a text-only database, the tool description clearly indicates:
```
[TEXT MODE] Search indexed documents using semantic similarity. 
This database contains 150 text documents. Supports .md and .txt files only.
```

### Multimodal Database with Images
When connected to a multimodal database, the description advertises additional capabilities:
```
[MULTIMODAL MODE] Search indexed documents using semantic similarity. 
This database contains 200 documents. Contains both text and image content. 
Image results include base64-encoded data for display. 
Supports cross-modal search (text queries can find images).
```

### Uninitialized Database
For databases that haven't been populated yet:
```
Search indexed documents using semantic similarity. 
Database not initialized - ingest documents first.
```

## Key Benefits

### Intelligent Query Routing
AI assistants can automatically select the appropriate database based on the query:
- Image searches route to multimodal databases
- Text searches route to text-only databases
- No manual database selection needed

### Self-Documenting Servers
Each MCP server instance clearly communicates:
- What mode it's running in (text/multimodal)
- How many documents are indexed
- What content types are available
- What features are supported

### Seamless Multi-Instance Support
Run multiple databases simultaneously without confusion:
- Each server advertises its unique capabilities
- AI assistants understand what each database contains
- Users get relevant results without specifying which database to use

## Usage Example

### Setting Up Multiple Instances

Configure multiple MCP server instances in your MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "rag-lite-text-docs": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./text-docs/db.sqlite",
        "RAG_INDEX_FILE": "./text-docs/index.bin"
      }
    },
    "rag-lite-multimodal-images": {
      "command": "npx",
      "args": ["rag-lite-mcp"],
      "env": {
        "RAG_DB_FILE": "./mixed-content/db.sqlite",
        "RAG_INDEX_FILE": "./mixed-content/index.bin"
      }
    }
  }
}
```

### Intelligent Routing in Action

**Scenario 1: Image Search**

**User:** "Find images of architecture diagrams"

**What Happens:**
1. AI assistant sees both servers' tool descriptions
2. Recognizes `rag-lite-multimodal-images` has `[MULTIMODAL MODE]` with image support
3. Automatically routes query to the multimodal database
4. Returns relevant architecture diagram images

**Scenario 2: Text Search**

**User:** "Search the API documentation"

**What Happens:**
1. AI assistant sees both servers' tool descriptions
2. Recognizes `rag-lite-text-docs` has `[TEXT MODE]` with text documents
3. Automatically routes query to the text-only database
4. Returns relevant API documentation

## Use Cases

### Separating Content by Type
- **Text database**: Documentation, articles, code files
- **Multimodal database**: Technical diagrams, screenshots, visual content
- AI automatically chooses the right database based on query intent

### Organizing by Project
- **Project A database**: All content related to Project A
- **Project B database**: All content related to Project B
- **Shared docs database**: Common documentation
- AI routes queries to the appropriate project database

### Domain-Specific Knowledge Bases
- **Engineering docs**: Technical specifications and diagrams
- **Marketing content**: Product images and descriptions
- **Support articles**: Help documentation and tutorials
- AI selects the relevant domain based on the question

## Getting Started

To enable dynamic tool descriptions:

1. **Set up your databases** - Ingest content into separate databases with appropriate modes
2. **Configure multiple MCP servers** - Point each instance to a different database
3. **Start using** - AI assistants will automatically route queries based on tool descriptions

No additional configuration needed - the feature works automatically once you have multiple MCP server instances configured.

## Related Documentation

- [MCP Server Multimodal Guide](./mcp-server-multimodal-guide.md) - Complete guide to MCP server features
- [Running Multiple MCP Server Instances](./mcp-server-multimodal-guide.md#running-multiple-mcp-server-instances) - Detailed multi-instance setup
- Ready-to-use configuration examples

## Summary

Dynamic tool descriptions enable intelligent, automatic routing of queries across multiple RAG-lite databases. By clearly advertising each database's capabilities, AI assistants can seamlessly select the right knowledge base for each query, creating a powerful and intuitive multi-database search experience.
