/**
 * CORE MODULE — Mode Detection Service for Chameleon Architecture
 * Handles automatic mode detection from database and provides default configurations
 * Supports graceful error handling and fallback to text mode
 * Enhanced with shared database connection management to prevent locking issues
 */

import { openDatabase, getSystemInfo, setSystemInfo, initializeSchema } from './db.js';
import type { DatabaseConnection } from './db.js';
import { DatabaseConnectionManager } from './database-connection-manager.js';
import type { SystemInfo, ModeType, ModelType, RerankingStrategyType } from '../types.js';
import { handleError, ErrorCategory, ErrorSeverity, createError } from './error-handler.js';

// =============================================================================
// MODE DETECTION SERVICE
// =============================================================================

/**
 * Service for detecting and storing system mode configuration
 * Provides automatic mode detection from database with graceful error handling
 * Uses shared database connections to prevent locking issues
 */
export class ModeDetectionService {
    constructor(private dbPath: string) { }

    /**
     * Detects the current system mode from the database
     * Falls back to default text mode configuration for new installations
     * Enhanced with comprehensive error handling and recovery mechanisms
     * Uses shared database connections to prevent locking issues
     * 
     * @param existingConnection - Optional existing connection to reuse
     * @returns Promise resolving to SystemInfo with current or default configuration
     * 
     * @example
     * ```typescript
     * const modeService = new ModeDetectionService('./db.sqlite');
     * const systemInfo = await modeService.detectMode();
     * console.log(`Current mode: ${systemInfo.mode}`);
     * ```
     */
    async detectMode(existingConnection?: DatabaseConnection): Promise<SystemInfo> {
        let connection: DatabaseConnection | null = null;
        let shouldReleaseConnection = false;

        try {
            console.log(`🔍 Detecting system mode from database: ${this.dbPath}`);

            // Pre-flight check: Verify database accessibility
            const accessibility = await this.checkDatabaseAccessibility();
            console.log(`📊 Database accessibility check:`);
            console.log(`   Exists: ${accessibility.exists}`);
            console.log(`   Readable: ${accessibility.readable}`);
            console.log(`   Writable: ${accessibility.writable}`);
            console.log(`   Size: ${accessibility.size} bytes`);

            if (accessibility.error) {
                console.log(`   Error: ${accessibility.error}`);
            }

            // Handle accessibility issues proactively
            if (!accessibility.exists) {
                console.log('📁 Database file does not exist - this is a new installation');
                return this.getDefaultSystemInfo();
            }

            if (!accessibility.readable) {
                throw new Error(`Database file is not readable. Check file permissions for ${this.dbPath}`);
            }

            if (accessibility.size === 0) {
                console.log('📄 Database file is empty - treating as new installation');
                return this.getDefaultSystemInfo();
            }

            // Use existing connection or get managed connection
            if (existingConnection) {
                connection = existingConnection;
                console.log('🔄 Using existing database connection');
            } else {
                try {
                    connection = await DatabaseConnectionManager.getConnection(this.dbPath);
                    shouldReleaseConnection = true;
                    console.log('✅ Database connection established successfully');
                } catch (dbError) {
                    console.log('⚠️  Database connection failed, analyzing error...');
                    throw dbError; // Re-throw to be handled by main catch block
                }
            }

            // Verify database schema integrity
            console.log('🔍 Checking database schema integrity...');
            try {
                await this.verifySchemaIntegrity(connection);
                console.log('✅ Database schema exists and is accessible');
            } catch (schemaError) {
                console.log('⚠️  Database schema verification failed');
                throw schemaError;
            }

            console.log('✅ Database schema verified');

            // Attempt to retrieve system info
            console.log('📖 Retrieving system configuration from database...');
            let systemInfo: SystemInfo | null = null;

            try {
                systemInfo = await getSystemInfo(connection);
                console.log('✅ System info retrieved from database');
            } catch (retrievalError) {
                console.log('⚠️  System info retrieval failed');
                throw retrievalError;
            }

            // Handle missing system info (new installation)
            if (!systemInfo) {
                console.log('📝 No system configuration found - this appears to be a new installation');
                return this.getDefaultSystemInfo();
            }

            // Validate retrieved system info
            console.log('🔍 Validating system configuration...');
            try {
                this.validateSystemInfo(systemInfo);
                console.log('✅ System configuration validation passed');
            } catch (validationError) {
                console.log('⚠️  System configuration validation failed');
                throw validationError;
            }

            console.log('✅ System configuration validated successfully');

            // Success - log detailed configuration info
            console.log(`🎯 Mode detection successful!`);
            console.log(`   Mode: ${systemInfo.mode}`);
            console.log(`   Model: ${systemInfo.modelName} (${systemInfo.modelType})`);
            console.log(`   Dimensions: ${systemInfo.modelDimensions}`);
            console.log(`   Content Types: ${systemInfo.supportedContentTypes.join(', ')}`);
            console.log(`   Reranking: ${systemInfo.rerankingStrategy}`);

            return systemInfo;

        } catch (error) {
            console.log('❌ Mode detection encountered an error, initiating fallback procedure...');
            return this.handleDetectionError(error);
        } finally {
            // Enhanced connection cleanup with managed connections
            if (shouldReleaseConnection && connection) {
                try {
                    await DatabaseConnectionManager.releaseConnection(this.dbPath);
                    console.log('✅ Database connection released successfully');
                } catch (closeError) {
                    console.warn('⚠️  Warning: Failed to release database connection cleanly:', closeError instanceof Error ? closeError.message : closeError);
                    // Log additional context for debugging
                    if (closeError instanceof Error && closeError.message.includes('SQLITE_BUSY')) {
                        console.warn('💡 Database may still be processing operations. This is usually harmless.');
                    }
                }
            }
        }
    }

