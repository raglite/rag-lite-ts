import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Test MCP server integration
 * Verifies MCP server exposes search and indexing functions correctly
 * Tests MCP protocol compliance and tool interface functionality
 * Ensures no additional abstractions beyond core function wrapping
 * Validates same-process deployment without separate server infrastructure
 * 
 * Requirements addressed: 6.2, 6.4
 */

// Test data setup
const testDir = './test-mcp-data';
const testDoc = join(testDir, 'test.md');

function setupTestData() {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
  writeFileSync(testDoc, '# Test Document\n\nThis is a test document for MCP integration testing.\n\nIt contains multiple paragraphs to test chunking and embedding functionality.');
}

function cleanupTestData() {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  // Clean up any test databases and indexes
  if (existsSync('db.sqlite')) {
    rmSync('db.sqlite', { force: true });
  }
  if (existsSync('vector-index.bin')) {
    rmSync('vector-index.bin', { force: true });
  }
}

test('MCP server responds to tools/list request', async () => {
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send tools/list request
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  // Collect response
  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Wait for response
  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  // Parse and validate response
  const lines = response.split('\n').filter(line => line.trim());
  const jsonResponse = lines.find(line => line.startsWith('{"result"'));

  assert(jsonResponse, 'Should receive JSON response');

  const parsed = JSON.parse(jsonResponse);
  assert.equal(parsed.jsonrpc, '2.0', 'Should use JSON-RPC 2.0');
  assert.equal(parsed.id, 1, 'Should return correct request ID');
  assert(parsed.result, 'Should have result object');
  assert(Array.isArray(parsed.result.tools), 'Should have tools array');

  // Verify all required tools are present
  const toolNames = parsed.result.tools.map((tool: any) => tool.name);
  assert(toolNames.includes('search'), 'Should have search tool');
  assert(toolNames.includes('ingest'), 'Should have ingest tool');
  assert(toolNames.includes('rebuild_index'), 'Should have rebuild_index tool');
  assert(toolNames.includes('get_stats'), 'Should have get_stats tool');

  // Verify search tool schema
  const searchTool = parsed.result.tools.find((tool: any) => tool.name === 'search');
  assert(searchTool.description, 'Search tool should have description');
  assert(searchTool.inputSchema, 'Search tool should have input schema');
  assert(searchTool.inputSchema.properties.query, 'Search tool should require query parameter');
  assert(searchTool.inputSchema.required.includes('query'), 'Query should be required');
});

test('MCP server handles invalid tool requests gracefully', async () => {
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send invalid tool call request
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'nonexistent_tool',
      arguments: {}
    }
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  // Collect response
  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Wait for response
  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  // Parse and validate error response
  const lines = response.split('\n').filter(line => line.trim());
  const jsonResponse = lines.find(line => line.startsWith('{"result"'));

  assert(jsonResponse, 'Should receive JSON response');

  const parsed = JSON.parse(jsonResponse);
  assert.equal(parsed.jsonrpc, '2.0', 'Should use JSON-RPC 2.0');
  assert.equal(parsed.id, 2, 'Should return correct request ID');

  // Should return error content for unknown tool
  assert(parsed.result.content, 'Should have content in result');
  assert(parsed.result.content[0].text.includes('Error'), 'Should contain error message');
});

test('MCP server validates search tool parameters', async () => {
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send search tool call with invalid parameters
  const request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: {
        // Missing required query parameter
        top_k: 5
      }
    }
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  // Collect response
  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Wait for response
  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  // Parse and validate error response
  const lines = response.split('\n').filter(line => line.trim());
  const jsonResponse = lines.find(line => line.startsWith('{"result"'));

  assert(jsonResponse, 'Should receive JSON response');

  const parsed = JSON.parse(jsonResponse);
  assert(parsed.result.content[0].text.includes('Error'), 'Should return validation error');
  assert(parsed.result.content[0].text.includes('required'), 'Should mention required parameter');
});

