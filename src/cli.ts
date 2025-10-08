#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EXIT_CODES, ConfigurationError } from './config.js';

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
RAG-lite TS v${packageJson.version}
Local-first TypeScript retrieval engine for semantic search

Usage:
  raglite <command> [options]

Commands:
  ingest <path>     Ingest documents from file or directory
  search <query>    Search indexed documents
  rebuild           Rebuild the vector index
  help              Show this help message

Examples:
  raglite ingest ./docs/           # Ingest all .md/.txt files in docs/
  raglite ingest ./readme.md       # Ingest single file
  raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2  # Use higher quality model
  raglite ingest ./docs/ --path-strategy relative --path-base /project  # Use relative paths
  raglite search "machine learning" # Search for documents about machine learning
  raglite search "API documentation" --top-k 10  # Get top 10 results

  raglite rebuild                  # Rebuild the entire index

Options for search:
  --top-k <number>    Number of results to return (default: 10)
  --rerank           Enable reranking for better results
  --no-rerank        Disable reranking

Options for ingest:
  --model <name>       Use specific embedding model
  --rebuild-if-needed  Automatically rebuild if model mismatch detected (WARNING: rebuilds entire index)
  --path-strategy <strategy>  Path storage strategy: 'relative' (default) or 'absolute'
  --path-base <path>   Base directory for relative paths (defaults to current directory)

Available models:
  sentence-transformers/all-MiniLM-L6-v2  (384 dim, fast, default)
  Xenova/all-mpnet-base-v2               (768 dim, higher quality)

For more information, visit: https://github.com/your-repo/rag-lite-ts
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  command: string;
  args: string[];
  options: Record<string, any>;
} {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { command: 'help', args: [], options: {} };
  }

  const command = args[0];
  const remainingArgs: string[] = [];
  const options: Record<string, any> = {};

  // Parse arguments and options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const optionName = arg.slice(2);

      // Handle boolean flags
      if (optionName === 'rerank') {
        options.rerank = true;
      } else if (optionName === 'no-rerank') {
        options.rerank = false;
      } else if (optionName === 'rebuild-if-needed') {
        options.rebuildIfNeeded = true;
      } else if (optionName === 'help') {
        return { command: 'help', args: [], options: {} };
      } else {
        // Handle options with values
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[optionName] = nextArg;
          i++; // Skip the next argument as it's the value
        } else {
          options[optionName] = true;
        }
      }
    } else {
      remainingArgs.push(arg);
    }
  }

  return { command, args: remainingArgs, options };
}

/**
 * Validate command line arguments
 */
