/**
 * Resource Cleanup Manager - Handles cleanup of temporary files and buffers for failed operations
 * Implements task 8.2: Add resource cleanup for failed operations
 * Requirements: 8.2, 8.4, 9.4
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { DatabaseConnection, deleteContentMetadata } from './db.js';
import { ContentDirectoryError, ContentErrorHandler } from './content-errors.js';

/**
 * Resource that needs cleanup
 */
export interface CleanupResource {
  type: 'file' | 'directory' | 'database_entry' | 'buffer';
  path?: string;
  contentId?: string;
  buffer?: Buffer;
  cleanup: () => Promise<void>;
}

/**
 * Transaction context for content operations
 */
export interface ContentTransaction {
  id: string;
  resources: CleanupResource[];
  isCommitted: boolean;
  isRolledBack: boolean;
  startTime: Date;
  timeoutMs?: number;
}

/**
 * Resource cleanup manager for content operations
 */
export class ResourceCleanupManager {
  private activeTransactions = new Map<string, ContentTransaction>();
  private cleanupTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Start a new transaction for content operations
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Transaction ID
   */
  startTransaction(timeoutMs?: number): string {
    const transactionId = this.generateTransactionId();
    const transaction: ContentTransaction = {
      id: transactionId,
      resources: [],
      isCommitted: false,
      isRolledBack: false,
      startTime: new Date(),
      timeoutMs
    };

    this.activeTransactions.set(transactionId, transaction);

    // Set up timeout if specified
    if (timeoutMs) {
      const timeout = setTimeout(async () => {
        await this.rollbackTransaction(transactionId, 'Transaction timeout');
      }, timeoutMs);
      
      this.cleanupTimeouts.set(transactionId, timeout);
    }

    return transactionId;
  }