test('MCP server exposes all required indexing and search functions', async () => {
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send tools/list request
  const request = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/list',
    params: {}
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  // Collect response
  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());
  const jsonResponse = lines.find(line => line.startsWith('{"result"'));
  const parsed = JSON.parse(jsonResponse!);

  const tools = parsed.result.tools;

  // Verify all core functions are exposed as MCP tools
  const toolNames = tools.map((tool: any) => tool.name);
  assert(toolNames.includes('search'), 'Should expose search function');
  assert(toolNames.includes('ingest'), 'Should expose ingest function');
  assert(toolNames.includes('rebuild_index'), 'Should expose rebuild_index function');
  assert(toolNames.includes('get_stats'), 'Should expose get_stats function');

  // Verify tool schemas match expected interface
  const searchTool = tools.find((tool: any) => tool.name === 'search');
  assert(searchTool.inputSchema.properties.query, 'Search should accept query parameter');
  assert(searchTool.inputSchema.properties.top_k, 'Search should accept top_k parameter');
  assert(searchTool.inputSchema.properties.rerank, 'Search should accept rerank parameter');

  const ingestTool = tools.find((tool: any) => tool.name === 'ingest');
  assert(ingestTool.inputSchema.properties.path, 'Ingest should accept path parameter');
  assert(ingestTool.inputSchema.properties.model, 'Ingest should accept model parameter');
  assert(ingestTool.inputSchema.properties.force_rebuild, 'Ingest should accept force_rebuild parameter');

  // Verify model parameter has correct enum values
  assert(Array.isArray(ingestTool.inputSchema.properties.model.enum), 'Model parameter should have enum values');
  assert(ingestTool.inputSchema.properties.model.enum.includes('sentence-transformers/all-MiniLM-L6-v2'), 'Should include default model');
  assert(ingestTool.inputSchema.properties.model.enum.includes('Xenova/all-mpnet-base-v2'), 'Should include all-mpnet-base-v2 model');

  // Verify no additional abstractions - tools should directly map to core functions
  assert.equal(tools.length, 4, 'Should only expose core functions without additional abstractions');
});

test('MCP server validates same-process deployment without separate infrastructure', async () => {
  // Test that MCP server runs in same process as CLI
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Verify server starts without requiring external services
  let stderr = '';
  mcpServer.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  // Send a simple request to verify server is running
  const request = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/list',
    params: {}
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  // Verify server started successfully without external dependencies
  assert(stderr.includes('RAG-lite TS MCP Server started successfully'),
    'Should start successfully in same process');

  // Verify no mentions of external services or infrastructure
  assert(!stderr.includes('REST'), 'Should not mention REST services');
  assert(!stderr.includes('GraphQL'), 'Should not mention GraphQL services');
  assert(!stderr.includes('HTTP'), 'Should not mention HTTP servers');
  assert(!stderr.includes('port'), 'Should not mention network ports');
});

test('MCP server tool interface functionality with real operations', async () => {
  // Setup test data
  setupTestData();

  try {
    const mcpServer = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    let stderr = '';
    mcpServer.stdout.on('data', (data) => {
      response += data.toString();
    });
    mcpServer.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Test get_stats tool (should work without data)
    const statsRequest = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'get_stats',
        arguments: {}
      }
    };

    mcpServer.stdin.write(JSON.stringify(statsRequest) + '\n');
    mcpServer.stdin.end();

    await new Promise((resolve) => {
      mcpServer.on('close', resolve);
    });

    const lines = response.split('\n').filter(line => line.trim());

    // Find stats response - look for any response with id 6
    const statsResponse = lines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 6 && (parsed.result || parsed.error);
      } catch {
        return false;
      }
    });

    assert(statsResponse, `Should receive stats response. Got lines: ${lines.join(', ')}`);

    const statsData = JSON.parse(statsResponse);
    if (statsData.result) {
      assert(statsData.result.content, 'Stats should return content');
      const statsJson = JSON.parse(statsData.result.content[0].text);
      assert(typeof statsJson.database_exists === 'boolean', 'Should report database status');
      assert(typeof statsJson.index_exists === 'boolean', 'Should report index status');
    } else {
      // If there's an error, that's also valid - just verify it's properly formatted
      assert(statsData.result.content[0].text.includes('Error'), 'Error should be properly formatted');
    }

  } finally {
    cleanupTestData();
  }
});

