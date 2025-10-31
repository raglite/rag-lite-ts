/**
 * CLI Database Utilities - Database access helpers for CLI commands
 * Provides database locking detection and retry mechanisms for CLI operations
 * Prevents conflicts between CLI commands and long-running processes like MCP server
 */

import { DatabaseConnectionManager } from './database-connection-manager.js';
import { existsSync } from 'fs';

/**
 * CLI-specific database access options
 */
export interface CLIDatabaseOptions {
  /** Maximum time to wait for database access (ms) */
  maxWaitMs?: number;
  /** Retry interval (ms) */
  retryIntervalMs?: number;
  /** Show progress messages to user */
  showProgress?: boolean;
  /** Command name for better error messages */
  commandName?: string;
}

/**
 * Default options for CLI database access
 */
const DEFAULT_CLI_OPTIONS: Required<CLIDatabaseOptions> = {
  maxWaitMs: 10000, // 10 seconds
  retryIntervalMs: 500, // 0.5 seconds
  showProgress: true,
  commandName: 'CLI command'
};

/**
 * Wait for database to become available for CLI operations
 * Provides user-friendly progress messages and error handling
 */
export async function waitForCLIDatabaseAccess(
  dbPath: string, 
  options: CLIDatabaseOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_CLI_OPTIONS, ...options };
  
  // Check if database file exists
  if (!existsSync(dbPath)) {
    throw new Error(
      `Database file not found: ${dbPath}\n` +
      `Please run 'raglite ingest <path>' first to create the database.`
    );
  }
  
  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;
  
  while (Date.now() - startTime < opts.maxWaitMs) {
    attempts++;
    
    try {
      // Try to get database access
      await DatabaseConnectionManager.waitForDatabaseAccess(dbPath, 1000);
      
      if (opts.showProgress && attempts > 1) {
        console.log(`✅ Database is now available (after ${attempts} attempts)`);
      }
      
      return; // Success!
      
    } catch (error) {
      lastError = error as Error;
      
      if (lastError.message.includes('SQLITE_BUSY') || lastError.message.includes('busy')) {
        // Database is busy - show progress and retry
        if (opts.showProgress) {
          if (attempts === 1) {
            console.log(`⏳ Database is busy, waiting for access...`);
            console.log(`   This usually happens when another process is using the database.`);
            console.log(`   Common causes:`);
            console.log(`   • MCP server is running`);
            console.log(`   • Another CLI command is in progress`);
            console.log(`   • Long-running ingestion process`);
            console.log('');
          } else if (attempts % 4 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`   Still waiting... (${elapsed}s elapsed, attempt ${attempts})`);
          }
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, opts.retryIntervalMs));
        continue;
        
      } else {
        // Other error - don't retry
        throw new Error(
          `Failed to access database: ${lastError.message}\n` +
          `Please check that the database file is not corrupted and you have proper permissions.`
        );
      }
    }
  }
  
  // Timeout reached
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  throw new Error(
    `Database is still busy after ${elapsed} seconds.\n` +
    `\n` +
    `This might be because:\n` +
    `• Another process is using the database (MCP server, long ingestion, etc.)\n` +
    `• The database is locked due to an interrupted operation\n` +
    `\n` +
    `Solutions:\n` +
    `• Wait for other operations to complete\n` +
    `• Stop the MCP server if running\n` +
    `• Restart your terminal/process\n` +
    `• As a last resort, restart your computer\n` +
    `\n` +
    `Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Execute a CLI operation with database access protection
 * Automatically handles database locking and provides user feedback
 */
export async function withCLIDatabaseAccess<T>(
  dbPath: string,
  operation: () => Promise<T>,
  options: CLIDatabaseOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_CLI_OPTIONS, ...options };
  
  try {
    // Wait for database access
    await waitForCLIDatabaseAccess(dbPath, opts);
    
    // Execute the operation
    return await operation();
    
  } catch (error) {
    if (error instanceof Error) {
      // Enhance error message with CLI context
      const enhancedMessage = 
        `${opts.commandName} failed: ${error.message}\n` +
        `\n` +
        `If this error persists:\n` +
        `• Check that no other RAG-lite processes are running\n` +
        `• Verify database file permissions\n` +
        `• Try running the command again\n`;
      
      throw new Error(enhancedMessage);
    }
    throw error;
  }
}

/**
 * Check if database is currently busy (non-blocking)
 * Useful for showing warnings or status information
 */
export async function isDatabaseBusy(dbPath: string): Promise<{
  isBusy: boolean;
  reason?: string;
  suggestions?: string[];
}> {
  try {
    await DatabaseConnectionManager.waitForDatabaseAccess(dbPath, 100);
    return { isBusy: false };
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('SQLITE_BUSY') || 
      error.message.includes('busy')
    )) {
      return {
        isBusy: true,
        reason: 'Database is currently in use by another process',
        suggestions: [
          'Wait for other operations to complete',
          'Stop MCP server if running',
          'Check for other CLI commands in progress'
        ]
      };
    }
    
    return {
      isBusy: true,
      reason: `Database access error: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [
        'Check database file permissions',
        'Verify database file is not corrupted',
        'Ensure you have read/write access to the database directory'
      ]
    };
  }
}

