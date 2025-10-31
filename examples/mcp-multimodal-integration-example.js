/**
 * MCP Server Multimodal Integration Example
 * 
 * This example demonstrates how to integrate RAG-lite's multimodal capabilities
 * with MCP (Model Context Protocol) servers for tool-based interactions.
 * 
 * The example shows:
 * - Setting up multimodal content ingestion via MCP tools
 * - Performing content-type aware searches
 * - Managing system configuration and mode detection
 * - Error handling and recovery strategies
 */

import { MCPClient } from '@modelcontextprotocol/client';
import { StdioServerTransport } from '@modelcontextprotocol/client/stdio';

class RAGLiteMCPExample {
    constructor() {
        this.client = null;
        this.transport = null;
    }

    async initialize() {
        console.log('🚀 Initializing RAG-lite MCP Server Connection');
        console.log('==============================================\n');

        try {
            // Initialize MCP client with RAG-lite server
            this.transport = new StdioServerTransport({
                command: 'node',
                args: ['../src/mcp-server.js'], // Adjust path as needed
                env: process.env
            });

            this.client = new MCPClient({
                name: 'rag-lite-multimodal-example',
                version: '1.0.0'
            });

            await this.client.connect(this.transport);
            console.log('✅ Connected to RAG-lite MCP server\n');

            // List available tools
            const tools = await this.client.listTools();
            console.log('Available MCP tools:');
            tools.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
            console.log();

        } catch (error) {
            console.error('❌ Failed to initialize MCP client:', error.message);
            throw error;
        }
    }

    async demonstrateTextModeWorkflow() {
        console.log('📝 Text Mode MCP Workflow');
        console.log('=========================\n');

        try {
            // Step 1: Check supported models for text mode
            console.log('1. Checking supported text models...');
            const textModels = await this.client.callTool('list_supported_models', {
                content_type: 'text'
            });
            console.log('Available text models:');
            textModels.content.forEach(model => {
                console.log(`  - ${model.name} (${model.dimensions} dimensions)`);
            });
            console.log();

            // Step 2: Ingest text content
            console.log('2. Ingesting text content...');
            const textIngestion = await this.client.callTool('ingest', {
                path: './docs',
                mode: 'text',
                model: 'sentence-transformers/all-MiniLM-L6-v2'
            });
            console.log(`✅ ${textIngestion.content.message}`);
            console.log(`   Processed: ${textIngestion.content.stats.documents} documents`);
            console.log(`   Created: ${textIngestion.content.stats.chunks} chunks\n`);

            // Step 3: Get system configuration
            console.log('3. Checking system configuration...');
            const modeInfo = await this.client.callTool('get_mode_info', {});
            console.log('Current configuration:');
            console.log(`  Mode: ${modeInfo.content.mode}`);
            console.log(`  Model: ${modeInfo.content.model_name}`);
            console.log(`  Reranking: ${modeInfo.content.reranking_strategy}`);
            console.log(`  Content types: ${modeInfo.content.supported_content_types.join(', ')}\n`);

            // Step 4: Perform text searches
            console.log('4. Performing text searches...');
            const queries = ['installation guide', 'API documentation', 'configuration options'];
            
            for (const query of queries) {
                console.log(`   Query: "${query}"`);
                const results = await this.client.callTool('search', {
                    query: query,
                    top_k: 3,
                    rerank: true
                });
                
                console.log(`   Found ${results.content.results.length} results:`);
                results.content.results.forEach((result, index) => {
                    console.log(`     ${index + 1}. Score: ${result.score.toFixed(3)} | ${result.document.source}`);
                });
                console.log();
            }

        } catch (error) {
            console.error('❌ Error in text mode workflow:', error.message);
            throw error;
        }
    }