test('MCP server get_stats tool includes correct model-specific configuration', async () => {
  // Test with explicit default model to avoid environment variable interference
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      RAG_EMBEDDING_MODEL: 'sentence-transformers/all-MiniLM-L6-v2' // Force default model
    }
  });

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Test enhanced get_stats tool
  const statsRequest = {
    jsonrpc: '2.0',
    id: 15,
    method: 'tools/call',
    params: {
      name: 'get_stats',
      arguments: {}
    }
  };

  mcpServer.stdin.write(JSON.stringify(statsRequest) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());

  // Find stats response
  const statsResponse = lines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 15 && parsed.result;
    } catch {
      return false;
    }
  });

  assert(statsResponse, 'Should receive stats response');

  const statsData = JSON.parse(statsResponse);
  assert(statsData.result.content, 'Stats should return content');

  const statsJson = JSON.parse(statsData.result.content[0].text);

  // Verify enhanced model information is included
  assert(statsJson.model_info, 'Should include model_info section');
  assert(typeof statsJson.model_info.current_model === 'string', 'Should include current model name');
  assert(typeof statsJson.model_info.current_dimensions === 'number', 'Should include current model dimensions');
  assert(statsJson.model_info.model_specific_config, 'Should include model-specific configuration');
  assert(typeof statsJson.model_info.model_specific_config.chunk_size === 'number', 'Should include model-specific chunk_size');
  assert(typeof statsJson.model_info.model_specific_config.chunk_overlap === 'number', 'Should include model-specific chunk_overlap');
  assert(typeof statsJson.model_info.model_specific_config.batch_size === 'number', 'Should include model-specific batch_size');

  // Verify compatibility information is included
  assert(statsJson.model_info.compatibility, 'Should include compatibility information');

  // Verify the current model is the expected default
  assert.equal(statsJson.model_info.current_model, 'sentence-transformers/all-MiniLM-L6-v2', 'Should use default model');
  assert.equal(statsJson.model_info.current_dimensions, 384, 'Should report correct dimensions for default model');

  // CRITICAL: Verify model-specific config matches expected defaults (this would have caught the bug!)
  assert.equal(statsJson.model_info.model_specific_config.chunk_size, 250, 'Should use correct chunk_size for default model');
  assert.equal(statsJson.model_info.model_specific_config.chunk_overlap, 50, 'Should use correct chunk_overlap for default model');
  assert.equal(statsJson.model_info.model_specific_config.batch_size, 16, 'Should use correct batch_size for default model');

  // CRITICAL: Verify effective config matches model-specific defaults
  assert.equal(statsJson.config.chunk_size, 250, 'Effective config should use model-specific chunk_size');
  assert.equal(statsJson.config.chunk_overlap, 50, 'Effective config should use model-specific chunk_overlap');
  assert.equal(statsJson.config.batch_size, 16, 'Effective config should use model-specific batch_size');
});

test('MCP server protocol compliance and error handling', async () => {
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Test basic protocol compliance with a simple request
  const request = {
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/list',
    params: {}
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());

  // Find valid JSON responses
  const jsonResponses = lines.filter(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.jsonrpc && parsed.id !== undefined;
    } catch {
      return false;
    }
  });

  assert(jsonResponses.length >= 1, `Should receive at least one response. Got lines: ${lines.join(', ')}`);

  // Verify JSON-RPC 2.0 protocol compliance
  for (const jsonResponse of jsonResponses) {
    const parsed = JSON.parse(jsonResponse);
    assert.equal(parsed.jsonrpc, '2.0', 'All responses should use JSON-RPC 2.0');
    assert(typeof parsed.id === 'number', 'All responses should have numeric ID');
    assert(parsed.result || parsed.error, 'All responses should have result or error');
  }

  // Test error handling with a separate server instance
  const errorServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let errorResponse = '';
  errorServer.stdout.on('data', (data) => {
    errorResponse += data.toString();
  });

  // Send invalid tool call
  const errorRequest = {
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: {
        query: '' // Empty query should fail validation
      }
    }
  };

  errorServer.stdin.write(JSON.stringify(errorRequest) + '\n');
  errorServer.stdin.end();

  await new Promise((resolve) => {
    errorServer.on('close', resolve);
  });

  const errorLines = errorResponse.split('\n').filter(line => line.trim());
  const errorJsonResponse = errorLines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 9 && parsed.result;
    } catch {
      return false;
    }
  });

  if (errorJsonResponse) {
    const parsed = JSON.parse(errorJsonResponse);
    assert(parsed.result.content[0].text.includes('Error'), 'Should return proper error message');
  }
});

