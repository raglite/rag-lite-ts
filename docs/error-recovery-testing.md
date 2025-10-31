# Error Recovery Testing Guide

This guide covers RAG-lite's comprehensive error recovery testing framework, which validates system behavior under various failure conditions and ensures robust operation in production environments.

## Table of Contents

- [Overview](#overview)
- [Test Suite Architecture](#test-suite-architecture)
- [Running Error Recovery Tests](#running-error-recovery-tests)
- [Test Categories](#test-categories)
- [Unified Content System Error Recovery](#unified-content-system-error-recovery)
- [Interpreting Test Results](#interpreting-test-results)
- [Adding New Error Tests](#adding-new-error-tests)
- [Production Monitoring](#production-monitoring)
- [Troubleshooting Test Failures](#troubleshooting-test-failures)

## Overview

RAG-lite's error recovery testing framework ensures the system maintains stability and provides clear guidance when operations fail. The framework tests various failure scenarios including missing content, storage limits, network issues, and corrupted data, validating that the system recovers gracefully and provides actionable error messages.

## Test Suite Architecture

The error recovery test suite is organized into several categories:

- **Content System Errors**: Missing files, storage limits, permission issues
- **Database Errors**: Corruption, connection failures, schema mismatches
- **Network Errors**: Model download failures, timeout scenarios
- **Resource Errors**: Memory limits, disk space, concurrent access
- **Integration Errors**: MCP communication failures, CLI tool errors

### Test Framework

All error recovery tests use Node.js native test runner with the following structure:

```typescript
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('Error Recovery - Content System', () => {
  test('should handle missing content files gracefully', async () => {
    // Test implementation
  });
});
``` 

## Running Error Recovery Tests

### Prerequisites

Ensure you have a test environment set up:

```bash
# Build the project
npm run build

# Build test files
npm run build:test
```

### Running Content System Error Recovery Tests

```bash
# Run the main content error integration test suite
npm run build:test && node --test dist/core/content-error-integration.test.js

# Run all content-related tests (includes error handling)
npm run build:test && node --test dist/core/content-*.test.js

# Run specific content system tests
npm run build:test && node --test dist/core/content-manager.test.js
npm run build:test && node --test dist/core/content-resolver.test.js
```

### Running Individual Error Test Categories

```bash
# Run tests for specific error scenarios
npm run build:test && node --test dist/core/content-error-integration.test.js --grep "ContentIngestionError"
npm run build:test && node --test dist/core/content-error-integration.test.js --grep "StorageLimitExceededError"
npm run build:test && node --test dist/core/content-error-integration.test.js --grep "ContentNotFoundError"

# Run batch operation error tests
npm run build:test && node --test dist/core/content-error-integration.test.js --grep "batch operations"
```

### Running Integration Tests with Error Scenarios

```bash
# Run unified content system integration tests (includes error scenarios)
npm run build:test && node --test dist/unified-content-system-integration.test.js

# Run multimodal content integration tests
npm run build:test && node --test dist/multimodal-content-integration.test.js
```

## Test Categories

### Content System Error Recovery

Tests for the unified content system's error handling based on actual implementation:

#### Missing Content Files
- **Scenario**: Content referenced in database but file missing from filesystem
- **Expected**: `ContentNotFoundError` with re-ingestion guidance
- **Test**: `src/core/content-error-integration.test.ts - should provide clear guidance when content file is deleted after ingestion`
- **Error Class**: `ContentNotFoundError`
- **Recovery Actions**: Re-ingest content, verify content ID, check original file location

#### Storage Limit Exceeded
- **Scenario**: Attempting to ingest content when storage limit reached
- **Expected**: `StorageLimitExceededError` with cleanup suggestions
- **Test**: `src/core/content-error-integration.test.ts - should throw StorageLimitExceededError when approaching limits`
- **Error Class**: `StorageLimitExceededError`
- **Recovery Actions**: Run `removeOrphanedFiles()`, `removeDuplicateContent()`, increase storage limits

#### Invalid Content Format
- **Scenario**: Attempting to ingest unsupported content types (audio, video, executables)
- **Expected**: `InvalidContentFormatError` with format conversion guidance
- **Test**: `src/core/content-error-integration.test.ts - should throw InvalidContentFormatError for unsupported content`
- **Error Class**: `InvalidContentFormatError`
- **Recovery Actions**: Convert to supported format, extract text content, use appropriate preprocessing

#### Content Ingestion Failures
- **Scenario**: File system errors, permission issues, or corrupted content during ingestion
- **Expected**: `ContentIngestionError` with troubleshooting steps
- **Test**: `src/core/content-error-integration.test.ts - should throw ContentIngestionError for oversized content`
- **Error Class**: `ContentIngestionError`
- **Recovery Actions**: Check file validity, verify permissions, ensure disk space

#### Content Retrieval Failures
- **Scenario**: Invalid format requests or inaccessible content during retrieval
- **Expected**: `ContentRetrievalError` with format and access guidance
- **Test**: `src/core/content-error-integration.test.ts - should throw ContentRetrievalError for invalid format`
- **Error Class**: `ContentRetrievalError`
- **Recovery Actions**: Use supported formats (file/base64), verify content exists, re-ingest if needed

### Database Error Recovery

Tests for database-related failures in content operations:

#### Content Metadata Lookup Failures
- **Scenario**: Database connection issues during content metadata retrieval
- **Expected**: `ContentNotFoundError` with database connectivity guidance
- **Test**: `src/core/content-error-integration.test.ts - should throw ContentNotFoundError for missing metadata`
- **Error Class**: `ContentNotFoundError`
- **Recovery Actions**: Check database connectivity, verify content was ingested, re-ingest if needed

#### Content Deduplication Failures
- **Scenario**: Hash calculation or database query failures during deduplication
- **Expected**: `ContentDeduplicationError` with database integrity guidance
- **Error Class**: `ContentDeduplicationError`
- **Recovery Actions**: Check database integrity, verify hash calculations, run database repair

#### Transaction Rollback Scenarios
- **Scenario**: Content ingestion fails mid-transaction leaving partial state
- **Expected**: Automatic cleanup with resource management
- **Implementation**: Uses `withResourceCleanup` for atomic operations
- **Recovery Actions**: Retry ingestion, check for orphaned files, verify database consistency

### Resource Management Error Recovery

Tests for resource exhaustion and timeout scenarios:

#### Operation Timeouts
- **Scenario**: Long-running content operations exceeding timeout limits
- **Expected**: Graceful timeout with clear error messages
- **Implementation**: Uses `withTimeout` wrapper for all I/O operations
- **Test Coverage**: File reading (60s), hash calculation (120s), database operations (10s)
- **Recovery Actions**: Retry with smaller content, check system resources, increase timeout limits

#### Memory Management Failures
- **Scenario**: Large content operations exceeding available memory
- **Expected**: Streaming operations with memory-efficient processing
- **Implementation**: Uses `SafeBuffer` and streaming operations for content >10MB
- **Recovery Actions**: Use streaming mode, reduce batch sizes, increase available memory

### Batch Operation Error Recovery

Tests for batch processing and concurrent operation failures:

#### Partial Batch Failures
- **Scenario**: Some items in batch operations fail while others succeed
- **Expected**: Partial success reporting with individual error details
- **Test**: `src/core/content-error-integration.test.ts - should handle batch operations with partial failures gracefully`
- **Implementation**: `ContentResolver.getContentBatch()` returns success/failure per item
- **Recovery Actions**: Retry failed items individually, check specific error causes

#### Concurrent Operation Limits
- **Scenario**: Too many concurrent content operations overwhelming system resources
- **Expected**: Backpressure and resource limit enforcement
- **Implementation**: Uses `ContentPerformanceOptimizer` with configurable concurrency limits
- **Recovery Actions**: Reduce batch sizes, increase processing limits, stagger operations

#### Resource Cleanup on Failures
- **Scenario**: Operations fail leaving temporary files or database entries
- **Expected**: Automatic cleanup of partial state
- **Implementation**: Uses `globalResourceCleanup` with transaction-based cleanup
- **Recovery Actions**: Run cleanup operations, verify no orphaned resources remain

## Unified Content System Error Recovery

The unified content system includes comprehensive error recovery mechanisms based on the actual implementation:

### Content Resolution Errors

```typescript
// Actual test from content-error-integration.test.ts
test('should provide clear guidance when content file is deleted after ingestion', async () => {
  // Create and ingest a test file
  const testFile = join(testDir, 'test-file.txt');
  await fs.writeFile(testFile, 'Test content');
  const result = await contentManager.ingestFromFilesystem(testFile);
  
  // Delete the original file to simulate missing content
  await fs.unlink(testFile);
  
  // Attempt retrieval should provide clear guidance
  await assert.rejects(
    () => contentResolver.getContent(result.contentId),
    (error) => {
      assert.ok(error instanceof ContentNotFoundError);
      assert.ok(error.suggestions.some(s => s.includes('Re-ingest')));
      assert.ok(error.suggestions.some(s => s.includes('file still exists')));
      return true;
    }
  );
});
```

### Storage Management Errors

```typescript
// Actual test from content-error-integration.test.ts
test('should throw StorageLimitExceededError when approaching limits', async () => {
  // Create content manager with very small limit
  const smallLimitManager = new ContentManager(db, {
    contentDir,
    maxFileSize: '1MB',
    maxContentDirSize: '1KB' // Very small limit
  });

  const content = Buffer.from('This content will exceed the tiny limit');
  
  await assert.rejects(
    () => smallLimitManager.ingestFromMemory(content, { displayName: 'test.txt' }),
    (error) => {
      assert.ok(error instanceof StorageLimitExceededError);
      assert.ok(error.message.includes('Storage limit exceeded'));
      assert.ok(error.suggestions.some(s => s.includes('removeOrphanedFiles')));
      assert.ok(error.suggestions.some(s => s.includes('removeDuplicateContent')));
      return true;
    }
  );
});
```

### Format Validation Errors

```typescript
// Actual test from content-error-integration.test.ts
test('should throw InvalidContentFormatError for unsupported content', async () => {
  // Create fake audio content
  const audioContent = Buffer.from('fake audio content');
  
  await assert.rejects(
    () => contentManager.ingestFromMemory(audioContent, {
      displayName: 'audio.mp3',
      contentType: 'audio/mp3'
    }),
    (error) => {
      assert.ok(error instanceof InvalidContentFormatError);
      assert.ok(error.message.includes('Invalid content format'));
      assert.ok(error.message.includes('audio/mp3'));
      assert.ok(error.suggestions.some(s => s.includes('speech-to-text')));
      return true;
    }
  );
});
```

### Batch Operation Error Handling

```typescript
// Actual test from content-error-integration.test.ts
test('should handle batch operations with partial failures gracefully', async () => {
  // Create one valid content item
  const validContent = Buffer.from('Valid content');
  const contentId = await contentManager.ingestFromMemory(validContent, {
    displayName: 'valid.txt'
  });

  // Test batch retrieval with mix of valid and invalid IDs
  const requests = [
    { contentId: contentId.contentId, format: 'file' as const },
    { contentId: 'invalid-id', format: 'file' as const }
  ];

  const results = await contentResolver.getContentBatch(requests);
  
  // Verify partial success handling
  assert.strictEqual(results.length, 2);
  assert.ok(results[0].success);
  assert.ok(!results[1].success);
  assert.ok(results[1].error!.includes('Content not found'));
});
```

## Interpreting Test Results

### Successful Recovery
- Test passes with expected error messages
- System state remains consistent
- Clear guidance provided to users

### Failed Recovery
- Test fails due to unexpected errors
- System left in inconsistent state
- Error messages unclear or unhelpful

### Example Test Output

```
✓ Content System Error Handling Integration (125ms)
  ✓ ContentManager Error Handling
    ✓ should throw ContentIngestionError for oversized content (15ms)
    ✓ should throw InvalidContentFormatError for unsupported content (8ms)
    ✓ should throw ContentIngestionError for non-existent file (12ms)
  ✓ ContentResolver Error Handling
    ✓ should throw ContentNotFoundError for non-existent content (18ms)
    ✓ should throw ContentRetrievalError for invalid format (6ms)
    ✓ should throw ContentNotFoundError for missing metadata (9ms)
  ✓ Storage Limit Error Handling
    ✓ should throw StorageLimitExceededError when approaching limits (22ms)
  ✓ Error Message Quality in Real Usage
    ✓ should provide actionable guidance for common scenarios (14ms)
    ✓ should handle batch operations with partial failures gracefully (28ms)
  ✓ Error Recovery Scenarios
    ✓ should provide clear guidance when content file is deleted after ingestion (35ms)
    ✓ should handle content directory permission issues (16ms)
```

## Adding New Error Tests

### Test Structure

Follow the established pattern from `content-error-integration.test.ts`:

```typescript
import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ContentManager } from './content-manager.js';
import { ContentResolver } from './content-resolver.js';
import { openDatabase } from './db.js';
import {
  ContentNotFoundError,
  StorageLimitExceededError,
  InvalidContentFormatError,
  ContentIngestionError,
  ContentRetrievalError
} from './content-errors.js';

describe('New Error Recovery Category', () => {
  let testDir: string;
  let dbPath: string;
  let contentDir: string;
  let db: any;
  let contentManager: ContentManager;
  let contentResolver: ContentResolver;

  beforeEach(async () => {
    // Setup test environment
    testDir = join(process.cwd(), `test-new-errors-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    dbPath = join(testDir, 'test.db');
    contentDir = join(testDir, 'content');
    
    db = await openDatabase(dbPath);
    contentManager = new ContentManager(db, { 
      contentDir,
      maxFileSize: '1MB',
      maxContentDirSize: '5MB'
    });
    contentResolver = new ContentResolver(db);
  });

  afterEach(async () => {
    // Cleanup
    if (db) {
      db.close();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should handle [specific error scenario]', async () => {
    // 1. Setup test conditions
    const testContent = Buffer.from('test content');
    
    // 2. Simulate error condition
    // ... create error condition
    
    // 3. Verify error handling
    await assert.rejects(
      () => contentManager.ingestFromMemory(testContent, { displayName: 'test.txt' }),
      (error) => {
        // Verify specific error type
        assert.ok(error instanceof ContentIngestionError);
        
        // Verify error message quality
        assert.ok(error.message.includes('expected error text'));
        
        // Verify actionable suggestions
        assert.ok(error.suggestions.length > 0);
        assert.ok(error.suggestions.some(s => s.includes('specific guidance')));
        
        return true;
      }
    );
  });
});
```

### Error Message Quality Criteria

Based on the actual implementation, good error messages should:

- **Use specific error classes**: `ContentNotFoundError`, `StorageLimitExceededError`, `InvalidContentFormatError`, etc.
- **Provide actionable suggestions**: Each error includes a `suggestions` array with specific guidance
- **Include relevant context**: Content IDs, file sizes, storage limits, content types
- **Avoid internal details**: Don't expose database internals or implementation details
- **Suggest recovery actions**: Re-ingestion, cleanup operations, format conversion, etc.

### Error Class Usage Patterns

```typescript
// Content not found - provides re-ingestion guidance
throw new ContentNotFoundError(contentId, displayName, 'file_verification');

// Storage limits - provides cleanup suggestions
throw new StorageLimitExceededError(currentMB, limitMB, contentMB, 'storage_enforcement');

// Invalid format - provides format-specific guidance
throw new InvalidContentFormatError(contentType, reason, 'format_validation');

// Ingestion failure - provides troubleshooting steps
throw new ContentIngestionError(operation, reason, 'filesystem_ingestion');

// Retrieval failure - provides format and access guidance
throw new ContentRetrievalError(contentId, format, reason, 'format_validation');
```

### Test Environment Setup

Use the established pattern from existing tests:

```typescript
beforeEach(async () => {
  // Create unique test directory to avoid conflicts
  testDir = join(process.cwd(), `test-content-errors-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });
  
  dbPath = join(testDir, 'test.db');
  contentDir = join(testDir, 'content');
  
  // Initialize database and components with test configuration
  db = await openDatabase(dbPath);
  contentManager = new ContentManager(db, { 
    contentDir,
    maxFileSize: '1MB',        // Small limits for testing
    maxContentDirSize: '5MB'   // Small limits for testing
  });
  contentResolver = new ContentResolver(db);
});

afterEach(async () => {
  // Ensure proper cleanup
  if (db) {
    db.close();
  }
  
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
});
```

## Production Monitoring

### Error Metrics to Track

Based on the actual error recovery implementation, monitor these metrics:

- **Content Resolution Failures**: `ContentNotFoundError` frequency and causes
- **Storage Limit Events**: `StorageLimitExceededError` frequency and storage usage trends
- **Format Validation Failures**: `InvalidContentFormatError` by content type
- **Ingestion Failures**: `ContentIngestionError` by operation type and cause
- **Batch Operation Failures**: Partial failure rates in batch processing
- **Resource Cleanup Events**: Orphaned file cleanup frequency and success rates

### Error Logging Integration

The content system uses structured error logging:

```typescript
// Error handling with categorized logging (from ContentErrorHandler)
ContentErrorHandler.handleContentError(error, 'content ingestion', 'ingestFromMemory', {
  severity: ErrorSeverity.ERROR,
  showStack: true
});

// Produces structured output:
// ContentIngestionError: Content ingestion failed during file validation: Path is not a file
// Context: filesystem_ingestion
// Suggestions:
//   1. Check that the content is valid and not corrupted
//   2. Ensure sufficient disk space is available
//   3. Verify file permissions allow reading the content
```

### Storage Health Monitoring

Use the built-in storage monitoring capabilities:

```typescript
// Get comprehensive storage statistics
const stats = await contentManager.getStorageStats();

// Monitor key metrics
const metrics = {
  contentDirUsagePercent: stats.limits.currentUsagePercent,
  remainingSpaceMB: stats.limits.remainingSpaceMB,
  totalContentItems: stats.overall.totalContentItems,
  storageEfficiency: stats.overall.storageEfficiency,
  isNearWarningThreshold: stats.limits.currentUsagePercent > 75,
  isNearErrorThreshold: stats.limits.currentUsagePercent > 95
};

// Get monitoring-friendly metrics
const monitoringMetrics = await contentManager.getStorageMetrics();
```

### Performance Health Checks

Monitor performance and resource usage:

```typescript
// Get performance statistics from ContentManager
const perfStats = contentManager.getPerformanceStats();

// Monitor hash cache efficiency
const cacheEfficiency = {
  hitRate: perfStats.hashCache.hitRate,
  cacheSize: perfStats.hashCache.size,
  averageSpeed: perfStats.operations.averageSpeed,
  errorRate: perfStats.operations.errorRate
};

// Get batch operation performance from ContentResolver
const resolverStats = contentResolver.getPerformanceStats();
const batchEfficiency = {
  averageDuration: resolverStats.batchOperations.averageDuration,
  errorRate: resolverStats.batchOperations.errorRate,
  cacheHitRate: resolverStats.contentRetrieval.cacheHitRate
};
```

## Troubleshooting Test Failures

### Common Test Failure Patterns

#### Inconsistent Error Messages
- **Symptom**: Error message doesn't match expected pattern
- **Solution**: Update error message or test pattern
- **Prevention**: Use consistent error message templates

#### Resource Cleanup Issues
- **Symptom**: Tests fail due to leftover resources from previous runs
- **Solution**: Improve cleanup in test teardown
- **Prevention**: Use unique temporary directories per test

#### Timing-Related Failures
- **Symptom**: Tests fail intermittently due to timing issues
- **Solution**: Add appropriate waits or use event-based synchronization
- **Prevention**: Avoid hard-coded timeouts, use condition polling

#### Platform-Specific Failures
- **Symptom**: Tests pass on some platforms but fail on others
- **Solution**: Use platform-agnostic file operations and paths
- **Prevention**: Test on multiple platforms during development

### Debugging Failed Tests

1. **Enable Verbose Logging**: Set log level to debug for detailed output
2. **Isolate the Failure**: Run only the failing test to reduce noise
3. **Check Test Environment**: Verify test setup and cleanup
4. **Validate Assumptions**: Ensure error conditions are properly simulated
5. **Review Error Messages**: Check that actual errors match expectations

### Test Maintenance

- **Regular Review**: Review error recovery tests quarterly
- **Update for Changes**: Update tests when error handling changes
- **Performance Impact**: Monitor test execution time and optimize slow tests
- **Coverage Analysis**: Ensure all error paths are covered by tests

## Best Practices

### Error Recovery Design
- **Fail Fast**: Detect errors early and provide immediate feedback
- **Clear Messages**: Use plain language in error messages
- **Actionable Guidance**: Always suggest next steps for resolution
- **State Consistency**: Ensure failed operations don't leave partial state
- **Resource Cleanup**: Clean up resources even when operations fail

### Test Design
- **Realistic Scenarios**: Test actual failure conditions, not artificial ones
- **Complete Coverage**: Test all error paths and recovery mechanisms
- **Maintainable Tests**: Write tests that are easy to understand and modify
- **Fast Execution**: Keep tests fast to encourage frequent running
- **Reliable Results**: Ensure tests produce consistent results across runs

This comprehensive error recovery testing framework ensures RAG-lite maintains its reputation for reliability and user-friendly operation, even when things go wrong.