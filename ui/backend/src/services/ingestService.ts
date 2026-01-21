import { IngestionFactory, openDatabase } from '../../../../src/index.js';
import { DatabaseConnectionManager } from '../../../../src/core/database-connection-manager.js';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { basename } from 'path';

export interface IngestionProgress {
  sessionId: string;
  status: 'processing' | 'completed' | 'error';
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  documentErrors: number;
  embeddingErrors: number;
  processingTimeMs: number;
  currentFile?: string;
  totalFiles?: number;
  currentFileIndex?: number;
  error?: string;
  startTime: number;
}

/**
 * Result of pre-flight check for force rebuild
 */
export interface ForceRebuildPreflightResult {
  canProceed: boolean;
  errors: string[];
  warnings: string[];
  filesChecked: {
    path: string;
    exists: boolean;
    canDelete: boolean;
    error?: string;
  }[];
}

export class IngestService {
  // In-memory progress storage by session ID
  private static progressStore = new Map<string, IngestionProgress>();
  
  // Get working directory from environment (where 'raglite ui' was called)
  // or fall back to current working directory
  private static getWorkingDir(): string {
    return process.env.RAG_WORKING_DIR || process.cwd();
  }
  
  // ISSUE #1 FIX: Make path resolution dynamic (methods instead of static properties)
  // These are now methods that compute paths on each call, not frozen IIFEs
  
  /**
   * Get database path - computed dynamically on each call
   * Respects RAG_DB_FILE environment variable (same as CLI)
   */
  private static getDbPath(): string {
    const workingDir = this.getWorkingDir();
    return process.env.RAG_DB_FILE 
      ? (path.isAbsolute(process.env.RAG_DB_FILE) 
          ? process.env.RAG_DB_FILE 
          : path.resolve(workingDir, process.env.RAG_DB_FILE))
      : path.resolve(workingDir, 'db.sqlite');
  }
  
  /**
   * Get index path - computed dynamically on each call
   * Respects RAG_INDEX_FILE environment variable (same as CLI)
   */
  private static getIndexPath(): string {
    const workingDir = this.getWorkingDir();
    return process.env.RAG_INDEX_FILE 
      ? (path.isAbsolute(process.env.RAG_INDEX_FILE) 
          ? process.env.RAG_INDEX_FILE 
          : path.resolve(workingDir, process.env.RAG_INDEX_FILE))
      : path.resolve(workingDir, 'vector-index.bin');
  }

  static getProgress(sessionId: string): IngestionProgress | null {
    return this.progressStore.get(sessionId) || null;
  }

  static clearProgress(sessionId: string): void {
    this.progressStore.delete(sessionId);
  }

  /**
   * ISSUE #5 FIX: Pre-flight check for force rebuild
   * Verifies that database and index files can be deleted before attempting ingestion.
   * Returns detailed status including which files exist and whether they can be deleted.
   */
  static async checkForceRebuildPreflight(): Promise<ForceRebuildPreflightResult> {
    const dbPath = this.getDbPath();
    const indexPath = this.getIndexPath();
    const candidates = [`${dbPath}-wal`, `${dbPath}-shm`, dbPath, indexPath];
    
    const result: ForceRebuildPreflightResult = {
      canProceed: true,
      errors: [],
      warnings: [],
      filesChecked: []
    };

    for (const filePath of candidates) {
      const fileCheck: ForceRebuildPreflightResult['filesChecked'][0] = {
        path: filePath,
        exists: false,
        canDelete: true
      };

      try {
        // Check if file exists
        await fs.access(filePath);
        fileCheck.exists = true;

        // Try to open file for writing to check if it's locked
        // On Windows, this will fail if another process has the file open
        const handle = await fs.open(filePath, 'r+');
        await handle.close();
        fileCheck.canDelete = true;
      } catch (e: any) {
        if (e?.code === 'ENOENT') {
          // File doesn't exist - that's fine for force rebuild
          fileCheck.exists = false;
          fileCheck.canDelete = true;
        } else if (e?.code === 'EBUSY' || e?.code === 'EACCES' || e?.code === 'EPERM') {
          // File is locked or permission denied
          fileCheck.exists = true;
          fileCheck.canDelete = false;
          fileCheck.error = e.message;
          result.canProceed = false;
          result.errors.push(`Cannot delete ${path.basename(filePath)}: ${e.code} - File may be in use by another process`);
        } else {
          // Other error
          fileCheck.exists = true;
          fileCheck.canDelete = false;
          fileCheck.error = e.message;
          result.warnings.push(`Unknown error checking ${path.basename(filePath)}: ${e.message}`);
        }
      }

      result.filesChecked.push(fileCheck);
    }

    // Add helpful message if we can't proceed
    if (!result.canProceed) {
      result.errors.push('');
      result.errors.push('💡 To fix this:');
      result.errors.push('   1. Close any other applications using the database');
      result.errors.push('   2. Stop any running search operations');
      result.errors.push('   3. Try again after a few seconds');
    }

    return result;
  }