  /**
   * Add a resource to be tracked for cleanup
   * @param transactionId - Transaction ID
   * @param resource - Resource to track
   */
  addResource(transactionId: string, resource: CleanupResource): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.isCommitted || transaction.isRolledBack) {
      throw new Error(`Transaction ${transactionId} is already finalized`);
    }

    transaction.resources.push(resource);
  }

  /**
   * Add a temporary file to be tracked for cleanup
   * @param transactionId - Transaction ID
   * @param filePath - Path to temporary file
   */
  addTempFile(transactionId: string, filePath: string): void {
    this.addResource(transactionId, {
      type: 'file',
      path: filePath,
      cleanup: async () => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // Ignore file not found errors
          if ((error as any).code !== 'ENOENT') {
            console.warn(`Failed to cleanup temp file ${filePath}:`, error);
          }
        }
      }
    });
  }

  /**
   * Add a database entry to be tracked for cleanup
   * @param transactionId - Transaction ID
   * @param db - Database connection
   * @param contentId - Content ID to delete
   */
  addDatabaseEntry(transactionId: string, db: DatabaseConnection, contentId: string): void {
    this.addResource(transactionId, {
      type: 'database_entry',
      contentId,
      cleanup: async () => {
        try {
          await deleteContentMetadata(db, contentId);
        } catch (error) {
          console.warn(`Failed to cleanup database entry ${contentId}:`, error);
        }
      }
    });
  }

  /**
   * Add a buffer to be tracked for cleanup (memory management)
   * @param transactionId - Transaction ID
   * @param buffer - Buffer to clear
   */
  addBuffer(transactionId: string, buffer: Buffer): void {
    this.addResource(transactionId, {
      type: 'buffer',
      buffer,
      cleanup: async () => {
        try {
          // Clear buffer contents for security
          buffer.fill(0);
        } catch (error) {
          console.warn('Failed to clear buffer:', error);
        }
      }
    });
  }

  /**
   * Commit a transaction - resources will not be cleaned up
   * @param transactionId - Transaction ID
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.isRolledBack) {
      throw new Error(`Transaction ${transactionId} was already rolled back`);
    }

    transaction.isCommitted = true;
    
    // Clear timeout
    const timeout = this.cleanupTimeouts.get(transactionId);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupTimeouts.delete(transactionId);
    }

    // Remove from active transactions
    this.activeTransactions.delete(transactionId);
  }

  /**
   * Rollback a transaction - cleanup all tracked resources
   * @param transactionId - Transaction ID
   * @param reason - Reason for rollback
   */
  async rollbackTransaction(transactionId: string, reason?: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      // Transaction might have already been cleaned up
      return;
    }

    if (transaction.isCommitted) {
      throw new Error(`Transaction ${transactionId} was already committed`);
    }

    transaction.isRolledBack = true;

    // Clear timeout
    const timeout = this.cleanupTimeouts.get(transactionId);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupTimeouts.delete(transactionId);
    }

    // Cleanup all resources
    const cleanupPromises = transaction.resources.map(async (resource) => {
      try {
        await resource.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup resource ${resource.type}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);

    // Remove from active transactions
    this.activeTransactions.delete(transactionId);

    if (reason) {
      console.warn(`Transaction ${transactionId} rolled back: ${reason}`);
    }
  }

  /**
   * Get transaction status
   * @param transactionId - Transaction ID
   * @returns Transaction status or null if not found
   */
  getTransactionStatus(transactionId: string): {
    id: string;
    resourceCount: number;
    isCommitted: boolean;
    isRolledBack: boolean;
    startTime: Date;
    duration: number;
    timeoutMs?: number;
  } | null {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      resourceCount: transaction.resources.length,
      isCommitted: transaction.isCommitted,
      isRolledBack: transaction.isRolledBack,
      startTime: transaction.startTime,
      duration: Date.now() - transaction.startTime.getTime(),
      timeoutMs: transaction.timeoutMs
    };
  }

  /**
   * Cleanup all active transactions (emergency cleanup)
   */
  async cleanupAllTransactions(): Promise<void> {
    const transactionIds = Array.from(this.activeTransactions.keys());
    
    const cleanupPromises = transactionIds.map(async (transactionId) => {
      try {
        await this.rollbackTransaction(transactionId, 'Emergency cleanup');
      } catch (error) {
        console.warn(`Failed to cleanup transaction ${transactionId}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Get statistics about active transactions
   */
  getStatistics(): {
    activeTransactions: number;
    totalResources: number;
    oldestTransactionAge: number | null;
    transactionsWithTimeout: number;
  } {
    const transactions = Array.from(this.activeTransactions.values());
    const now = Date.now();

    return {
      activeTransactions: transactions.length,
      totalResources: transactions.reduce((sum, t) => sum + t.resources.length, 0),
      oldestTransactionAge: transactions.length > 0 
        ? Math.max(...transactions.map(t => now - t.startTime.getTime()))
        : null,
      transactionsWithTimeout: transactions.filter(t => t.timeoutMs).length
    };
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global resource cleanup manager instance
 */
export const globalResourceCleanup = new ResourceCleanupManager();

/**
 * Utility function to execute an operation with automatic resource cleanup
 * @param operation - Operation to execute
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns Promise that resolves to operation result
 */
export async function withResourceCleanup<T>(
  operation: (transactionId: string) => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  const transactionId = globalResourceCleanup.startTransaction(timeoutMs);
  
  try {
    const result = await operation(transactionId);
    await globalResourceCleanup.commitTransaction(transactionId);
    return result;
  } catch (error) {
    await globalResourceCleanup.rollbackTransaction(transactionId, 
      `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Utility function for atomic file operations with cleanup
 * @param filePath - Target file path
 * @param content - Content to write
 * @param transactionId - Transaction ID for cleanup tracking
 */
export async function writeFileAtomic(
  filePath: string, 
  content: Buffer, 
  transactionId: string
): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  
  // Track temp file for cleanup
  globalResourceCleanup.addTempFile(transactionId, tempPath);
  
  try {
    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });
    
    // Write to temporary file
    await fs.writeFile(tempPath, content);
    
    // Atomically move to final location
    await fs.rename(tempPath, filePath);
    
    // Remove temp file from cleanup list since it was successfully moved
    const transaction = globalResourceCleanup.getTransactionStatus(transactionId);
    if (transaction) {
      // Remove the temp file resource since it's now the final file
      const activeTransaction = (globalResourceCleanup as any).activeTransactions.get(transactionId);
      if (activeTransaction) {
        activeTransaction.resources = activeTransaction.resources.filter(
          (r: CleanupResource) => r.path !== tempPath
        );
      }
    }
  } catch (error) {
    // Temp file will be cleaned up automatically by transaction rollback
    throw new ContentDirectoryError(
      'atomic write',
      `Failed to write file atomically: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'file_write'
    );
  }
}

/**
 * Timeout wrapper for operations
 * @param operation - Operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Message for timeout error
 * @returns Promise that resolves to operation result or rejects on timeout
 */
export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${timeoutMessage} (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([
    operation.finally(() => {
      // Clear timeout when operation completes (success or failure)
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }),
    timeoutPromise
  ]);
}

/**
 * Memory-safe buffer operations
 */
export class SafeBuffer {
  private buffer: Buffer;
  private originalBuffer: Buffer | null = null;
  private isCleared: boolean = false;
  private clearOriginal: boolean;

  constructor(size: number | Buffer, options: { clearOriginal?: boolean } = {}) {
    this.clearOriginal = options.clearOriginal ?? true; // Default to true for security
    
    if (typeof size === 'number') {
      this.buffer = Buffer.allocUnsafe(size);
    } else {
      // Store reference to original buffer for secure clearing (if requested)
      if (this.clearOriginal) {
        this.originalBuffer = size;
      }
      // Create a copy of the buffer to avoid modifying the original during normal operations
      this.buffer = Buffer.from(size);
    }
  }

  /**
   * Get the buffer (throws if cleared)
   */
  get(): Buffer {
    if (this.isCleared) {
      throw new Error('Buffer has been cleared');
    }
    return this.buffer;
  }

  /**
   * Clear the buffer securely
   * This clears the internal copy and optionally the original buffer for security
   */
  clear(): void {
    if (!this.isCleared) {
      // Clear the internal buffer
      this.buffer.fill(0);
      
      // Also clear the original buffer for security (if requested and it exists)
      if (this.clearOriginal && this.originalBuffer) {
        this.originalBuffer.fill(0);
      }
      
      this.isCleared = true;
    }
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is cleared
   */
  isBufferCleared(): boolean {
    return this.isCleared;
  }
}