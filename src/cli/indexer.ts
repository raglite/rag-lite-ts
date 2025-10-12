import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { TextIngestionFactory } from '../factories/text-factory.js';
import { EXIT_CODES, ConfigurationError } from '../core/config.js';

/**
 * Run document ingestion from CLI
 * @param path - File or directory path to ingest
 * @param options - CLI options including model selection
 */
export async function runIngest(path: string, options: Record<string, any> = {}): Promise<void> {
  try {
    // Validate path exists
    const resolvedPath = resolve(path);
    if (!existsSync(resolvedPath)) {
      console.error(`Error: Path does not exist: ${path}`);
      console.error('');
      console.error('Please check:');
      console.error('- The path is spelled correctly');
      console.error('- You have read permissions for the path');
      console.error('- The file or directory exists');
      console.error('');
      console.error('Examples:');
      console.error('  raglite ingest ./docs/           # Ingest directory');
      console.error('  raglite ingest ./readme.md       # Ingest single file');
      process.exit(EXIT_CODES.FILE_NOT_FOUND);
    }

    // Check if it's a file or directory
    let stats;
    try {
      stats = statSync(resolvedPath);
    } catch (error) {
      console.error(`Error: Cannot access path: ${path}`);
      console.error('');
      if (error instanceof Error && error.message.includes('EACCES')) {
        console.error('Permission denied. Please check that you have read permissions for this path.');
        process.exit(EXIT_CODES.PERMISSION_ERROR);
      } else {
        console.error('The path exists but cannot be accessed. Please check permissions.');
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      }
    }

    const pathType = stats.isDirectory() ? 'directory' : 'file';
    
    // Validate file type for single files
    if (stats.isFile()) {
      const validExtensions = ['.md', '.txt'];
      const hasValidExtension = validExtensions.some(ext => path.toLowerCase().endsWith(ext));
      
      if (!hasValidExtension) {
        console.error(`Error: Unsupported file type: ${path}`);
        console.error('');
        console.error('Supported file types: .md, .txt');
        console.error('');
        console.error('If you want to ingest multiple files, provide a directory path instead.');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
    }
    
    console.log(`Starting ingestion of ${pathType}: ${resolvedPath}`);
    console.log('This may take a while for large document collections...');
    console.log('');

    // Prepare factory options
    const factoryOptions: any = {};
    if (options.model) {
      factoryOptions.embeddingModel = options.model;
      console.log(`Using embedding model: ${options.model}`);
    }
    
    if (options.rebuildIfNeeded) {
      factoryOptions.forceRebuild = true;
      console.log('Force rebuild enabled due to rebuildIfNeeded option');
    }
    
    // Create ingestion pipeline using factory
    let pipeline;
    
    try {
      // Create ingestion pipeline using TextIngestionFactory
      pipeline = await TextIngestionFactory.create(
        process.env.RAG_DB_FILE || './db.sqlite',
        process.env.RAG_INDEX_FILE || './vector-index.bin',
        factoryOptions
      );
      
      const result = await pipeline.ingestPath(resolvedPath);
      
      // Display final results
      console.log('\n' + '='.repeat(50));
      console.log('INGESTION SUMMARY');
      console.log('='.repeat(50));
      console.log(`Documents processed: ${result.documentsProcessed}`);
      console.log(`Chunks created: ${result.chunksCreated}`);
      console.log(`Embeddings generated: ${result.embeddingsGenerated}`);
      
      if (result.documentErrors > 0) {
        console.log(`Document errors: ${result.documentErrors}`);
      }
      
      if (result.embeddingErrors > 0) {
        console.log(`Embedding errors: ${result.embeddingErrors}`);
      }
      
      console.log(`Total processing time: ${(result.processingTimeMs / 1000).toFixed(2)} seconds`);
      
      if (result.chunksCreated > 0) {
        const chunksPerSecond = (result.chunksCreated / (result.processingTimeMs / 1000)).toFixed(1);
        console.log(`Processing rate: ${chunksPerSecond} chunks/second`);
      }
      
      console.log('\nIngestion completed successfully!');
      console.log('You can now search your documents using: raglite search "your query"');
      
    } finally {
      if (pipeline) {
        await pipeline.cleanup();
      }
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('INGESTION FAILED');
    console.error('='.repeat(50));
    
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:');
      console.error(error.message);
      process.exit(error.exitCode);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('');
      
      // Provide specific help for common error types
      if (error.message.includes('ENOENT')) {
        console.error('File/Directory Not Found:');
        console.error('- Verify the path exists and is accessible');
        console.error('- Check file and directory permissions');
        console.error('- Ensure you have read access to the specified location');
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
        console.error('Permission Denied:');
        console.error('- Check that you have read permissions for the files/directories');
        console.error('- Ensure the database file is not locked by another process');
        console.error('- Try running with appropriate permissions');
        process.exit(EXIT_CODES.PERMISSION_ERROR);
      } else if (error.message.includes('SQLITE') || error.message.includes('database')) {
        console.error('Database Error:');
        console.error('- The database file may be corrupted or locked');
        console.error('- Try running: raglite rebuild');
        console.error('- Ensure no other RAG-lite processes are running');
        console.error('- Check available disk space');
        process.exit(EXIT_CODES.DATABASE_ERROR);
      } else if (error.message.includes('ONNX') || error.message.includes('model')) {
        console.error('Model Loading Error:');
        console.error('- The embedding model failed to load');
        console.error('- This may happen on first run while downloading the model');
        console.error('- Ensure you have internet connection for initial model download');
        console.error('- Check available disk space in the models directory');
        console.error('- Try running the command again');
        process.exit(EXIT_CODES.MODEL_ERROR);
      } else if (error.message.includes('index') || error.message.includes('vector')) {
        console.error('Vector Index Error:');
        console.error('- The vector index may be corrupted');
        console.error('- Try running: raglite rebuild');
        console.error('- Check available disk space');
        process.exit(EXIT_CODES.INDEX_ERROR);
      } else {
        console.error('General Error:');
        console.error('- An unexpected error occurred during ingestion');
        console.error('- Check the error message above for more details');
        console.error('- Try running the command again');
        console.error('- If the problem persists, try: raglite rebuild');
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    } else {
      console.error('Unknown error:', String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}

/**
 * Run index rebuild from CLI
 */
export async function runRebuild(): Promise<void> {
  try {
    console.log('Starting index rebuild...');
    console.log('This will regenerate all embeddings and rebuild the vector index.');
    console.log('This may take a while depending on your document collection size.');
    console.log('');
    console.log('Progress will be shown below...');
    console.log('');

    // Create ingestion pipeline with force rebuild using factory
    const pipeline = await TextIngestionFactory.create(
      process.env.RAG_DB_FILE || './db.sqlite',
      process.env.RAG_INDEX_FILE || './vector-index.bin',
      { forceRebuild: true }
    );

    try {
      // Get all documents from database and re-ingest them
      const { openDatabase } = await import('../core/db.js');
      const db = await openDatabase(process.env.RAG_DB_FILE || './db.sqlite');
      
      try {
        const documents = await db.all('SELECT DISTINCT source FROM documents ORDER BY source');
        
        if (documents.length === 0) {
          throw new Error('No documents found in database. Nothing to rebuild.');
        }

        console.log(`Found ${documents.length} document${documents.length === 1 ? '' : 's'} to rebuild`);
        
        let totalResult = {
          documentsProcessed: 0,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: 0,
          embeddingErrors: 0,
          processingTimeMs: 0
        };

        // Re-ingest each document
        for (const doc of documents) {
          if (existsSync(doc.source)) {
            console.log(`Rebuilding: ${doc.source}`);
            const result = await pipeline.ingestFile(doc.source);
            
            totalResult.documentsProcessed += result.documentsProcessed;
            totalResult.chunksCreated += result.chunksCreated;
            totalResult.embeddingsGenerated += result.embeddingsGenerated;
            totalResult.documentErrors += result.documentErrors;
            totalResult.embeddingErrors += result.embeddingErrors;
            totalResult.processingTimeMs += result.processingTimeMs;
          } else {
            console.warn(`⚠️  Document not found, skipping: ${doc.source}`);
            totalResult.documentErrors++;
          }
        }

        console.log('\n' + '='.repeat(50));
        console.log('REBUILD COMPLETE');
        console.log('='.repeat(50));
        console.log(`Documents processed: ${totalResult.documentsProcessed}`);
        console.log(`Chunks created: ${totalResult.chunksCreated}`);
        console.log(`Embeddings generated: ${totalResult.embeddingsGenerated}`);
        if (totalResult.documentErrors > 0) {
          console.log(`Document errors: ${totalResult.documentErrors}`);
        }
        if (totalResult.embeddingErrors > 0) {
          console.log(`Embedding errors: ${totalResult.embeddingErrors}`);
        }
        console.log(`Total processing time: ${(totalResult.processingTimeMs / 1000).toFixed(2)} seconds`);
        console.log('');
        console.log('The vector index has been successfully rebuilt.');
        console.log('All embeddings have been regenerated with the current model.');
        console.log('');
        console.log('You can now search your documents using: raglite search "your query"');

      } finally {
        await db.close();
      }
    } finally {
      await pipeline.cleanup();
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('REBUILD FAILED');
    console.error('='.repeat(50));
    
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:');
      console.error(error.message);
      process.exit(error.exitCode);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('');
      
      if (error.message.includes('No documents found') || error.message.includes('empty')) {
        console.error('No Documents Found:');
        console.error('- Make sure you have ingested documents first');
        console.error('- Run: raglite ingest <path>');
        console.error('- Check that your documents are in supported formats (.md, .txt)');
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      } else if (error.message.includes('SQLITE') || error.message.includes('database')) {
        console.error('Database Error:');
        console.error('- The database file may be missing or corrupted');
        console.error('- Try deleting db.sqlite and re-ingesting your documents');
        console.error('- Ensure you have write permissions in the current directory');
        process.exit(EXIT_CODES.DATABASE_ERROR);
      } else if (error.message.includes('model') || error.message.includes('ONNX')) {
        console.error('Model Error:');
        console.error('- The embedding model failed to load');
        console.error('- Ensure you have internet connection for model download');
        console.error('- Check available disk space');
        console.error('- Try deleting the models directory and running again');
        process.exit(EXIT_CODES.MODEL_ERROR);
      } else if (error.message.includes('index') || error.message.includes('vector')) {
        console.error('Index Error:');
        console.error('- Failed to rebuild the vector index');
        console.error('- Try deleting vector-index.bin and running again');
        console.error('- Check available disk space');
        process.exit(EXIT_CODES.INDEX_ERROR);
      } else {
        console.error('General Error:');
        console.error('- An unexpected error occurred during rebuild');
        console.error('- Try deleting db.sqlite and vector-index.bin, then re-ingest');
        console.error('- Check available disk space and permissions');
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    } else {
      console.error('Unknown error:', String(error));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}