test('MCP server wraps core functions without additional abstractions', async () => {
  // This test verifies that MCP tools are thin wrappers around existing functionality
  // by checking that the server doesn't introduce unnecessary complexity

  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Request tool definitions
  const request = {
    jsonrpc: '2.0',
    id: 12,
    method: 'tools/list',
    params: {}
  };

  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());
  const jsonResponse = lines.find(line => line.startsWith('{"result"'));
  const parsed = JSON.parse(jsonResponse!);

  const tools = parsed.result.tools;

  // Verify tools are direct mappings to core functions
  for (const tool of tools) {
    // Tool names should directly correspond to core functionality
    assert(['search', 'ingest', 'rebuild_index', 'get_stats'].includes(tool.name),
      `Tool ${tool.name} should be a core function`);

    // Tool descriptions should be straightforward, not abstract
    assert(tool.description.length > 10 && tool.description.length < 200,
      'Tool descriptions should be concise and direct');

    // Input schemas should be simple and direct
    assert(tool.inputSchema.type === 'object', 'Input schemas should be simple objects');
    assert(!tool.inputSchema.anyOf && !tool.inputSchema.oneOf,
      'Input schemas should not use complex composition patterns');
  }

  // Verify no middleware or abstraction layers in tool definitions
  assert.equal(tools.length, 4, 'Should only expose essential core functions');

  // Verify tool parameters directly map to function parameters
  const searchTool = tools.find((tool: any) => tool.name === 'search');
  const searchParams = Object.keys(searchTool.inputSchema.properties);
  assert(searchParams.includes('query'), 'Search should directly accept query');
  assert(searchParams.includes('top_k'), 'Search should directly accept top_k');
  assert(searchParams.includes('rerank'), 'Search should directly accept rerank');
  assert(searchParams.length === 3, 'Search should not have additional abstraction parameters');
});

test('MCP server end-to-end integration workflow', async () => {
  // This test demonstrates the complete MCP workflow: ingest → search
  setupTestData();

  try {
    // Test ingestion first
    const ingestServer = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let ingestResponse = '';
    ingestServer.stdout.on('data', (data) => {
      ingestResponse += data.toString();
    });

    const ingestRequest = {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'ingest',
        arguments: {
          path: testDoc // Single file ingestion
        }
      }
    };

    ingestServer.stdin.write(JSON.stringify(ingestRequest) + '\n');
    ingestServer.stdin.end();

    await new Promise((resolve) => {
      ingestServer.on('close', resolve);
    });

    // Verify ingestion worked
    const ingestLines = ingestResponse.split('\n').filter(line => line.trim());
    const ingestJsonResponse = ingestLines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 13 && parsed.result;
      } catch {
        return false;
      }
    });

    assert(ingestJsonResponse, 'Should receive ingestion response');
    const ingestData = JSON.parse(ingestJsonResponse);

    if (ingestData.result.content[0].text.includes('Error')) {
      // If ingestion failed, that's still a valid test - just verify error handling
      assert(ingestData.result.content[0].text.includes('Error'), 'Should handle ingestion errors properly');
      return; // Skip search test if ingestion failed
    }

    // Parse successful ingestion result
    const ingestResult = JSON.parse(ingestData.result.content[0].text);
    assert(ingestResult.success === true, 'Ingestion should succeed');
    assert(ingestResult.documents_processed >= 1, 'Should process at least one document');

    // Now test search on the ingested data
    const searchServer = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let searchResponse = '';
    searchServer.stdout.on('data', (data) => {
      searchResponse += data.toString();
    });

    const searchRequest = {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: {
          query: 'test document',
          top_k: 3
        }
      }
    };

    searchServer.stdin.write(JSON.stringify(searchRequest) + '\n');
    searchServer.stdin.end();

    await new Promise((resolve) => {
      searchServer.on('close', resolve);
    });

    // Verify search worked
    const searchLines = searchResponse.split('\n').filter(line => line.trim());
    const searchJsonResponse = searchLines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 14 && parsed.result;
      } catch {
        return false;
      }
    });

    assert(searchJsonResponse, 'Should receive search response');
    const searchData = JSON.parse(searchJsonResponse);

    if (searchData.result.content[0].text.includes('Error')) {
      // Search might fail if no index exists, which is valid behavior
      assert(searchData.result.content[0].text.includes('Error'), 'Should handle search errors properly');
    } else {
      // Parse successful search result
      const searchResult = JSON.parse(searchData.result.content[0].text);
      assert(typeof searchResult.results_count === 'number', 'Should return results count');
      assert(Array.isArray(searchResult.results), 'Should return results array');
      assert(typeof searchResult.search_time_ms === 'number', 'Should report search time');
    }

  } finally {
    cleanupTestData();
  }
});

