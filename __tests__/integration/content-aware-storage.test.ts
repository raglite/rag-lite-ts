/**
 * Tests for Content-Aware Document and Chunk Storage
 * Tests content type validation, metadata handling, and content-type specific queries
 * Uses Node.js test runner
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  openDatabase, 
  initializeSchema, 
  insertDocument, 
  insertChunk, 
  upsertDocument,
  getDocumentsByContentType,
  getChunksByContentType,
  getContentTypeStatistics,
  updateDocumentMetadata,
  updateChunkMetadata,
  getChunksByEmbeddingIds
} from '../../src/core/db.js';
import { unlink } from 'fs/promises';

describe('Content-Aware Document and Chunk Storage', () => {
  const testDbPath = './test-content-aware.db';

  // Clean up test database after each test
  async function cleanup() {
    try {
      await unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  test('should validate content types for documents', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Valid content types should work
      const validTypes = ['text', 'image', 'pdf', 'docx'];
      for (const contentType of validTypes) {
        const docId = await insertDocument(connection, `test-${contentType}.txt`, `Test ${contentType}`, contentType);
        assert.ok(docId > 0, `Should insert document with content type ${contentType}`);
      }
      
      // Invalid content type should throw
      await assert.rejects(
        () => insertDocument(connection, 'invalid.txt', 'Invalid', 'invalid'),
        /Invalid content type 'invalid'/,
        'Should reject invalid content type'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should validate content types for chunks', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Create a document first
      const docId = await insertDocument(connection, 'test.txt', 'Test Document', 'text');
      
      // Valid content types should work
      const validTypes = ['text', 'image', 'pdf', 'docx'];
      for (let i = 0; i < validTypes.length; i++) {
        const contentType = validTypes[i];
        await insertChunk(connection, `chunk-${i}`, docId, `Content ${i}`, i, contentType);
      }
      
      // Invalid content type should throw
      await assert.rejects(
        () => insertChunk(connection, 'invalid-chunk', docId, 'Invalid content', 0, 'invalid'),
        /Invalid content type 'invalid'/,
        'Should reject invalid content type for chunks'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle JSON metadata for documents', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const imageMetadata = {
        dimensions: { width: 1920, height: 1080 },
        fileSize: 2048576,
        format: 'png',
        description: 'A beautiful landscape'
      };
      
      const docId = await insertDocument(connection, 'image.png', 'Test Image', 'image', imageMetadata);
      
      // Retrieve documents by content type to verify metadata
      const imageDocs = await getDocumentsByContentType(connection, 'image');
      assert.strictEqual(imageDocs.length, 1);
      assert.deepStrictEqual(imageDocs[0].metadata, imageMetadata);
      assert.strictEqual(imageDocs[0].content_type, 'image');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle JSON metadata for chunks', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const docId = await insertDocument(connection, 'test.pdf', 'Test PDF', 'pdf');
      
      const chunkMetadata = {
        pageNumber: 1,
        boundingBox: { x: 100, y: 200, width: 300, height: 400 },
        confidence: 0.95,
        extractedText: 'This is extracted text from the PDF'
      };
      
      await insertChunk(connection, 'pdf-chunk-1', docId, 'PDF content', 0, 'pdf', chunkMetadata);
      
      // Retrieve chunks by content type to verify metadata
      const pdfChunks = await getChunksByContentType(connection, 'pdf');
      assert.strictEqual(pdfChunks.length, 1);
      assert.deepStrictEqual(pdfChunks[0].metadata, chunkMetadata);
      assert.strictEqual(pdfChunks[0].content_type, 'pdf');
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should query documents by content type', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Insert documents of different types
      await insertDocument(connection, 'doc1.txt', 'Text Document 1', 'text');
      await insertDocument(connection, 'doc2.txt', 'Text Document 2', 'text');
      await insertDocument(connection, 'image1.jpg', 'Image 1', 'image');
      await insertDocument(connection, 'pdf1.pdf', 'PDF 1', 'pdf');
      
      // Query by content type
      const textDocs = await getDocumentsByContentType(connection, 'text');
      const imageDocs = await getDocumentsByContentType(connection, 'image');
      const pdfDocs = await getDocumentsByContentType(connection, 'pdf');
      
      assert.strictEqual(textDocs.length, 2);
      assert.strictEqual(imageDocs.length, 1);
      assert.strictEqual(pdfDocs.length, 1);
      
      // Verify content types
      textDocs.forEach(doc => assert.strictEqual(doc.content_type, 'text'));
      imageDocs.forEach(doc => assert.strictEqual(doc.content_type, 'image'));
      pdfDocs.forEach(doc => assert.strictEqual(doc.content_type, 'pdf'));
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should query chunks by content type', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Create documents
      const textDocId = await insertDocument(connection, 'text.txt', 'Text Doc', 'text');
      const imageDocId = await insertDocument(connection, 'image.jpg', 'Image Doc', 'image');
      
      // Insert chunks of different types
      await insertChunk(connection, 'text-chunk-1', textDocId, 'Text content 1', 0, 'text');
      await insertChunk(connection, 'text-chunk-2', textDocId, 'Text content 2', 1, 'text');
      await insertChunk(connection, 'image-chunk-1', imageDocId, 'Image description', 0, 'image');
      
      // Query by content type
      const textChunks = await getChunksByContentType(connection, 'text');
      const imageChunks = await getChunksByContentType(connection, 'image');
      
      assert.strictEqual(textChunks.length, 2);
      assert.strictEqual(imageChunks.length, 1);
      
      // Verify content types and document metadata
      textChunks.forEach(chunk => {
        assert.strictEqual(chunk.content_type, 'text');
        assert.strictEqual(chunk.document_content_type, 'text');
      });
      
      imageChunks.forEach(chunk => {
        assert.strictEqual(chunk.content_type, 'image');
        assert.strictEqual(chunk.document_content_type, 'image');
      });
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should provide content type statistics', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // Insert documents and chunks of different types
      const textDocId = await insertDocument(connection, 'text.txt', 'Text Doc', 'text');
      const imageDocId = await insertDocument(connection, 'image.jpg', 'Image Doc', 'image');
      const pdfDocId = await insertDocument(connection, 'pdf.pdf', 'PDF Doc', 'pdf');
      
      await insertChunk(connection, 'text-chunk-1', textDocId, 'Text 1', 0, 'text');
      await insertChunk(connection, 'text-chunk-2', textDocId, 'Text 2', 1, 'text');
      await insertChunk(connection, 'image-chunk-1', imageDocId, 'Image desc', 0, 'image');
      await insertChunk(connection, 'pdf-chunk-1', pdfDocId, 'PDF content', 0, 'pdf');
      await insertChunk(connection, 'pdf-chunk-2', pdfDocId, 'PDF content 2', 1, 'pdf');
      
      const stats = await getContentTypeStatistics(connection);
      
      // Verify document statistics
      assert.strictEqual(stats.documents.text, 1);
      assert.strictEqual(stats.documents.image, 1);
      assert.strictEqual(stats.documents.pdf, 1);
      assert.strictEqual(stats.total.documents, 3);
      
      // Verify chunk statistics
      assert.strictEqual(stats.chunks.text, 2);
      assert.strictEqual(stats.chunks.image, 1);
      assert.strictEqual(stats.chunks.pdf, 2);
      assert.strictEqual(stats.total.chunks, 5);
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should update document metadata', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const initialMetadata = { version: 1, tags: ['test'] };
      const docId = await insertDocument(connection, 'test.txt', 'Test Doc', 'text', initialMetadata);
      
      const updatedMetadata = { version: 2, tags: ['test', 'updated'], lastModified: '2024-01-01' };
      await updateDocumentMetadata(connection, docId, updatedMetadata);
      
      // Verify the metadata was updated
      const docs = await getDocumentsByContentType(connection, 'text');
      assert.strictEqual(docs.length, 1);
      assert.deepStrictEqual(docs[0].metadata, updatedMetadata);
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should update chunk metadata', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const docId = await insertDocument(connection, 'test.txt', 'Test Doc', 'text');
      const initialMetadata = { confidence: 0.8, source: 'ocr' };
      
      await insertChunk(connection, 'test-chunk', docId, 'Test content', 0, 'text', initialMetadata);
      
      // Get the chunk ID
      const chunks = await getChunksByEmbeddingIds(connection, ['test-chunk']);
      assert.strictEqual(chunks.length, 1);
      const chunkId = chunks[0].id;
      
      const updatedMetadata = { confidence: 0.95, source: 'manual', verified: true };
      await updateChunkMetadata(connection, chunkId, updatedMetadata);
      
      // Verify the metadata was updated
      const updatedChunks = await getChunksByEmbeddingIds(connection, ['test-chunk']);
      assert.strictEqual(updatedChunks.length, 1);
      assert.deepStrictEqual(updatedChunks[0].metadata, updatedMetadata);
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle upsert with content type validation', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      // First upsert should insert
      const docId1 = await upsertDocument(connection, 'test.jpg', 'Test Image', 'image', { size: 1024 });
      assert.ok(docId1 > 0);
      
      // Second upsert with same source should return existing ID
      const docId2 = await upsertDocument(connection, 'test.jpg', 'Updated Image', 'image', { size: 2048 });
      assert.strictEqual(docId1, docId2);
      
      // Invalid content type should throw
      await assert.rejects(
        () => upsertDocument(connection, 'invalid.txt', 'Invalid', 'invalid'),
        /Invalid content type 'invalid'/,
        'Should reject invalid content type in upsert'
      );
    } finally {
      await connection.close();
      await cleanup();
    }
  });

  test('should handle complex metadata serialization', async () => {
    await cleanup();
    
    const connection = await openDatabase(testDbPath);
    try {
      await initializeSchema(connection);
      
      const complexMetadata = {
        nested: {
          object: {
            with: ['arrays', 'and', 'values']
          }
        },
        numbers: [1, 2, 3.14, -5],
        booleans: { true: true, false: false },
        nullValue: null,
        emptyArray: [],
        emptyObject: {}
      };
      
      const docId = await insertDocument(connection, 'complex.json', 'Complex Metadata', 'text', complexMetadata);
      await insertChunk(connection, 'complex-chunk', docId, 'Complex content', 0, 'text', complexMetadata);
      
      // Verify document metadata
      const docs = await getDocumentsByContentType(connection, 'text');
      assert.strictEqual(docs.length, 1);
      assert.deepStrictEqual(docs[0].metadata, complexMetadata);
      
      // Verify chunk metadata
      const chunks = await getChunksByEmbeddingIds(connection, ['complex-chunk']);
      assert.strictEqual(chunks.length, 1);
      assert.deepStrictEqual(chunks[0].metadata, complexMetadata);
    } finally {
      await connection.close();
      await cleanup();
    }
  });
});