  /**
   * ISSUE #3 FIX: Close all database connections before deletion
   * This ensures no file handles are left open that would prevent deletion on Windows.
   */
  private static async closeAllDatabaseConnections(): Promise<void> {
    const dbPath = this.getDbPath();
    
    console.log('🔒 Closing all database connections before force rebuild...');
    
    try {
      // Force close the specific database connection if it exists
      if (DatabaseConnectionManager.hasConnection(dbPath)) {
        await DatabaseConnectionManager.forceCloseConnection(dbPath);
        console.log(`✓ Closed connection to ${dbPath}`);
      }
      
      // Also close any connections to WAL/SHM sidecars (shouldn't exist but just in case)
      const sidecars = [`${dbPath}-wal`, `${dbPath}-shm`];
      for (const sidecar of sidecars) {
        if (DatabaseConnectionManager.hasConnection(sidecar)) {
          await DatabaseConnectionManager.forceCloseConnection(sidecar);
        }
      }
      
      // Give SQLite a moment to fully release file handles
      // This is especially important on Windows
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✓ All database connections closed');
    } catch (error) {
      console.warn('⚠️ Error closing database connections:', error);
      // Continue anyway - the deletion will fail if files are still locked
    }
  }

  /**
   * ISSUE #2 & #4 FIX: Synchronous deletion with proper error handling
   * Uses sync unlink like CLI does, and fails loudly on errors instead of silent continue.
   * 
   * ⚠️ DESTRUCTIVE: wipe DB + index for a clean rebuild (CLI parity with `--force-rebuild`)
   */
  private static async wipeDbAndIndex(): Promise<void> {
    const dbPath = this.getDbPath();
    const indexPath = this.getIndexPath();

    console.log('🗑️ Deleting existing database and index to perform a clean rebuild...');

    // ISSUE #3: Close all connections BEFORE attempting deletion
    await this.closeAllDatabaseConnections();

    // Remove WAL/SHM if present (common on SQLite with WAL journaling).
    const candidates = [`${dbPath}-wal`, `${dbPath}-shm`, dbPath, indexPath];
    const deletionErrors: string[] = [];

    for (const p of candidates) {
      try {
        // ISSUE #2 FIX: Use synchronous unlink like CLI does
        // This ensures file is deleted before we proceed
        if (existsSync(p)) {
          unlinkSync(p);
          console.log(`✓ Deleted: ${p}`);
        }
      } catch (e: any) {
        // ISSUE #4 FIX: Fail loudly on deletion errors for critical files (db and index)
        // Only silently skip if file doesn't exist
        if (e?.code === 'ENOENT') {
          // File doesn't exist - that's fine
          continue;
        }
        
        const errorMsg = `Could not remove file (${p}): ${e?.message || String(e)}`;
        console.error(`❌ ${errorMsg}`);
        
        // For database and index files, this is a critical error
        if (p === dbPath || p === indexPath) {
          deletionErrors.push(errorMsg);
        } else {
          // For WAL/SHM files, warn but don't fail
          console.warn(`⚠️ ${errorMsg}`);
        }
      }
    }

    // ISSUE #4: If we couldn't delete critical files, throw an error
    if (deletionErrors.length > 0) {
      const errorMessage = [
        '❌ Force rebuild failed: Could not delete existing database/index files.',
        '',
        'Errors:',
        ...deletionErrors.map(e => `  • ${e}`),
        '',
        '🛠️ How to fix this:',
        '  1. Close any other applications using the database',
        '  2. Stop any running search operations in this UI',
        '  3. Wait a few seconds and try again',
        '  4. On Windows, check Task Manager for processes locking the files',
        '',
        '💡 Tip: The database may be locked by:',
        '  • Active search queries',
        '  • Another browser tab with this UI open',
        '  • Background processes'
      ].join('\n');
      
      throw new Error(errorMessage);
    }

    console.log('✓ Database and index files deleted successfully');
  }

