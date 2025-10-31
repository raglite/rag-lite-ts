/**
 * Content System Error Handling - Comprehensive error handling for unified content system
 * Implements task 8.1: Add specific error types for content operations with clear guidance
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */

import { APIError, ErrorFactory } from '../api-errors.js';
import { CategorizedError, ErrorCategory, ErrorSeverity } from './error-handler.js';

/**
 * Content-specific error types for unified content system operations
 */
export class ContentNotFoundError extends APIError {
  constructor(contentId: string, displayName?: string, context?: string) {
    const message = displayName 
      ? `Content not found: ${displayName} (ID: ${contentId})`
      : `Content not found: ${contentId}`;
    
    super(
      message,
      'CONTENT_NOT_FOUND',
      [
        'Re-ingest the content to restore access',
        'Check that the content ID is correct',
        'Verify the content was successfully ingested previously',
        'If the content was from a file, ensure the file still exists at its original location'
      ],
      context
    );
  }
}

/**
 * Error when storage limits are exceeded
 */
export class StorageLimitExceededError extends APIError {
  constructor(
    currentUsageMB: number, 
    limitMB: number, 
    contentSizeMB: number,
    context?: string
  ) {
    const message = `Storage limit exceeded. Cannot add ${contentSizeMB}MB content. ` +
                   `Current usage: ${currentUsageMB}MB / ${limitMB}MB`;
    
    super(
      message,
      'STORAGE_LIMIT_EXCEEDED',
      [
        'Run cleanup to remove orphaned files: removeOrphanedFiles()',
        'Remove duplicate content: removeDuplicateContent()',
        'Increase storage limit in configuration',
        'Delete unused content manually from the content directory',
        `Free up at least ${Math.ceil(contentSizeMB - (limitMB - currentUsageMB))}MB of space`
      ],
      context
    );
  }
}

/**
 * Error when content format is invalid or unsupported
 */
export class InvalidContentFormatError extends APIError {
  constructor(contentType: string, reason: string, context?: string) {
    const message = `Invalid content format: ${contentType}. ${reason}`;
    
    super(
      message,
      'INVALID_CONTENT_FORMAT',
      InvalidContentFormatError.getSuggestionsForContentType(contentType),
      context
    );
  }

  private static getSuggestionsForContentType(contentType: string): string[] {
    const category = contentType.split('/')[0];
    
    switch (category) {
      case 'audio':
        return [
          'Audio files are not supported for text-based RAG processing',
          'Consider extracting transcripts or metadata from audio files',
          'Use speech-to-text services to convert audio to text before ingestion',
          'Supported formats include text, documents (PDF, DOCX), and images'
        ];
      
      case 'video':
        return [
          'Video files are not supported for text-based RAG processing',
          'Consider extracting subtitles, transcripts, or metadata from video files',
          'Use video analysis tools to extract text content before ingestion',
          'Supported formats include text, documents (PDF, DOCX), and images'
        ];
      
      case 'application':
        if (contentType.includes('executable') || contentType.includes('binary')) {
          return [
            'Executable and binary files are not supported for security reasons',
            'Only document and text formats are supported for processing',
            'Supported application formats: PDF, Office documents (DOCX, XLSX, PPTX)',
            'Convert binary data to text format if it contains readable content'
          ];
        } else {
          return [
            'This application format is not currently supported',
            'Supported application formats: PDF, Office documents (DOCX, XLSX, PPTX), JSON, XML',
            'Convert the content to a supported format like PDF or plain text',
            'Check the file extension and ensure it matches the actual content type'
          ];
        }
      
      default:
        return [
          `The ${category} content type is not supported`,
          'Supported types: text files, documents (PDF, DOCX), images (JPEG, PNG)',
          'Convert the content to a supported format before ingestion',
          'Check that the file is not corrupted and has the correct extension'
        ];
    }
  }
}

/**
 * Error when content ingestion fails
 */
export class ContentIngestionError extends APIError {
  constructor(operation: string, reason: string, context?: string) {
    const message = `Content ingestion failed during ${operation}: ${reason}`;
    
    super(
      message,
      'CONTENT_INGESTION_FAILED',
      [
        'Check that the content is valid and not corrupted',
        'Ensure sufficient disk space is available',
        'Verify file permissions allow reading the content',
        'Try ingesting the content again',
        'Check content size limits and format requirements'
      ],
      context
    );
  }
}

/**
 * Error when content retrieval fails
 */
export class ContentRetrievalError extends APIError {
  constructor(contentId: string, format: string, reason: string, context?: string) {
    const message = `Content retrieval failed for ${contentId} in ${format} format: ${reason}`;
    
    super(
      message,
      'CONTENT_RETRIEVAL_FAILED',
      [
        'Check that the content still exists and is accessible',
        'Verify the content ID is correct',
        'Ensure the requested format is supported (file or base64)',
        'Try retrieving the content in a different format',
        'Re-ingest the content if the file has been moved or deleted'
      ],
      context
    );
  }
}

