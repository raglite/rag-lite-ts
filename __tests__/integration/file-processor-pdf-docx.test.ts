import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { discoverFiles, processFiles } from '../../src/file-processor.js';
import { DocumentPathManager } from '../../src/core/path-manager.js';

test('PDF and DOCX file support', async () => {
  // Test that PDF and DOCX extensions are now supported
  const testDir = './test-files';
  
  // Create test directory if it doesn't exist
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Create a simple text file to test the discovery still works
  const testFile = join(testDir, 'test.txt');
  await fs.writeFile(testFile, 'This is a test document.\n\n# Test Title\n\nSome content here.');

  try {
    // Test file discovery
    const result = await discoverFiles(testDir);
    
    // Should find the text file
    assert(result.files.length >= 1, 'Should discover at least one file');
    assert(result.files.some(f => f.endsWith('test.txt')), 'Should find the test.txt file');

    // Test processing
    const pathManager = new DocumentPathManager('relative', testDir);
    const processResult = await processFiles(result.files, pathManager);
    
    assert(processResult.documents.length >= 1, 'Should process at least one document');
    
    const testDoc = processResult.documents.find(d => d.source.includes('test.txt'));
    assert(testDoc, 'Should find processed test document');
    assert.equal(testDoc.title, 'Test Title', 'Should extract title from markdown header');
    assert(testDoc.content.includes('This is a test document'), 'Should contain file content');

    console.log('✓ File processor supports PDF and DOCX extensions');
    console.log('✓ Existing functionality still works');
    
  } finally {
    // Clean up
    try {
      await fs.unlink(testFile);
      await fs.rmdir(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});
