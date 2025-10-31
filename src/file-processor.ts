import { promises as fs } from 'fs';
import { join, extname, basename, resolve } from 'path';
import { handleError, ErrorCategory, ErrorSeverity, safeExecute } from './core/error-handler.js';
import { preprocessDocument } from './preprocess.js';
import { config } from './core/config.js';
import { DocumentPathManager } from './core/path-manager.js';
import type { Document } from './core/types.js';
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
const SUPPORTED_TEXT_EXTENSIONS = ['.md', '.txt', '.mdx', '.pdf', '.docx'];

/**
 * Supported image file extensions for multimodal ingestion
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * All supported file extensions (text + image)
 */
const SUPPORTED_EXTENSIONS = [...SUPPORTED_TEXT_EXTENSIONS, ...SUPPORTED_IMAGE_EXTENSIONS];

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
 * Default options for image-to-text processing
 */
export const DEFAULT_IMAGE_TO_TEXT_OPTIONS: ImageToTextOptions = {
  model: 'Xenova/vit-gpt2-image-captioning',
  maxLength: 50,
  batchSize: 4,
  includeConfidence: false
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
 * Image description generation result
 */
export interface ImageDescriptionResult {
  /** Generated text description */
  description: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Model used for generation */
  model: string;
}

/**
 * Options for image-to-text processing
 */
export interface ImageToTextOptions {
  /** Model to use for image captioning */
  model?: string;
  /** Maximum description length */
  maxLength?: number;
  /** Batch size for processing multiple images */
  batchSize?: number;
  /** Whether to include confidence scores */
  includeConfidence?: boolean;
}

/**
 * Image metadata extracted from image files
 */
export interface ImageMetadata {
  /** Original file path */
  originalPath: string;
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** File size in bytes */
  fileSize: number;
  /** Image format (jpeg, png, gif, webp, bmp) */
  format: string;
  /** File creation date */
  createdAt?: Date;
  /** Generated text description (if available) */
  description?: string;
  /** Model used for description generation */
  descriptionModel?: string;
  /** Confidence score for description */
  descriptionConfidence?: number;
}

/**
 * Check if a file has a supported extension
 */
function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Determine content type based on file extension
 */
function getContentType(filePath: string): 'text' | 'image' {
  const ext = extname(filePath).toLowerCase();
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  return 'text';
}

/**
 * Check if a file is an image file
 */
function isImageFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Validate image file format and accessibility
 */
async function validateImageFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const stats = await fs.stat(filePath);
    
    // Check if file is readable
    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }

    // Check file size (images can be larger than text files)
    const maxImageSize = 50 * 1024 * 1024; // 50MB for images
    if (stats.size > maxImageSize) {
      return { 
        valid: false, 
        error: `Image file size (${Math.round(stats.size / 1024 / 1024)}MB) exceeds maximum (50MB)` 
      };
    }

    // Check if file is empty
    if (stats.size === 0) {
      return { valid: false, error: 'Image file is empty' };
    }

    // Basic format validation by reading file header
    const buffer = await fs.readFile(filePath, { encoding: null });
    const ext = extname(filePath).toLowerCase();
    
    // Validate file signatures (magic numbers)
    if (ext === '.jpg' || ext === '.jpeg') {
      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        return { valid: false, error: 'Invalid JPEG file format' };
      }
    } else if (ext === '.png') {
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      for (let i = 0; i < pngSignature.length; i++) {
        if (buffer[i] !== pngSignature[i]) {
          return { valid: false, error: 'Invalid PNG file format' };
        }
      }
    } else if (ext === '.gif') {
      const gifSignature = [0x47, 0x49, 0x46]; // "GIF"
      for (let i = 0; i < gifSignature.length; i++) {
        if (buffer[i] !== gifSignature[i]) {
          return { valid: false, error: 'Invalid GIF file format' };
        }
      }
    } else if (ext === '.webp') {
      // WebP: "RIFF" at start and "WEBP" at offset 8
      if (buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46) {
        return { valid: false, error: 'Invalid WebP file format (missing RIFF header)' };
      }
      if (buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50) {
        return { valid: false, error: 'Invalid WebP file format (missing WEBP signature)' };
      }
    } else if (ext === '.bmp') {
      if (buffer[0] !== 0x42 || buffer[1] !== 0x4D) { // "BM"
        return { valid: false, error: 'Invalid BMP file format' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Failed to validate image file: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
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
            // Check file size based on content type
            const stats = await fs.stat(fullPath);
            const contentType = getContentType(fullPath);
            
            // Different size limits for different content types
            const maxSize = contentType === 'image' 
              ? 50 * 1024 * 1024  // 50MB for images
              : (options.maxFileSize || 10 * 1024 * 1024); // 10MB for text files
            
            if (stats.size > maxSize) {
              result.skipped.push({
                path: fullPath,
                reason: `File size (${Math.round(stats.size / 1024 / 1024)}MB) exceeds maximum (${Math.round(maxSize / 1024 / 1024)}MB) for ${contentType} files`
              });
              continue;
            }

            // Additional validation for image files
            if (contentType === 'image') {
              const validation = await validateImageFile(fullPath);
              if (!validation.valid) {
                result.skipped.push({
                  path: fullPath,
                  reason: validation.error || 'Invalid image file'
                });
                continue;
              }
            }

            result.files.push(fullPath);
          } catch (error) {
            result.skipped.push({
              path: fullPath,
              reason: `Failed to validate file: ${error instanceof Error ? error.message : String(error)}`
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
            reason: `Unsupported file extension. Supported text: ${SUPPORTED_TEXT_EXTENSIONS.join(', ')}, images: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`
          }]
        };
      }

      const contentType = getContentType(resolvedPath);
      
      // Check file size based on content type
      const maxSize = contentType === 'image' 
        ? 50 * 1024 * 1024  // 50MB for images
        : (options.maxFileSize || 10 * 1024 * 1024); // 10MB for text files
      
      if (stats.size > maxSize) {
        return {
          files: [],
          skipped: [{
            path: resolvedPath,
            reason: `File size (${Math.round(stats.size / 1024 / 1024)}MB) exceeds maximum (${Math.round(maxSize / 1024 / 1024)}MB) for ${contentType} files`
          }]
        };
      }

      // Additional validation for image files
      if (contentType === 'image') {
        const validation = await validateImageFile(resolvedPath);
        if (!validation.valid) {
          return {
            files: [],
            skipped: [{
              path: resolvedPath,
              reason: validation.error || 'Invalid image file'
            }]
          };
        }
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
 * Cache for image-to-text pipeline to avoid reloading
 */
let imageToTextPipeline: any = null;

/**
 * Initialize the image-to-text pipeline
 */
async function initializeImageToTextPipeline(modelName: string = 'Xenova/vit-gpt2-image-captioning'): Promise<any> {
  if (imageToTextPipeline) {
    return imageToTextPipeline;
  }

  try {
    const { pipeline } = await import('@huggingface/transformers');
    console.log(`Loading image-to-text model: ${modelName}`);
    imageToTextPipeline = await pipeline('image-to-text', modelName);
    console.log(`Successfully loaded image-to-text model: ${modelName}`);
    return imageToTextPipeline;
  } catch (error) {
    console.error(`Failed to load image-to-text model ${modelName}:`, error);
    throw new Error(`Failed to initialize image-to-text pipeline: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse PNG image dimensions from file buffer
 */
function parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length < 24) return null;
    
    // Check PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngSignature.length; i++) {
      if (buffer[i] !== pngSignature[i]) return null;
    }
    
    // IHDR chunk starts at byte 8, dimensions at bytes 16-23
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    
    return { width, height };
  } catch (error) {
    return null;
  }
}

/**
 * Parse JPEG image dimensions from file buffer
 */
function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 4) return null;
    
    // Check JPEG signature
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
    
    let offset = 2;
    while (offset < buffer.length - 8) {
      // Find SOF (Start of Frame) markers
      if (buffer[offset] === 0xFF) {
        const marker = buffer[offset + 1];
        
        // SOF0 (0xC0) or SOF2 (0xC2) markers contain dimensions
        if (marker === 0xC0 || marker === 0xC2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        
        // Skip to next marker
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      } else {
        offset++;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse GIF image dimensions from file buffer
 */
function parseGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 10) return null;
    
    // Check GIF signature
    const gifSignature = [0x47, 0x49, 0x46]; // "GIF"
    for (let i = 0; i < gifSignature.length; i++) {
      if (buffer[i] !== gifSignature[i]) return null;
    }
    
    // Dimensions are at bytes 6-9 (little endian)
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    
    return { width, height };
  } catch (error) {
    return null;
  }
}

/**
 * Parse WebP image dimensions from file buffer
 */
function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 30) return null;
    
    // Check WebP signature
    if (buffer.readUInt32BE(0) !== 0x52494646) return null; // "RIFF"
    if (buffer.readUInt32BE(8) !== 0x57454250) return null; // "WEBP"
    
    // VP8 format
    if (buffer.readUInt32BE(12) === 0x56503820) { // "VP8 "
      const width = buffer.readUInt16LE(26) & 0x3FFF;
      const height = buffer.readUInt16LE(28) & 0x3FFF;
      return { width, height };
    }
    
    // VP8L format
    if (buffer.readUInt32BE(12) === 0x5650384C) { // "VP8L"
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3FFF) + 1;
      const height = ((bits >> 14) & 0x3FFF) + 1;
      return { width, height };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse BMP image dimensions from file buffer
 */
function parseBmpDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 26) return null;
    
    // Check BMP signature
    if (buffer[0] !== 0x42 || buffer[1] !== 0x4D) return null; // "BM"
    
    // Dimensions are at bytes 18-25 (little endian)
    const width = buffer.readInt32LE(18);
    const height = Math.abs(buffer.readInt32LE(22)); // Height can be negative
    
    return { width, height };
  } catch (error) {
    return null;
  }
}

/**
 * Extract image dimensions from file buffer based on format
 */
function extractImageDimensions(buffer: Buffer, format: string): { width: number; height: number } | null {
  switch (format.toLowerCase()) {
    case 'png':
      return parsePngDimensions(buffer);
    case 'jpg':
    case 'jpeg':
      return parseJpegDimensions(buffer);
    case 'gif':
      return parseGifDimensions(buffer);
    case 'webp':
      return parseWebpDimensions(buffer);
    case 'bmp':
      return parseBmpDimensions(buffer);
    default:
      return null;
  }
}

/**
 * Extract metadata from an image file using native parsing
 */
async function extractImageMetadata(imagePath: string): Promise<ImageMetadata> {
  try {
    const stats = await fs.stat(imagePath);
    const format = extname(imagePath).toLowerCase().substring(1);
    
    // Read file buffer for dimension extraction
    const buffer = await fs.readFile(imagePath);
    
    // Extract dimensions using native parsing
    const dimensions = extractImageDimensions(buffer, format);
    
    const imageMetadata: ImageMetadata = {
      originalPath: imagePath,
      dimensions: dimensions || { width: 0, height: 0 }, // Use 0 if dimensions can't be extracted
      fileSize: stats.size,
      format: format,
      createdAt: stats.birthtime || stats.mtime
    };

    return imageMetadata;
  } catch (error) {
    throw new Error(`Failed to extract metadata for image ${imagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate text description for a single image
 */
async function generateImageDescription(
  imagePath: string,
  options: ImageToTextOptions = DEFAULT_IMAGE_TO_TEXT_OPTIONS
): Promise<ImageDescriptionResult> {
  try {
    const pipeline = await initializeImageToTextPipeline(options.model);
    
    // Generate description
    const result = await pipeline(imagePath, {
      max_length: options.maxLength || 50,
      num_beams: 4,
      early_stopping: true
    });

    // Extract description and confidence
    const description = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;
    const confidence = Array.isArray(result) ? result[0]?.score : result?.score;

    if (!description) {
      throw new Error('No description generated for image');
    }

    // Clean up the description
    const cleanDescription = description.trim();
    
    return {
      description: cleanDescription,
      confidence: options.includeConfidence ? confidence : undefined,
      model: options.model || DEFAULT_IMAGE_TO_TEXT_OPTIONS.model!
    };
  } catch (error) {
    throw new Error(`Failed to generate description for image ${imagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate text descriptions for multiple images in batches
 */
async function generateImageDescriptionsBatch(
  imagePaths: string[],
  options: ImageToTextOptions = DEFAULT_IMAGE_TO_TEXT_OPTIONS
): Promise<Array<{ path: string; result?: ImageDescriptionResult; error?: string }>> {
  const results: Array<{ path: string; result?: ImageDescriptionResult; error?: string }> = [];
  const batchSize = options.batchSize || DEFAULT_IMAGE_TO_TEXT_OPTIONS.batchSize!;

  // Process images in batches
  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);
    console.log(`Processing image batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imagePaths.length / batchSize)} (${batch.length} images)`);

    // Process batch in parallel
    const batchPromises = batch.map(async (imagePath) => {
      try {
        const result = await generateImageDescription(imagePath, options);
        return { path: imagePath, result };
      } catch (error) {
        return { 
          path: imagePath, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Generate text descriptions for multiple images using optimized batch processing
 * Uses BatchProcessingOptimizer for memory-efficient processing of large image collections
 */
async function generateImageDescriptionsBatchOptimized(
  imagePaths: string[],
  options: ImageToTextOptions = DEFAULT_IMAGE_TO_TEXT_OPTIONS
): Promise<Array<{ path: string; result?: ImageDescriptionResult; error?: string }>> {
  
  // For small batches, use the existing implementation
  if (imagePaths.length <= 10) {
    return generateImageDescriptionsBatch(imagePaths, options);
  }
  
  try {
    // Import batch processing optimizer
    const { createImageBatchProcessor } = await import('./core/batch-processing-optimizer.js');
    const batchProcessor = createImageBatchProcessor();
    
    // Convert image paths to batch items
    const batchItems = imagePaths.map(path => ({
      content: path,
      contentType: 'image' as const,
      metadata: { originalPath: path }
    }));
    
    // Create image description function
    const imageDescriptionFunction = async (item: any) => {
      try {
        const result = await generateImageDescription(item.content, options);
        return {
          embedding_id: `img_desc_${Date.now()}_${Math.random()}`,
          vector: new Float32Array([0]), // Placeholder vector
          contentType: 'image',
          metadata: {
            path: item.content,
            description: result.description,
            confidence: result.confidence,
            model: result.model
          }
        };
      } catch (error) {
        throw new Error(`Failed to generate description for ${item.content}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    // Process with optimization and progress reporting
    const batchResult = await batchProcessor.processBatch(
      batchItems,
      imageDescriptionFunction,
      (stats) => {
        console.log(`Image description progress: ${stats.processedItems}/${stats.totalItems} (${Math.round((stats.processedItems / stats.totalItems) * 100)}%)`);
        console.log(`  Memory usage: ${stats.memoryUsageMB}MB (peak: ${stats.peakMemoryUsageMB}MB)`);
        
        if (stats.failedItems > 0) {
          console.log(`  Failed items: ${stats.failedItems}`);
        }
      }
    );
    
    // Log final statistics
    console.log(`✓ Image description generation complete:`);
    console.log(`  Processed: ${batchResult.stats.processedItems}/${batchResult.stats.totalItems}`);
    console.log(`  Failed: ${batchResult.stats.failedItems}`);
    console.log(`  Processing time: ${Math.round(batchResult.stats.processingTimeMs / 1000)}s`);
    console.log(`  Rate: ${Math.round(batchResult.stats.itemsPerSecond)} images/sec`);
    console.log(`  Peak memory usage: ${batchResult.stats.peakMemoryUsageMB}MB`);
    
    if (batchResult.stats.retryCount > 0) {
      console.log(`  Retries: ${batchResult.stats.retryCount}`);
    }
    
    // Convert results back to expected format
    const results: Array<{ path: string; result?: ImageDescriptionResult; error?: string }> = [];
    
    // Add successful results
    for (const result of batchResult.results) {
      if (result.metadata?.description) {
        results.push({
          path: result.metadata.path,
          result: {
            description: result.metadata.description,
            confidence: result.metadata.confidence,
            model: result.metadata.model
          }
        });
      }
    }
    
    // Add failed results
    for (const error of batchResult.errors) {
      results.push({
        path: error.item.content,
        error: error.error
      });
    }
    
    return results;
    
  } catch (error) {
    console.warn(`Optimized batch processing failed, falling back to standard batch processing: ${error instanceof Error ? error.message : String(error)}`);
    
    // Fall back to existing implementation
    return generateImageDescriptionsBatch(imagePaths, options);
  }
}

/**
 * Process image file to extract text description and metadata
 */
async function processImageFile(
  filePath: string,
  pathManager: DocumentPathManager,
  options: ImageToTextOptions = DEFAULT_IMAGE_TO_TEXT_OPTIONS
): Promise<Document> {
  try {
    // Extract image metadata first
    const imageMetadata = await extractImageMetadata(filePath);
    
    // Generate text description for the image
    const descriptionResult = await generateImageDescription(filePath, options);
    
    // Update metadata with description information
    imageMetadata.description = descriptionResult.description;
    imageMetadata.descriptionModel = descriptionResult.model;
    imageMetadata.descriptionConfidence = descriptionResult.confidence;
    
    // Create document with image description as content
    const title = extractTitle('', filePath); // Use filename as title for images
    
    // Create content that includes description and key metadata
    const content = `Image: ${title}\nDescription: ${descriptionResult.description}\nDimensions: ${imageMetadata.dimensions.width}x${imageMetadata.dimensions.height}\nFormat: ${imageMetadata.format}`;
    
    return {
      source: pathManager.toStoragePath(filePath),
      title,
      content: content.trim(),
      // Store comprehensive metadata about the image
      metadata: {
        contentType: 'image',
        ...imageMetadata // Spread all image metadata fields
      }
    };
  } catch (error) {
    // If processing fails, try to extract at least basic metadata
    console.warn(`Failed to fully process image ${filePath}, attempting basic metadata extraction: ${error instanceof Error ? error.message : String(error)}`);
    
    try {
      const imageMetadata = await extractImageMetadata(filePath);
      const title = extractTitle('', filePath);
      const content = `Image: ${title}\nDimensions: ${imageMetadata.dimensions.width}x${imageMetadata.dimensions.height}\nFormat: ${imageMetadata.format}`;
      
      return {
        source: pathManager.toStoragePath(filePath),
        title,
        content: content.trim(),
        metadata: {
          contentType: 'image',
          ...imageMetadata,
          processingError: error instanceof Error ? error.message : String(error)
        }
      };
    } catch (metadataError) {
      // Final fallback - create document with minimal information
      console.warn(`Failed to extract any metadata for image ${filePath}, using minimal fallback: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
      
      const title = extractTitle('', filePath);
      const content = `Image: ${title}\nPath: ${filePath}`;
      
      return {
        source: pathManager.toStoragePath(filePath),
        title,
        content: content.trim(),
        metadata: {
          contentType: 'image',
          originalPath: filePath,
          processingError: error instanceof Error ? error.message : String(error),
          metadataError: metadataError instanceof Error ? metadataError.message : String(metadataError)
        }
      };
    }
  }
}



/**
 * Process a single file into a Document
 */
async function processFile(
  filePath: string,
  pathManager: DocumentPathManager,
  imageToTextOptions?: ImageToTextOptions
): Promise<Document> {
  const result = await safeExecute(
    async () => {
      const contentType = getContentType(filePath);
      
      // Handle image files differently
      if (contentType === 'image') {
        return await processImageFile(filePath, pathManager, imageToTextOptions);
      }

      // Handle text files (existing logic)
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
        content: content.trim(),
        metadata: {
          contentType: 'text'
        }
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
  pathManager: DocumentPathManager,
  imageToTextOptions?: ImageToTextOptions
): Promise<DocumentProcessingResult> {
  const result: DocumentProcessingResult = {
    documents: [],
    errors: []
  };

  // Separate image and text files for optimized processing
  const imageFiles = filePaths.filter(path => getContentType(path) === 'image');
  const textFiles = filePaths.filter(path => getContentType(path) === 'text');

  // Process text files sequentially (existing behavior)
  for (const filePath of textFiles) {
    try {
      const document = await processFile(filePath, pathManager, imageToTextOptions);
      result.documents.push(document);
    } catch (error) {
      result.errors.push({
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Process image files in batches for efficiency
  if (imageFiles.length > 0) {
    console.log(`Processing ${imageFiles.length} image files with optimized batch processing`);
    
    try {
      // Use optimized batch processing for image descriptions
      const batchResults = await generateImageDescriptionsBatchOptimized(imageFiles, imageToTextOptions);
      
      // Convert batch results to documents with metadata extraction
      for (const batchResult of batchResults) {
        try {
          // Extract metadata for each image
          const imageMetadata = await extractImageMetadata(batchResult.path);
          
          if (batchResult.result) {
            // Create document from successful description generation
            imageMetadata.description = batchResult.result.description;
            imageMetadata.descriptionModel = batchResult.result.model;
            imageMetadata.descriptionConfidence = batchResult.result.confidence;
            
            const title = extractTitle('', batchResult.path);
            const content = `Image: ${title}\nDescription: ${batchResult.result.description}\nDimensions: ${imageMetadata.dimensions.width}x${imageMetadata.dimensions.height}\nFormat: ${imageMetadata.format}`;
            
            result.documents.push({
              source: pathManager.toStoragePath(batchResult.path),
              title,
              content: content.trim(),
              metadata: {
                contentType: 'image',
                ...imageMetadata
              }
            });
          } else {
            // Create fallback document for failed description generation
            const title = extractTitle('', batchResult.path);
            const content = `Image: ${title}\nDimensions: ${imageMetadata.dimensions.width}x${imageMetadata.dimensions.height}\nFormat: ${imageMetadata.format}`;
            
            result.documents.push({
              source: pathManager.toStoragePath(batchResult.path),
              title,
              content: content.trim(),
              metadata: {
                contentType: 'image',
                ...imageMetadata,
                processingError: batchResult.error
              }
            });
          }
        } catch (error) {
          result.errors.push({
            path: batchResult.path,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      // If batch processing fails entirely, fall back to individual processing
      console.warn(`Batch processing failed, falling back to individual processing: ${error instanceof Error ? error.message : String(error)}`);
      
      for (const filePath of imageFiles) {
        try {
          const document = await processFile(filePath, pathManager, imageToTextOptions);
          result.documents.push(document);
        } catch (error) {
          result.errors.push({
            path: filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
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
  pathManager?: DocumentPathManager,
  imageToTextOptions?: ImageToTextOptions
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

  // Count different content types
  const imageFiles = discoveryResult.files.filter(file => getContentType(file) === 'image');
  const textFiles = discoveryResult.files.filter(file => getContentType(file) === 'text');
  
  if (imageFiles.length > 0) {
    console.log(`  - ${textFiles.length} text files`);
    console.log(`  - ${imageFiles.length} image files`);
    
    if (imageToTextOptions?.model) {
      console.log(`Using image-to-text model: ${imageToTextOptions.model}`);
    } else {
      console.log(`Using default image-to-text model: ${DEFAULT_IMAGE_TO_TEXT_OPTIONS.model}`);
    }
  }

  // Create default path manager if not provided
  const effectivePathManager = pathManager || new DocumentPathManager(
    config.path_storage_strategy,
    resolve(path)
  );

  // Process discovered files with path manager and image-to-text options
  const processingResult = await processFiles(discoveryResult.files, effectivePathManager, imageToTextOptions);

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

/**
 * Clean up image processing resources
 * Call this when shutting down the application to free memory
 */
export async function cleanupImageProcessingResources(): Promise<void> {
  // Clean up image-to-text pipeline
  if (imageToTextPipeline) {
    try {
      // Dispose of the pipeline if it has a dispose method
      if (typeof imageToTextPipeline.dispose === 'function') {
        await imageToTextPipeline.dispose();
      }
      imageToTextPipeline = null;
      console.log('Image-to-text pipeline cleaned up');
    } catch (error) {
      console.warn('Error cleaning up image-to-text pipeline:', error);
    }
  }
}

/**
 * Clean up image-to-text pipeline resources (legacy function for backward compatibility)
 * @deprecated Use cleanupImageProcessingResources() instead
 */
export async function cleanupImageToTextPipeline(): Promise<void> {
  return cleanupImageProcessingResources();
}

/**
 * Generate description for a single image (exported for external use)
 */
export async function generateImageDescriptionForFile(
  imagePath: string,
  options?: ImageToTextOptions
): Promise<ImageDescriptionResult> {
  return generateImageDescription(imagePath, { ...DEFAULT_IMAGE_TO_TEXT_OPTIONS, ...options });
}

/**
 * Generate descriptions for multiple images (exported for external use)
 */
export async function generateImageDescriptionsForFiles(
  imagePaths: string[],
  options?: ImageToTextOptions
): Promise<Array<{ path: string; result?: ImageDescriptionResult; error?: string }>> {
  return generateImageDescriptionsBatch(imagePaths, { ...DEFAULT_IMAGE_TO_TEXT_OPTIONS, ...options });
}

/**
 * Extract metadata from a single image file (exported for external use)
 */
export async function extractImageMetadataForFile(imagePath: string): Promise<ImageMetadata> {
  return extractImageMetadata(imagePath);
}

/**
 * Extract metadata from multiple image files (exported for external use)
 */
export async function extractImageMetadataForFiles(
  imagePaths: string[]
): Promise<Array<{ path: string; metadata?: ImageMetadata; error?: string }>> {
  const results: Array<{ path: string; metadata?: ImageMetadata; error?: string }> = [];
  
  for (const imagePath of imagePaths) {
    try {
      const metadata = await extractImageMetadata(imagePath);
      results.push({ path: imagePath, metadata });
    } catch (error) {
      results.push({ 
        path: imagePath, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  return results;
}