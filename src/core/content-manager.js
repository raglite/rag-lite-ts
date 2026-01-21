/**
 * Content Manager - Handles content ingestion routing for unified content system
 * Routes filesystem content to reference storage and memory content to content directory
 * Implements deduplication and content ID generation
 */
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { insertContentMetadata, getContentMetadataByHash, getStorageStats, updateStorageStats, getContentMetadataByStorageType, deleteContentMetadata } from './db.js';
import { ContentIngestionError, StorageLimitExceededError, InvalidContentFormatError, ContentErrorHandler } from './content-errors.js';
import { globalResourceCleanup, withResourceCleanup, writeFileAtomic, withTimeout, SafeBuffer } from './resource-cleanup.js';
import { createStreamingOperations, formatBytes, formatProcessingTime } from './streaming-operations.js';
import { createContentPerformanceOptimizer, formatCacheHitRate } from './content-performance-optimizer.js';
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    contentDir: '.raglite/content',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxContentDirSize: 2 * 1024 * 1024 * 1024, // 2GB
    enableDeduplication: true,
    enableStorageTracking: true,
    storageWarningThreshold: 75, // Warn at 75% usage
    storageErrorThreshold: 95 // Reject at 95% usage
};
/**
 * ContentManager class for handling content ingestion routing
 * Implements the unified content system's ingestion logic
 */
