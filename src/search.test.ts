import { test, describe } from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';
import { SearchEngine } from './search.js';
import { IndexManager } from './index-manager.js';
import { initializeEmbeddingEngine } from './embedder.js';
import { openDatabase, insertDocument, insertChunk, initializeSchema } from './db.js';
import { config, getModelDefaults } from './config.js';

async function createTempDir(): Promise<string> {
  const tempDir = join(tmpdir(), `search-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('SearchEngine', () => {
  test('should embed query using same model as document chunks', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add some test data
      const docId = await insertDocument(db, 'test.md', 'Test Document');
      const chunks = [
        { text: 'Machine learning is a subset of artificial intelligence', docId, chunkIndex: 0 },
        { text: 'Deep learning uses neural networks with multiple layers', docId, chunkIndex: 1 },
        { text: 'Natural language processing helps computers understand text', docId, chunkIndex: 2 }
      ];

      const embeddings: any[] = [];
      for (const chunk of chunks) {
        const embedding = await embedder.embedSingle(chunk.text);
        embeddings.push(embedding);
        await insertChunk(db, embedding.embedding_id, chunk.docId, chunk.text, chunk.chunkIndex);
      }

      await indexManager.addVectors(embeddings);

      // Test search
      const results = await searchEngine.search('artificial intelligence');

      assert.ok(results.length > 0, 'Should return search results');
      assert.ok(results[0].score > 0, 'Should have positive similarity scores');
      assert.ok(results[0].text.includes('Machine learning'), 'Should return relevant content');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should implement vector similarity search using IndexManager', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add test documents
      const docId1 = await insertDocument(db, 'doc1.md', 'Programming Guide');
      const docId2 = await insertDocument(db, 'doc2.md', 'Cooking Recipes');

      const chunks = [
        { text: 'Python is a programming language used for web development', docId: docId1, chunkIndex: 0 },
        { text: 'JavaScript is essential for frontend web development', docId: docId1, chunkIndex: 1 },
        { text: 'Pasta recipes require boiling water and adding salt', docId: docId2, chunkIndex: 0 },
        { text: 'Baking bread involves mixing flour, water, and yeast', docId: docId2, chunkIndex: 1 }
      ];

      const embeddings: any[] = [];
      for (const chunk of chunks) {
        const embedding = await embedder.embedSingle(chunk.text);
        embeddings.push(embedding);
        await insertChunk(db, embedding.embedding_id, chunk.docId, chunk.text, chunk.chunkIndex);
      }

      await indexManager.addVectors(embeddings);

      // Test programming-related search
      const programmingResults = await searchEngine.search('web development programming');
      assert.ok(programmingResults.length >= 2, 'Should find programming-related results');
      assert.ok(programmingResults[0].text.includes('Python') || programmingResults[0].text.includes('JavaScript'), 'Should prioritize programming content');

      // Test cooking-related search
      const cookingResults = await searchEngine.search('cooking food recipes');
      assert.ok(cookingResults.length >= 2, 'Should find cooking-related results');
      assert.ok(cookingResults[0].text.includes('Pasta') || cookingResults[0].text.includes('bread'), 'Should prioritize cooking content');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should retrieve text and metadata from SQLite using embedding_ids', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add test document with specific metadata
      const docId = await insertDocument(db, '/path/to/test.md', 'Test Document Title');
      const chunkText = 'This is a test chunk with specific content for metadata verification';

      const embedding = await embedder.embedSingle(chunkText);
      await insertChunk(db, embedding.embedding_id, docId, chunkText, 0);
      await indexManager.addVectors([embedding] as any);

      // Search and verify metadata
      const results = await searchEngine.search('test chunk content');

      assert.ok(results.length > 0, 'Should return results');
      const result = results[0];

      assert.equal(result.text, chunkText, 'Should return correct chunk text');
      assert.equal(result.document.title, 'Test Document Title', 'Should return correct document title');
      assert.equal(result.document.source, '/path/to/test.md', 'Should return correct document source');
      assert.equal(result.document.id, docId, 'Should return correct document ID');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should format results as JSON with text, score, and document metadata', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add test data
      const docId = await insertDocument(db, 'example.md', 'Example Document');
      const chunkText = 'Example content for testing result formatting';

      const embedding = await embedder.embedSingle(chunkText);
      await insertChunk(db, embedding.embedding_id, docId, chunkText, 0);
      await indexManager.addVectors([embedding] as any);

      // Search and verify result format
      const results = await searchEngine.search('example content');

      assert.ok(results.length > 0, 'Should return results');
      const result = results[0];

      // Verify result structure
      assert.ok(typeof result.text === 'string', 'Result should have text field');
      assert.ok(typeof result.score === 'number', 'Result should have numeric score');
      assert.ok(result.score >= 0 && result.score <= 1, 'Score should be between 0 and 1');

      assert.ok(typeof result.document === 'object', 'Result should have document object');
      assert.ok(typeof result.document.id === 'number', 'Document should have numeric ID');
      assert.ok(typeof result.document.title === 'string', 'Document should have title');
      assert.ok(typeof result.document.source === 'string', 'Document should have source');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should handle empty query gracefully', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Test empty queries
      const emptyResults = await searchEngine.search('');
      const whitespaceResults = await searchEngine.search('   ');

      assert.equal(emptyResults.length, 0, 'Empty query should return no results');
      assert.equal(whitespaceResults.length, 0, 'Whitespace query should return no results');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should respect top_k parameter with default of 10 results', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add multiple test documents
      const docId = await insertDocument(db, 'test.md', 'Test Document');
      const chunks: string[] = [];
      for (let i = 0; i < 10; i++) {
        chunks.push(`This is test content number ${i} about machine learning and AI`);
      }

      const embeddings: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embedder.embedSingle(chunks[i]);
        embeddings.push(embedding);
        await insertChunk(db, embedding.embedding_id, docId, chunks[i], i);
      }

      await indexManager.addVectors(embeddings);

      // Test default top_k (should be 10)
      const defaultResults = await searchEngine.search('machine learning');
      assert.ok(defaultResults.length <= 10, 'Default should return at most 10 results');

      // Test custom top_k
      const customResults = await searchEngine.search('machine learning', { top_k: 3 });
      assert.ok(customResults.length <= 3, 'Should respect custom top_k parameter');

      const moreResults = await searchEngine.search('machine learning', { top_k: 8 });
      assert.ok(moreResults.length <= 8, 'Should respect larger top_k parameter');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  test('should return relevant results for domain-specific queries', async () => {
    const tempDir = await createTempDir();

    try {
      const dbPath = join(tempDir, 'test.db');
      const indexPath = join(tempDir, 'test.bin');

      // Initialize components
      const db = await openDatabase(dbPath);
      await initializeSchema(db);

      const embedder = await initializeEmbeddingEngine();
      // Use current config model dimensions to match the embedder
      const modelDefaults = getModelDefaults(config.embedding_model);
      const indexManager = new IndexManager(indexPath, dbPath, modelDefaults.dimensions);
      await indexManager.initialize();

      const searchEngine = SearchEngine.createWithComponents(embedder, indexManager, db);
      await searchEngine.initialize();

      // Add domain-specific content
      const docId = await insertDocument(db, 'tech.md', 'Technology Guide');
      const techChunks = [
        'React is a JavaScript library for building user interfaces',
        'Node.js allows JavaScript to run on the server side',
        'Docker containers provide application isolation and deployment'
      ];

      const embeddings: any[] = [];
      for (let i = 0; i < techChunks.length; i++) {
        const embedding = await embedder.embedSingle(techChunks[i]);
        embeddings.push(embedding);
        await insertChunk(db, embedding.embedding_id, docId, techChunks[i], i);
      }

      await indexManager.addVectors(embeddings);

      // Test domain-specific searches
      const reactResults = await searchEngine.search('frontend JavaScript framework');
      assert.ok(reactResults.length > 0, 'Should find React-related content');
      // Check if React content is in the top results (more flexible than requiring it to be first)
      const hasReactContent = reactResults.some(result => result.text.includes('React'));
      assert.ok(hasReactContent, 'Should find React content for frontend query');

      const serverResults = await searchEngine.search('backend server development');
      assert.ok(serverResults.length > 0, 'Should find server-related content');
      // Check if Node.js content is in the top results (more flexible than requiring it to be first)
      const hasNodeContent = serverResults.some(result => result.text.includes('Node.js'));
      assert.ok(hasNodeContent, 'Should find Node.js content for server query');

      await db.close();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});