    /**
     * Stores system mode configuration in the database
     * Creates or updates the system_info table with the provided configuration
     * Uses shared database connections to prevent locking issues
     * 
     * @param systemInfo - SystemInfo object to store (can be partial for updates)
     * @param existingConnection - Optional existing connection to reuse
     * 
     * @example
     * ```typescript
     * const modeService = new ModeDetectionService('./db.sqlite');
     * await modeService.storeMode({
     *   mode: 'multimodal',
     *   modelName: 'Xenova/clip-vit-base-patch32',
     *   modelType: 'clip',
     *   modelDimensions: 512,
     *   supportedContentTypes: ['text', 'image'],
     *   rerankingStrategy: 'text-derived'
     * });
     * ```
     */
    async storeMode(systemInfo: Partial<SystemInfo>, existingConnection?: DatabaseConnection): Promise<void> {
        let connection: DatabaseConnection | null = null;
        let shouldReleaseConnection = false;

        try {
            // Validate the system info before storing
            if (systemInfo.mode) {
                this.validateMode(systemInfo.mode);
            }
            if (systemInfo.modelType) {
                this.validateModelType(systemInfo.modelType);
            }
            if (systemInfo.rerankingStrategy) {
                this.validateRerankingStrategy(systemInfo.rerankingStrategy);
            }

            // Use existing connection or get managed connection
            if (existingConnection) {
                connection = existingConnection;
            } else {
                connection = await DatabaseConnectionManager.getConnection(this.dbPath);
                shouldReleaseConnection = true;
            }

            // Initialize schema if it doesn't exist
            await this.ensureSchemaExists(connection);

            await setSystemInfo(connection, systemInfo);

            console.log(`✅ Mode configuration stored successfully: ${systemInfo.mode || 'partial update'}`);

        } catch (error) {
            const enhancedError = this.enhanceStorageError(error, systemInfo);
            handleError(enhancedError, 'Mode Storage', {
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.DATABASE
            });
            throw enhancedError;
        } finally {
            if (shouldReleaseConnection && connection) {
                try {
                    await DatabaseConnectionManager.releaseConnection(this.dbPath);
                } catch (closeError) {
                    console.warn('Warning: Failed to release database connection:', closeError);
                }
            }
        }
    }

    /**
     * Gets the current mode from the database (convenience method)
     * @returns Promise resolving to the current mode string
     */
    async getCurrentMode(): Promise<ModeType> {
        const systemInfo = await this.detectMode();
        return systemInfo.mode;
    }