  /**
   * Check if a file extension is supported for ingestion
   * Based on the actual supported extensions from file-processor.ts
   */
  private static isSupportedFileExtension(filename: string, mode: string = 'text'): boolean {
    const ext = path.extname(filename).toLowerCase();
    
    // Supported text/document extensions
    const textExtensions = ['.md', '.txt', '.mdx', '.pdf', '.docx'];
    
    // Supported image extensions (only in multimodal mode)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    
    if (mode === 'multimodal') {
      return textExtensions.includes(ext) || imageExtensions.includes(ext);
    } else {
      // Text mode: only text/document files
      return textExtensions.includes(ext);
    }
  }

  /**
   * Detect content type from file extension
   * Returns MIME type string compatible with ingestFromMemory
   * Returns null for unsupported file types
   */
  private static detectContentTypeFromFilename(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();
    
    // Text formats
    switch (ext) {
      case '.txt': return 'text/plain';
      case '.md':
      case '.mdx':
      case '.markdown': return 'text/markdown';
      case '.html':
      case '.htm': return 'text/html';
      case '.css': return 'text/css';
      case '.js':
      case '.mjs': return 'application/javascript';
      case '.json': return 'application/json';
      case '.xml': return 'application/xml';
      case '.csv': return 'text/csv';
      // Document formats
      case '.pdf': return 'application/pdf';
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.doc': return 'application/msword';
      // Image formats
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      case '.bmp': return 'image/bmp';
      default: return null; // Unsupported extension
    }
  }