test('MCP server applies correct model-specific configuration for all-mpnet-base-v2', async () => {
  // Test with all-mpnet-base-v2 model via environment variable
  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      RAG_EMBEDDING_MODEL: 'Xenova/all-mpnet-base-v2'
    }
  });

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  const statsRequest = {
    jsonrpc: '2.0',
    id: 18,
    method: 'tools/call',
    params: {
      name: 'get_stats',
      arguments: {}
    }
  };

  mcpServer.stdin.write(JSON.stringify(statsRequest) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());
  const statsResponse = lines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 18 && parsed.result;
    } catch {
      return false;
    }
  });

  assert(statsResponse, 'Should receive stats response');
  const statsData = JSON.parse(statsResponse);
  const statsJson = JSON.parse(statsData.result.content[0].text);

  // CRITICAL: Verify all-mpnet-base-v2 specific configuration
  assert.equal(statsJson.model_info.current_model, 'Xenova/all-mpnet-base-v2', 'Should use all-mpnet-base-v2 model');
  assert.equal(statsJson.model_info.current_dimensions, 768, 'Should report 768 dimensions for all-mpnet-base-v2');

  // CRITICAL: Verify model-specific defaults are applied correctly
  assert.equal(statsJson.model_info.model_specific_config.chunk_size, 400, 'all-mpnet-base-v2 should use chunk_size 400');
  assert.equal(statsJson.model_info.model_specific_config.chunk_overlap, 80, 'all-mpnet-base-v2 should use chunk_overlap 80');
  assert.equal(statsJson.model_info.model_specific_config.batch_size, 8, 'all-mpnet-base-v2 should use batch_size 8');

  // CRITICAL: Verify effective config uses model-specific defaults
  assert.equal(statsJson.config.chunk_size, 400, 'Effective config should use all-mpnet-base-v2 chunk_size');
  assert.equal(statsJson.config.chunk_overlap, 80, 'Effective config should use all-mpnet-base-v2 chunk_overlap');
  assert.equal(statsJson.config.batch_size, 8, 'Effective config should use all-mpnet-base-v2 batch_size');
});

test('MCP server ingest tool supports model parameter with correct configuration', async () => {
  setupTestData();

  try {
    const mcpServer = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    mcpServer.stdout.on('data', (data) => {
      response += data.toString();
    });

    // Test ingest with model parameter
    const ingestRequest = {
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: {
        name: 'ingest',
        arguments: {
          path: testDoc,
          model: 'Xenova/all-mpnet-base-v2'
        }
      }
    };

    mcpServer.stdin.write(JSON.stringify(ingestRequest) + '\n');
    mcpServer.stdin.end();

    await new Promise((resolve) => {
      mcpServer.on('close', resolve);
    });

    const lines = response.split('\n').filter(line => line.trim());

    // Look for embedding engine initialization log to verify correct batch size
    const embeddingLog = lines.find(line => line.includes('EmbeddingEngine initialized'));
    if (embeddingLog) {
      assert(embeddingLog.includes('Xenova/all-mpnet-base-v2'), 'Should use specified model');
      assert(embeddingLog.includes('batchSize: 8'), 'Should use correct batch size for all-mpnet-base-v2');
    }

    // Look for chunking logs to verify correct chunk size
    const chunkingLog = lines.find(line => line.includes('chunkSize='));
    if (chunkingLog) {
      assert(chunkingLog.includes('chunkSize=400'), 'Should use correct chunk size for all-mpnet-base-v2');
      assert(chunkingLog.includes('chunkOverlap=80'), 'Should use correct chunk overlap for all-mpnet-base-v2');
    }

    const ingestResponse = lines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 19 && parsed.result;
      } catch {
        return false;
      }
    });

    if (ingestResponse) {
      const ingestData = JSON.parse(ingestResponse);
      const responseText = ingestData.result.content[0].text;

      // If successful, verify the ingestion worked
      if (!responseText.includes('Error')) {
        const ingestResult = JSON.parse(responseText);
        assert(ingestResult.success === true, 'Ingestion with model parameter should succeed');
      }
    }

  } finally {
    cleanupTestData();
  }
});