/**
 * Error when content directory operations fail
 */
export class ContentDirectoryError extends APIError {
  constructor(operation: string, reason: string, context?: string) {
    const message = `Content directory ${operation} failed: ${reason}`;
    
    super(
      message,
      'CONTENT_DIRECTORY_ERROR',
      [
        'Check that the content directory exists and is writable',
        'Verify sufficient disk space is available',
        'Ensure proper file permissions for the content directory',
        'Try creating the content directory manually if it doesn\'t exist',
        'Check for file system errors or corruption'
      ],
      context
    );
  }
}

/**
 * Error when content deduplication fails
 */
export class ContentDeduplicationError extends APIError {
  constructor(reason: string, context?: string) {
    const message = `Content deduplication failed: ${reason}`;
    
    super(
      message,
      'CONTENT_DEDUPLICATION_FAILED',
      [
        'Check database connectivity and integrity',
        'Verify content hash calculations are working correctly',
        'Try running database repair operations',
        'Ensure sufficient memory for hash calculations',
        'Check for file system errors in the content directory'
      ],
      context
    );
  }
}

/**
 * Enhanced error factory for content system operations
 * Extends the base ErrorFactory with content-specific error handling
 */
export class ContentErrorFactory extends ErrorFactory {
  /**
   * Create content-specific error from generic error
   */
  static createContentError(error: unknown, operation: string, context: string): APIError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific content error scenarios
    if (errorMessage.includes('Content not found') || errorMessage.includes('ENOENT')) {
      const contentIdMatch = errorMessage.match(/Content not found: (.+?)(?:\s|$)/);
      const contentId = contentIdMatch ? contentIdMatch[1] : 'unknown';
      return new ContentNotFoundError(contentId, undefined, context);
    }

    if (errorMessage.includes('Storage limit exceeded')) {
      // Extract usage information from error message
      const usageMatch = errorMessage.match(/Current usage: ([\d.]+)MB.*Storage limit: ([\d.]+)MB/);
      const contentMatch = errorMessage.match(/Cannot add ([\d.]+)MB content/);
      
      const currentUsage = usageMatch ? parseFloat(usageMatch[1]) : 0;
      const limit = usageMatch ? parseFloat(usageMatch[2]) : 0;
      const contentSize = contentMatch ? parseFloat(contentMatch[1]) : 0;
      
      return new StorageLimitExceededError(currentUsage, limit, contentSize, context);
    }

    if (errorMessage.includes('Content type validation failed') || 
        errorMessage.includes('Unsupported content type')) {
      const typeMatch = errorMessage.match(/(?:Content type validation failed|Unsupported content type): (.+?)(?:\.|$)/);
      const contentType = typeMatch ? typeMatch[1] : 'unknown';
      return new InvalidContentFormatError(contentType, errorMessage, context);
    }

    if (errorMessage.includes('Failed to ingest')) {
      return new ContentIngestionError(operation, errorMessage, context);
    }

    if (errorMessage.includes('Failed to retrieve content') || 
        errorMessage.includes('Content retrieval failed')) {
      return new ContentRetrievalError('unknown', 'unknown', errorMessage, context);
    }

    if (errorMessage.includes('content directory') || 
        errorMessage.includes('Content directory')) {
      return new ContentDirectoryError(operation, errorMessage, context);
    }

    if (errorMessage.includes('deduplication') || errorMessage.includes('duplicate')) {
      return new ContentDeduplicationError(errorMessage, context);
    }

    // For generic errors that don't match specific patterns, create a generic content ingestion error
    return new ContentIngestionError(operation, errorMessage, context);
  }

  /**
   * Create storage-related error with enhanced guidance
   */
  static createStorageError(error: unknown, context: string): APIError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space left')) {
      return new StorageLimitExceededError(0, 0, 0, context);
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new ContentDirectoryError(
        'permission check',
        'Permission denied accessing content directory',
        context
      );
    }

    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return new ContentDirectoryError(
        'directory access',
        'Content directory does not exist or is not accessible',
        context
      );
    }

    return new ContentDirectoryError('operation', errorMessage, context);
  }

  /**
   * Create format validation error with specific guidance
   */
  static createFormatError(contentType: string, reason: string, context: string): InvalidContentFormatError {
    return new InvalidContentFormatError(contentType, reason, context);
  }
}

/**
 * Content system error handler with categorized error management
 */