/**
 * Show database status information for debugging
 * Useful for troubleshooting CLI issues
 */
export async function showDatabaseStatus(dbPath: string): Promise<void> {
  console.log(`📊 Database Status: ${dbPath}`);
  console.log('');
  
  // Check file existence
  if (!existsSync(dbPath)) {
    console.log('❌ Database file does not exist');
    console.log('   Run "raglite ingest <path>" to create the database');
    return;
  }
  
  // Check file stats
  try {
    const fs = await import('fs');
    const stats = fs.statSync(dbPath);
    console.log(`📁 File size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);
  } catch (error) {
    console.log(`⚠️  Cannot read file stats: ${error}`);
  }
  
  // Check database access
  const busyStatus = await isDatabaseBusy(dbPath);
  if (busyStatus.isBusy) {
    console.log(`🔒 Status: BUSY`);
    console.log(`   Reason: ${busyStatus.reason}`);
    if (busyStatus.suggestions) {
      console.log('   Suggestions:');
      busyStatus.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }
  } else {
    console.log(`✅ Status: AVAILABLE`);
  }
  
  // Show connection manager stats
  const connectionStats = DatabaseConnectionManager.getConnectionStats();
  if (connectionStats.totalConnections > 0) {
    console.log('');
    console.log(`🔗 Active connections: ${connectionStats.totalConnections}`);
    connectionStats.connections.forEach((conn, index) => {
      console.log(`   ${index + 1}. ${conn.path}`);
      console.log(`      References: ${conn.refCount}`);
      console.log(`      Last accessed: ${conn.lastAccessed.toLocaleString()}`);
      console.log(`      Idle time: ${(conn.idleTime / 1000).toFixed(1)}s`);
    });
  }
  
  console.log('');
}

/**
 * Force cleanup of database connections (emergency use only)
 * Use with caution - only for recovery from stuck states
 */
export async function forceCleanupDatabase(dbPath: string): Promise<void> {
  console.log(`🚨 Force cleaning up database connections: ${dbPath}`);
  
  try {
    await DatabaseConnectionManager.forceCloseConnection(dbPath);
    console.log('✅ Force cleanup completed');
  } catch (error) {
    console.log(`⚠️  Force cleanup failed: ${error}`);
    console.log('You may need to restart the process or reboot your system');
  }
}

/**
 * Graceful shutdown helper for CLI commands
 * Ensures proper cleanup when CLI commands are interrupted
 */
export function setupCLICleanup(dbPath?: string): void {
  const cleanup = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    if (dbPath) {
      try {
        await DatabaseConnectionManager.releaseConnection(dbPath);
      } catch (error) {
        // Ignore cleanup errors during shutdown
      }
    }
    
    await DatabaseConnectionManager.closeAllConnections();
    process.exit(0);
  };
  
  // Only set up handlers if they haven't been set up already
  if (!process.listenerCount('SIGINT')) {
    process.on('SIGINT', cleanup);
  }
  if (!process.listenerCount('SIGTERM')) {
    process.on('SIGTERM', cleanup);
  }
}