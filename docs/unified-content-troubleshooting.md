# Unified Content System Troubleshooting

This guide helps you diagnose and resolve issues with RAG-lite's unified content system, covering memory ingestion, content retrieval, and storage management.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Memory Ingestion Issues](#memory-ingestion-issues)
- [Content Retrieval Problems](#content-retrieval-problems)
- [Storage Management Issues](#storage-management-issues)
- [Performance Problems](#performance-problems)
- [Configuration Issues](#configuration-issues)
- [Error Reference](#error-reference)
- [Recovery Procedures](#recovery-procedures)

## Quick Diagnostics

### Health Check Script

```typescript
import { SearchEngine, IngestionPipeline } from 'rag-lite-ts';
import { ContentManager } from 'rag-lite-ts/core';

async function healthCheck() {
  console.log('🔍 RAG-lite Unified Content System Health Check\n');
  
  try {
    // Test basic initialization
    const search = new SearchEngine('./vector-index.bin', './db.sqlite');
    const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin');
    console.log('✅ Basic initialization successful');
    
    // Test memory ingestion
    const testContent = Buffer.from('# Test Document\nThis is a test.');
    const contentId = await ingestion.ingestFromMemory(testContent, {
      displayName: 'health-check.md',
      contentType: 'text/markdown'
    });
    console.log('✅ Memory ingestion working');
    
    // Test content retrieval
    const filePath = await search.getContent(contentId, 'file');
    const base64Data = await search.getContent(contentId, 'base64');
    console.log('✅ Content retrieval working');
    
    // Test search
    const results = await search.search('test document');
    console.log(`✅ Search working (${results.length} results)`);
    
    // Test storage stats
    const contentManager = new ContentManager(search.db);
    const stats = await contentManager.getStorageStats();
    console.log(`✅ Storage stats: ${stats.contentDirectory.totalFiles} files, ${stats.contentDirectory.totalSizeMB}MB`);
    
    console.log('\n🎉 All systems operational!');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('\n🔧 See troubleshooting guide for solutions');
  }
}
```

### System Information

```typescript
async function getSystemInfo() {
  const search = new SearchEngine('./vector-index.bin', './db.sqlite');
  const contentManager = new ContentManager(search.db);
  
  // Storage information
  const stats = await contentManager.getStorageStats();
  const status = await contentManager.getStorageLimitStatus();
  
  console.log('📊 System Information:');
  console.log(`  Content Directory: ${stats.contentDirectory.totalFiles} files, ${stats.contentDirectory.totalSizeMB}MB`);
  console.log(`  Filesystem References: ${stats.filesystemReferences.totalRefs} files, ${stats.filesystemReferences.totalSizeMB}MB`);
  console.log(`  Storage Usage: ${status.currentUsagePercent}%`);
  console.log(`  Can Accept Content: ${status.canAcceptContent}`);
  
  // Performance information
  const perfStats = contentManager.getPerformanceStats();
  console.log(`  Hash Cache Hit Rate: ${perfStats.hashCache.hitRate}%`);
  console.log(`  Average Operation Speed: ${perfStats.operations.averageSpeed} MB/s`);
  console.log(`  Error Rate: ${perfStats.operations.errorRate}%`);
}
```

## Memory Ingestion Issues

### Issue: "Content size exceeds maximum allowed size"

**Symptoms:**
```
ContentIngestionError: Content size (75.2MB) exceeds maximum allowed size (50.0MB)
```

**Causes:**
- File too large for current configuration
- Incorrect size limit configuration

**Solutions:**

1. **Increase size limits:**
```typescript
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin', {
  contentSystem: {
    maxFileSize: '100MB',  // Increase from default 50MB
    maxContentDirSize: '5GB'  // Increase total limit too
  }
});
```

2. **Check current limits:**
```typescript
const contentManager = new ContentManager(db);
const status = await contentManager.getStorageLimitStatus();
console.log(`Max file size: ${status.limits.maxSizeMB}MB`);
```

3. **Split large content:**
```typescript
// For very large content, split into chunks
const chunkSize = 40 * 1024 * 1024; // 40MB chunks
const chunks = [];

for (let i = 0; i < largeBuffer.length; i += chunkSize) {
  const chunk = largeBuffer.subarray(i, i + chunkSize);
  const contentId = await ingestion.ingestFromMemory(chunk, {
    displayName: `large-document-part-${Math.floor(i / chunkSize) + 1}.bin`,
    contentType: 'application/octet-stream'
  });
  chunks.push(contentId);
}
```

### Issue: "Storage limit exceeded"

**Symptoms:**
```
StorageLimitExceededError: Storage limit exceeded. Current: 1950.5MB, Max: 2048.0MB, Attempting to add: 150.2MB
```

**Causes:**
- Content directory approaching size limit
- Many large files ingested
- Orphaned files taking up space

**Solutions:**

1. **Run cleanup operations:**
```typescript
const contentManager = new ContentManager(db);

// Remove orphaned files
const orphanResult = await contentManager.removeOrphanedFiles();
console.log(`Freed ${Math.round(orphanResult.freedSpace / 1024 / 1024)}MB from orphaned files`);

// Remove duplicates
const dupResult = await contentManager.removeDuplicateContent();
console.log(`Freed ${Math.round(dupResult.freedSpace / 1024 / 1024)}MB from duplicates`);
```

2. **Increase storage limits:**
```typescript
const ingestion = new IngestionPipeline('./db.sqlite', './vector-index.bin', {
  contentSystem: {
    maxContentDirSize: '10GB'  // Increase limit
  }
});
```

3. **Monitor storage proactively:**
```typescript
const status = await contentManager.getStorageLimitStatus();
if (status.isNearWarningThreshold) {
  console.log('⚠️ Storage getting full, running cleanup...');
  await contentManager.removeOrphanedFiles();
}
```

### Issue: "Invalid content format"

**Symptoms:**
```
InvalidContentFormatError: Unsupported content type: video/mp4. Video files are not supported for text-based RAG processing.
```

**Causes:**
- Attempting to ingest unsupported file types
- Incorrect content type detection

**Solutions:**

1. **Check supported formats:**
```typescript
const supportedTypes = [
  'text/plain', 'text/markdown', 'text/html',
  'application/pdf', 'application/json',
  'image/jpeg', 'image/png', 'image/gif'
  // See full list in documentation
];
```

2. **Override content type for generic content:**
```typescript
// For unsupported but text-like content
const contentId = await ingestion.ingestFromMemory(buffer, {
  displayName: 'custom-format.txt',
  contentType: 'text/plain'  // Override detection
});
```

3. **Extract text from unsupported formats:**
```typescript
// Pre-process unsupported content
const extractedText = await extractTextFromVideo(videoBuffer);
const textBuffer = Buffer.from(extractedText);

const contentId = await ingestion.ingestFromMemory(textBuffer, {
  displayName: 'video-transcript.txt',
  contentType: 'text/plain'
});
```

## Content Retrieval Problems

### Issue: "Content not found"

**Symptoms:**
```
ContentNotFoundError: Content "document.pdf" not found. Please re-ingest the content.
```

**Causes:**
- Content files moved or deleted
- Database corruption
- Incorrect content ID

**Solutions:**

1. **Verify content exists:**
```typescript
const exists = await search.verifyContentExists(contentId);
if (!exists) {
  console.log('Content needs to be re-ingested');
  
  // Get metadata for better error reporting
  try {
    const metadata = await search.getContentMetadata(contentId);
    console.log(`Missing content: ${metadata.displayName}`);
  } catch {
    console.log(`Content ID ${contentId} not found in database`);
  }
}
```

2. **Check storage integrity:**
```typescript
const contentManager = new ContentManager(db);
const stats = await contentManager.getStorageStats();

if (stats.contentDirectory.totalFiles === 0) {
  console.log('⚠️ Content directory appears empty or corrupted');
  console.log('Consider re-ingesting all content');
}
```

3. **Re-ingest missing content:**
```typescript
// For filesystem content that was moved
try {
  await search.getContent(contentId, 'file');
} catch (error) {
  if (error.message.includes('Content not found')) {
    console.log('Re-ingesting from original location...');
    await ingestion.ingestFile(originalPath);
  }
}
```

### Issue: "Base64 conversion failed"

**Symptoms:**
```
ContentRetrievalError: Failed to read content file: ENOENT: no such file or directory
```

**Causes:**
- Content file deleted after ingestion
- Permission issues
- Disk space issues

**Solutions:**

1. **Check file permissions:**
```typescript
import { access, constants } from 'fs/promises';

try {
  await access(contentPath, constants.R_OK);
  console.log('File is readable');
} catch (error) {
  console.log('Permission issue:', error.message);
  // Fix permissions or re-ingest
}
```

2. **Fallback to file path:**
```typescript
async function getContentSafely(contentId, preferredFormat) {
  try {
    return await search.getContent(contentId, preferredFormat);
  } catch (error) {
    if (preferredFormat === 'base64') {
      console.log('Base64 failed, trying file path...');
      return await search.getContent(contentId, 'file');
    }
    throw error;
  }
}
```

3. **Batch retrieval with error handling:**
```typescript
const batchResults = await search.getContentBatch(requests);
const failed = batchResults.filter(r => !r.success);

if (failed.length > 0) {
  console.log(`${failed.length} retrievals failed:`);
  failed.forEach(f => console.log(`  ${f.contentId}: ${f.error}`));
  
  // Retry failed items individually
  for (const failedItem of failed) {
    try {
      const content = await search.getContent(failedItem.contentId, 'file');
      console.log(`✅ Retry successful for ${failedItem.contentId}`);
    } catch (retryError) {
      console.log(`❌ Retry failed for ${failedItem.contentId}: ${retryError.message}`);
    }
  }
}
```

## Storage Management Issues

### Issue: Content directory corruption

**Symptoms:**
- Files exist but metadata missing
- Metadata exists but files missing
- Inconsistent storage statistics

**Diagnosis:**
```typescript
async function diagnoseStorageCorruption() {
  const contentManager = new ContentManager(db);
  
  // Check for orphaned files
  const orphanResult = await contentManager.removeOrphanedFiles();
  if (orphanResult.removedFiles.length > 0) {
    console.log(`Found ${orphanResult.removedFiles.length} orphaned files`);
  }
  
  // Check for missing files
  const allContent = await getAllContentMetadata(db);
  let missingCount = 0;
  
  for (const content of allContent) {
    const exists = await search.verifyContentExists(content.id);
    if (!exists) {
      missingCount++;
      console.log(`Missing: ${content.displayName} (${content.id})`);
    }
  }
  
  if (missingCount > 0) {
    console.log(`⚠️ ${missingCount} content items have missing files`);
  }
}
```

**Recovery:**
```typescript
async function repairStorageCorruption() {
  const contentManager = new ContentManager(db);
  
  console.log('🔧 Repairing storage corruption...');
  
  // Step 1: Remove orphaned files
  const orphanResult = await contentManager.removeOrphanedFiles();
  console.log(`Removed ${orphanResult.removedFiles.length} orphaned files`);
  
  // Step 2: Update storage statistics
  await contentManager.updateStorageStats();
  console.log('Updated storage statistics');
  
  // Step 3: Verify integrity
  const stats = await contentManager.getStorageStats();
  console.log(`Final state: ${stats.contentDirectory.totalFiles} files, ${stats.contentDirectory.totalSizeMB}MB`);
}
```

### Issue: Excessive disk usage

**Symptoms:**
- Content directory larger than expected
- Many duplicate files
- Storage warnings

**Solutions:**

1. **Analyze storage usage:**
```typescript
async function analyzeStorageUsage() {
  const contentManager = new ContentManager(db);
  const report = await contentManager.generateStorageReport();
  console.log(report);
  
  // Check for duplicates
  const dupResult = await contentManager.removeDuplicateContent();
  if (dupResult.removedFiles.length > 0) {
    console.log(`Found ${dupResult.removedFiles.length} duplicate files`);
    console.log(`Can free ${Math.round(dupResult.freedSpace / 1024 / 1024)}MB`);
  }
}
```

2. **Implement storage monitoring:**
```typescript
async function monitorStorage() {
  const contentManager = new ContentManager(db);
  
  setInterval(async () => {
    const status = await contentManager.getStorageLimitStatus();
    
    if (status.isNearWarningThreshold) {
      console.log(`⚠️ Storage at ${status.currentUsagePercent}%`);
      
      if (status.isNearErrorThreshold) {
        console.log('🚨 Running emergency cleanup...');
        await contentManager.removeOrphanedFiles();
        await contentManager.removeDuplicateContent();
      }
    }
  }, 60000); // Check every minute
}
```

## Performance Problems

### Issue: Slow memory ingestion

**Symptoms:**
- Ingestion takes longer than expected
- High memory usage during ingestion
- System becomes unresponsive

**Diagnosis:**
```typescript
async function diagnosePerformance() {
  const contentManager = new ContentManager(db);
  
  // Monitor ingestion performance
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  const contentId = await ingestion.ingestFromMemory(largeBuffer, metadata);
  
  const duration = Date.now() - startTime;
  const endMemory = process.memoryUsage();
  const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
  
  console.log(`Ingestion took ${duration}ms`);
  console.log(`Memory delta: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
  
  // Check performance stats
  const perfStats = contentManager.getPerformanceStats();
  console.log(`Cache hit rate: ${perfStats.hashCache.hitRate}%`);
  console.log(`Average speed: ${perfStats.operations.averageSpeed} MB/s`);
}
```

**Solutions:**

1. **Optimize for large files:**
```typescript
// Process large files in smaller batches
const BATCH_SIZE = 10 * 1024 * 1024; // 10MB batches

if (buffer.length > BATCH_SIZE) {
  console.log('Processing large file in batches...');
  
  // Clear performance caches before large operations
  contentManager.clearPerformanceCaches();
  
  const contentId = await ingestion.ingestFromMemory(buffer, metadata);
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}
```

2. **Reduce concurrent operations:**
```typescript
// Limit concurrent ingestion operations
const semaphore = new Semaphore(3); // Max 3 concurrent operations

async function ingestWithLimit(buffer, metadata) {
  await semaphore.acquire();
  try {
    return await ingestion.ingestFromMemory(buffer, metadata);
  } finally {
    semaphore.release();
  }
}
```

### Issue: Slow content retrieval

**Symptoms:**
- Base64 conversion takes too long
- Batch operations timeout
- High CPU usage during retrieval

**Solutions:**

1. **Use streaming for large content:**
```typescript
// The system automatically uses streaming for files >10MB
// Monitor if this is working correctly
const metadata = await search.getContentMetadata(contentId);
if (metadata.fileSize > 10 * 1024 * 1024) {
  console.log('Large file - streaming should be used automatically');
}
```

2. **Optimize batch sizes:**
```typescript
// Process in smaller batches for better performance
const OPTIMAL_BATCH_SIZE = 10;
const batches = [];

for (let i = 0; i < contentIds.length; i += OPTIMAL_BATCH_SIZE) {
  batches.push(contentIds.slice(i, i + OPTIMAL_BATCH_SIZE));
}

for (const batch of batches) {
  const requests = batch.map(id => ({ contentId: id, format: 'base64' }));
  const results = await search.getContentBatch(requests);
  // Process results...
}
```

## Configuration Issues

### Issue: Invalid configuration values

**Symptoms:**
```
Error: Invalid size format: 50GB. Use formats like "50MB", "2GB", or number of bytes.
```

**Solutions:**

1. **Use correct size formats:**
```typescript
// Correct formats
const config = {
  contentSystem: {
    maxFileSize: '50MB',      // ✅ String with unit
    maxContentDirSize: 2048,  // ✅ Number in bytes
    // maxFileSize: '50GB',   // ❌ Invalid - too large
    // maxFileSize: 'large',  // ❌ Invalid format
  }
};
```

2. **Validate configuration:**
```typescript
function validateConfig(config) {
  const sizeRegex = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i;
  
  if (typeof config.maxFileSize === 'string') {
    if (!sizeRegex.test(config.maxFileSize)) {
      throw new Error(`Invalid size format: ${config.maxFileSize}`);
    }
  }
  
  if (config.storageWarningThreshold >= config.storageErrorThreshold) {
    throw new Error('Warning threshold must be less than error threshold');
  }
}
```

### Issue: Permission errors

**Symptoms:**
```
Error: Failed to create content directory: EACCES: permission denied, mkdir '.raglite/content'
```

**Solutions:**

1. **Check and fix permissions:**
```typescript
import { access, mkdir, chmod } from 'fs/promises';
import { constants } from 'fs';

async function ensureContentDirectory(contentDir) {
  try {
    await access(contentDir, constants.W_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      await mkdir(contentDir, { recursive: true, mode: 0o755 });
    } else if (error.code === 'EACCES') {
      // Permission issue
      console.log('Fixing permissions...');
      await chmod(contentDir, 0o755);
    } else {
      throw error;
    }
  }
}
```

2. **Use alternative directory:**
```typescript
import { tmpdir } from 'os';
import { join } from 'path';

// Fallback to temp directory if default location fails
const config = {
  contentSystem: {
    contentDir: join(tmpdir(), 'raglite-content')
  }
};
```

## Error Reference

### ContentIngestionError
- **Cause**: Issues during content ingestion
- **Common messages**: "Content size exceeds limit", "Invalid content format"
- **Recovery**: Check size limits, validate content type, retry with correct parameters

### ContentNotFoundError  
- **Cause**: Content file missing or moved
- **Common messages**: "Content not found", "File verification failed"
- **Recovery**: Re-ingest content, check file permissions, verify storage integrity

### StorageLimitExceededError
- **Cause**: Content directory size limit reached
- **Common messages**: "Storage limit exceeded"
- **Recovery**: Run cleanup operations, increase limits, remove unused content

### ContentRetrievalError
- **Cause**: Issues reading or converting content
- **Common messages**: "Failed to read content file", "Base64 conversion failed"
- **Recovery**: Check file permissions, verify disk space, try alternative format

## Recovery Procedures

### Complete System Recovery

```typescript
async function completeSystemRecovery() {
  console.log('🚨 Starting complete system recovery...');
  
  try {
    // Step 1: Backup current state
    console.log('1. Creating backup...');
    await backupDatabase('./db.sqlite', './db.sqlite.backup');
    
    // Step 2: Initialize content manager
    const contentManager = new ContentManager(db);
    
    // Step 3: Clean up storage
    console.log('2. Cleaning up storage...');
    const orphanResult = await contentManager.removeOrphanedFiles();
    const dupResult = await contentManager.removeDuplicateContent();
    
    console.log(`   Removed ${orphanResult.removedFiles.length} orphaned files`);
    console.log(`   Removed ${dupResult.removedFiles.length} duplicate files`);
    
    // Step 4: Update statistics
    console.log('3. Updating storage statistics...');
    await contentManager.updateStorageStats();
    
    // Step 5: Verify integrity
    console.log('4. Verifying system integrity...');
    const stats = await contentManager.getStorageStats();
    console.log(`   Content directory: ${stats.contentDirectory.totalFiles} files`);
    console.log(`   Storage usage: ${stats.limits.currentUsagePercent}%`);
    
    // Step 6: Test basic operations
    console.log('5. Testing basic operations...');
    const testContent = Buffer.from('Recovery test content');
    const testId = await ingestion.ingestFromMemory(testContent, {
      displayName: 'recovery-test.txt',
      contentType: 'text/plain'
    });
    
    const retrieved = await search.getContent(testId, 'base64');
    console.log('   Basic operations working ✅');
    
    console.log('🎉 System recovery completed successfully!');
    
  } catch (error) {
    console.error('❌ Recovery failed:', error.message);
    console.log('Consider restoring from backup and re-ingesting content');
  }
}
```

### Selective Content Recovery

```typescript
async function recoverSpecificContent(contentIds) {
  console.log(`🔧 Recovering ${contentIds.length} content items...`);
  
  const results = { recovered: 0, failed: 0, errors: [] };
  
  for (const contentId of contentIds) {
    try {
      // Try to verify content exists
      const exists = await search.verifyContentExists(contentId);
      
      if (exists) {
        // Test retrieval
        await search.getContent(contentId, 'file');
        results.recovered++;
        console.log(`✅ ${contentId} - OK`);
      } else {
        // Content missing - needs re-ingestion
        results.failed++;
        results.errors.push(`${contentId} - Content file missing`);
        console.log(`❌ ${contentId} - Missing`);
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push(`${contentId} - ${error.message}`);
      console.log(`❌ ${contentId} - Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Recovery Summary:`);
  console.log(`   Recovered: ${results.recovered}`);
  console.log(`   Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(error => console.log(`   ${error}`));
  }
  
  return results;
}
```

---

This troubleshooting guide covers the most common issues with the unified content system. For additional help, check the main documentation or create an issue with detailed error messages and system information.