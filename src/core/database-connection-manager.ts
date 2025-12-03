/**
 * Database Connection Manager - Centralized connection handling
 * Prevents database locking issues by managing shared connections
 * Addresses production issues with MCP server + CLI concurrent usage
 */

import { openDatabase, type DatabaseConnection } from './db.js';
import { resolve as pathResolve } from 'node:path';

/**
 * Connection metadata for tracking and cleanup
 */
interface ConnectionInfo {
  connection: DatabaseConnection;
  refCount: number;
  lastAccessed: number;
  isClosing: boolean;
}

/**
 * Database Connection Manager
 * Manages shared database connections to prevent locking issues
 */
export class DatabaseConnectionManager {
  private static connections = new Map<string, ConnectionInfo>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private static readonly MAX_IDLE_TIME = 60000; // 1 minute

  /**
   * Get a shared database connection
   * Creates new connection if none exists, otherwise returns existing
   */
  static async getConnection(dbPath: string): Promise<DatabaseConnection> {
    const normalizedPath = this.normalizePath(dbPath);
    
    let connectionInfo = this.connections.get(normalizedPath);
    
    // Check if cached connection exists but database file was deleted
    if (connectionInfo && !connectionInfo.isClosing) {
      const { existsSync } = await import('fs');
      if (!existsSync(normalizedPath)) {
        // Database file was deleted - invalidate cached connection
        console.log(`🔄 Database file deleted, invalidating cached connection: ${normalizedPath}`);
        await this.forceCloseConnection(normalizedPath);
        connectionInfo = undefined; // Force creation of new connection
      }
    }
    
    if (!connectionInfo || connectionInfo.isClosing) {
      // Create new connection
      const connection = await openDatabase(dbPath);
      connectionInfo = {
        connection,
        refCount: 1,
        lastAccessed: Date.now(),
        isClosing: false
      };
      this.connections.set(normalizedPath, connectionInfo);
      
      // Start cleanup timer if this is the first connection
      if (this.connections.size === 1 && !this.cleanupInterval) {
        this.startCleanupTimer();
      }
      
      console.log(`📊 Database connection created: ${normalizedPath} (total: ${this.connections.size})`);
    } else {
      // Reuse existing connection
      connectionInfo.refCount++;
      connectionInfo.lastAccessed = Date.now();
      console.log(`🔄 Database connection reused: ${normalizedPath} (refs: ${connectionInfo.refCount})`);
    }
    
    return connectionInfo.connection;
  }

  /**
   * Release a database connection reference
   * Connection is kept alive for potential reuse
   */
  static async releaseConnection(dbPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(dbPath);
    const connectionInfo = this.connections.get(normalizedPath);
    
    if (connectionInfo && !connectionInfo.isClosing) {
      connectionInfo.refCount = Math.max(0, connectionInfo.refCount - 1);
      connectionInfo.lastAccessed = Date.now();
      
      console.log(`📉 Database connection released: ${normalizedPath} (refs: ${connectionInfo.refCount})`);
      
      // Don't immediately close - let cleanup timer handle it
      // This prevents rapid open/close cycles
    }
  }

  /**
   * Force close a specific database connection
   * Use with caution - only for cleanup or error recovery
   */
  static async forceCloseConnection(dbPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(dbPath);
    const connectionInfo = this.connections.get(normalizedPath);
    
    if (connectionInfo && !connectionInfo.isClosing) {
      connectionInfo.isClosing = true;
      
      try {
        await connectionInfo.connection.close();
        console.log(`🔒 Database connection force closed: ${normalizedPath}`);
      } catch (error) {
        console.warn(`⚠️  Warning: Error force closing connection ${normalizedPath}:`, error);
      } finally {
        this.connections.delete(normalizedPath);
      }
    }
  }

  /**
   * Close all database connections
   * Used during application shutdown
   */
  static async closeAllConnections(): Promise<void> {
    if (this.connections.size === 0) {
      return; // Nothing to close
    }
    
    const isCLI = process.env.RAG_CLI_MODE === 'true';
    
    if (!isCLI) {
      console.log(`🧹 Closing all database connections (${this.connections.size} active)`);
    }
    
    const closePromises: Promise<void>[] = [];
    
    for (const [path, connectionInfo] of this.connections.entries()) {
      if (!connectionInfo.isClosing) {
        connectionInfo.isClosing = true;
        closePromises.push(
          connectionInfo.connection.close()
            .then(() => {
              if (!isCLI) {
                console.log(`✅ Closed connection: ${path}`);
              }
            })
            .catch(error => {
              if (!isCLI) {
                console.warn(`⚠️  Error closing connection ${path}:`, error);
              }
            })
        );
      }
    }
    
    await Promise.all(closePromises);
    this.connections.clear();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (!isCLI) {
      console.log('✅ All database connections closed');
    }
  }