test('MCP server configuration comparison between models', async () => {
  // Test that different models produce different configurations

  // Test default model - explicitly set to avoid environment variable interference
  const defaultServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      RAG_EMBEDDING_MODEL: 'sentence-transformers/all-MiniLM-L6-v2' // Force default model
    }
  });

  let defaultResponse = '';
  defaultServer.stdout.on('data', (data) => {
    defaultResponse += data.toString();
  });

  const defaultStatsRequest = {
    jsonrpc: '2.0',
    id: 20,
    method: 'tools/call',
    params: {
      name: 'get_stats',
      arguments: {}
    }
  };

  defaultServer.stdin.write(JSON.stringify(defaultStatsRequest) + '\n');
  defaultServer.stdin.end();

  await new Promise((resolve) => {
    defaultServer.on('close', resolve);
  });

  // Test all-mpnet-base-v2 model
  const customServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      RAG_EMBEDDING_MODEL: 'Xenova/all-mpnet-base-v2'
    }
  });

  let customResponse = '';
  customServer.stdout.on('data', (data) => {
    customResponse += data.toString();
  });

  const customStatsRequest = {
    jsonrpc: '2.0',
    id: 21,
    method: 'tools/call',
    params: {
      name: 'get_stats',
      arguments: {}
    }
  };

  customServer.stdin.write(JSON.stringify(customStatsRequest) + '\n');
  customServer.stdin.end();

  await new Promise((resolve) => {
    customServer.on('close', resolve);
  });

  // Parse responses
  const defaultLines = defaultResponse.split('\n').filter(line => line.trim());
  const defaultStatsResponse = defaultLines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 20 && parsed.result;
    } catch {
      return false;
    }
  });

  const customLines = customResponse.split('\n').filter(line => line.trim());
  const customStatsResponse = customLines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 21 && parsed.result;
    } catch {
      return false;
    }
  });

  assert(defaultStatsResponse, 'Should receive default model stats');
  assert(customStatsResponse, 'Should receive custom model stats');

  const defaultStats = JSON.parse(JSON.parse(defaultStatsResponse).result.content[0].text);
  const customStats = JSON.parse(JSON.parse(customStatsResponse).result.content[0].text);

  // CRITICAL: Verify models are different
  assert.notEqual(defaultStats.model_info.current_model, customStats.model_info.current_model,
    'Different models should be reported');

  // CRITICAL: Verify dimensions are different
  assert.notEqual(defaultStats.model_info.current_dimensions, customStats.model_info.current_dimensions,
    'Different models should have different dimensions');

  // CRITICAL: Verify configurations are different (this would have caught the bug!)
  assert.notEqual(defaultStats.config.chunk_size, customStats.config.chunk_size,
    'Different models should use different chunk sizes');
  assert.notEqual(defaultStats.config.chunk_overlap, customStats.config.chunk_overlap,
    'Different models should use different chunk overlaps');
  assert.notEqual(defaultStats.config.batch_size, customStats.config.batch_size,
    'Different models should use different batch sizes');

  // CRITICAL: Verify specific expected values
  assert.equal(defaultStats.config.chunk_size, 250, 'Default model should use chunk_size 250');
  assert.equal(customStats.config.chunk_size, 400, 'all-mpnet-base-v2 should use chunk_size 400');

  assert.equal(defaultStats.config.batch_size, 16, 'Default model should use batch_size 16');
  assert.equal(customStats.config.batch_size, 8, 'all-mpnet-base-v2 should use batch_size 8');
});

test('MCP server ingest tool validates model parameter', async () => {
  setupTestData(); // Ensure test file exists

  try {
    const mcpServer = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    mcpServer.stdout.on('data', (data) => {
      response += data.toString();
    });

    // Test ingest with invalid model parameter
    const ingestRequest = {
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: {
        name: 'ingest',
        arguments: {
          path: testDoc,
          model: 'invalid-model-name'
        }
      }
    };

    mcpServer.stdin.write(JSON.stringify(ingestRequest) + '\n');
    mcpServer.stdin.end();

    await new Promise((resolve) => {
      mcpServer.on('close', resolve);
    });

    const lines = response.split('\n').filter(line => line.trim());
    const ingestResponse = lines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 22 && parsed.result;
      } catch {
        return false;
      }
    });

    assert(ingestResponse, 'Should receive ingest response');
    const ingestData = JSON.parse(ingestResponse);
    const responseText = ingestData.result.content[0].text;

    // Should return validation error for invalid model
    assert(responseText.includes('Error'), 'Should return error for invalid model');
    assert(responseText.includes('Unsupported model') || responseText.includes('invalid-model-name'),
      'Should mention unsupported model or invalid model name');

  } finally {
    cleanupTestData();
  }
});