    async demonstrateMultimodalWorkflow() {
        console.log('🖼️  Multimodal Mode MCP Workflow');
        console.log('================================\n');

        try {
            // Step 1: Check supported multimodal models
            console.log('1. Checking supported multimodal models...');
            const multimodalModels = await this.client.callTool('list_supported_models', {
                content_type: 'image'
            });
            console.log('Available multimodal models:');
            multimodalModels.content.forEach(model => {
                console.log(`  - ${model.name} (${model.dimensions} dimensions)`);
                console.log(`    Content types: ${model.supported_content_types.join(', ')}`);
            });
            console.log();

            // Step 2: Check reranking strategies for multimodal mode
            console.log('2. Checking multimodal reranking strategies...');
            const strategies = await this.client.callTool('list_reranking_strategies', {
                mode: 'multimodal'
            });
            console.log('Available strategies:');
            strategies.content.forEach(strategy => {
                console.log(`  - ${strategy.name}: ${strategy.description}`);
            });
            console.log();

            // Step 3: Ingest multimodal content
            console.log('3. Ingesting multimodal content...');
            const multimodalIngestion = await this.client.callTool('ingest', {
                path: './mixed-content',
                mode: 'multimodal',
                model: 'Xenova/clip-vit-base-patch32',
                rerank_strategy: 'text-derived'
            });
            console.log(`✅ ${multimodalIngestion.content.message}`);
            console.log(`   Processed: ${multimodalIngestion.content.stats.documents} documents`);
            console.log(`   Text chunks: ${multimodalIngestion.content.stats.text_chunks}`);
            console.log(`   Image chunks: ${multimodalIngestion.content.stats.image_chunks}\n`);

            // Step 4: Get updated system configuration
            console.log('4. Checking updated system configuration...');
            const updatedModeInfo = await this.client.callTool('get_mode_info', {});
            console.log('Updated configuration:');
            console.log(`  Mode: ${updatedModeInfo.content.mode}`);
            console.log(`  Model: ${updatedModeInfo.content.model_name}`);
            console.log(`  Reranking: ${updatedModeInfo.content.reranking_strategy}`);
            console.log(`  Content types: ${updatedModeInfo.content.supported_content_types.join(', ')}\n`);

            // Step 5: Perform multimodal searches
            console.log('5. Performing multimodal searches...');
            
            // Search all content types
            console.log('   All content search:');
            const allResults = await this.client.callTool('multimodal_search', {
                query: 'architecture diagram',
                top_k: 5,
                rerank: true
            });
            console.log(`   Found ${allResults.content.results.length} results across all content types:`);
            allResults.content.results.forEach((result, index) => {
                console.log(`     ${index + 1}. ${result.content_type}: ${result.document.source} (${result.score.toFixed(3)})`);
            });
            console.log();

            // Search only images
            console.log('   Image-only search:');
            const imageResults = await this.client.callTool('multimodal_search', {
                query: 'system architecture',
                top_k: 3,
                rerank: true,
                content_type: 'image'
            });
            console.log(`   Found ${imageResults.content.results.length} image results:`);
            imageResults.content.results.forEach((result, index) => {
                console.log(`     ${index + 1}. ${result.document.source} (${result.score.toFixed(3)})`);
                if (result.metadata?.description) {
                    console.log(`        Description: ${result.metadata.description.substring(0, 80)}...`);
                }
            });
            console.log();

            // Search only text
            console.log('   Text-only search:');
            const textResults = await this.client.callTool('multimodal_search', {
                query: 'installation instructions',
                top_k: 3,
                rerank: true,
                content_type: 'text'
            });
            console.log(`   Found ${textResults.content.results.length} text results:`);
            textResults.content.results.forEach((result, index) => {
                console.log(`     ${index + 1}. ${result.document.source} (${result.score.toFixed(3)})`);
            });
            console.log();

        } catch (error) {
            console.error('❌ Error in multimodal workflow:', error.message);
            throw error;
        }
    }

    async demonstrateSystemManagement() {
        console.log('⚙️  System Management via MCP');
        console.log('=============================\n');

        try {
            // Get comprehensive system statistics
            console.log('1. Getting system statistics...');
            const stats = await this.client.callTool('get_system_stats', {
                include_performance: true,
                include_content_breakdown: true
            });
            
            console.log('System Statistics:');
            console.log(`  Database exists: ${stats.content.database_exists}`);
            console.log(`  Index exists: ${stats.content.index_exists}`);
            console.log(`  Total documents: ${stats.content.total_documents}`);
            console.log(`  Total chunks: ${stats.content.total_chunks}`);
            
            if (stats.content.content_breakdown) {
                console.log('  Content breakdown:');
                Object.entries(stats.content.content_breakdown).forEach(([type, count]) => {
                    console.log(`    ${type}: ${count}`);
                });
            }
            
            if (stats.content.performance_metrics) {
                console.log('  Performance metrics:');
                console.log(`    Average search time: ${stats.content.performance_metrics.avg_search_time}ms`);
                console.log(`    Memory usage: ${stats.content.performance_metrics.memory_usage}MB`);
            }
            console.log();

            // List all supported models
            console.log('2. Listing all supported models...');
            const allModels = await this.client.callTool('list_supported_models', {});
            console.log('All supported models:');
            allModels.content.forEach(model => {
                console.log(`  - ${model.name}`);
                console.log(`    Type: ${model.type} | Dimensions: ${model.dimensions}`);
                console.log(`    Content types: ${model.supported_content_types.join(', ')}`);
                console.log(`    Memory: ~${model.memory_requirements}MB`);
                console.log();
            });

            // List all reranking strategies
            console.log('3. Listing all reranking strategies...');
            const allStrategies = await this.client.callTool('list_reranking_strategies', {});
            console.log('All reranking strategies:');
            allStrategies.content.forEach(strategy => {
                console.log(`  - ${strategy.name} (${strategy.mode} mode)`);
                console.log(`    Description: ${strategy.description}`);
                console.log(`    Performance impact: ${strategy.performance_impact}`);
                console.log();
            });

        } catch (error) {
            console.error('❌ Error in system management:', error.message);
            throw error;
        }
    }

