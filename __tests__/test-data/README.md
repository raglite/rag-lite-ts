# Test Data Directory

This directory contains test data files used by the RAG-lite test suite.

## Directory Structure

- **`images/`** - Test images for multimodal functionality tests
  - `cat.jpg`, `dog.jpg` - Sample images for CLIP embedding and image processing tests
  - Used by: `__tests__/integration/chameleon-error-recovery.test.ts`, multimodal tutorial documentation

- **`mcp/`** - Test data for MCP (Model Context Protocol) server tests
  - `test.md` - Sample markdown document for MCP integration testing
  - Used by: `__tests__/integration/mcp-server.test.ts`

- **`reliability/`** - Test documents for reliability and integration tests
  - `document1.txt`, `document2.txt`, `readme.md` - Sample text documents
  - Used by: `__tests__/integration/chameleon-reliability-integration.test.ts`

- **`streaming/`** - Test directories for streaming operations tests
  - Various subdirectories for testing different streaming scenarios
  - Used by: `__tests__/core/streaming-operations.test.ts` (if it exists)

## Usage

These test data files are referenced directly by the test suite and should not be modified unless you're updating the corresponding tests. The files are tracked in git to ensure consistent test behavior across different environments.

## Adding New Test Data

When adding new test data:
1. Place files in the appropriate subdirectory based on functionality
2. Update this README to document the new files
3. Ensure the files are small and appropriate for version control
4. Update corresponding test files to reference the new data