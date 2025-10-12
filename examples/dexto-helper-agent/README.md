# RAG-lite TS Example Agent

A comprehensive example demonstrating how to use RAG-lite TS for semantic search over documentation with local-first AI agent systems like Dexto. This example showcases RAG-lite's capabilities for indexing nested markdown documentation and integrating with agent frameworks through MCP (Model Context Protocol).

## What This Example Demonstrates

- **🔍 Semantic Documentation Search**: Using RAG-lite TS with all-mpnet-base-v2 model for high-quality semantic search
- **📁 Nested Folder Indexing**: Demonstrates indexing of nested markdown files in the `docs/` folder structure
- **🤖 Agent Integration**: Shows how RAG-lite integrates seamlessly with local-first agent systems like Dexto
- **🔧 MCP Server Usage**: Advanced MCP server integration patterns for AI agent communication
- **⚙️ Model Selection**: Practical example of using higher-quality embedding models for better search results
- **🏠 Local-First Search**: RAG-lite operates locally while agent uses external LLM APIs (OpenAI, Gemini, etc.)
- **📚 Documentation Retrieval**: Efficient retrieval of relevant documentation chunks for agent responses
- **🛠️ Production Patterns**: Real-world configuration and deployment patterns

## Quick Start

1. **Prerequisites**: 
   - **For published version**: Install RAG-lite TS: `npm install -g rag-lite-ts`
   - **For development**: Build and link RAG-lite TS from source:
     ```bash
     cd ../../  # Go to rag-lite-ts root
     npm install
     npm run build
     npm link    # Makes raglite-mcp available globally
     cd examples/dexto-helper-agent
     ```
   - Install Dexto CLI (optional): `npm install -g dexto`
   - Set your LLM API key: `export OPENAI_API_KEY="your-key-here"` (or Gemini: `export GOOGLE_API_KEY="your-key"`)

2. **Index the Documentation**:
   ```bash
   # Index the nested docs folder using the high-quality all-mpnet-base-v2 model
   raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2
   ```

3. **Run the Agent**:
   ```bash
   dexto --agent ./dexto-helper-agent.yml
   ```

4. **Test RAG-lite Search** (see [example-queries.md](./example-queries.md) for comprehensive examples):
   - **Configuration**: "How do I configure RAG-lite for different embedding models?"
   - **Indexing**: "Show me how to index nested documentation folders"
   - **Integration**: "How does RAG-lite integrate with agent systems?"
   - **Performance**: "What are the performance characteristics of different models?"
   - **MCP Usage**: "How do I use RAG-lite as an MCP server?"

## How It Works

This example demonstrates RAG-lite TS integration patterns:
- **RAG-lite Indexing**: Uses `Xenova/all-mpnet-base-v2` model for high-quality 768-dimensional embeddings
- **Nested Documentation**: Indexes the complete `docs/` folder structure including subdirectories
- **MCP Server Integration**: RAG-lite runs as an MCP server providing search capabilities to the agent
- **Local-First Search**: RAG-lite indexing and search happens locally, while LLM responses require external API access
- **Agent Communication**: Dexto agent communicates with RAG-lite through MCP protocol for document retrieval
- **Semantic Search**: Vector similarity search enables meaning-based document retrieval beyond keyword matching

## Files Included

- `dexto-helper-agent.yml` - Dexto agent configuration with RAG-lite MCP integration
- `docs/` - Nested documentation folder structure for indexing
- `db.sqlite` - RAG-lite documentation database (generated after indexing)
- `vector-index.bin` - RAG-lite vector search index (generated after indexing)
- `example-queries.md` - Sample questions demonstrating RAG-lite capabilities
- `raglite.config.js` - RAG-lite configuration with all-mpnet-base-v2 model settings

## Configuration Highlights

### RAG-lite Configuration (`raglite.config.js`)
- **High-Quality Model**: Uses `Xenova/all-mpnet-base-v2` for 768-dimensional embeddings
- **Optimized Settings**: Automatic configuration for chunk size (400 tokens) and batch size (8)
- **Local Storage**: SQLite database and hnswlib vector index for fast local search
- **Preprocessing**: Balanced mode for handling markdown with code blocks and diagrams

### Agent Configuration (`dexto-helper-agent.yml`)
- **MCP Integration**: Connects to RAG-lite MCP server for document search capabilities
- **System Prompts**: Specialized prompts for documentation retrieval and response formatting
- **Local-First Search**: No external API dependencies for document indexing and search
- **Flexible LLM Support**: Works with OpenAI, Google, or other LLM providers for response generation

## Example Usage