export class ContentManager {
    db;
    config;
    streamingOps;
    performanceOptimizer;
    constructor(db, config = {}) {
        this.db = db;
        // Parse and normalize configuration
        const inputConfig = { ...DEFAULT_CONFIG, ...config };
        // Parse size strings to bytes
        const maxFileSize = this.parseSizeToBytes(inputConfig.maxFileSize);
        const maxContentDirSize = this.parseSizeToBytes(inputConfig.maxContentDirSize);
        // Validate thresholds
        if (inputConfig.storageWarningThreshold < 0 || inputConfig.storageWarningThreshold > 100) {
            throw new Error('Storage warning threshold must be between 0 and 100');
        }
        if (inputConfig.storageErrorThreshold < 0 || inputConfig.storageErrorThreshold > 100) {
            throw new Error('Storage error threshold must be between 0 and 100');
        }
        if (inputConfig.storageErrorThreshold <= inputConfig.storageWarningThreshold) {
            throw new Error('Storage error threshold must be greater than warning threshold');
        }
        // Create normalized config
        this.config = {
            contentDir: inputConfig.contentDir,
            maxFileSize,
            maxContentDirSize,
            enableDeduplication: inputConfig.enableDeduplication,
            enableStorageTracking: inputConfig.enableStorageTracking,
            storageWarningThreshold: inputConfig.storageWarningThreshold,
            storageErrorThreshold: inputConfig.storageErrorThreshold
        };
        // Initialize streaming operations with appropriate chunk size based on file size limits
        const chunkSize = Math.floor(Math.min(1024 * 1024, Math.max(64 * 1024, maxFileSize / 100))); // 64KB to 1MB chunks
        this.streamingOps = createStreamingOperations({
            chunkSize,
            enableProgress: false, // Can be enabled for debugging
            enableHashing: true,
            timeout: 300000 // 5 minutes
        });
        // Initialize performance optimizer with optimized settings
        this.performanceOptimizer = createContentPerformanceOptimizer({
            hashCacheSize: 1000,
            hashCacheTTL: 60 * 60 * 1000, // 1 hour
            maxConcurrentOperations: 10,
            batchSize: 50,
            fileBufferSize: chunkSize,
            enableAsyncIO: true,
            enableMetrics: true,
            metricsRetentionTime: 24 * 60 * 60 * 1000 // 24 hours
        });
    }
    /**
     * Ingests content from filesystem by creating references without copying files
     * @param filePath - Path to the file to ingest
     * @returns Promise that resolves to content ingestion result
     */
    async ingestFromFilesystem(filePath) {
        // Use resource cleanup with timeout for filesystem operations
        return withResourceCleanup(async (transactionId) => {
            let content = null;
            let safeBuffer = null;
            try {
                // Verify file exists and get stats with timeout
                const stats = await withTimeout(fs.stat(filePath), 10000, // 10 second timeout for file stat
                'File stat operation timed out');
                if (!stats.isFile()) {
                    throw new ContentIngestionError('file validation', `Path is not a file: ${filePath}`, 'filesystem_ingestion');
                }
                // Check file size limit
                if (stats.size > this.config.maxFileSize) {
                    const sizeMB = Math.round((stats.size / 1024 / 1024) * 100) / 100;
                    const limitMB = Math.round((this.config.maxFileSize / 1024 / 1024) * 100) / 100;
                    throw new ContentIngestionError('file size validation', `File size (${sizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`, 'filesystem_ingestion');
                }
                // Use optimized hash calculation with caching
                let contentHash;
                if (stats.size > 10 * 1024 * 1024) { // Use streaming for files > 10MB
                    contentHash = await withTimeout(this.performanceOptimizer.calculateFileHashOptimized(filePath), 120000, // 2 minute timeout for large file hashing
                    'Optimized hash calculation timed out');
                    // Log performance metrics for large files
                    if (stats.size > 50 * 1024 * 1024) {
                        const cacheStats = this.performanceOptimizer.getHashCacheStats();
                        console.log(`Optimized hash completed: ${formatBytes(stats.size)} (Cache hit rate: ${formatCacheHitRate(cacheStats.hitRate)})`);
                    }
                }
                else {
                    // For smaller files, use traditional method with memory management
                    content = await withTimeout(fs.readFile(filePath), 60000, // 60 second timeout for file reading
                    'File read operation timed out');
                    // Create safe buffer for memory management (don't clear original for normal operations)
                    safeBuffer = new SafeBuffer(content, { clearOriginal: false });
                    globalResourceCleanup.addBuffer(transactionId, safeBuffer.get());
                    contentHash = this.generateContentHash(safeBuffer.get());
                }
                // Check for existing content if deduplication is enabled
                if (this.config.enableDeduplication) {
                    const existing = await withTimeout(getContentMetadataByHash(this.db, contentHash), 10000, // 10 second timeout for database query
                    'Database query for existing content timed out');
                    if (existing) {
                        return {
                            contentId: existing.id,
                            wasDeduped: true,
                            storageType: existing.storageType,
                            contentPath: existing.contentPath
                        };
                    }
                }
                // Generate content ID
                const contentId = safeBuffer ? this.generateContentId(safeBuffer.get()) : this.generateContentIdFromHash(contentHash);
                // Detect content type - for streaming case, read small sample for magic number detection
                let contentType;
                if (stats.size > 10 * 1024 * 1024 && !content) {
                    // For large files processed with streaming, read small sample for content type detection
                    const sampleSize = Math.min(8192, stats.size); // Read first 8KB for magic number detection
                    const sample = Buffer.alloc(sampleSize);
                    const fd = await fs.open(filePath, 'r');
                    try {
                        await fd.read(sample, 0, sampleSize, 0);
                        contentType = this.detectContentType(filePath, sample);
                    }
                    finally {
                        await fd.close();
                    }
                }
                else {
                    contentType = safeBuffer ? this.detectContentType(filePath, safeBuffer.get()) : this.detectContentType(filePath);
                }
                // Validate content type is supported
                const validation = this.validateContentType(contentType);
                if (!validation.isSupported) {
                    throw new InvalidContentFormatError(contentType, validation.error, 'filesystem_ingestion');
                }
                // Create content metadata for filesystem reference
                const contentMetadata = {
                    id: contentId,
                    storageType: 'filesystem',
                    originalPath: filePath,
                    contentPath: filePath, // For filesystem, content path is the same as original path
                    displayName: basename(filePath),
                    contentType,
                    fileSize: stats.size,
                    contentHash
                };
                // Track database entry for cleanup in case of failure
                globalResourceCleanup.addDatabaseEntry(transactionId, this.db, contentId);
                // Insert content metadata with timeout
                await withTimeout(insertContentMetadata(this.db, contentMetadata), 10000, // 10 second timeout for database insertion
                'Database insertion timed out');
                return {
                    contentId,
                    wasDeduped: false,
                    storageType: 'filesystem',
                    contentPath: filePath
                };
            }
            catch (error) {
                if (error instanceof ContentIngestionError || error instanceof InvalidContentFormatError) {
                    throw error; // Re-throw content-specific errors
                }
                ContentErrorHandler.handleContentError(error, 'filesystem ingestion', 'ingestFromFilesystem');
            }
            finally {
                // Clear sensitive buffer data
                if (safeBuffer) {
                    safeBuffer.clear();
                }
            }
        }, 90000); // 90 second overall timeout for filesystem operations
    }
    /**
     * Ingests content from memory by storing it in content directory with hash-based filenames
     * @param content - Buffer containing the content
     * @param metadata - Memory content metadata
     * @returns Promise that resolves to content ingestion result
     */
    async ingestFromMemory(content, metadata) {
        // Use resource cleanup with timeout for long-running operations
        return withResourceCleanup(async (transactionId) => {
            // Create safe buffer for memory management (don't clear original for normal operations)
            const safeBuffer = new SafeBuffer(content, { clearOriginal: false });
            globalResourceCleanup.addBuffer(transactionId, safeBuffer.get());
            try {
                // Check content size limit
                if (content.length > this.config.maxFileSize) {
                    const sizeMB = Math.round((content.length / 1024 / 1024) * 100) / 100;
                    const limitMB = Math.round((this.config.maxFileSize / 1024 / 1024) * 100) / 100;
                    throw new ContentIngestionError('content size validation', `Content size (${sizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`, 'memory_ingestion');
                }
                // Enforce storage limits with enhanced error messages and guidance
                await withTimeout(this.enforceStorageLimits(content.length), 30000, // 30 second timeout for storage limit checks
                'Storage limit enforcement timed out');
                // Use optimized hash calculation with caching
                let contentHash;
                // Use optimized hash calculation with caching
                // Don't use a cache key for memory content to ensure proper deduplication
                contentHash = await withTimeout(this.performanceOptimizer.calculateBufferHashOptimized(safeBuffer.get()), 120000, // 2 minute timeout for hash calculation
                'Optimized buffer hash calculation timed out');
                // Log performance metrics for large content
                if (content.length > 50 * 1024 * 1024) {
                    const cacheStats = this.performanceOptimizer.getHashCacheStats();
                    console.log(`Optimized buffer hash completed: ${formatBytes(content.length)} (Cache hit rate: ${formatCacheHitRate(cacheStats.hitRate)})`);
                }
                // Check for existing content if deduplication is enabled
                if (this.config.enableDeduplication) {
                    const existing = await withTimeout(getContentMetadataByHash(this.db, contentHash), 10000, // 10 second timeout for database queries
                    'Database query for existing content timed out');
                    if (existing) {
                        // Content already exists, no cleanup needed
                        return {
                            contentId: existing.id,
                            wasDeduped: true,
                            storageType: existing.storageType,
                            contentPath: existing.contentPath
                        };
                    }
                }
                // Generate content ID
                const contentId = this.generateContentId(safeBuffer.get());
                // Detect content type
                const contentType = metadata.contentType || this.detectContentTypeFromBuffer(safeBuffer.get(), metadata.displayName);
                // Validate content type is supported
                const validation = this.validateContentType(contentType);
                if (!validation.isSupported) {
                    throw new InvalidContentFormatError(contentType, validation.error, 'memory_ingestion');
                }
                // Ensure content directory exists
                await withTimeout(this.ensureContentDirectory(), 5000, // 5 second timeout for directory creation
                'Content directory creation timed out');
                // Generate filename with extension based on content type or display name
                const extension = this.getExtensionFromContentType(contentType) ||
                    (metadata.displayName ? extname(metadata.displayName) : '.bin');
                const filename = `${contentHash}${extension}`;
                const contentPath = join(this.config.contentDir, filename);
                // Use streaming write for large content to minimize memory usage
                if (content.length > 10 * 1024 * 1024) { // Use streaming for content > 10MB
                    const writeResult = await withTimeout(this.streamingOps.writeBufferStreaming(safeBuffer.get(), contentPath), 180000, // 3 minute timeout for large content writing
                    'Streaming write operation timed out');
                    // Log performance metrics for large content
                    if (content.length > 50 * 1024 * 1024) {
                        console.log(`Streaming write completed: ${formatBytes(writeResult.bytesWritten)} in ${formatProcessingTime(writeResult.processingTimeMs)}`);
                    }
                    // Track file for cleanup
                    globalResourceCleanup.addTempFile(transactionId, contentPath);
                }
                else {
                    // For smaller content, use atomic write with cleanup tracking
                    await withTimeout(writeFileAtomic(contentPath, safeBuffer.get(), transactionId), 60000, // 60 second timeout for file writing
                    'File write operation timed out');
                }
                // Create content metadata
                const contentMetadata = {
                    id: contentId,
                    storageType: 'content_dir',
                    originalPath: metadata.originalPath,
                    contentPath,
                    displayName: metadata.displayName,
                    contentType,
                    fileSize: content.length,
                    contentHash
                };
                // Insert content metadata with cleanup tracking
                globalResourceCleanup.addDatabaseEntry(transactionId, this.db, contentId);
                await withTimeout(insertContentMetadata(this.db, contentMetadata), 10000, // 10 second timeout for database insertion
                'Database insertion timed out');
                // Update storage statistics if tracking is enabled
                if (this.config.enableStorageTracking) {
                    try {
                        await withTimeout(this.updateStorageStats(), 15000, // 15 second timeout for stats update
                        'Storage stats update timed out');
                    }
                    catch (error) {
                        // Don't fail the operation if stats update fails
                        console.warn('Failed to update storage stats after ingestion:', error);
                    }
                }
                return {
                    contentId,
                    wasDeduped: false,
                    storageType: 'content_dir',
                    contentPath
                };
            }
            catch (error) {
                if (error instanceof ContentIngestionError ||
                    error instanceof InvalidContentFormatError ||
                    error instanceof StorageLimitExceededError) {
                    throw error; // Re-throw content-specific errors
                }
                ContentErrorHandler.handleContentError(error, 'memory ingestion', 'ingestFromMemory');
            }
            finally {
                // Clear sensitive buffer data
                safeBuffer.clear();
            }
        }, 120000); // 2 minute overall timeout for the entire operation
    }
    /**
     * Generates a stable content ID using SHA-256 hash of content
     * @param content - Buffer containing the content
     * @returns Content ID string
     */
    generateContentId(content) {
        return this.generateContentHash(content);
    }
    /**
     * Generates a unique content ID from an existing hash
     * @param hash - Content hash
     * @returns Content ID string
     */
    generateContentIdFromHash(hash) {
        return hash;
    }
    /**
     * Gets performance statistics for monitoring and optimization
     * @returns Performance statistics
     */
    getPerformanceStats() {
        const cacheStats = this.performanceOptimizer.getHashCacheStats();
        const operationStats = this.performanceOptimizer.getPerformanceStats();
        return {
            hashCache: cacheStats,
            operations: operationStats
        };
    }
    /**
     * Clears performance caches and resets metrics
     */
    clearPerformanceCaches() {
        this.performanceOptimizer.clearHashCache();
    }
    /**
     * Checks if content with given ID already exists (deduplication check)
     * @param contentId - Content ID to check
     * @returns Promise that resolves to true if content exists, false otherwise
     */
    async deduplicateContent(contentId) {
        try {
            const existing = await getContentMetadataByHash(this.db, contentId);
            return existing !== null;
        }
        catch (error) {
            throw new Error(`Failed to check for duplicate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // STORAGE LIMIT ENFORCEMENT METHODS
    // =============================================================================
    /**
     * Enforces storage limits before accepting new content
     * @param contentSize - Size of content to add in bytes
     * @returns Promise that resolves if content can be added, throws error otherwise
     */
    async enforceStorageLimits(contentSize) {
        if (!this.config.enableStorageTracking) {
            return; // Skip enforcement if tracking is disabled
        }
        try {
            const stats = await this.getStorageStats();
            const currentUsage = stats.contentDirectory.totalSize;
            const projectedUsage = currentUsage + contentSize;
            const maxSize = this.config.maxContentDirSize;
            const currentPercent = (currentUsage / maxSize) * 100;
            const projectedPercent = (projectedUsage / maxSize) * 100;
            // Check if adding content would exceed error threshold
            if (projectedPercent > this.config.storageErrorThreshold) {
                const currentMB = Math.round((currentUsage / 1024 / 1024) * 100) / 100;
                const maxMB = Math.round((maxSize / 1024 / 1024) * 100) / 100;
                const contentMB = Math.round((contentSize / 1024 / 1024) * 100) / 100;
                const remainingMB = Math.round(((maxSize - currentUsage) / 1024 / 1024) * 100) / 100;
                throw new StorageLimitExceededError(currentMB, maxMB, contentMB, 'storage_enforcement');
            }
            // Check if adding content would exceed warning threshold
            if (projectedPercent > this.config.storageWarningThreshold && currentPercent <= this.config.storageWarningThreshold) {
                const currentMB = Math.round((currentUsage / 1024 / 1024) * 100) / 100;
                const maxMB = Math.round((maxSize / 1024 / 1024) * 100) / 100;
                console.warn(`⚠️  Storage Warning: Content directory usage will reach ${Math.round(projectedPercent)}% after adding this content.\n` +
                    `Current: ${currentMB}MB / ${maxMB}MB (${Math.round(currentPercent)}%)\n` +
                    `Consider running cleanup operations to free space.`);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Storage limit exceeded')) {
                throw error; // Re-throw storage limit errors
            }
            // Log other errors but don't fail the operation
            console.warn('Failed to enforce storage limits:', error);
        }
    }
    /**
     * Gets storage limit status and recommendations
     * @returns Promise that resolves to storage limit status
     */
    async getStorageLimitStatus() {
        try {
            const stats = await this.getStorageStats();
            const currentUsage = stats.contentDirectory.totalSize;
            const maxSize = this.config.maxContentDirSize;
            const currentPercent = (currentUsage / maxSize) * 100;
            const isNearWarningThreshold = currentPercent >= this.config.storageWarningThreshold;
            const isNearErrorThreshold = currentPercent >= this.config.storageErrorThreshold;
            const canAcceptContent = currentPercent < this.config.storageErrorThreshold;
            const recommendations = [];
            if (isNearErrorThreshold) {
                recommendations.push('🚨 URGENT: Storage is critically full - new content will be rejected');
                recommendations.push('Run cleanup operations immediately: removeOrphanedFiles() and removeDuplicateContent()');
                recommendations.push('Consider increasing storage limits or removing unused content');
            }
            else if (isNearWarningThreshold) {
                recommendations.push('⚠️  WARNING: Storage is getting full');
                recommendations.push('Consider running cleanup operations: removeOrphanedFiles() and removeDuplicateContent()');
                recommendations.push('Monitor storage usage closely');
            }
            else if (currentPercent > 50) {
                recommendations.push('ℹ️  Storage is over 50% full');
                recommendations.push('Regular cleanup operations recommended');
            }
            else {
                recommendations.push('✅ Storage usage is healthy');
            }
            return {
                currentUsagePercent: Math.round(currentPercent * 100) / 100,
                isNearWarningThreshold,
                isNearErrorThreshold,
                canAcceptContent,
                recommendations,
                limits: {
                    warningThreshold: this.config.storageWarningThreshold,
                    errorThreshold: this.config.storageErrorThreshold,
                    maxSizeMB: Math.round((maxSize / 1024 / 1024) * 100) / 100,
                    currentSizeMB: Math.round((currentUsage / 1024 / 1024) * 100) / 100,
                    remainingSizeMB: Math.round(((maxSize - currentUsage) / 1024 / 1024) * 100) / 100
                }
            };
        }
        catch (error) {
            throw new Error(`Failed to get storage limit status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    /**
     * Parses size string or number to bytes
     * @param size - Size as number (bytes) or string like "50MB", "2GB"
     * @returns Size in bytes
     */
    parseSizeToBytes(size) {
        if (typeof size === 'number') {
            return size;
        }
        const sizeStr = size.toString().trim().toUpperCase();
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/);
        if (!match) {
            throw new Error(`Invalid size format: ${size}. Use formats like "50MB", "2GB", or number of bytes.`);
        }
        const value = parseFloat(match[1]);
        const unit = match[2] || 'B';
        const multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };
        return Math.round(value * multipliers[unit]);
    }
    /**
     * Generates SHA-256 hash of content
     * @param content - Buffer containing the content
     * @returns SHA-256 hash string
     */
    generateContentHash(content) {
        return createHash('sha256').update(content).digest('hex');
    }
    /**
     * Detects content type from file path and optionally content using enhanced magic number detection
     * @param filePath - Path to the file
     * @param content - File content buffer (optional)
     * @returns MIME type string
     */
    detectContentType(filePath, content) {
        const extension = extname(filePath).toLowerCase();
        // First try magic number detection for more reliable identification (if content is available)
        if (content) {
            const magicBasedType = this.detectContentTypeByMagicNumbers(content);
            if (magicBasedType !== 'application/octet-stream') {
                return magicBasedType;
            }
        }
        // Fall back to extension-based detection
        const extensionBasedType = this.detectContentTypeByExtension(extension);
        if (extensionBasedType !== 'application/octet-stream') {
            return extensionBasedType;
        }
        // Final fallback: check if it's text content (if content is available)
        if (content && this.isTextContent(content)) {
            return 'text/plain';
        }
        return 'application/octet-stream';
    }
    /**
     * Detects content type from buffer and optional filename for memory-based ingestion
     * @param content - Content buffer
     * @param filename - Optional filename for extension-based detection
     * @returns MIME type string
     */
    detectContentTypeFromBuffer(content, filename) {
        // Use filename if provided for more accurate detection
        if (filename) {
            return this.detectContentType(filename, content);
        }
        // Use magic number detection for buffer-only content
        const magicBasedType = this.detectContentTypeByMagicNumbers(content);
        if (magicBasedType !== 'application/octet-stream') {
            return magicBasedType;
        }
        // Final fallback: check if it's text content
        if (this.isTextContent(content)) {
            return 'text/plain';
        }
        return 'application/octet-stream';
    }
    /**
     * Enhanced magic number detection for comprehensive content type identification
     * @param content - Content buffer to analyze
     * @returns MIME type string based on magic numbers, or 'application/octet-stream' if unknown
     */
    detectContentTypeByMagicNumbers(content) {
        if (content.length === 0) {
            return 'application/octet-stream';
        }
        // Get enough bytes for magic number detection
        const magicBytes = content.subarray(0, Math.min(32, content.length));
        // PDF - %PDF
        if (magicBytes.length >= 4 && magicBytes.subarray(0, 4).toString() === '%PDF') {
            return 'application/pdf';
        }
        // PNG - 89 50 4E 47 0D 0A 1A 0A
        if (magicBytes.length >= 8 &&
            magicBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
            return 'image/png';
        }
        // JPEG - FF D8 FF
        if (magicBytes.length >= 3 &&
            magicBytes.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
            return 'image/jpeg';
        }
        // GIF87a or GIF89a
        if (magicBytes.length >= 6) {
            const gifHeader = magicBytes.subarray(0, 6).toString();
            if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
                return 'image/gif';
            }
        }
        // WebP - RIFF....WEBP
        if (magicBytes.length >= 12 &&
            magicBytes.subarray(0, 4).toString() === 'RIFF' &&
            magicBytes.subarray(8, 12).toString() === 'WEBP') {
            return 'image/webp';
        }
        // ZIP-based formats (DOCX, XLSX, etc.) - 50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08
        if (magicBytes.length >= 4) {
            const zipMagic = magicBytes.subarray(0, 4);
            if (zipMagic.equals(Buffer.from([0x50, 0x4B, 0x03, 0x04])) ||
                zipMagic.equals(Buffer.from([0x50, 0x4B, 0x05, 0x06])) ||
                zipMagic.equals(Buffer.from([0x50, 0x4B, 0x07, 0x08]))) {
                // For ZIP files, we need more context to determine the specific type
                // This is a generic ZIP file, specific detection would require filename
                return 'application/zip';
            }
        }
        // BMP - 42 4D
        if (magicBytes.length >= 2 &&
            magicBytes.subarray(0, 2).equals(Buffer.from([0x42, 0x4D]))) {
            return 'image/bmp';
        }
        // TIFF - 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
        if (magicBytes.length >= 4) {
            const tiffLE = Buffer.from([0x49, 0x49, 0x2A, 0x00]);
            const tiffBE = Buffer.from([0x4D, 0x4D, 0x00, 0x2A]);
            if (magicBytes.subarray(0, 4).equals(tiffLE) || magicBytes.subarray(0, 4).equals(tiffBE)) {
                return 'image/tiff';
            }
        }
        // ICO - 00 00 01 00
        if (magicBytes.length >= 4 &&
            magicBytes.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) {
            return 'image/x-icon';
        }
        // SVG - Check for XML declaration and SVG tag
        if (magicBytes.length >= 5) {
            const start = magicBytes.toString('utf8', 0, Math.min(100, magicBytes.length)).toLowerCase();
            if (start.includes('<svg') || (start.includes('<?xml') && start.includes('<svg'))) {
                return 'image/svg+xml';
            }
        }
        // HTML - Check for HTML tags
        if (magicBytes.length >= 5) {
            const start = magicBytes.toString('utf8', 0, Math.min(100, magicBytes.length)).toLowerCase();
            if (start.includes('<!doctype html') || start.includes('<html') || start.includes('<head')) {
                return 'text/html';
            }
        }
        // XML - Check for XML declaration
        if (magicBytes.length >= 5) {
            const start = magicBytes.toString('utf8', 0, Math.min(50, magicBytes.length)).toLowerCase();
            if (start.startsWith('<?xml')) {
                return 'application/xml';
            }
        }
        // JSON - Check for JSON structure (basic heuristic)
        if (magicBytes.length >= 2) {
            const start = magicBytes.toString('utf8', 0, Math.min(10, magicBytes.length)).trim();
            if (start.startsWith('{') || start.startsWith('[')) {
                // Additional validation to ensure it's likely JSON
                try {
                    const sample = content.toString('utf8', 0, Math.min(1024, content.length));
                    JSON.parse(sample);
                    return 'application/json';
                }
                catch {
                    // Not valid JSON, continue with other detection
                }
            }
        }
        return 'application/octet-stream';
    }
    /**
     * Extension-based content type detection with comprehensive mapping
     * @param extension - File extension (with or without dot)
     * @returns MIME type string based on extension, or 'application/octet-stream' if unknown
     */
    detectContentTypeByExtension(extension) {
        const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
        // Text formats
        switch (ext) {
            case '.txt':
            case '.text':
                return 'text/plain';
            case '.md':
            case '.markdown':
            case '.mdown':
                return 'text/markdown';
            case '.html':
            case '.htm':
                return 'text/html';
            case '.css':
                return 'text/css';
            case '.js':
            case '.mjs':
                return 'application/javascript';
            case '.json':
                return 'application/json';
            case '.xml':
                return 'application/xml';
            case '.csv':
                return 'text/csv';
            case '.rtf':
                return 'application/rtf';
            // Document formats
            case '.pdf':
                return 'application/pdf';
            case '.doc':
                return 'application/msword';
            case '.docx':
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case '.xls':
                return 'application/vnd.ms-excel';
            case '.xlsx':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case '.ppt':
                return 'application/vnd.ms-powerpoint';
            case '.pptx':
                return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            case '.odt':
                return 'application/vnd.oasis.opendocument.text';
            case '.ods':
                return 'application/vnd.oasis.opendocument.spreadsheet';
            case '.odp':
                return 'application/vnd.oasis.opendocument.presentation';
            // Image formats
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.gif':
                return 'image/gif';
            case '.webp':
                return 'image/webp';
            case '.bmp':
                return 'image/bmp';
            case '.tiff':
            case '.tif':
                return 'image/tiff';
            case '.ico':
                return 'image/x-icon';
            case '.svg':
                return 'image/svg+xml';
            case '.avif':
                return 'image/avif';
            case '.heic':
            case '.heif':
                return 'image/heic';
            // Archive formats
            case '.zip':
                return 'application/zip';
            case '.rar':
                return 'application/vnd.rar';
            case '.7z':
                return 'application/x-7z-compressed';
            case '.tar':
                return 'application/x-tar';
            case '.gz':
                return 'application/gzip';
            // Audio formats
            case '.mp3':
                return 'audio/mpeg';
            case '.wav':
                return 'audio/wav';
            case '.ogg':
                return 'audio/ogg';
            case '.flac':
                return 'audio/flac';
            // Video formats
            case '.mp4':
                return 'video/mp4';
            case '.avi':
                return 'video/x-msvideo';
            case '.mov':
                return 'video/quicktime';
            case '.webm':
                return 'video/webm';
            default:
                return 'application/octet-stream';
        }
    }
    /**
     * Validates if a content type is supported for processing
     * @param contentType - MIME type to validate
     * @returns Object with validation result and error message if unsupported
     */
    validateContentType(contentType) {
        // Define supported content types for RAG-lite processing
        const supportedTypes = new Set([
            // Text formats (fully supported)
            'text/plain',
            'text/markdown',
            'text/html',
            'text/css',
            'text/csv',
            'application/json',
            'application/xml',
            'application/javascript',
            'application/rtf',
            // Document formats (supported via preprocessing)
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.oasis.opendocument.presentation',
            // Image formats (supported via multimodal processing)
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/tiff',
            'image/svg+xml',
            'image/avif',
            'image/heic',
            // Generic binary (accepted but limited processing)
            'application/octet-stream',
            'application/zip' // May contain supported documents
        ]);
        if (supportedTypes.has(contentType)) {
            return { isSupported: true };
        }
        // Provide specific guidance for unsupported types
        const category = contentType.split('/')[0];
        let error = `Unsupported content type: ${contentType}. `;
        switch (category) {
            case 'audio':
                error += 'Audio files are not supported for text-based RAG processing. Consider extracting transcripts or metadata.';
                break;
            case 'video':
                error += 'Video files are not supported for text-based RAG processing. Consider extracting transcripts, subtitles, or metadata.';
                break;
            case 'application':
                if (contentType.includes('executable') || contentType.includes('binary')) {
                    error += 'Executable and binary application files are not supported for security and processing reasons.';
                }
                else {
                    error += 'This application format is not currently supported. Supported formats include PDF, Office documents, and common text formats.';
                }
                break;
            default:
                error += `The ${category} content type is not supported. Supported types include text, documents (PDF, DOCX), and images.`;
        }
        return { isSupported: false, error };
    }
    /**
     * Gets file extension from content type with enhanced mapping
     * @param contentType - MIME type
     * @returns File extension with dot, or null if unknown
     */
    getExtensionFromContentType(contentType) {
        switch (contentType) {
            // Text formats
            case 'text/plain':
                return '.txt';
            case 'text/markdown':
                return '.md';
            case 'text/html':
                return '.html';
            case 'text/css':
                return '.css';
            case 'text/csv':
                return '.csv';
            case 'application/json':
                return '.json';
            case 'application/xml':
                return '.xml';
            case 'application/javascript':
                return '.js';
            case 'application/rtf':
                return '.rtf';
            // Document formats
            case 'application/pdf':
                return '.pdf';
            case 'application/msword':
                return '.doc';
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return '.docx';
            case 'application/vnd.ms-excel':
                return '.xls';
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                return '.xlsx';
            case 'application/vnd.ms-powerpoint':
                return '.ppt';
            case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                return '.pptx';
            case 'application/vnd.oasis.opendocument.text':
                return '.odt';
            case 'application/vnd.oasis.opendocument.spreadsheet':
                return '.ods';
            case 'application/vnd.oasis.opendocument.presentation':
                return '.odp';
            // Image formats
            case 'image/jpeg':
                return '.jpg';
            case 'image/png':
                return '.png';
            case 'image/gif':
                return '.gif';
            case 'image/webp':
                return '.webp';
            case 'image/bmp':
                return '.bmp';
            case 'image/tiff':
                return '.tiff';
            case 'image/x-icon':
                return '.ico';
            case 'image/svg+xml':
                return '.svg';
            case 'image/avif':
                return '.avif';
            case 'image/heic':
                return '.heic';
            // Archive formats
            case 'application/zip':
                return '.zip';
            case 'application/vnd.rar':
                return '.rar';
            case 'application/x-7z-compressed':
                return '.7z';
            case 'application/x-tar':
                return '.tar';
            case 'application/gzip':
                return '.gz';
            default:
                return '.bin'; // Generic binary extension for unknown types
        }
    }
    /**
     * Enhanced text content detection with better UTF-8 and encoding support
     * @param content - Content buffer
     * @returns True if content appears to be text
     */
    isTextContent(content) {
        if (content.length === 0) {
            return true; // Empty content is considered text
        }
        // Check first 2KB for better accuracy
        const sample = content.subarray(0, Math.min(2048, content.length));
        let nonTextBytes = 0;
        let totalBytes = sample.length;
        // Skip UTF-8 BOM if present
        let startIndex = 0;
        if (sample.length >= 3 &&
            sample[0] === 0xEF && sample[1] === 0xBB && sample[2] === 0xBF) {
            startIndex = 3;
        }
        // Skip UTF-16 BOM if present
        if (sample.length >= 2 &&
            ((sample[0] === 0xFF && sample[1] === 0xFE) ||
                (sample[0] === 0xFE && sample[1] === 0xFF))) {
            startIndex = 2;
        }
        for (let i = startIndex; i < sample.length; i++) {
            const byte = sample[i];
            // Allow common control characters
            if (byte === 9 || byte === 10 || byte === 13) { // Tab, LF, CR
                continue;
            }
            // Allow printable ASCII (32-126)
            if (byte >= 32 && byte <= 126) {
                continue;
            }
            // Allow extended ASCII and UTF-8 continuation bytes
            if (byte >= 128) {
                // Check if this is part of a valid UTF-8 sequence
                if (this.isValidUTF8Byte(sample, i)) {
                    continue;
                }
            }
            // Count non-text bytes
            nonTextBytes++;
        }
        // Consider it text if less than 5% of bytes are non-text
        const nonTextRatio = nonTextBytes / totalBytes;
        return nonTextRatio < 0.05;
    }
    /**
     * Checks if a byte at given position is part of a valid UTF-8 sequence
     * @param buffer - Buffer to check
     * @param index - Index of the byte to check
     * @returns True if the byte is part of valid UTF-8
     */
    isValidUTF8Byte(buffer, index) {
        const byte = buffer[index];
        // UTF-8 continuation byte (10xxxxxx)
        if ((byte & 0xC0) === 0x80) {
            return true;
        }
        // UTF-8 start bytes
        if ((byte & 0xE0) === 0xC0) { // 110xxxxx - 2-byte sequence
            return index + 1 < buffer.length && (buffer[index + 1] & 0xC0) === 0x80;
        }
        if ((byte & 0xF0) === 0xE0) { // 1110xxxx - 3-byte sequence
            return index + 2 < buffer.length &&
                (buffer[index + 1] & 0xC0) === 0x80 &&
                (buffer[index + 2] & 0xC0) === 0x80;
        }
        if ((byte & 0xF8) === 0xF0) { // 11110xxx - 4-byte sequence
            return index + 3 < buffer.length &&
                (buffer[index + 1] & 0xC0) === 0x80 &&
                (buffer[index + 2] & 0xC0) === 0x80 &&
                (buffer[index + 3] & 0xC0) === 0x80;
        }
        // Extended ASCII (128-255) - allow but consider less reliable
        return byte >= 128 && byte <= 255;
    }
    /**
     * Ensures content directory exists
     * @returns Promise that resolves when directory is created
     */
    async ensureContentDirectory() {
        try {
            await fs.mkdir(this.config.contentDir, { recursive: true });
        }
        catch (error) {
            throw new Error(`Failed to create content directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // =============================================================================
    // CONTENT DIRECTORY MANAGEMENT METHODS
    // =============================================================================
    /**
     * Gets comprehensive storage statistics for monitoring and reporting
     * @returns Promise that resolves to detailed storage statistics
     */
    async getStorageStats() {
        try {
            const dbStats = await getStorageStats(this.db);
            if (!dbStats) {
                // Initialize stats if they don't exist
                await this.updateStorageStats();
                return this.getStorageStats(); // Recursive call after initialization
            }
            // Calculate filesystem references total size
            const filesystemContent = await getContentMetadataByStorageType(this.db, 'filesystem');
            const filesystemTotalSize = filesystemContent.reduce((sum, meta) => sum + meta.fileSize, 0);
            // Calculate derived statistics
            const contentDirSizeMB = Math.round((dbStats.contentDirSize / 1024 / 1024) * 100) / 100;
            const filesystemSizeMB = Math.round((filesystemTotalSize / 1024 / 1024) * 100) / 100;
            const maxSizeMB = Math.round((this.config.maxContentDirSize / 1024 / 1024) * 100) / 100;
            const averageFileSize = dbStats.contentDirFiles > 0
                ? Math.round(dbStats.contentDirSize / dbStats.contentDirFiles)
                : 0;
            const totalContentItems = dbStats.contentDirFiles + dbStats.filesystemRefs;
            const totalStorageUsed = dbStats.contentDirSize + filesystemTotalSize;
            const totalStorageUsedMB = Math.round((totalStorageUsed / 1024 / 1024) * 100) / 100;
            const currentUsagePercent = this.config.maxContentDirSize > 0
                ? Math.round((dbStats.contentDirSize / this.config.maxContentDirSize) * 10000) / 100
                : 0;
            const remainingSpace = Math.max(0, this.config.maxContentDirSize - dbStats.contentDirSize);
            const remainingSpaceMB = Math.round((remainingSpace / 1024 / 1024) * 100) / 100;
            // Calculate storage efficiency (how much space saved by deduplication)
            // This is a rough estimate based on the assumption that without deduplication,
            // we might have more duplicate files
            const storageEfficiency = totalContentItems > 0
                ? Math.round((totalContentItems / Math.max(1, totalContentItems)) * 100)
                : 100;
            return {
                contentDirectory: {
                    totalFiles: dbStats.contentDirFiles,
                    totalSize: dbStats.contentDirSize,
                    totalSizeMB: contentDirSizeMB,
                    averageFileSize
                },
                filesystemReferences: {
                    totalRefs: dbStats.filesystemRefs,
                    totalSize: filesystemTotalSize,
                    totalSizeMB: filesystemSizeMB
                },
                overall: {
                    totalContentItems,
                    totalStorageUsed,
                    totalStorageUsedMB,
                    storageEfficiency
                },
                limits: {
                    maxContentDirSize: this.config.maxContentDirSize,
                    maxContentDirSizeMB: maxSizeMB,
                    currentUsagePercent,
                    remainingSpace,
                    remainingSpaceMB
                },
                lastUpdated: new Date(),
                lastCleanup: dbStats.lastCleanup
            };
        }
        catch (error) {
            throw new Error(`Failed to get storage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Gets current storage statistics for the content directory (legacy method)
     * @returns Promise that resolves to storage statistics
     * @deprecated Use getStorageStats() for more comprehensive statistics
     */
    async getContentDirectoryStats() {
        try {
            const stats = await getStorageStats(this.db);
            if (!stats) {
                // Initialize stats if they don't exist
                await this.updateStorageStats();
                return {
                    totalFiles: 0,
                    totalSize: 0,
                    filesystemRefs: 0,
                    lastCleanup: null
                };
            }
            return {
                totalFiles: stats.contentDirFiles,
                totalSize: stats.contentDirSize,
                filesystemRefs: stats.filesystemRefs,
                lastCleanup: stats.lastCleanup
            };
        }
        catch (error) {
            throw new Error(`Failed to get content directory stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generates a simple, human-readable storage usage report
     * @returns Promise that resolves to formatted storage report
     */
    async generateStorageReport() {
        try {
            const stats = await this.getStorageStats();
            const report = [
                '=== RAG-lite Content Storage Report ===',
                '',
                'Content Directory:',
                `  Files: ${stats.contentDirectory.totalFiles}`,
                `  Size: ${stats.contentDirectory.totalSizeMB} MB`,
                `  Average file size: ${Math.round(stats.contentDirectory.averageFileSize / 1024)} KB`,
                '',
                'Filesystem References:',
                `  References: ${stats.filesystemReferences.totalRefs}`,
                `  Total size: ${stats.filesystemReferences.totalSizeMB} MB`,
                '',
                'Overall Usage:',
                `  Total content items: ${stats.overall.totalContentItems}`,
                `  Total storage used: ${stats.overall.totalStorageUsedMB} MB`,
                `  Storage efficiency: ${stats.overall.storageEfficiency}%`,
                '',
                'Storage Limits:',
                `  Content directory limit: ${stats.limits.maxContentDirSizeMB} MB`,
                `  Current usage: ${stats.limits.currentUsagePercent}%`,
                `  Remaining space: ${stats.limits.remainingSpaceMB} MB`,
                '',
                'Maintenance:',
                `  Last updated: ${stats.lastUpdated.toISOString()}`,
                `  Last cleanup: ${stats.lastCleanup ? stats.lastCleanup.toISOString() : 'Never'}`,
                ''
            ];
            // Add warnings if needed
            if (stats.limits.currentUsagePercent > 90) {
                report.push('⚠️  WARNING: Content directory is over 90% full!');
                report.push('   Consider running cleanup operations to free space.');
                report.push('');
            }
            else if (stats.limits.currentUsagePercent > 75) {
                report.push('⚠️  NOTICE: Content directory is over 75% full.');
                report.push('   You may want to run cleanup operations soon.');
                report.push('');
            }
            return report.join('\n');
        }
        catch (error) {
            throw new Error(`Failed to generate storage report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Gets storage statistics in a format suitable for monitoring systems
     * @returns Promise that resolves to monitoring-friendly statistics
     */
    async getStorageMetrics() {
        try {
            const stats = await this.getStorageStats();
            return {
                contentDirFiles: stats.contentDirectory.totalFiles,
                contentDirSizeBytes: stats.contentDirectory.totalSize,
                contentDirSizeMB: stats.contentDirectory.totalSizeMB,
                filesystemRefs: stats.filesystemReferences.totalRefs,
                filesystemSizeBytes: stats.filesystemReferences.totalSize,
                filesystemSizeMB: stats.filesystemReferences.totalSizeMB,
                totalContentItems: stats.overall.totalContentItems,
                totalStorageBytes: stats.overall.totalStorageUsed,
                totalStorageMB: stats.overall.totalStorageUsedMB,
                usagePercent: stats.limits.currentUsagePercent,
                remainingBytes: stats.limits.remainingSpace,
                remainingMB: stats.limits.remainingSpaceMB,
                lastCleanupTimestamp: stats.lastCleanup ? stats.lastCleanup.getTime() : null,
                lastUpdatedTimestamp: stats.lastUpdated.getTime()
            };
        }
        catch (error) {
            throw new Error(`Failed to get storage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Updates storage statistics by scanning the content directory
     * @returns Promise that resolves when stats are updated
     */
    async updateStorageStats() {
        try {
            let contentDirFiles = 0;
            let contentDirSize = 0;
            let filesystemRefs = 0;
            // Count content directory files and size
            try {
                const contentDirContents = await fs.readdir(this.config.contentDir);
                for (const filename of contentDirContents) {
                    const filePath = join(this.config.contentDir, filename);
                    try {
                        const stats = await fs.stat(filePath);
                        if (stats.isFile()) {
                            contentDirFiles++;
                            contentDirSize += stats.size;
                        }
                    }
                    catch {
                        // Skip files that can't be accessed
                    }
                }
            }
            catch {
                // Content directory doesn't exist or can't be read
                contentDirFiles = 0;
                contentDirSize = 0;
            }
            // Count filesystem references
            const filesystemContent = await getContentMetadataByStorageType(this.db, 'filesystem');
            filesystemRefs = filesystemContent.length;
            // Update database stats
            await updateStorageStats(this.db, {
                contentDirFiles,
                contentDirSize,
                filesystemRefs
            });
        }
        catch (error) {
            throw new Error(`Failed to update storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Checks if adding new content would exceed storage limits (legacy method)
     * @param contentSize - Size of content to add
     * @returns Promise that resolves to true if within limits, false otherwise
     * @deprecated Use enforceStorageLimits() for better error handling and guidance
     */
    async checkStorageLimits(contentSize) {
        try {
            const stats = await this.getContentDirectoryStats();
            return (stats.totalSize + contentSize) <= this.config.maxContentDirSize;
        }
        catch (error) {
            // If we can't get stats, allow the operation but log the error
            console.warn('Failed to check storage limits:', error);
            return true;
        }
    }
    /**
     * Removes orphaned files that exist in content directory but have no metadata references
     * @returns Promise that resolves to cleanup results
     */
    async removeOrphanedFiles() {
        return this.cleanupOrphanedFiles();
    }
    /**
     * Removes duplicate content files based on content hash, keeping the first occurrence
     * @returns Promise that resolves to deduplication results
     */
    async removeDuplicateContent() {
        return this.deduplicateContentFiles();
    }
    /**
     * Cleans up orphaned files in the content directory
     * Removes files that exist in the directory but have no corresponding metadata
     * @returns Promise that resolves to cleanup results
     */
    async cleanupOrphanedFiles() {
        const removedFiles = [];
        const errors = [];
        let freedSpace = 0;
        try {
            // Ensure content directory exists
            await this.ensureContentDirectory();
            // Get all content metadata for content_dir storage
            const contentMetadata = await getContentMetadataByStorageType(this.db, 'content_dir');
            const validPaths = new Set(contentMetadata.map(meta => meta.contentPath));
            // Scan content directory for files
            const contentDirContents = await fs.readdir(this.config.contentDir);
            for (const filename of contentDirContents) {
                const filePath = join(this.config.contentDir, filename);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isFile() && !validPaths.has(filePath)) {
                        // This file is orphaned - remove it
                        await fs.unlink(filePath);
                        removedFiles.push(filename);
                        freedSpace += stats.size;
                    }
                }
                catch (error) {
                    errors.push(`Failed to process ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // Update storage stats after cleanup
            if (removedFiles.length > 0) {
                await this.updateStorageStats();
                // Update last cleanup time
                await updateStorageStats(this.db, {
                    lastCleanup: new Date()
                });
            }
            return { removedFiles, errors, freedSpace };
        }
        catch (error) {
            throw new Error(`Failed to cleanup orphaned files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Removes duplicate content files based on content hash
     * Keeps the first occurrence and removes duplicates
     * @returns Promise that resolves to deduplication results
     */
    async deduplicateContentFiles() {
        const removedFiles = [];
        const errors = [];
        let freedSpace = 0;
        try {
            // Get all content metadata for content_dir storage
            const contentMetadata = await getContentMetadataByStorageType(this.db, 'content_dir');
            // Group by content hash
            const hashGroups = new Map();
            for (const metadata of contentMetadata) {
                const hash = metadata.contentHash;
                if (!hashGroups.has(hash)) {
                    hashGroups.set(hash, []);
                }
                hashGroups.get(hash).push(metadata);
            }
            // Process groups with duplicates
            for (const [hash, group] of hashGroups) {
                if (group.length > 1) {
                    // Keep the first one, remove the rest
                    const [keep, ...remove] = group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                    for (const duplicate of remove) {
                        try {
                            // Remove file
                            const stats = await fs.stat(duplicate.contentPath);
                            await fs.unlink(duplicate.contentPath);
                            // Remove metadata
                            await deleteContentMetadata(this.db, duplicate.id);
                            removedFiles.push(basename(duplicate.contentPath));
                            freedSpace += stats.size;
                        }
                        catch (error) {
                            errors.push(`Failed to remove duplicate ${duplicate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                }
            }
            // Update storage stats after deduplication
            if (removedFiles.length > 0) {
                await this.updateStorageStats();
            }
            return { removedFiles, errors, freedSpace };
        }
        catch (error) {
            throw new Error(`Failed to deduplicate content files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Ensures content directory has proper permissions
     * @returns Promise that resolves when permissions are set
     */
    async ensureContentDirectoryPermissions() {
        try {
            await this.ensureContentDirectory();
            // Set directory permissions to 755 (owner: rwx, group: rx, others: rx)
            await fs.chmod(this.config.contentDir, 0o755);
        }
        catch (error) {
            throw new Error(`Failed to set content directory permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validates content directory structure and repairs if needed
     * @returns Promise that resolves to validation results
     */
    async validateAndRepairContentDirectory() {
        const issues = [];
        const repaired = [];
        try {
            // Check if content directory exists
            try {
                const stats = await fs.stat(this.config.contentDir);
                if (!stats.isDirectory()) {
                    issues.push('Content path exists but is not a directory');
                }
            }
            catch {
                // Directory doesn't exist - create it
                await this.ensureContentDirectory();
                repaired.push('Created missing content directory');
            }
            // Check permissions
            try {
                await fs.access(this.config.contentDir, fs.constants.R_OK | fs.constants.W_OK);
            }
            catch {
                issues.push('Content directory is not readable/writable');
                try {
                    await this.ensureContentDirectoryPermissions();
                    repaired.push('Fixed content directory permissions');
                }
                catch {
                    issues.push('Failed to fix content directory permissions');
                }
            }
            // Validate storage stats consistency
            try {
                const dbStats = await getStorageStats(this.db);
                const actualStats = await this.getActualDirectoryStats();
                if (!dbStats ||
                    dbStats.contentDirFiles !== actualStats.files ||
                    Math.abs(dbStats.contentDirSize - actualStats.size) > 1024) { // Allow 1KB tolerance
                    await this.updateStorageStats();
                    repaired.push('Updated inconsistent storage statistics');
                }
            }
            catch (error) {
                issues.push(`Failed to validate storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return {
                isValid: issues.length === 0,
                issues,
                repaired
            };
        }
        catch (error) {
            throw new Error(`Failed to validate content directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Gets actual directory statistics by scanning the filesystem
     * @returns Promise that resolves to actual directory stats
     */
    async getActualDirectoryStats() {
        let files = 0;
        let size = 0;
        try {
            const contentDirContents = await fs.readdir(this.config.contentDir);
            for (const filename of contentDirContents) {
                const filePath = join(this.config.contentDir, filename);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isFile()) {
                        files++;
                        size += stats.size;
                    }
                }
                catch {
                    // Skip files that can't be accessed
                }
            }
        }
        catch {
            // Directory doesn't exist or can't be read
        }
        return { files, size };
    }
    /**
     * Cleanup resources to prevent memory leaks and hanging processes
     * Should be called when ContentManager is no longer needed
     */
    cleanup() {
        // Clean up performance optimizer interval that prevents process exit
        if (this.performanceOptimizer && typeof this.performanceOptimizer.cleanup === 'function') {
            this.performanceOptimizer.cleanup();
        }
    }
}