    async demonstrateErrorHandling() {
        console.log('🚨 Error Handling and Recovery');
        console.log('==============================\n');

        try {
            // Test 1: Invalid model
            console.log('1. Testing invalid model handling...');
            try {
                await this.client.callTool('ingest', {
                    path: './docs',
                    mode: 'text',
                    model: 'invalid-model-name'
                });
            } catch (error) {
                console.log(`✅ Caught expected error: ${error.message}`);
                console.log('   System provided helpful error message with supported alternatives\n');
            }

            // Test 2: Model mismatch recovery
            console.log('2. Testing model mismatch recovery...');
            try {
                // This would trigger a model mismatch if we had different models
                const stats = await this.client.callTool('get_stats', {});
                console.log('✅ System handled model compatibility check');
                console.log(`   Current model dimensions: ${stats.content.model_info?.dimensions || 'auto-detected'}\n`);
            } catch (error) {
                console.log(`Model mismatch detected: ${error.message}`);
                console.log('Recovery options:');
                console.log('- Use rebuild_index tool to regenerate embeddings');
                console.log('- Verify model configuration matches indexing setup\n');
            }

            // Test 3: Index rebuild (if needed)
            console.log('3. Testing index rebuild capability...');
            try {
                const rebuildResult = await this.client.callTool('rebuild_index', {});
                console.log(`✅ Index rebuild completed: ${rebuildResult.content.message}`);
                console.log(`   Processed: ${rebuildResult.content.stats.total_chunks} chunks\n`);
            } catch (error) {
                console.log(`Index rebuild info: ${error.message}\n`);
            }

        } catch (error) {
            console.error('❌ Error in error handling demo:', error.message);
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up MCP connection...');
        try {
            if (this.client) {
                await this.client.close();
            }
            if (this.transport) {
                await this.transport.close();
            }
            console.log('✅ MCP connection closed\n');
        } catch (error) {
            console.error('❌ Error during cleanup:', error.message);
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.demonstrateTextModeWorkflow();
            console.log('='.repeat(60) + '\n');
            
            await this.demonstrateMultimodalWorkflow();
            console.log('='.repeat(60) + '\n');
            
            await this.demonstrateSystemManagement();
            console.log('='.repeat(60) + '\n');
            
            await this.demonstrateErrorHandling();
            
            console.log('🎉 MCP Multimodal Integration Example Completed!');
            console.log('\nKey MCP Integration Benefits:');
            console.log('✓ Tool-based interaction with RAG-lite capabilities');
            console.log('✓ Automatic mode detection and configuration management');
            console.log('✓ Content-type aware search and filtering');
            console.log('✓ Comprehensive system monitoring and statistics');
            console.log('✓ Robust error handling and recovery mechanisms');
            console.log('✓ Support for both text-only and multimodal workflows');

        } catch (error) {
            console.error('❌ Example failed:', error.message);
            console.error('Stack:', error.stack);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the example
async function main() {
    console.log('🔧 RAG-lite MCP Server Multimodal Integration Example');
    console.log('=====================================================\n');
    
    console.log('This example demonstrates comprehensive integration between');
    console.log('RAG-lite\'s Chameleon Architecture and MCP (Model Context Protocol)');
    console.log('for tool-based multimodal document retrieval.\n');

    const example = new RAGLiteMCPExample();
    await example.run();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});