    /**
     * Checks if the system is in multimodal mode
     * @returns Promise resolving to boolean indicating multimodal mode
     */
    async isMultimodalMode(): Promise<boolean> {
        const mode = await this.getCurrentMode();
        return mode === 'multimodal';
    }

    /**
     * Gets complete model information from the database
     * @returns Promise resolving to current model configuration
     */
    async getCurrentModelInfo(): Promise<{
        modelName: string;
        modelType: ModelType;
        dimensions: number;
        supportedContentTypes: string[];
    }> {
        const systemInfo = await this.detectMode();
        return {
            modelName: systemInfo.modelName,
            modelType: systemInfo.modelType,
            dimensions: systemInfo.modelDimensions,
            supportedContentTypes: systemInfo.supportedContentTypes
        };
    }

    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================

    /**
     * Get default system info for new installations
     * @private
     */
    private getDefaultSystemInfo(): SystemInfo {
        return {
            mode: 'text',
            modelName: 'sentence-transformers/all-MiniLM-L6-v2',
            modelType: 'sentence-transformer',
            modelDimensions: 384,
            modelVersion: '1.0.0',
            supportedContentTypes: ['text'],
            rerankingStrategy: 'cross-encoder',
            rerankingModel: 'Xenova/ms-marco-MiniLM-L-6-v2',
            rerankingConfig: undefined,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Check database file accessibility
     * @private
     */
    private async checkDatabaseAccessibility(): Promise<{
        exists: boolean;
        readable: boolean;
        writable: boolean;
        size: number;
        error?: string;
    }> {
        try {
            const fs = await import('fs');
            const path = this.dbPath;

            const exists = fs.existsSync(path);
            if (!exists) {
                return { exists: false, readable: false, writable: false, size: 0 };
            }

            const stats = fs.statSync(path);
            const size = stats.size;

            // Test readability
            let readable = true;
            try {
                fs.accessSync(path, fs.constants.R_OK);
            } catch {
                readable = false;
            }

            // Test writability
            let writable = true;
            try {
                fs.accessSync(path, fs.constants.W_OK);
            } catch {
                writable = false;
            }

            return { exists, readable, writable, size };

        } catch (error) {
            return {
                exists: false,
                readable: false,
                writable: false,
                size: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Verify database schema integrity
     * @private
     */
    private async verifySchemaIntegrity(connection: DatabaseConnection): Promise<void> {
        try {
            // Check if system_info table exists
            const result = await connection.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='system_info'"
            );

            if (!result) {
                throw new Error('system_info table does not exist');
            }

            // Verify table structure by attempting a simple query
            await connection.get('SELECT COUNT(*) as count FROM system_info');

        } catch (error) {
            throw new Error(`Database schema verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensure database schema exists
     * @private
     */
    private async ensureSchemaExists(connection: DatabaseConnection): Promise<void> {
        try {
            await initializeSchema(connection);
        } catch (error) {
            throw new Error(`Failed to initialize database schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle detection errors with fallback to default configuration
     * @private
     */
    private handleDetectionError(error: unknown): SystemInfo {
        console.log('🔄 Handling mode detection error with fallback to default configuration...');

        if (error instanceof Error) {
            console.log(`   Error details: ${error.message}`);

            // Provide specific guidance based on error type
            this.logErrorGuidance(error);
        } else {
            console.log(`   Unknown error: ${String(error)}`);
        }

        const defaultInfo = this.getDefaultSystemInfo();
        console.log(`✅ Fallback complete - using default configuration: ${defaultInfo.mode} mode`);

        return defaultInfo;
    }

    /**
     * Log error-specific guidance for users
     * @private
     */
    private logErrorGuidance(error: Error): void {
        console.log('');
        console.log('🔧 Troubleshooting suggestions:');

        if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
            console.log('   • Database file not found - this is normal for first-time use');
            console.log('   • Run ingestion to create the database');
            console.log('   • Use --mode parameter to set your preferred mode');
        } else if (error.message.includes('SQLITE_CORRUPT')) {
            console.log('   • Backup any important data if possible');
            console.log(`   • Delete the corrupted database: rm "${this.dbPath}"`);
            console.log('   • Re-run ingestion to recreate the database');
            console.log('   • Consider using database integrity check tools');
        } else if (error.message.includes('SQLITE_BUSY') || error.message.includes('locked')) {
            console.log('   • Close any other RAG-lite instances');
            console.log('   • Wait for ongoing operations to complete');
            console.log('   • Check for zombie processes: ps aux | grep raglite');
            console.log('   • Restart your terminal/IDE if needed');
        } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
            console.log(`   • Check file permissions: ls -la "${this.dbPath}"`);
            console.log(`   • Make file writable: chmod 644 "${this.dbPath}"`);
            console.log('   • Ensure directory is writable');
            console.log('   • Run with appropriate user permissions');
        } else if (error.message.includes('SQLITE_FULL') || error.message.includes('disk full')) {
            console.log('   • Free up disk space');
            console.log('   • Move database to location with more space');
            console.log('   • Clean up temporary files');
            console.log('   • Check disk usage: df -h');
        } else if (error.message.includes('no such table') || error.message.includes('schema')) {
            console.log('   • Re-run ingestion to update database schema');
            console.log('   • Or delete database and start fresh');
            console.log('   • Check if database was created with older version');
        } else {
            console.log('   • Check the error message above for specific details');
            console.log('   • Try running ingestion to recreate the database');
            console.log('   • If problem persists, report it as a bug');
            console.log(`   • Database path: ${this.dbPath}`);
        }

        console.log('');
        console.log('💡 For immediate use, the system will continue with default text mode.');
    }

    /**
     * Enhances storage errors with more context and helpful suggestions
     * @private
     */
    private enhanceStorageError(error: unknown, systemInfo: Partial<SystemInfo>): Error {
        if (error instanceof Error) {
            let enhancedMessage = `Failed to store mode configuration: ${error.message}`;

            if (error.message.includes('UNIQUE constraint failed')) {
                enhancedMessage = 'System info already exists. This should not happen with proper upsert logic.';
            } else if (error.message.includes('CHECK constraint failed')) {
                enhancedMessage = `Invalid configuration values provided. Check mode, model_type, and reranking_strategy values.`;

                if (systemInfo.mode && !['text', 'multimodal'].includes(systemInfo.mode)) {
                    enhancedMessage += `\nInvalid mode: '${systemInfo.mode}'. Must be 'text' or 'multimodal'.`;
                }
                if (systemInfo.modelType && !['sentence-transformer', 'clip'].includes(systemInfo.modelType)) {
                    enhancedMessage += `\nInvalid model type: '${systemInfo.modelType}'. Must be 'sentence-transformer' or 'clip'.`;
                }
                if (systemInfo.rerankingStrategy && !['cross-encoder', 'text-derived', 'metadata', 'hybrid', 'disabled'].includes(systemInfo.rerankingStrategy)) {
                    enhancedMessage += `\nInvalid reranking strategy: '${systemInfo.rerankingStrategy}'.`;
                }
            } else if (error.message.includes('SQLITE_READONLY')) {
                enhancedMessage = 'Database is read-only. Check file permissions and ensure the database file is writable.';
            }

            return new Error(enhancedMessage);
        }

        return new Error(`Failed to store mode configuration: ${String(error)}`);
    }

    /**
     * Validate complete system info object
     * @private
     */
    private validateSystemInfo(systemInfo: SystemInfo): void {
        console.log('🔍 Validating system configuration...');

        // Check for required fields
        const missingFields: string[] = [];
        if (!systemInfo.mode) missingFields.push('mode');
        if (!systemInfo.modelName) missingFields.push('modelName');
        if (!systemInfo.modelType) missingFields.push('modelType');

        if (missingFields.length > 0) {
            throw createError.validation(
                `Incomplete system configuration in database. Missing fields: ${missingFields.join(', ')}. ` +
                `This may indicate database corruption or an incomplete installation. ` +
                `Consider re-running ingestion to fix the configuration.`
            );
        }

        // Validate individual fields
        try {
            this.validateMode(systemInfo.mode);
        } catch (modeError) {
            throw createError.validation(
                `Invalid mode '${systemInfo.mode}' found in database. Expected 'text' or 'multimodal'. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        try {
            this.validateModelType(systemInfo.modelType);
        } catch (typeError) {
            throw createError.validation(
                `Invalid model type '${systemInfo.modelType}' found in database. Expected 'sentence-transformer' or 'clip'. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        if (systemInfo.rerankingStrategy) {
            try {
                this.validateRerankingStrategy(systemInfo.rerankingStrategy);
            } catch (strategyError) {
                throw createError.validation(
                    `Invalid reranking strategy '${systemInfo.rerankingStrategy}' found in database. ` +
                    `This may indicate database corruption. Consider re-running ingestion.`
                );
            }
        }

        // Validate supported content types
        if (!Array.isArray(systemInfo.supportedContentTypes)) {
            throw createError.validation(
                `Invalid supported content types format in database. Expected array, got ${typeof systemInfo.supportedContentTypes}. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        if (systemInfo.supportedContentTypes.length === 0) {
            throw createError.validation(
                `Empty supported content types array in database. At least one content type must be supported. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        // Validate model dimensions
        if (typeof systemInfo.modelDimensions !== 'number') {
            throw createError.validation(
                `Invalid model dimensions type in database. Expected number, got ${typeof systemInfo.modelDimensions}. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        if (systemInfo.modelDimensions <= 0) {
            throw createError.validation(
                `Invalid model dimensions value in database: ${systemInfo.modelDimensions}. Must be positive. ` +
                `This may indicate database corruption. Consider re-running ingestion.`
            );
        }

        // Warn about unusual dimensions (but don't fail)
        if (systemInfo.modelDimensions < 50 || systemInfo.modelDimensions > 2048) {
            console.warn(`⚠️  Unusual model dimensions detected: ${systemInfo.modelDimensions}. This may indicate configuration issues.`);
        }

        console.log('✅ System configuration validation completed successfully');
    }

    /**
     * Validate mode value
     * @private
     */
    private validateMode(mode: ModeType): void {
        const validModes: ModeType[] = ['text', 'multimodal'];
        if (!validModes.includes(mode)) {
            throw createError.validation(`Invalid mode '${mode}'. Must be one of: ${validModes.join(', ')}`);
        }
    }

    /**
     * Validate model type value
     * @private
     */
    private validateModelType(modelType: ModelType): void {
        const validTypes: ModelType[] = ['sentence-transformer', 'clip'];
        if (!validTypes.includes(modelType)) {
            throw createError.validation(`Invalid model type '${modelType}'. Must be one of: ${validTypes.join(', ')}`);
        }
    }

    /**
     * Validate reranking strategy value
     * @private
     */
    private validateRerankingStrategy(strategy: RerankingStrategyType): void {
        const validStrategies: RerankingStrategyType[] = ['cross-encoder', 'text-derived', 'metadata', 'hybrid', 'disabled'];
        if (!validStrategies.includes(strategy)) {
            throw createError.validation(`Invalid reranking strategy '${strategy}'. Must be one of: ${validStrategies.join(', ')}`);
        }
    }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick function to detect mode from database
 * @param dbPath - Path to database file
 * @returns Promise resolving to SystemInfo
 */
export async function detectSystemMode(dbPath: string): Promise<SystemInfo> {
    const service = new ModeDetectionService(dbPath);
    return service.detectMode();
}

/**
 * Quick function to store mode configuration
 * @param dbPath - Path to database file
 * @param systemInfo - System configuration to store
 */
export async function storeSystemMode(dbPath: string, systemInfo: Partial<SystemInfo>): Promise<void> {
    const service = new ModeDetectionService(dbPath);
    await service.storeMode(systemInfo);
}

/**
 * Quick function to check if system is in multimodal mode
 * @param dbPath - Path to database file
 * @returns Promise resolving to boolean
 */
export async function isMultimodalMode(dbPath: string): Promise<boolean> {
    const service = new ModeDetectionService(dbPath);
    return service.isMultimodalMode();
}