  static async ingestFiles(fileMappings: Array<{ buffer: Buffer; originalName: string } | { tempPath: string; originalName: string }> | string[], options: any = {}): Promise<string> {
    // Handle backward compatibility: if string[] is passed, convert to mapping format
    // Also handle old format with tempPath for backward compatibility
    const mappings: Array<{ buffer?: Buffer; tempPath?: string; originalName: string }> = 
      typeof fileMappings[0] === 'string' 
        ? (fileMappings as string[]).map(p => ({ tempPath: p, originalName: basename(p) }))
        : fileMappings as Array<{ buffer?: Buffer; tempPath?: string; originalName: string }>;
    const sessionId = options.sessionId || randomUUID();
    const startTime = Date.now();
    
    // Initialize progress
    const progress: IngestionProgress = {
      sessionId,
      status: 'processing',
      documentsProcessed: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      documentErrors: 0,
      embeddingErrors: 0,
      processingTimeMs: 0,
      totalFiles: mappings.length,
      currentFileIndex: 0,
      startTime
    };
    this.progressStore.set(sessionId, progress);

    // Get paths dynamically (ISSUE #1 FIX)
    const dbPath = this.getDbPath();
    const indexPath = this.getIndexPath();

    // Run ingestion in background (don't await)
    (async () => {
      let pipeline: any = null;
      try {
        // ISSUE #5 FIX: Run pre-flight check before force rebuild
        if (options.forceRebuild) {
          console.log('🔍 Running pre-flight check for force rebuild...');
          const preflight = await this.checkForceRebuildPreflight();
          
          if (!preflight.canProceed) {
            throw new Error(
              '❌ Force rebuild pre-flight check failed:\n' +
              preflight.errors.join('\n')
            );
          }
          
          if (preflight.warnings.length > 0) {
            console.warn('⚠️ Pre-flight warnings:\n' + preflight.warnings.join('\n'));
          }
          
          console.log('✓ Pre-flight check passed');
          
          // --forceRebuild (CLI parity): wipe DB+index BEFORE creating pipeline
          // ISSUES #2, #3, #4 FIX: Proper deletion with connection cleanup
          await this.wipeDbAndIndex();
        }

        const factoryOptions: any = {
          mode: options.mode || 'text',
          embeddingModel: options.model
        };

        // Chunk configuration
        if (options.chunkSize) factoryOptions.chunkSize = options.chunkSize;
        if (options.chunkOverlap) factoryOptions.chunkOverlap = options.chunkOverlap;

        // Index management
        if (options.forceRebuild) factoryOptions.forceRebuild = true;

        pipeline = await IngestionFactory.create(dbPath, indexPath, factoryOptions);

        // Prepare ingestion options for ingestFile/ingestPath
      const ingestionOptions: any = {
        mode: options.mode || 'text'
      };

      // Chunk configuration
      if (options.chunkSize || options.chunkOverlap) {
        ingestionOptions.chunkConfig = {
          chunkSize: options.chunkSize || 250,
          chunkOverlap: options.chunkOverlap || 50
        };
      }

      // Get working directory for relative path resolution
      // Note: The ingestion pipeline's path manager uses process.cwd() as base, so we match that
      const workingDir = this.getWorkingDir();
      const pathStorageStrategy = options.pathStorageStrategy || 'relative';
      // The path manager in ingestion pipeline uses process.cwd(), so we use that for consistency
      const pathManagerBase = process.cwd();

      const results = [];
      for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        const { buffer, tempPath, originalName } = mapping;
        
        // Determine the document source path based on storage strategy
        // Use original filename, preserving any directory structure from the original name
        // ingestFromMemory uses displayName directly as document source (no path manager processing)
        let documentSource: string;
        if (pathStorageStrategy === 'absolute') {
          // For absolute, construct a path using the working directory + original name
          documentSource = path.isAbsolute(originalName) 
            ? originalName 
            : path.resolve(pathManagerBase, originalName);
        } else {
          // For relative, use just the original filename (or relative path if it contains separators)
          // If originalName already contains path separators (from folder upload), preserve them
          documentSource = path.isAbsolute(originalName)
            ? path.relative(pathManagerBase, originalName)
            : originalName; // Preserve relative path structure from folder uploads
        }
        
        // Update progress - create new object to ensure reactivity
        const updatedProgress = {
          ...progress,
          currentFile: path.basename(originalName),
          currentFileIndex: i + 1
        };
        this.progressStore.set(sessionId, updatedProgress);
        Object.assign(progress, updatedProgress);

        console.log(`Ingesting file ${i + 1}/${mappings.length}: ${originalName} -> ${documentSource}`);
        
        try {
            // Validate file extension before processing
            const mode = options.mode || 'text';
            if (!this.isSupportedFileExtension(originalName, mode)) {
              const ext = path.extname(originalName).toLowerCase();
              const supportedText = ['.md', '.txt', '.mdx', '.pdf', '.docx'];
              const supportedImages = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
              const supported = mode === 'multimodal' 
                ? [...supportedText, ...supportedImages]
                : supportedText;
              
              console.warn(`⚠️  Skipping unsupported file type: ${originalName} (extension: ${ext || 'none'})`);
              console.warn(`   Supported in ${mode} mode: ${supported.join(', ')}`);
              
              // Count as error (unsupported file type)
              const errorProgress = {
                ...progress,
                documentErrors: progress.documentErrors + 1
              };
              this.progressStore.set(sessionId, errorProgress);
              Object.assign(progress, errorProgress);
              
              results.push({
                documentsProcessed: 0,
                chunksCreated: 0,
                embeddingsGenerated: 0,
                documentErrors: 1,
                embeddingErrors: 0,
                processingTimeMs: 0
              });
              
              continue; // Skip to next file
            }
            
            // Get file buffer: prefer buffer from memory storage, fallback to reading from tempPath
            let fileBuffer: Buffer;
            if (buffer) {
              // Use buffer directly from memory storage (no disk I/O needed)
              fileBuffer = buffer;
            } else if (tempPath) {
              // Fallback: read from temp path (backward compatibility)
              fileBuffer = await fs.readFile(tempPath);
              // Clean up temp file after reading
              try {
                await fs.unlink(tempPath);
              } catch (unlinkError) {
                console.warn(`⚠️  Could not delete temp file ${tempPath}:`, unlinkError);
              }
            } else {
              throw new Error(`No buffer or tempPath provided for file: ${originalName}`);
            }
            
            // Detect content type from filename
            const contentType = this.detectContentTypeFromFilename(originalName);
            
            if (!contentType) {
              throw new Error(`Unable to determine content type for file: ${originalName}`);
            }
            
            // Use ingestFromMemory - this preserves paths correctly and uses raglite-ts API properly
            // No database manipulation needed - the API handles everything correctly
            const contentId = await pipeline.ingestFromMemory(
              fileBuffer,
              {
                displayName: documentSource, // This becomes the document source directly
                originalPath: documentSource, // Store original path in metadata
                contentType: contentType // contentType is guaranteed to be non-null here
              },
              ingestionOptions
            );
            
            // CRITICAL: Save index after each file to ensure vectors are persisted
            // Without this, if the index reloads or there's an issue, vectors are lost
            try {
              await pipeline.saveIndex();
              console.log(`✓ Index saved after ingesting ${originalName}`);
            } catch (saveError) {
              console.warn(`⚠️  Failed to save index after ${originalName}:`, saveError);
              // Don't fail the ingestion if index save fails, but log it
            }
            
            // Query database to get actual stats for this document
            // Note: If content was deduplicated, ingestFromMemory returns early and no document is created
            // So we check if a document exists - if it does, count it; if not, it was deduplicated (count 0)
            const db = await openDatabase(dbPath);
            try {
              // Small delay to ensure database transaction is committed
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Normalize path separators for cross-platform compatibility
              // SQLite stores paths as-is, so we need to match exactly
              const normalizedSource = documentSource.replace(/\\/g, '/');
              
              // Try exact match first
              let doc = await db.get('SELECT id FROM documents WHERE source = ?', [documentSource]);
              
              // If not found, try with normalized path (forward slashes)
              if (!doc && normalizedSource !== documentSource) {
                doc = await db.get('SELECT id FROM documents WHERE source = ?', [normalizedSource]);
              }
              
              // If still not found, try reverse normalization (backslashes on Windows)
              if (!doc && process.platform === 'win32') {
                const windowsSource = documentSource.replace(/\//g, '\\');
                if (windowsSource !== documentSource) {
                  doc = await db.get('SELECT id FROM documents WHERE source = ?', [windowsSource]);
                }
              }
              
              if (doc) {
                const chunkCountResult = await db.get('SELECT COUNT(*) as count FROM chunks WHERE document_id = ?', [doc.id]);
                const chunkCount = chunkCountResult?.count || 0;
                
                console.log(`✓ Document found: ${documentSource} (id: ${doc.id}, chunks: ${chunkCount})`);
                
                // Count this document and its chunks
                const fileProgress = {
                  ...progress,
                  documentsProcessed: progress.documentsProcessed + 1,
                  chunksCreated: progress.chunksCreated + chunkCount,
                  embeddingsGenerated: progress.embeddingsGenerated + chunkCount, // Assume 1:1 chunks:embeddings
                };
                this.progressStore.set(sessionId, fileProgress);
                Object.assign(progress, fileProgress);
                
                results.push({
                  documentsProcessed: 1,
                  chunksCreated: chunkCount,
                  embeddingsGenerated: chunkCount,
                  documentErrors: 0,
                  embeddingErrors: 0,
                  processingTimeMs: 0
                });
              } else {
                // Document not found - check if it might exist with a different path format
                // List a few recent documents to help debug
                const recentDocs = await db.all('SELECT source FROM documents ORDER BY id DESC LIMIT 5');
                console.log(`⚠️  Document not found: "${documentSource}"`);
                console.log(`   Recent document sources:`, recentDocs.map((d: any) => `"${d.source}"`));
                console.log(`   Content was likely deduplicated (contentId: ${contentId})`);
                
                results.push({
                  documentsProcessed: 0,
                  chunksCreated: 0,
                  embeddingsGenerated: 0,
                  documentErrors: 0,
                  embeddingErrors: 0,
                  processingTimeMs: 0
                });
              }
            } finally {
              await db.close();
            }
            
            console.log(`✓ Ingested ${originalName} (contentId: ${contentId})`);
          } catch (fileError: any) {
            console.error(`Failed to ingest file ${originalName}:`, fileError);
            
            // Clean up temp file if it exists (backward compatibility)
            if (tempPath) {
              try {
                await fs.unlink(tempPath);
              } catch (unlinkError) {
                // Ignore unlink errors
              }
            }
            
            // Update progress with error
            const errorProgress = {
              ...progress,
              documentErrors: progress.documentErrors + 1
            };
            this.progressStore.set(sessionId, errorProgress);
            Object.assign(progress, errorProgress);
            
            results.push({
              documentsProcessed: 0,
              chunksCreated: 0,
              embeddingsGenerated: 0,
              documentErrors: 1,
              embeddingErrors: 0,
              processingTimeMs: 0
            });
          }
        }

        // Sum up results
        const summary = results.reduce((acc, curr) => ({
          documentsProcessed: acc.documentsProcessed + curr.documentsProcessed,
          chunksCreated: acc.chunksCreated + curr.chunksCreated,
          embeddingsGenerated: acc.embeddingsGenerated + curr.embeddingsGenerated,
          documentErrors: acc.documentErrors + curr.documentErrors,
          embeddingErrors: acc.embeddingErrors + curr.embeddingErrors,
          processingTimeMs: acc.processingTimeMs + curr.processingTimeMs
        }), {
          documentsProcessed: 0,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          documentErrors: 0,
          embeddingErrors: 0,
          processingTimeMs: 0
        });

        // Final index save to ensure all vectors are persisted
        // (We also save after each file, but this is a safety net)
        try {
          await pipeline.saveIndex();
          console.log('✓ Final index save completed');
        } catch (saveError) {
          console.warn('⚠️  Failed to perform final index save:', saveError);
        }

        // Mark as completed - create new object
        const completedProgress = {
          ...progress,
          status: 'completed' as const,
          processingTimeMs: Date.now() - startTime
        };
        this.progressStore.set(sessionId, completedProgress);

        return summary;
      } catch (error: any) {
        // Mark as error - create new object
        const errorProgress = {
          ...progress,
          status: 'error' as const,
          error: error.message,
          processingTimeMs: Date.now() - startTime
        };
        this.progressStore.set(sessionId, errorProgress);
        throw error;
      } finally {
        if (pipeline) {
          await pipeline.cleanup();
        }
      }
    })().catch((error: any) => {
      console.error('Background ingestion error:', error);
      const storedProgress = this.progressStore.get(sessionId);
      if (storedProgress) {
        const errorProgress = {
          ...storedProgress,
          status: 'error' as const,
          error: error.message
        };
        this.progressStore.set(sessionId, errorProgress);
      }
    });

    // Return session ID immediately, ingestion continues in background
    return sessionId;
  }

