import { promises as fs } from 'fs';
import { join, extname, basename, resolve } from 'path';
import { handleError, ErrorCategory, ErrorSeverity, safeExecute } from './error-handler.js';
import { preprocessDocument } from './preprocess.js';
import { config } from './config.js';
import { DocumentPathManager } from './path-manager.js';
import type { Document } from './types.js';
import { createRequire } from 'module';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);

// Set up DOM polyfills for PDF parsing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable'
});

// Polyfill global objects needed by pdf-parse
(global as any).DOMMatrix = dom.window.DOMMatrix || class {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor() {}
};
(global as any).ImageData = dom.window.ImageData || class {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};
(global as any).Path2D = dom.window.Path2D || class {
  constructor() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
};

const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';

/**
 * Supported file extensions for document ingestion
 */
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.mdx', '.pdf', '.docx'];

/**
 * Options for file discovery and processing
 */
export interface FileProcessorOptions {
  /** Whether to process files recursively in subdirectories */
  recursive?: boolean;
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
}

/**
 * Default options for file processing
 */
export const DEFAULT_FILE_PROCESSOR_OPTIONS: FileProcessorOptions = {
  recursive: true,
  maxFileSize: 10 * 1024 * 1024 // 10MB
};

/**
 * Result of file discovery operation
 */
export interface FileDiscoveryResult {
  /** Successfully discovered files */
  files: string[];
  /** Files that were skipped due to errors */
  skipped: Array<{
    path: string;
    reason: string;
  }>;
}

/**
 * Result of document processing operation
 */
