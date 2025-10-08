import { DatabaseConnection, openDatabase, initializeSchema, getStoredModelInfo, setStoredModelInfo } from './db.js';
import { IndexManager } from './index-manager.js';
import { EmbeddingEngine, initializeEmbeddingEngine } from './embedder.js';
import { config, getModelDefaults } from './config.js';
import { ErrorFactory, ResourceError, CommonErrors } from './api-errors.js';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * Configuration for resource initialization
 */
export interface ResourceConfig {
  basePath?: string;
  dbPath?: string;
  indexPath?: string;
  modelName?: string;
  batchSize?: number;
  skipModelCheck?: boolean;
}

/**
 * Managed resources container
 */
export interface ManagedResources {
  database: DatabaseConnection;
  indexManager: IndexManager;
  embedder: EmbeddingEngine;
}

/**
 * Internal ResourceManager for automatic initialization and cleanup
 * Implements singleton pattern for resource sharing across instances
 * Requirements: 5.1, 5.4 - Automatic resource management and lifecycle handling
 */
export class ResourceManager {
  private static instances = new Map<string, ResourceManager>();
  private static cleanupHandlersSet = false;

  private database: DatabaseConnection | null = null;
  private indexManager: IndexManager | null = null;
  private embedder: EmbeddingEngine | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  private readonly resourceKey: string;
  private readonly config: Required<ResourceConfig>;

  /**
   * Get or create ResourceManager instance for the given configuration
   * Implements singleton pattern for resource sharing
   * @param config - Resource configuration
   * @returns ResourceManager instance
   */
  static getInstance(config: ResourceConfig = {}): ResourceManager {
    // Create a unique key based on the configuration
    const resolvedConfig = ResourceManager.resolveConfig(config);
    const key = `${resolvedConfig.dbPath}:${resolvedConfig.indexPath}:${resolvedConfig.modelName}`;
    
    if (!ResourceManager.instances.has(key)) {
      ResourceManager.instances.set(key, new ResourceManager(key, resolvedConfig));
    }
    
    return ResourceManager.instances.get(key)!;
  }

  /**
   * Resolve and normalize configuration with defaults
   */
  private static resolveConfig(resourceConfig: ResourceConfig): Required<ResourceConfig> {
    const basePath = resourceConfig.basePath ? resolve(resourceConfig.basePath) : process.cwd();
    
    return {
      basePath,
      dbPath: resourceConfig.dbPath ? resolve(resourceConfig.dbPath) : join(basePath, 'db.sqlite'),
      indexPath: resourceConfig.indexPath ? resolve(resourceConfig.indexPath) : join(basePath, 'vector-index.bin'),
      modelName: resourceConfig.modelName || config.embedding_model,
      batchSize: resourceConfig.batchSize || config.batch_size,
      skipModelCheck: resourceConfig.skipModelCheck || false
    };
  }

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(resourceKey: string, config: Required<ResourceConfig>) {
    this.resourceKey = resourceKey;
    this.config = config;
    
    // Set up automatic cleanup handlers
    this.setupCleanupHandlers();
  }

  /**
   * Initialize all resources with lazy loading
   * Requirements: 5.1 - Automatic resource management
   */
  async initialize(): Promise<ManagedResources> {
    // Return existing initialization promise if already in progress
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.getResources();
    }

    // Start new initialization if not already initialized
    if (!this.isInitialized) {
      this.initializationPromise = this.performInitialization();
      await this.initializationPromise;
    }