export class ContentErrorHandler {
  /**
   * Handle content operation errors with appropriate categorization
   */
  static handleContentError(
    error: unknown,
    operation: string,
    context: string,
    options: {
      severity?: ErrorSeverity;
      skipError?: boolean;
      showStack?: boolean;
    } = {}
  ): never {
    const contentError = ContentErrorFactory.createContentError(error, operation, context);
    
    // Log the error with appropriate category
    const category = this.getCategoryForError(contentError);
    const severity = options.severity || ErrorSeverity.ERROR;
    
    const categorizedError = new CategorizedError(
      contentError.getFormattedMessage(),
      category,
      severity
    );

    if (!options.skipError) {
      categorizedError.name = contentError.constructor.name;
      console.error(`\n${categorizedError.name}: ${contentError.message}`);
      
      if (contentError.context) {
        console.error(`Context: ${contentError.context}`);
      }
      
      if (contentError.suggestions.length > 0) {
        console.error('\nSuggestions:');
        contentError.suggestions.forEach((suggestion, index) => {
          console.error(`  ${index + 1}. ${suggestion}`);
        });
      }
      
      if (options.showStack && error instanceof Error && error.stack) {
        console.error('\nStack trace:', error.stack);
      }
      
      console.error(''); // Empty line for better readability
    }

    throw contentError;
  }

  /**
   * Get appropriate error category for content errors
   */
  private static getCategoryForError(error: APIError): ErrorCategory {
    switch (error.code) {
      case 'CONTENT_NOT_FOUND':
      case 'CONTENT_RETRIEVAL_FAILED':
        return ErrorCategory.FILE_SYSTEM;
      
      case 'STORAGE_LIMIT_EXCEEDED':
      case 'CONTENT_DIRECTORY_ERROR':
        return ErrorCategory.FILE_SYSTEM;
      
      case 'INVALID_CONTENT_FORMAT':
        return ErrorCategory.VALIDATION;
      
      case 'CONTENT_INGESTION_FAILED':
        return ErrorCategory.GENERAL;
      
      case 'CONTENT_DEDUPLICATION_FAILED':
        return ErrorCategory.DATABASE;
      
      default:
        return ErrorCategory.GENERAL;
    }
  }

  /**
   * Validate content operation parameters and throw appropriate errors
   */
  static validateContentOperation(
    contentId?: string,
    format?: string,
    contentType?: string
  ): void {
    if (contentId && typeof contentId !== 'string') {
      throw new ContentRetrievalError(
        String(contentId),
        format || 'unknown',
        'Content ID must be a string',
        'parameter_validation'
      );
    }

    if (format && !['file', 'base64'].includes(format)) {
      throw new ContentRetrievalError(
        contentId || 'unknown',
        format,
        'Format must be either "file" or "base64"',
        'parameter_validation'
      );
    }

    if (contentType && typeof contentType !== 'string') {
      throw new InvalidContentFormatError(
        String(contentType),
        'Content type must be a string',
        'parameter_validation'
      );
    }
  }

  /**
   * Create user-friendly error message for common content scenarios
   */
  static createUserFriendlyMessage(error: APIError): string {
    const baseMessage = error.message;
    
    if (error.suggestions.length === 0) {
      return baseMessage;
    }

    const suggestions = error.suggestions
      .map((suggestion, index) => `  ${index + 1}. ${suggestion}`)
      .join('\n');

    return `${baseMessage}\n\nTo resolve this issue:\n${suggestions}`;
  }
}

/**
 * Utility functions for content error handling
 */
export const ContentErrorUtils = {
  /**
   * Check if an error is content-related
   */
  isContentError(error: unknown): error is APIError {
    return error instanceof APIError && 
           ['CONTENT_NOT_FOUND', 'STORAGE_LIMIT_EXCEEDED', 'INVALID_CONTENT_FORMAT',
            'CONTENT_INGESTION_FAILED', 'CONTENT_RETRIEVAL_FAILED', 'CONTENT_DIRECTORY_ERROR',
            'CONTENT_DEDUPLICATION_FAILED'].includes((error as APIError).code);
  },

  /**
   * Extract content ID from error message
   */
  extractContentId(error: APIError): string | null {
    // Try to extract from "Content not found: displayName (ID: contentId)" format
    let match = error.message.match(/Content not found: (.+?) \(ID: (.+?)\)/);
    if (match) {
      return match[1]; // Return display name
    }
    
    // Try to extract from "Content retrieval failed for contentId" format
    match = error.message.match(/Content retrieval failed for (.+?) in/);
    if (match) {
      return match[1];
    }
    
    // Try to extract from simple "Content not found: contentId" format
    match = error.message.match(/Content not found: (.+?)(?:\.|$)/);
    if (match) {
      return match[1];
    }
    
    return null;
  },

  /**
   * Get recovery action for content error
   */
  getRecoveryAction(error: APIError): string {
    switch (error.code) {
      case 'CONTENT_NOT_FOUND':
        return 'Re-ingest the content';
      case 'STORAGE_LIMIT_EXCEEDED':
        return 'Run cleanup operations or increase storage limit';
      case 'INVALID_CONTENT_FORMAT':
        return 'Convert content to supported format';
      case 'CONTENT_INGESTION_FAILED':
        return 'Check content validity and try again';
      case 'CONTENT_RETRIEVAL_FAILED':
        return 'Verify content exists and try different format';
      case 'CONTENT_DIRECTORY_ERROR':
        return 'Check directory permissions and disk space';
      case 'CONTENT_DEDUPLICATION_FAILED':
        return 'Check database integrity';
      default:
        return 'Check error details and try again';
    }
  }
};