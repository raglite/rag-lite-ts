/**
 * User-friendly error classes with actionable suggestions
 * Requirements: 5.3 - Create user-friendly error classes with actionable suggestions
 */

/**
 * Base class for API errors with actionable suggestions
 */
export abstract class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions: string[],
    public context?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Get formatted error message with suggestions
   */
  getFormattedMessage(): string {
    let formatted = this.message;
    
    if (this.suggestions.length > 0) {
      formatted += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, index) => {
        formatted += `\n  ${index + 1}. ${suggestion}`;
      });
    }
    
    return formatted;
  }

  /**
   * Log the error with proper formatting
   */
  logError(): void {
    console.error(`\n${this.name}: ${this.message}`);
    
    if (this.context) {
      console.error(`Context: ${this.context}`);
    }
    
    if (this.suggestions.length > 0) {
      console.error('\nSuggestions:');
      this.suggestions.forEach((suggestion, index) => {
        console.error(`  ${index + 1}. ${suggestion}`);
      });
    }
    console.error(''); // Empty line for better readability
  }
}

/**
 * Ingestion-related errors
 */
export class IngestionError extends APIError {
  constructor(message: string, code: string, suggestions: string[], context?: string) {
    super(message, code, suggestions, context);
  }
}

/**
 * Search-related errors
 */
export class SearchError extends APIError {
  constructor(message: string, code: string, suggestions: string[], context?: string) {
    super(message, code, suggestions, context);
  }
}

/**
 * Resource management errors
 */
export class ResourceError extends APIError {
  constructor(message: string, code: string, suggestions: string[], context?: string) {
    super(message, code, suggestions, context);
  }
}

/**
 * Model compatibility errors
 */
export class ModelCompatibilityError extends APIError {
  constructor(message: string, code: string, suggestions: string[], context?: string) {
    super(message, code, suggestions, context);
  }
}

/**
 * Error factory for creating user-friendly errors from internal errors
 * Requirements: 5.3 - Map internal errors to clear guidance
 */
