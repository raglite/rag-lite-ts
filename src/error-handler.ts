/**
 * Centralized error handling utilities for RAG-lite TS
 * Provides consistent error handling patterns across the application
 */

import { EXIT_CODES } from './config.js';

/**
 * Error categories for different types of failures
 */
export enum ErrorCategory {
  CONFIGURATION = 'Configuration',
  DATABASE = 'Database',
  MODEL = 'Model',
  INDEX = 'Index',
  FILE_SYSTEM = 'File System',
  EMBEDDING = 'Embedding',
  NETWORK = 'Network',
  VALIDATION = 'Validation',
  GENERAL = 'General'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  FATAL = 'FATAL',      // System must exit immediately
  ERROR = 'ERROR',      // Operation failed but system can continue
  WARNING = 'WARNING',  // Potential issue but operation can continue
  INFO = 'INFO'         // Informational message
}

/**
 * Enhanced error class with category and severity
 */
export class CategorizedError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public severity: ErrorSeverity = ErrorSeverity.ERROR,
    public exitCode: number = EXIT_CODES.GENERAL_ERROR,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CategorizedError';
  }
}

/**
 * Handle errors with appropriate logging and exit behavior
 * @param error - Error to handle
 * @param context - Context where error occurred
 * @param options - Handling options
 */
export function handleError(
  error: Error | string,
  context: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    exitCode?: number;
    skipError?: boolean;
    showStack?: boolean;
  } = {}
): void {
  const {
    category = ErrorCategory.GENERAL,
    severity = ErrorSeverity.ERROR,
    exitCode = EXIT_CODES.GENERAL_ERROR,
    skipError = false,
    showStack = false
  } = options;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const timestamp = new Date().toISOString();
  
  // Format error message based on severity
  const severityPrefix = severity === ErrorSeverity.FATAL ? '🚨' : 
                        severity === ErrorSeverity.ERROR ? '❌' : 
                        severity === ErrorSeverity.WARNING ? '⚠️' : 'ℹ️';
  
  const logMessage = `${severityPrefix} [${timestamp}] ${severity} in ${context} (${category}): ${errorMessage}`;
  
  if (severity === ErrorSeverity.FATAL || severity === ErrorSeverity.ERROR) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Show stack trace for debugging if requested
  if (showStack && error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
  
  // Handle based on severity
  if (severity === ErrorSeverity.FATAL) {
    console.error('\nThe system cannot continue and will exit immediately.');
    provideContextualGuidance(category, exitCode);
    process.exit(exitCode);
  } else if (severity === ErrorSeverity.ERROR && !skipError) {
    console.error('Operation failed. See error details above.');
  }
}

/**
 * Provide contextual guidance based on error category and exit code
 */
function provideContextualGuidance(category: ErrorCategory, exitCode: number): void {
  console.error('\nTroubleshooting guidance:');
  
  switch (category) {
    case ErrorCategory.CONFIGURATION:
      console.error('- Check your configuration file for syntax errors');
      console.error('- Ensure all required fields are present and valid');
      console.error('- Verify numeric values are positive numbers');
      break;
      
    case ErrorCategory.DATABASE:
      console.error('- Try running "raglite rebuild" to fix database issues');
      console.error('- Check that the database file is not locked by another process');
      console.error('- Ensure you have write permissions in the current directory');
      console.error('- Verify sufficient disk space is available');
      break;
      
    case ErrorCategory.MODEL:
      console.error('- Ensure you have internet connection for model download');
      console.error('- Check available disk space in the models directory');
      console.error('- Try clearing the model cache and downloading again');
      console.error('- Verify your system has sufficient memory (2GB+ recommended)');
      break;
      
    case ErrorCategory.INDEX:
      console.error('- Try running "raglite rebuild" to recreate the vector index');
      console.error('- Check available disk space for index files');
      console.error('- Ensure the index file is not corrupted or locked');
      break;
      
    case ErrorCategory.FILE_SYSTEM:
      console.error('- Check that files and directories exist and are accessible');
      console.error('- Verify you have read/write permissions');
      console.error('- Ensure paths are spelled correctly');
      break;
      
    case ErrorCategory.EMBEDDING:
      console.error('- Check that the embedding model is properly loaded');
      console.error('- Verify input text is not empty or malformed');
      console.error('- Ensure sufficient memory for batch processing');
      break;
      
    case ErrorCategory.NETWORK:
      console.error('- Check your internet connection');
      console.error('- Verify firewall settings allow model downloads');
      console.error('- Try again later if servers are temporarily unavailable');
      break;
      
    default:
      console.error('- Check the error message above for specific details');
      console.error('- Try running the command again');
      console.error('- If the problem persists, please report it as a bug');
  }
}

/**
 * Wrapper for try-catch blocks with consistent error handling
 * @param operation - Function to execute
 * @param context - Context description
 * @param options - Error handling options
 */
export async function safeExecute<T>(
  operation: () => Promise<T> | T,
  context: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    exitCode?: number;
    skipError?: boolean;
    fallbackValue?: T;
  } = {}
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    handleError(error as Error, context, options);
    
    if (options.fallbackValue !== undefined) {
      return options.fallbackValue;
    }
    
    if (options.skipError) {
      return undefined;
    }
    
    // Re-throw if not skipping and no fallback
    if (options.severity !== ErrorSeverity.FATAL) {
      throw error;
    }
    
    return undefined; // This won't be reached due to process.exit in FATAL
  }
}