  /**
   * Get connection statistics for monitoring
   */
  static getConnectionStats(): {
    totalConnections: number;
    connections: Array<{
      path: string;
      refCount: number;
      lastAccessed: Date;
      idleTime: number;
    }>;
  } {
    const now = Date.now();
    const connections = Array.from(this.connections.entries()).map(([path, info]) => ({
      path,
      refCount: info.refCount,
      lastAccessed: new Date(info.lastAccessed),
      idleTime: now - info.lastAccessed
    }));
    
    return {
      totalConnections: this.connections.size,
      connections
    };
  }

  /**
   * Check if a connection exists for a given path
   */
  static hasConnection(dbPath: string): boolean {
    const normalizedPath = this.normalizePath(dbPath);
    const connectionInfo = this.connections.get(normalizedPath);
    return connectionInfo !== undefined && !connectionInfo.isClosing;
  }

  /**
   * Wait for database to become available
   * Useful for handling temporary locking issues
   */
  static async waitForDatabaseAccess(dbPath: string, maxWaitMs = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Try to get a connection
        const connection = await this.getConnection(dbPath);
        await this.releaseConnection(dbPath);
        return; // Success
      } catch (error) {
        if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        // Other errors should be thrown immediately
        throw error;
      }
    }
    
    throw new Error(`Database ${dbPath} is busy after ${maxWaitMs}ms. Please try again later.`);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Normalize database path for consistent key usage
   */
  private static normalizePath(dbPath: string): string {
    // Convert to absolute path and normalize separators
    // Use Node.js path.resolve for proper relative path handling
    const absolutePath = pathResolve(dbPath);
    // Normalize separators for cross-platform consistency
    return absolutePath.replace(/\\/g, '/');
  }

  /**
   * Start the cleanup timer for idle connections
   * Only start if not in CLI mode to prevent hanging
   */
  private static startCleanupTimer(): void {
    // Don't start cleanup timer for CLI commands - they should exit quickly
    const isCLI = process.argv.some(arg => 
      arg.includes('cli.js') || 
      arg.includes('raglite') || 
      process.env.RAG_CLI_MODE === 'true'
    );
    
    if (!isCLI) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupIdleConnections();
      }, this.CLEANUP_INTERVAL);
    }
  }

  /**
   * Clean up idle connections that haven't been used recently
   */
  private static async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToClose: string[] = [];
    
    for (const [path, connectionInfo] of this.connections.entries()) {
      const idleTime = now - connectionInfo.lastAccessed;
      
      // Close connections that are idle and have no active references
      if (connectionInfo.refCount === 0 && idleTime > this.MAX_IDLE_TIME && !connectionInfo.isClosing) {
        connectionsToClose.push(path);
      }
    }
    
    if (connectionsToClose.length > 0) {
      console.log(`🧹 Cleaning up ${connectionsToClose.length} idle database connections`);
      
      for (const path of connectionsToClose) {
        await this.forceCloseConnection(path);
      }
    }
    
    // Stop cleanup timer if no connections remain
    if (this.connections.size === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Convenience function to get a managed database connection
 * Use this instead of openDatabase() directly
 */
export async function getManagedConnection(dbPath: string): Promise<DatabaseConnection> {
  return DatabaseConnectionManager.getConnection(dbPath);
}

/**
 * Convenience function to release a managed database connection
 * Use this instead of connection.close() directly
 */
export async function releaseManagedConnection(dbPath: string): Promise<void> {
  return DatabaseConnectionManager.releaseConnection(dbPath);
}

/**
 * Enhanced database connection wrapper
 * Automatically manages connection lifecycle
 */
export class ManagedDatabaseConnection {
  private dbPath: string;
  private connection: DatabaseConnection | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Get the underlying database connection
   * Automatically acquires managed connection on first use
   */
  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection) {
      this.connection = await DatabaseConnectionManager.getConnection(this.dbPath);
    }
    return this.connection;
  }

  /**
   * Execute a database operation with automatic connection management
   */
  async execute<T>(operation: (db: DatabaseConnection) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    return operation(connection);
  }

  /**
   * Release the managed connection
   * Connection may be kept alive for reuse by other components
   */
  async release(): Promise<void> {
    if (this.connection) {
      await DatabaseConnectionManager.releaseConnection(this.dbPath);
      this.connection = null;
    }
  }

  /**
   * Force close the connection
   * Use only during cleanup or error recovery
   */
  async forceClose(): Promise<void> {
    if (this.connection) {
      await DatabaseConnectionManager.forceCloseConnection(this.dbPath);
      this.connection = null;
    }
  }
}

// =============================================================================
// PROCESS CLEANUP HANDLERS
// =============================================================================

/**
 * Ensure all connections are closed on process exit
 */
process.on('exit', () => {
  // Synchronous cleanup only
  console.log('🔄 Process exiting, cleaning up database connections...');
});

// Don't set up global process handlers - let applications handle their own cleanup
// This prevents CLI commands from hanging due to active event listeners