export class ErrorFactory {
  /**
   * Create user-friendly ingestion error from internal error
   */
  static createIngestionError(error: unknown, context: string): IngestionError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle common error scenarios with specific guidance
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      if (context === 'path_validation') {
        return new IngestionError(
          `Directory or file path does not exist: ${errorMessage}`,
          'PATH_NOT_FOUND',
          [
            'Check that the path exists and is accessible',
            'Ensure you have read permissions for the directory',
            'Use an absolute path if the relative path is not working'
          ],
          context
        );
      } else {
        return new IngestionError(
          `Required files not found during ${context}`,
          'FILES_NOT_FOUND',
          [
            'Ensure the base directory exists and is writable',
            'Check file permissions in the target directory',
            'Try using an absolute path instead of a relative path'
          ],
          context
        );
      }
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new IngestionError(
        `Permission denied during ${context}`,
        'PERMISSION_DENIED',
        [
          'Check that you have write permissions to the directory',
          'Try running with appropriate permissions',
          'Ensure the directory is not read-only'
        ],
        context
      );
    }

    if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space left')) {
      return new IngestionError(
        `Insufficient disk space during ${context}`,
        'DISK_SPACE_FULL',
        [
          'Free up disk space in the target directory',
          'Choose a different location with more available space',
          'Check disk usage with your system tools'
        ],
        context
      );
    }

    if (errorMessage.includes('model') && errorMessage.includes('version')) {
      return new ModelCompatibilityError(
        `Embedding model compatibility issue: ${errorMessage}`,
        'MODEL_COMPATIBILITY',
        [
          'Run pipeline.rebuildIndex() to rebuild with the current model',
          'Or specify the same model that was used during original ingestion',
          'Check the model configuration in your setup'
        ],
        context
      );
    }

    if (errorMessage.includes('embedding') || errorMessage.includes('model')) {
      return new IngestionError(
        `Embedding model initialization failed: ${errorMessage}`,
        'MODEL_INIT_FAILED',
        [
          'Check your internet connection for model downloads',
          'Ensure you have sufficient memory available',
          'Try specifying a different embedding model',
          'Check that the model name is correct and supported'
        ],
        context
      );
    }

    if (errorMessage.includes('database') || errorMessage.includes('sqlite')) {
      return new IngestionError(
        `Database initialization failed: ${errorMessage}`,
        'DATABASE_ERROR',
        [
          'Check that the database file is not corrupted',
          'Ensure the directory is writable',
          'Try deleting the database file to start fresh',
          'Check for sufficient disk space'
        ],
        context
      );
    }

    // Generic error with basic suggestions
    return new IngestionError(
      `${context} failed: ${errorMessage}`,
      'GENERAL_ERROR',
      [
        'Check the error message above for specific details',
        'Ensure all file paths are correct and accessible',
        'Verify you have necessary permissions',
        'Try the operation again or contact support if the issue persists'
      ],
      context
    );
  }

  /**
   * Create user-friendly search error from internal error
   */
  static createSearchError(error: unknown, context: string): SearchError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle common search error scenarios
    if (context === 'missing_database') {
      return new SearchError(
        `Database file not found`,
        'DATABASE_NOT_FOUND',
        [
          'Run ingestion first to create the database: pipeline.ingestDirectory("./docs/")',
          'Check that the database path is correct',
          'Ensure the ingestion process completed successfully'
        ],
        context
      );
    }

    if (context === 'missing_index') {
      return new SearchError(
        `Vector index file not found`,
        'INDEX_NOT_FOUND',
        [
          'Run ingestion first to create the index: pipeline.ingestDirectory("./docs/")',
          'Check that the index path is correct',
          'Ensure the ingestion process completed successfully'
        ],
        context
      );
    }

    if (context === 'missing_model_info') {
      return new SearchError(
        'No embedding model information found in database. The database may be from an older version or corrupted.',
        'MODEL_INFO_NOT_FOUND',
        [
          'Run ingestion again to store model information: pipeline.ingestDirectory("./docs/")',
          'If the problem persists, delete the database and index files and run ingestion from scratch',
          'Check that the database was created with a compatible version of the library'
        ],
        context
      );
    }

    if (context === 'model_loading') {
      return new SearchError(
        `Failed to load embedding model: ${errorMessage}`,
        'MODEL_LOADING_FAILED',
        [
          'Check that the model name is correct and supported',
          'Ensure you have internet connection for model download',
          'Try running ingestion again with a supported model',
          'Check the model configuration in your setup'
        ],
        context
      );
    }

    if (context === 'model_compatibility' || (errorMessage.includes('model') && errorMessage.includes('mismatch'))) {
      return new ModelCompatibilityError(
        `Model compatibility issue detected: ${errorMessage}`,
        'MODEL_COMPATIBILITY',
        [
          'The stored model information doesn\'t match the current configuration',
          'Run pipeline.rebuildIndex() to rebuild with the current model',
          'Or ensure you\'re using the same model that was used during ingestion',
          'Check that the index and database files are from the same ingestion run'
        ],
        context
      );
    }

    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return new SearchError(
        `Required files not found: ${errorMessage}`,
        'FILES_NOT_FOUND',
        [
          'Run ingestion first to create the required files',
          'Check that the file paths are correct',
          'Ensure you have read permissions for the files'
        ],
        context
      );
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new SearchError(
        `Permission denied: ${errorMessage}`,
        'PERMISSION_DENIED',
        [
          'Check that you have read permissions for the database and index files',
          'Ensure the files are not locked by another process',
          'Try running with appropriate permissions'
        ],
        context
      );
    }

    if (errorMessage.includes('database') || errorMessage.includes('sqlite')) {
      return new SearchError(
        `Database error: ${errorMessage}`,
        'DATABASE_ERROR',
        [
          'Check that the database file is not corrupted',
          'Ensure no other processes are using the database',
          'Try recreating the database by running ingestion again'
        ],
        context
      );
    }

    // Generic error with basic suggestions
    return new SearchError(
      `Search engine ${context} failed: ${errorMessage}`,
      'GENERAL_ERROR',
      [
        'Check the error message above for specific details',
        'Ensure all required files exist and are accessible',
        'Try running ingestion first if you haven\'t already',
        'Contact support if the issue persists'
      ],
      context
    );
  }

  /**
   * Create user-friendly resource error from internal error
   */
  static createResourceError(error: unknown, context: string): ResourceError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('initialization')) {
      return new ResourceError(
        `Resource initialization failed: ${errorMessage}`,
        'INITIALIZATION_FAILED',
        [
          'Check that all required files exist and are accessible',
          'Ensure you have proper permissions for the resource files',
          'Try cleaning up and reinitializing the resources',
          'Check for sufficient disk space and memory'
        ],
        context
      );
    }

    if (errorMessage.includes('cleanup')) {
      return new ResourceError(
        `Resource cleanup failed: ${errorMessage}`,
        'CLEANUP_FAILED',
        [
          'Some resources may not have been properly released',
          'Try restarting the application to ensure clean state',
          'Check for any locked files or processes',
          'This may not affect functionality but could cause resource leaks'
        ],
        context
      );
    }

    // Generic resource error
    return new ResourceError(
      `Resource management error: ${errorMessage}`,
      'RESOURCE_ERROR',
      [
        'Check the error message above for specific details',
        'Try restarting the application',
        'Ensure sufficient system resources are available',
        'Contact support if the issue persists'
      ],
      context
    );
  }
}