/**
 * Validate that a condition is true, throw categorized error if not
 * @param condition - Condition to check
 * @param message - Error message if condition fails
 * @param category - Error category
 * @param exitCode - Exit code for fatal errors
 */
export function assert(
  condition: boolean,
  message: string,
  category: ErrorCategory = ErrorCategory.VALIDATION,
  exitCode: number = EXIT_CODES.GENERAL_ERROR
): asserts condition {
  if (!condition) {
    throw new CategorizedError(message, category, ErrorSeverity.FATAL, exitCode);
  }
}

/**
 * Log progress with error context
 * @param message - Progress message
 * @param current - Current progress value
 * @param total - Total progress value
 */
export function logProgress(message: string, current?: number, total?: number): void {
  const timestamp = new Date().toISOString();
  let progressMsg = `ℹ️ [${timestamp}] ${message}`;
  
  if (current !== undefined && total !== undefined) {
    const percentage = Math.round((current / total) * 100);
    progressMsg += ` (${current}/${total} - ${percentage}%)`;
  }
  
  console.log(progressMsg);
}

/**
 * Create a categorized error for common scenarios
 */
export const createError = {
  configuration: (message: string, exitCode = EXIT_CODES.CONFIGURATION_ERROR) =>
    new CategorizedError(message, ErrorCategory.CONFIGURATION, ErrorSeverity.FATAL, exitCode),
    
  database: (message: string, exitCode = EXIT_CODES.DATABASE_ERROR) =>
    new CategorizedError(message, ErrorCategory.DATABASE, ErrorSeverity.FATAL, exitCode),
    
  model: (message: string, exitCode = EXIT_CODES.MODEL_ERROR) =>
    new CategorizedError(message, ErrorCategory.MODEL, ErrorSeverity.FATAL, exitCode),
    
  index: (message: string, exitCode = EXIT_CODES.INDEX_ERROR) =>
    new CategorizedError(message, ErrorCategory.INDEX, ErrorSeverity.FATAL, exitCode),
    
  fileSystem: (message: string, exitCode = EXIT_CODES.FILE_NOT_FOUND) =>
    new CategorizedError(message, ErrorCategory.FILE_SYSTEM, ErrorSeverity.FATAL, exitCode),
    
  embedding: (message: string, severity = ErrorSeverity.ERROR) =>
    new CategorizedError(message, ErrorCategory.EMBEDDING, severity),
    
  validation: (message: string, exitCode = EXIT_CODES.INVALID_ARGUMENTS) =>
    new CategorizedError(message, ErrorCategory.VALIDATION, ErrorSeverity.FATAL, exitCode)
};