    return this.getResources();
  }

  /**
   * Perform the actual initialization steps
   */
  private async performInitialization(): Promise<void> {
    try {
      console.log('Initializing resources...');

      // Step 1: Initialize database
      await this.initializeDatabase();

      // Step 2: Initialize embedder (either from stored model info or config)
      await this.initializeEmbedder();

      // Step 3: Initialize index manager with model compatibility check
      await this.initializeIndexManager();

      this.isInitialized = true;
      console.log('Resources initialized successfully');

    } catch (error) {
      // Clean up partial initialization on failure
      await this.cleanup();
      throw ErrorFactory.createResourceError(error, 'initialization');
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize database connection and schema
   */
  private async initializeDatabase(): Promise<void> {
    if (this.database) {
      return;
    }

    console.log('Opening database connection...');
    this.database = await openDatabase(this.config.dbPath);
    await initializeSchema(this.database);
  }

  /**
   * Initialize embedder based on stored model info or configuration
   * Requirements: 5.1 - Embedder initialization based on stored model info from database
   */
  private async initializeEmbedder(): Promise<void> {
    if (this.embedder) {
      return;
    }

    if (!this.database) {
      throw new Error('Database must be initialized before embedder');
    }

    let modelName = this.config.modelName;
    
    // Try to get stored model info from database first
    try {
      const storedModelInfo = await getStoredModelInfo(this.database);
      if (storedModelInfo && storedModelInfo.modelName) {
        modelName = storedModelInfo.modelName;
        console.log(`Using stored model from database: ${modelName}`);
      } else if (this.config.modelName) {
        console.log(`No stored model found, using configured model: ${modelName}`);
        // Store the model info for future use
        const modelDefaults = getModelDefaults(modelName);
        await setStoredModelInfo(this.database, modelName, modelDefaults.dimensions);
      } else {
        // Use default model from config
        modelName = config.embedding_model;
        console.log(`Using default model: ${modelName}`);
        const modelDefaults = getModelDefaults(modelName);
        await setStoredModelInfo(this.database, modelName, modelDefaults.dimensions);
      }
    } catch (error) {
      console.warn(`Failed to read stored model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall back to configured or default model
      if (!modelName) {
        modelName = config.embedding_model;
      }
    }

    console.log(`Loading embedding model: ${modelName}...`);
    this.embedder = await initializeEmbeddingEngine(modelName, this.config.batchSize);
  }

  /**
   * Initialize index manager with model compatibility validation
   */
  private async initializeIndexManager(): Promise<void> {
    if (this.indexManager) {
      return;
    }

    if (!this.database || !this.embedder) {
      throw new Error('Database and embedder must be initialized before index manager');
    }

    console.log('Initializing index manager...');
    
    // Get model info for index manager initialization
    const storedModelInfo = await getStoredModelInfo(this.database);
    const modelName = storedModelInfo?.modelName || this.embedder.getModelName();
    const dimensions = storedModelInfo?.dimensions || getModelDefaults(modelName).dimensions;

    this.indexManager = new IndexManager(
      this.config.indexPath,
      this.config.dbPath,
      dimensions,
      modelName
    );

    await this.indexManager.initialize(this.config.skipModelCheck);
  }

  /**
   * Get initialized resources
   * @throws Error if resources are not initialized
   */
  private getResources(): ManagedResources {
    if (!this.isInitialized || !this.database || !this.indexManager || !this.embedder) {
      throw new Error('Resources not properly initialized');
    }

    return {
      database: this.database,
      indexManager: this.indexManager,
      embedder: this.embedder
    };
  }

  /**
   * Get database connection (lazy initialization)
   */
  async getDatabase(): Promise<DatabaseConnection> {
    if (!this.database) {
      await this.initialize();
    }
    return this.database!;
  }

  /**
   * Get index manager (lazy initialization)
   */
  async getIndexManager(): Promise<IndexManager> {
    if (!this.indexManager) {
      await this.initialize();
    }
    return this.indexManager!;
  }

  /**
   * Get embedder (lazy initialization)
   */
  async getEmbedder(): Promise<EmbeddingEngine> {
    if (!this.embedder) {
      await this.initialize();
    }
    return this.embedder!;
  }

  /**
   * Check if resources are initialized
   */
  isResourcesInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Validate that required files exist for search operations
   * @throws ResourceError with user-friendly message if files are missing
   */
  async validateSearchFiles(): Promise<void> {
    if (!existsSync(this.config.dbPath)) {
      throw ErrorFactory.createResourceError(
        new Error(`Database file not found: ${this.config.dbPath}`),
        'missing_database'
      );
    }

    if (!existsSync(this.config.indexPath)) {
      throw ErrorFactory.createResourceError(
        new Error(`Vector index file not found: ${this.config.indexPath}`),
        'missing_index'
      );
    }
  }

  /**
   * Set up automatic cleanup handlers
   * Requirements: 5.5 - Automatic cleanup on process exit
   */
  private setupCleanupHandlers(): void {
    if (ResourceManager.cleanupHandlersSet) {
      return;
    }

    ResourceManager.cleanupHandlersSet = true;

    const cleanupAll = async () => {
      const instances = Array.from(ResourceManager.instances.values());
      await Promise.all(instances.map(instance => instance.cleanup()));
    };

    // Handle various exit scenarios
    process.on('exit', () => {
      // Synchronous cleanup for exit event
      for (const instance of ResourceManager.instances.values()) {
        try {
          instance.performSyncCleanup();
        } catch (error) {
          // Silent cleanup on exit
        }
      }
    });

    process.on('SIGINT', async () => {
      await cleanupAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await cleanupAll();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanupAll();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('Unhandled rejection:', reason);
      await cleanupAll();
      process.exit(1);
    });
  }

  /**
   * Synchronous cleanup for process exit handlers
   */
  private performSyncCleanup(): void {
    try {
      if (this.database) {
        // Note: Synchronous close is not available in sqlite3, 
        // but we set to null to prevent further use
        this.database = null;
      }
      this.indexManager = null;
      this.embedder = null;
      this.isInitialized = false;
    } catch (error) {
      // Silent cleanup
    }
  }

  /**
   * Clean up all resources with proper error handling
   * Requirements: 5.5 - Proper resource disposal and error handling during cleanup
   */
  async cleanup(): Promise<void> {
    const errors: string[] = [];

    // Clean up database connection
    if (this.database) {
      try {
        await this.database.close();
        console.log('Database connection closed successfully');
      } catch (error) {
        const errorMsg = `Failed to close database: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      } finally {
        this.database = null;
      }
    }

    // Clean up index manager
    if (this.indexManager) {
      try {
        await this.indexManager.close();
        console.log('Index manager closed successfully');
      } catch (error) {
        const errorMsg = `Failed to close index manager: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      } finally {
        this.indexManager = null;
      }
    }

    // Clean up embedder (no explicit cleanup needed, just nullify reference)
    if (this.embedder) {
      this.embedder = null;
      console.log('Embedder reference cleared');
    }

    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;

    // Remove from instances map
    ResourceManager.instances.delete(this.resourceKey);

    // Log cleanup completion
    if (errors.length === 0) {
      console.log('Resource cleanup completed successfully');
    } else {
      console.warn(`Resource cleanup completed with ${errors.length} error(s):`);
      errors.forEach(error => console.warn(`  - ${error}`));
    }
  }

  /**
   * Clean up all instances (for testing or shutdown)
   * Requirements: 5.5 - Ensure resources are properly disposed when no longer needed
   */
  static async cleanupAll(): Promise<void> {
    const instances = Array.from(ResourceManager.instances.values());
    
    if (instances.length === 0) {
      console.log('No resource instances to clean up');
      return;
    }

    console.log(`Cleaning up ${instances.length} resource instance(s)...`);
    
    const cleanupPromises = instances.map(async (instance, index) => {
      try {
        await instance.cleanup();
        console.log(`Instance ${index + 1}/${instances.length} cleaned up successfully`);
      } catch (error) {
        console.error(`Failed to cleanup instance ${index + 1}/${instances.length}:`, 
          error instanceof Error ? error.message : String(error));
      }
    });

    await Promise.allSettled(cleanupPromises);
    ResourceManager.instances.clear();
    console.log('All resource instances cleanup completed');
  }

  /**
   * Get the number of active resource instances
   */
  static getActiveInstanceCount(): number {
    return ResourceManager.instances.size;
  }

  /**
   * Check if a specific resource configuration is already managed
   */
  static hasInstance(config: ResourceConfig): boolean {
    const resolvedConfig = ResourceManager.resolveConfig(config);
    const key = `${resolvedConfig.dbPath}:${resolvedConfig.indexPath}:${resolvedConfig.modelName}`;
    return ResourceManager.instances.has(key);
  }
}