/**
 * Common error scenarios with predefined messages and suggestions
 * Requirements: 5.3 - Add specific error handling for common scenarios
 */
export const CommonErrors = {
  /**
   * Error when trying to search without running ingestion first
   */
  NO_DOCUMENTS_INGESTED: new SearchError(
    'No documents found to search. Run ingestion first.',
    'NO_DOCUMENTS',
    [
      'Call pipeline.ingestDirectory("./docs/") to add documents',
      'Check that your document directory contains .md, .txt, or .mdx files',
      'Ensure the ingestion process completed successfully'
    ],
    'search_initialization'
  ),

  /**
   * Error when model versions don't match
   */
  MODEL_VERSION_MISMATCH: new ModelCompatibilityError(
    'Embedding model version mismatch detected between stored index and current configuration.',
    'MODEL_MISMATCH',
    [
      'Run pipeline.rebuildIndex() to rebuild with current model',
      'Or specify the same model used during ingestion',
      'Check your model configuration settings'
    ],
    'model_validation'
  ),

  /**
   * Error when required files are missing
   */
  MISSING_REQUIRED_FILES: new SearchError(
    'Required database or index files are missing.',
    'MISSING_FILES',
    [
      'Run ingestion first: pipeline.ingestDirectory("./docs/")',
      'Check that the file paths are correct',
      'Ensure the ingestion process completed without errors'
    ],
    'file_validation'
  ),

  /**
   * Error when initialization fails
   */
  INITIALIZATION_FAILED: new ResourceError(
    'Failed to initialize required resources.',
    'INIT_FAILED',
    [
      'Check that all file paths are correct and accessible',
      'Ensure you have proper read/write permissions',
      'Try running ingestion first if this is a new setup',
      'Check for sufficient disk space and memory'
    ],
    'resource_initialization'
  )
};

/**
 * Utility function to handle and log errors appropriately
 */
export function handleAPIError(error: unknown, context: string, operation: 'ingestion' | 'search' | 'resource'): never {
  let apiError: APIError;

  if (error instanceof APIError) {
    apiError = error;
  } else {
    switch (operation) {
      case 'ingestion':
        apiError = ErrorFactory.createIngestionError(error, context);
        break;
      case 'search':
        apiError = ErrorFactory.createSearchError(error, context);
        break;
      case 'resource':
        apiError = ErrorFactory.createResourceError(error, context);
        break;
      default:
        apiError = new ResourceError(
          `Unexpected error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
          'UNEXPECTED_ERROR',
          ['Contact support with the error details above'],
          context
        );
    }
  }

  apiError.logError();
  throw apiError;
}