  static async ingestDirectory(dirPath: string, options: any = {}): Promise<string> {
    const sessionId = options.sessionId || randomUUID();
    const startTime = Date.now();
    
    // Get paths dynamically (ISSUE #1 FIX)
    const dbPath = this.getDbPath();
    const indexPath = this.getIndexPath();
    
    // Initialize progress
    const progress: IngestionProgress = {
      sessionId,
      status: 'processing',
      documentsProcessed: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      documentErrors: 0,
      embeddingErrors: 0,
      processingTimeMs: 0,
      currentFile: path.basename(dirPath),
      startTime
    };
    this.progressStore.set(sessionId, progress);

    // Run ingestion in background (don't await)
    (async () => {
      // ISSUE #5 FIX: Run pre-flight check before force rebuild
      if (options.forceRebuild) {
        console.log('🔍 Running pre-flight check for force rebuild...');
        const preflight = await this.checkForceRebuildPreflight();
        
        if (!preflight.canProceed) {
          throw new Error(
            '❌ Force rebuild pre-flight check failed:\n' +
            preflight.errors.join('\n')
          );
        }
        
        if (preflight.warnings.length > 0) {
          console.warn('⚠️ Pre-flight warnings:\n' + preflight.warnings.join('\n'));
        }
        
        console.log('✓ Pre-flight check passed');
        
        // --forceRebuild (CLI parity): wipe DB+index BEFORE creating pipeline
        // ISSUES #2, #3, #4 FIX: Proper deletion with connection cleanup
        await this.wipeDbAndIndex();
      }

      const factoryOptions: any = {
        mode: options.mode || 'text',
        embeddingModel: options.model
      };

      // Chunk configuration
      if (options.chunkSize) factoryOptions.chunkSize = options.chunkSize;
      if (options.chunkOverlap) factoryOptions.chunkOverlap = options.chunkOverlap;

      // Index management
      if (options.forceRebuild) factoryOptions.forceRebuild = true;

      const pipeline = await IngestionFactory.create(dbPath, indexPath, factoryOptions);

      // Prepare ingestion options for ingestPath
      const ingestionOptions: any = {
        mode: options.mode || 'text'
      };

      // Chunk configuration
      if (options.chunkSize || options.chunkOverlap) {
        ingestionOptions.chunkConfig = {
          chunkSize: options.chunkSize || 250,
          chunkOverlap: options.chunkOverlap || 50
        };
      }

      try {
        // Update progress during processing
        // Note: ingestPath doesn't provide per-file progress, so we'll update at completion
        const result = await pipeline.ingestPath(dirPath, ingestionOptions);

        // Update progress with final results - create new object
        const completedProgress = {
          ...progress,
          status: 'completed' as const,
          documentsProcessed: result.documentsProcessed,
          chunksCreated: result.chunksCreated,
          embeddingsGenerated: result.embeddingsGenerated,
          documentErrors: result.documentErrors,
          embeddingErrors: result.embeddingErrors,
          processingTimeMs: Date.now() - startTime
        };
        this.progressStore.set(sessionId, completedProgress);

        return result;
      } catch (error: any) {
        // Mark as error - create new object
        const errorProgress = {
          ...progress,
          status: 'error' as const,
          error: error.message,
          processingTimeMs: Date.now() - startTime
        };
        this.progressStore.set(sessionId, errorProgress);
        throw error;
      } finally {
        if (pipeline) {
          await pipeline.cleanup();
        }
      }
    })().catch((error: any) => {
      console.error('Background ingestion error:', error);
      const storedProgress = this.progressStore.get(sessionId);
      if (storedProgress) {
        const errorProgress = {
          ...storedProgress,
          status: 'error' as const,
          error: error.message
        };
        this.progressStore.set(sessionId, errorProgress);
      }
    });

    // Return session ID immediately, ingestion continues in background
    return sessionId;
  }
}