export interface DocumentProcessingResult {
  /** Successfully processed documents */
  documents: Document[];
  /** Files that failed to process */
  errors: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Check if a file has a supported extension
 */
function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Recursively discover files in a directory
 */
async function discoverFilesRecursive(
  dirPath: string,
  options: FileProcessorOptions
): Promise<FileDiscoveryResult> {
  const result: FileDiscoveryResult = {
    files: [],
    skipped: []
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (options.recursive) {
          // Recursively process subdirectory
          const subResult = await discoverFilesRecursive(fullPath, options);
          result.files.push(...subResult.files);
          result.skipped.push(...subResult.skipped);
        }
      } else if (entry.isFile()) {
        if (isSupportedFile(fullPath)) {
          try {
            // Check file size
            const stats = await fs.stat(fullPath);
            if (options.maxFileSize && stats.size > options.maxFileSize) {
              result.skipped.push({
                path: fullPath,
                reason: `File size (${stats.size} bytes) exceeds maximum (${options.maxFileSize} bytes)`
              });
              continue;
            }

            result.files.push(fullPath);
          } catch (error) {
            result.skipped.push({
              path: fullPath,
              reason: `Failed to stat file: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
      }
    }
  } catch (error) {
    result.skipped.push({
      path: dirPath,
      reason: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return result;
}

/**
 * Discover files for ingestion
 * Supports both single files and directories (with optional recursion)
 */
export async function discoverFiles(
  path: string,
  options: FileProcessorOptions = DEFAULT_FILE_PROCESSOR_OPTIONS
): Promise<FileDiscoveryResult> {
  const resolvedPath = resolve(path);

  try {
    const stats = await fs.stat(resolvedPath);

    if (stats.isFile()) {
      // Single file processing
      if (!isSupportedFile(resolvedPath)) {
        return {
          files: [],
          skipped: [{
            path: resolvedPath,
            reason: `Unsupported file extension. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
          }]
        };
      }

      // Check file size
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return {
          files: [],
          skipped: [{
            path: resolvedPath,
            reason: `File size (${stats.size} bytes) exceeds maximum (${options.maxFileSize} bytes)`
          }]
        };
      }

      return {
        files: [resolvedPath],
        skipped: []
      };
    } else if (stats.isDirectory()) {
      // Directory processing
      return await discoverFilesRecursive(resolvedPath, options);
    } else {
      return {
        files: [],
        skipped: [{
          path: resolvedPath,
          reason: 'Path is neither a file nor a directory'
        }]
      };
    }
  } catch (error) {
    return {
      files: [],
      skipped: [{
        path: resolvedPath,
        reason: `Failed to access path: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Extract text content from PDF file
 */
async function extractPdfContent(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract text content from DOCX file
 */
async function extractDocxContent(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract document title from content
 * Looks for markdown H1 headers first, then falls back to filename
 */
function extractTitle(content: string, filePath: string): string {
  // Try to find markdown H1 header
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      const title = trimmed.substring(2).trim();
      if (title) {
        return title;
      }
    }
  }

  // Fallback to filename without extension
  const filename = basename(filePath);
  const ext = extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}



/**
 * Process a single file into a Document
 */
async function processFile(
  filePath: string,
  pathManager: DocumentPathManager
): Promise<Document> {
  const result = await safeExecute(
    async () => {
      let content: string;
      const ext = extname(filePath).toLowerCase();

      // Extract content based on file type
      switch (ext) {
        case '.pdf':
          content = await extractPdfContent(filePath);
          break;
        case '.docx':
          content = await extractDocxContent(filePath);
          break;
        case '.md':
        case '.txt':
        case '.mdx':
        default:
          content = await fs.readFile(filePath, 'utf-8');
          break;
      }

      // Validate content is not empty
      if (!content.trim()) {
        throw new Error('File is empty or contains only whitespace');
      }

      // Use preprocessing module for all content types
      content = preprocessDocument(content, filePath, config.preprocessing);

      // Validate processed content is not empty (preprocessing module ensures this)
      if (!content.trim()) {
        throw new Error('File contains no content after preprocessing');
      }

      const title = extractTitle(content, filePath);

      return {
        source: pathManager.toStoragePath(filePath), // Use path manager
        title,
        content: content.trim()
      };
    },
    `File Processing: ${filePath}`,
    {
      category: ErrorCategory.FILE_SYSTEM,
      severity: ErrorSeverity.ERROR
    }
  );

  if (!result) {
    throw new Error(`Failed to process file: ${filePath}`);
  }

  return result;
}

/**
 * Process multiple files into Documents
 * Handles errors gracefully by skipping problematic files
 */
export async function processFiles(
  filePaths: string[],
  pathManager: DocumentPathManager
): Promise<DocumentProcessingResult> {
  const result: DocumentProcessingResult = {
    documents: [],
    errors: []
  };

  for (const filePath of filePaths) {
    try {
      const document = await processFile(filePath, pathManager);
      result.documents.push(document);
    } catch (error) {
      result.errors.push({
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

/**
 * Complete file discovery and processing pipeline
 * Discovers files and processes them into Documents
 */
export async function discoverAndProcessFiles(
  path: string,
  options: FileProcessorOptions = DEFAULT_FILE_PROCESSOR_OPTIONS,
  pathManager?: DocumentPathManager
): Promise<{
  documents: Document[];
  discoveryResult: FileDiscoveryResult;
  processingResult: DocumentProcessingResult;
}> {
  console.log(`Discovering files in: ${path}`);

  // Discover files
  const discoveryResult = await discoverFiles(path, options);

  // Log discovery results
  if (discoveryResult.skipped.length > 0) {
    console.log(`Skipped ${discoveryResult.skipped.length} files:`);
    for (const skipped of discoveryResult.skipped) {
      console.error(`  - ${skipped.path}: ${skipped.reason}`);
    }
  }

  console.log(`Found ${discoveryResult.files.length} supported files`);

  // Create default path manager if not provided
  const effectivePathManager = pathManager || new DocumentPathManager(
    config.path_storage_strategy,
    resolve(path)
  );

  // Process discovered files with path manager
  const processingResult = await processFiles(discoveryResult.files, effectivePathManager);

  // Log processing results
  if (processingResult.errors.length > 0) {
    console.log(`Failed to process ${processingResult.errors.length} files:`);
    for (const error of processingResult.errors) {
      console.error(`  - ${error.path}: ${error.error}`);
    }
  }

  console.log(`Successfully processed ${processingResult.documents.length} documents`);

  return {
    documents: processingResult.documents,
    discoveryResult,
    processingResult
  };
}