function validateArgs(command: string, args: string[], options: Record<string, any>): void {
  switch (command) {
    case 'ingest':
      if (args.length === 0) {
        console.error('Error: ingest command requires a path argument');
        console.error('');
        console.error('Usage: raglite ingest <path>');
        console.error('');
        console.error('Examples:');
        console.error('  raglite ingest ./docs/           # Ingest all .md/.txt files in docs/');
        console.error('  raglite ingest ./readme.md       # Ingest single file');
        console.error('  raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2  # Use higher quality model');
        console.error('');
        console.error('Options:');
        console.error('  --model <name>         Use specific embedding model');
        console.error('  --rebuild-if-needed    Automatically rebuild if model mismatch detected');
        console.error('');
        console.error('The path can be either a file (.md or .txt) or a directory.');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      break;

    case 'search':
      if (args.length === 0) {
        console.error('Error: search command requires a query argument');
        console.error('');
        console.error('Usage: raglite search <query> [options]');
        console.error('');
        console.error('Examples:');
        console.error('  raglite search "machine learning"');
        console.error('  raglite search "API documentation" --top-k 10');
        console.error('  raglite search "tutorial" --rerank');

        console.error('');
        console.error('Options:');
        console.error('  --top-k <number>    Number of results to return (default: 10)');
        console.error('  --rerank           Enable reranking for better results');
        console.error('  --no-rerank        Disable reranking');

        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      break;

    case 'rebuild':
      // No arguments required
      break;

    case 'help':
      // No validation needed
      break;

    default:
      console.error(`Error: Unknown command '${command}'`);
      console.error('');
      console.error('Available commands: ingest, search, rebuild, help');
      console.error('Run "raglite help" for detailed usage information');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  // Validate numeric options
  if (options['top-k'] !== undefined) {
    const topK = parseInt(options['top-k'], 10);
    if (isNaN(topK) || topK <= 0) {
      console.error('Error: --top-k must be a positive number');
      console.error('');
      console.error('Examples:');
      console.error('  --top-k 5     # Return 5 results');
      console.error('  --top-k 20    # Return 20 results');
      console.error('');
      console.error('Valid range: 1-100 results');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    if (topK > 100) {
      console.warn(`Warning: Large --top-k value (${topK}) may impact performance. Consider using a smaller value.`);
    }

    options['top-k'] = topK;
  }

  // Validate model option (only for ingest command)
  if (options.model !== undefined) {
    if (command !== 'ingest') {
      console.error(`Error: --model option is only available for the 'ingest' command`);
      console.error('');
      console.error('The search command automatically uses the model that was used during ingestion.');
      console.error('To search with a different model, you need to re-ingest with that model first.');
      console.error('');
      console.error('Examples:');
      console.error('  raglite ingest ./docs/ --model Xenova/all-mpnet-base-v2');
      console.error('  raglite search "your query"  # Uses the model from ingestion');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    const supportedModels = [
      'sentence-transformers/all-MiniLM-L6-v2',
      'Xenova/all-mpnet-base-v2'
    ];

    if (!supportedModels.includes(options.model)) {
      console.error(`Error: Unsupported model '${options.model}'`);
      console.error('');
      console.error('Supported models:');
      console.error('  sentence-transformers/all-MiniLM-L6-v2  (384 dim, fast, default)');
      console.error('  Xenova/all-mpnet-base-v2               (768 dim, higher quality)');
      console.error('');
      console.error('Examples:');
      console.error('  --model sentence-transformers/all-MiniLM-L6-v2');
      console.error('  --model Xenova/all-mpnet-base-v2');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
  }

  // Validate path-strategy option (only for ingest command)
  if (options['path-strategy'] !== undefined) {
    if (command !== 'ingest') {
      console.error(`Error: --path-strategy option is only available for the 'ingest' command`);
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    const supportedStrategies = ['absolute', 'relative'];
    if (!supportedStrategies.includes(options['path-strategy'])) {
      console.error(`Error: Unsupported path strategy '${options['path-strategy']}'`);
      console.error('');
      console.error('Supported strategies:');
      console.error('  relative   Store paths relative to base directory (default, portable)');
      console.error('  absolute   Store absolute paths (legacy mode)');
      console.error('');
      console.error('Examples:');
      console.error('  --path-strategy relative');
      console.error('  --path-strategy absolute');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
  }

  // Validate path-base option (only for ingest command)
  if (options['path-base'] !== undefined) {
    if (command !== 'ingest') {
      console.error(`Error: --path-base option is only available for the 'ingest' command`);
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }

    if (typeof options['path-base'] !== 'string' || options['path-base'].trim() === '') {
      console.error('Error: --path-base must be a non-empty directory path');
      console.error('');
      console.error('Examples:');
      console.error('  --path-base /project/docs');
      console.error('  --path-base ./my-docs');
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    const { command, args, options } = parseArgs();

    // Validate arguments
    validateArgs(command, args, options);

    // Handle commands
    switch (command) {
      case 'help':
        showHelp();
        break;

      case 'ingest':
        const { runIngest } = await import('./cli/indexer.js');
        await runIngest(args[0], options);
        break;

      case 'search':
        const { runSearch } = await import('./cli/search.js');
        const query = args.join(' '); // Join all args as query
        await runSearch(query, options);
        break;

      case 'rebuild':
        const { runRebuild } = await import('./cli/indexer.js');
        await runRebuild();
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        process.exit(1);
    }

  } catch (error) {
    // Handle different error types with appropriate exit codes
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:');
      console.error(error.message);
      process.exit(error.exitCode);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);

      // Provide context-specific help for common errors
      if (error.message.includes('ENOENT')) {
        console.error('');
        console.error('This usually means a file or directory was not found.');
        console.error('Please check that the path exists and you have read permissions.');
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
        console.error('');
        console.error('Permission denied. Please check file/directory permissions.');
        process.exit(EXIT_CODES.PERMISSION_ERROR);
      } else if (error.message.includes('SQLITE') || error.message.includes('database')) {
        console.error('');
        console.error('Database error. Try running "raglite rebuild" to fix index issues.');
        process.exit(EXIT_CODES.DATABASE_ERROR);
      } else if (error.message.includes('model') || error.message.includes('ONNX')) {
        console.error('');
        console.error('Model loading error. The embedding model will be downloaded automatically on first run.');
        process.exit(EXIT_CODES.MODEL_ERROR);
      } else {
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    } else {
      console.error('Unknown error:', String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection:');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('');
  console.error('This is usually caused by an async operation that failed without proper error handling.');
  console.error('The system will exit to prevent undefined behavior.');
  console.error('');
  console.error('If this error persists, please report it with the above details.');
  process.exit(EXIT_CODES.GENERAL_ERROR);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:');
  console.error('Error:', error.message);
  console.error('');
  if (error.stack) {
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
  }
  console.error('This indicates a serious error in the application.');
  console.error('The system will exit immediately to prevent data corruption.');
  console.error('');
  console.error('Please report this issue with the above details.');
  process.exit(EXIT_CODES.GENERAL_ERROR);
});

// Handle process termination signals gracefully
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT (Ctrl+C). Shutting down gracefully...');
  console.log('If you need to force quit, press Ctrl+C again.');
  process.exit(EXIT_CODES.SUCCESS);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM. Shutting down gracefully...');
  process.exit(EXIT_CODES.SUCCESS);
});

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));

  if (error instanceof ConfigurationError) {
    process.exit(error.exitCode);
  } else {
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
});