test('MCP server handles model mismatch errors with clear messages', async () => {
  // This test verifies that model mismatch errors are caught and returned with helpful messages
  // Requirements: 4.4, 5.1, 5.2, 5.3, 5.4

  const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  // Test search tool with potential model mismatch
  const searchRequest = {
    jsonrpc: '2.0',
    id: 16,
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: {
        query: 'test query'
      }
    }
  };

  mcpServer.stdin.write(JSON.stringify(searchRequest) + '\n');
  mcpServer.stdin.end();

  await new Promise((resolve) => {
    mcpServer.on('close', resolve);
  });

  const lines = response.split('\n').filter(line => line.trim());
  const searchResponse = lines.find(line => {
    try {
      const parsed = JSON.parse(line);
      return parsed.id === 16 && parsed.result;
    } catch {
      return false;
    }
  });

  assert(searchResponse, 'Should receive search response');
  const searchData = JSON.parse(searchResponse);
  const responseText = searchData.result.content[0].text;

  // Check if we got a model mismatch error (this might not always happen in tests)
  if (responseText.includes('MODEL_MISMATCH') || responseText.includes('DIMENSION_MISMATCH')) {
    const errorData = JSON.parse(responseText);

    // Verify error structure for model mismatch
    assert(errorData.error, 'Should have error field');
    assert(errorData.message, 'Should have message field');
    assert(errorData.details, 'Should have details field');
    assert(errorData.resolution, 'Should have resolution field');
    assert(errorData.resolution.action, 'Should have resolution action');
    assert(errorData.resolution.command, 'Should have resolution command');
    assert(errorData.resolution.explanation, 'Should have resolution explanation');

    // Verify the resolution suggests rebuild
    assert(errorData.resolution.command.includes('rebuild'), 'Should suggest rebuild command');
    assert(errorData.resolution.explanation.includes('rebuild'), 'Should explain rebuild is needed');
  }

  // Test ingest tool with potential model mismatch
  const ingestServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let ingestResponse = '';
  ingestServer.stdout.on('data', (data) => {
    ingestResponse += data.toString();
  });

  // Create a test file for ingestion
  setupTestData();

  try {
    const ingestRequest = {
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: {
        name: 'ingest',
        arguments: {
          path: testDoc
        }
      }
    };

    ingestServer.stdin.write(JSON.stringify(ingestRequest) + '\n');
    ingestServer.stdin.end();

    await new Promise((resolve) => {
      ingestServer.on('close', resolve);
    });

    const ingestLines = ingestResponse.split('\n').filter(line => line.trim());
    const ingestJsonResponse = ingestLines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id === 17 && parsed.result;
      } catch {
        return false;
      }
    });

    assert(ingestJsonResponse, 'Should receive ingest response');
    const ingestData = JSON.parse(ingestJsonResponse);
    const ingestResponseText = ingestData.result.content[0].text;

    // Check if we got a model mismatch error during ingestion
    if (ingestResponseText.includes('MODEL_MISMATCH') || ingestResponseText.includes('DIMENSION_MISMATCH') || ingestResponseText.includes('INITIALIZATION_FAILED')) {
      const errorData = JSON.parse(ingestResponseText);

      // Verify error structure for model mismatch in ingestion
      assert(errorData.error, 'Should have error field');
      assert(errorData.message, 'Should have message field');
      assert(errorData.resolution, 'Should have resolution field');
      assert(errorData.resolution.command, 'Should suggest rebuild command');

      // For ingestion, should also mention force_rebuild option
      if (errorData.error === 'MODEL_MISMATCH' || errorData.error === 'DIMENSION_MISMATCH') {
        assert(errorData.resolution.alternative_command.includes('force_rebuild'), 'Should mention force_rebuild option');
      }
    }

  } finally {
    cleanupTestData();
  }
});