```bash
# 1. Index your documentation with RAG-lite
raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2

# 2. Start the RAG-lite MCP server (in background)
raglite-mcp &

# 3. Start the agent
dexto --agent ./dexto-helper-agent.yml

# The system will automatically:
# 1. Load the RAG-lite configuration
# 2. Connect to the RAG-lite MCP server
# 3. Enable semantic search over your indexed documentation
# 4. Provide intelligent responses using retrieved context
```

### Direct RAG-lite Usage

```bash
# Test search directly with RAG-lite CLI
raglite search "configuration options" --top-k 5 --rerank

# Rebuild index if needed
raglite rebuild

# Check index statistics
raglite-mcp  # Provides get_stats tool via MCP
```

## Key Features

- ✅ **Local-First Search**: Document indexing and search operates locally (LLM responses require API access)
- ✅ **High-Quality Embeddings**: Uses all-mpnet-base-v2 model for superior semantic understanding
- ✅ **Nested Folder Support**: Automatically indexes complex documentation hierarchies
- ✅ **Fast Retrieval**: Sub-100ms search queries with hnswlib vector index
- ✅ **MCP Integration**: Seamless integration with agent systems through Model Context Protocol
- ✅ **Flexible Configuration**: Easy model switching and parameter tuning
- ✅ **Production Ready**: Battle-tested patterns for real-world agent deployments
- ✅ **Agent Agnostic**: Works with Dexto, Claude Desktop, or any MCP-compatible system

## Learning Outcomes

By studying this comprehensive example, you'll learn:

### **RAG-lite TS Fundamentals**
- How to configure and use different embedding models effectively
- Best practices for indexing nested documentation structures
- Understanding the trade-offs between model quality and performance
- Local-first architecture patterns for semantic search

### **MCP Integration Patterns**
- How to set up RAG-lite as an MCP server for agent communication
- Configuring agent systems to consume RAG-lite search capabilities
- Error handling and connection management for MCP services
- Production deployment patterns for MCP-based architectures

### **Agent System Integration**
- Integrating RAG-lite with local-first agent frameworks like Dexto
- Designing system prompts that effectively use retrieved context
- Balancing retrieval quality with response generation speed
- Managing document updates and index maintenance

### **Performance Optimization**
- Choosing appropriate embedding models for your use case
- Optimizing chunk sizes and search parameters for your content
- Managing memory usage and storage requirements
- Monitoring and debugging search quality issues

### **Production Deployment**
- Setting up reliable indexing pipelines for documentation updates
- Configuring robust MCP server deployments
- Managing model downloads and caching in production environments
- Scaling RAG-lite for larger document collections

## RAG-lite TS Capabilities Demonstrated

This example showcases RAG-lite TS's key capabilities:
- **Semantic Search** - Meaning-based document retrieval using high-quality embeddings
- **Local-First Search** - Document indexing and retrieval operates locally (LLM inference requires external APIs)
- **Flexible Model Support** - Easy switching between embedding models based on quality/speed needs
- **Nested Indexing** - Automatic discovery and indexing of complex folder structures
- **MCP Protocol** - Standard integration with modern agent systems and AI tools
- **Production Patterns** - Real-world configuration and deployment strategies
- **Agent Integration** - Seamless integration with local-first agent frameworks

## Integration with Agent Systems

RAG-lite TS is designed to work effectively with various local-first agent systems:

### **Dexto Integration**
- Configuration-driven agent setup with RAG-lite MCP server
- Declarative YAML configuration for search capabilities
- Multi-contributor system prompts leveraging retrieved context

### **Claude Desktop Integration**
- Direct MCP server configuration in Claude Desktop settings
- Real-time document search during conversations
- Context-aware responses using retrieved documentation

### **Custom Agent Systems**
- Standard MCP protocol for universal compatibility
- RESTful API endpoints for non-MCP integrations
- Programmatic TypeScript API for custom implementations

This example demonstrates how RAG-lite TS enables sophisticated document-aware AI agents with local document processing while using external LLM APIs (OpenAI, Gemini, etc.) for response generation.

## Troubleshooting

### "raglite-mcp command not found" Error

If you get this error when running Dexto:

```bash
# For development setup
cd ../../  # Go to rag-lite-ts root
npm run build
npm link

# For published version
npm install -g rag-lite-ts
```

### MCP Server Connection Issues

1. **Verify raglite-mcp works**: `raglite-mcp --help`
2. **Check database exists**: Ensure `db.sqlite` and `vector-index.bin` exist
3. **Re-index if needed**: `raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2`
4. **Check environment variables**: Verify paths in dexto-helper-agent.yml match your file locations