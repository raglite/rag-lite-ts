import { describe, test } from 'node:test';
import { execSync } from 'child_process';
import { join } from 'path';
import assert from 'assert';

// Test configuration
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

/**
 * Execute CLI command and return result
 */
function runCLI(args: string[], expectError = false): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  try {
    const result = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    
    return {
      stdout: result,
      stderr: '',
      exitCode: 0
    };
  } catch (error: any) {
    if (expectError) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.status || 1
      };
    }
    throw error;
  }
}

describe('CLI Critical Bug Prevention Tests', () => {
  
  describe('Model Selection Validation (The bugs we found)', () => {
    test('should reject --model flag with search command', () => {
      const result = runCLI(['search', 'test', '--model', 'Xenova/all-mpnet-base-v2'], true);
      
      // Should fail (any non-zero exit code)
      assert.notStrictEqual(result.exitCode, 0);
      
      // Should contain the specific error message we implemented
      assert(result.stderr.includes('--model option is only available for the \'ingest\' command'));
      assert(result.stderr.includes('The search command automatically uses the model that was used during ingestion'));
      
      console.log('✅ PASS: CLI correctly rejects --model with search');
    });

    test('should reject invalid model names', () => {
      const result = runCLI(['ingest', 'dummy.md', '--model', 'invalid-model'], true);
      
      // Should fail
      assert.notStrictEqual(result.exitCode, 0);
      
      // Should show supported models
      assert(result.stderr.includes('Unsupported model'));
      assert(result.stderr.includes('sentence-transformers/all-MiniLM-L6-v2'));
      assert(result.stderr.includes('Xenova/all-mpnet-base-v2'));
      
      console.log('✅ PASS: CLI correctly validates model names');
    });

    test('should accept valid model names', () => {
      const result = runCLI(['ingest', 'dummy.md', '--model', 'Xenova/all-mpnet-base-v2'], true);
      
      // Should not fail on model validation (may fail for other reasons like missing file)
      assert(!result.stderr.includes('Unsupported model'));
      
      console.log('✅ PASS: CLI accepts valid model names');
    });
  });

  describe('Basic Argument Validation', () => {
    test('should show help when no arguments provided', () => {
      const result = runCLI([]);
      
      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes('RAG-lite TS'));
      assert(result.stdout.includes('Usage:'));
      assert(result.stdout.includes('Commands:'));
      assert(result.stdout.includes('Available models:'));
      
      console.log('✅ PASS: CLI shows help correctly');
    });

    test('should require arguments for commands', () => {
      const ingestResult = runCLI(['ingest'], true);
      assert.notStrictEqual(ingestResult.exitCode, 0);
      assert(ingestResult.stderr.includes('ingest command requires a path argument'));
      
      const searchResult = runCLI(['search'], true);
      assert.notStrictEqual(searchResult.exitCode, 0);
      assert(searchResult.stderr.includes('search command requires a query argument'));
      
      console.log('✅ PASS: CLI validates required arguments');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown commands', () => {
      const result = runCLI(['unknown-command'], true);
      
      assert.notStrictEqual(result.exitCode, 0);
      assert(result.stderr.includes('Unknown command') || result.stderr.includes('unknown-command'));
      
      console.log('✅ PASS: CLI handles unknown commands');
    });
  });
});

console.log('\n🧪 Running CLI Bug Prevention Tests...\n');
console.log('These tests would have caught the bugs we found during manual testing!\n');