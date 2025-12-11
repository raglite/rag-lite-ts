import { VectorIndex } from './core/vector-index.js';
import { BinaryIndexFormat } from './core/binary-index-format.js';
import { openDatabase, getSystemInfo, setSystemInfo, type DatabaseConnection } from './core/db.js';
import type { EmbeddingResult } from './core/types.js';
import { config, getModelDefaults } from './core/config.js';
import { existsSync } from 'fs';

export interface IndexStats {
  totalVectors: number;
  modelVersion: string;
  lastUpdated: Date;
}

export class IndexManager {
  private vectorIndex: VectorIndex;
  private textIndex?: VectorIndex;
  private imageIndex?: VectorIndex;
  private db: DatabaseConnection | null = null;
  private indexPath: string;
  private dbPath: string;
  private isInitialized = false;
  private hashToEmbeddingId: Map<number, string> = new Map();
  private embeddingIdToHash: Map<string, number> = new Map();
  private groupedEmbeddings?: { text: EmbeddingResult[]; image: EmbeddingResult[] };
  private vectorIndexOptions: any;

  constructor(indexPath: string, dbPath: string, dimensions: number, private modelName?: string) {
    this.indexPath = indexPath;
    this.dbPath = dbPath;

    // Store options for creating specialized indexes
    this.vectorIndexOptions = {
      dimensions: dimensions,
      maxElements: 100000, // Start with 100k capacity
      efConstruction: 200,
      M: 16
    };

    // Initialize with provided dimensions from config
    this.vectorIndex = new VectorIndex(indexPath, this.vectorIndexOptions);
  }

  /**
   * Initialize the index manager and load existing index if available
   * @param skipModelCheck - Skip model compatibility check (used for rebuilds)
   * @param forceRecreate - Force recreation of index (used for model changes)
   */
  async initialize(skipModelCheck: boolean = false, forceRecreate: boolean = false): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Open database connection
      this.db = await openDatabase(this.dbPath);

      // Check model compatibility BEFORE trying to load the vector index
      // This prevents WebAssembly exceptions when dimensions don't match
      if (!skipModelCheck && !forceRecreate) {
        await this.checkModelCompatibility();
      }

      if (forceRecreate || !this.vectorIndex.indexExists()) {
        console.log('Creating new vector index...');
        await this.vectorIndex.initialize();
      } else {
        // Only try to load existing index if not forcing recreation
        console.log('Loading existing vector index...');
        await this.vectorIndex.loadIndex();

        // Check if the loaded index has grouped data and create specialized indexes
        await this.createSpecializedIndexes();
      }

      // Always populate the embedding ID mapping from existing database entries
      // This is needed both for new and existing indexes
      const existingChunks = await this.db.all('SELECT embedding_id FROM chunks ORDER BY id');
      for (const chunk of existingChunks) {
        this.hashEmbeddingId(chunk.embedding_id); // This will populate the mapping
      }

      this.isInitialized = true;
      const vectorCount = this.vectorIndex.getCurrentCount();
      console.log(`Index manager initialized with ${vectorCount} vectors${this.textIndex && this.imageIndex ? ' (multi-graph mode)' : ''}`);
    } catch (error) {
      throw new Error(`Failed to initialize index manager: ${error}`);
    }
  }

  /**
   * Check model compatibility between stored and current configuration
   * Requirements: 2.1, 2.2, 2.4, 5.1, 5.2, 5.3, 5.4
   */
  private async checkModelCompatibility(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Get stored model information
      const systemInfo = await getSystemInfo(this.db);
      const currentModel = this.modelName || config.embedding_model;
      const currentDefaults = getModelDefaults(currentModel);

      if (systemInfo && systemInfo.modelName && systemInfo.modelDimensions) {
        // Check if models match
        if (systemInfo.modelName !== currentModel) {
          throw new Error(
            `Model mismatch detected!\n` +
            `Current model: ${currentModel} (${currentDefaults.dimensions} dimensions)\n` +
            `Index model: ${systemInfo.modelName} (${systemInfo.modelDimensions} dimensions)\n` +
            `\n` +
            `The embedding model has changed since the index was created.\n` +
            `This requires a full index rebuild to maintain consistency.\n` +
            `\n` +
            `To fix this issue:\n` +
            `1. Run: npm run rebuild\n` +
            `2. Or run: node dist/cli.js rebuild\n` +
            `\n` +
            `This will regenerate all embeddings with the new model.`
          );
        }

        // Check if dimensions match (additional safety check)
        if (systemInfo.modelDimensions !== currentDefaults.dimensions) {
          throw new Error(
            `Model dimension mismatch detected!\n` +
            `Current model dimensions: ${currentDefaults.dimensions}\n` +
            `Index model dimensions: ${systemInfo.modelDimensions}\n` +
            `\n` +
            `This indicates a configuration inconsistency.\n` +
            `Please run: npm run rebuild`
          );
        }

        console.log(`Model compatibility verified: ${currentModel} (${currentDefaults.dimensions} dimensions)`);
      } else {
        // First run - store the model info
        console.log(`No model info stored yet - storing current model info: ${currentModel}`);
        await setSystemInfo(this.db, {
          modelName: currentModel,
          modelDimensions: currentDefaults.dimensions
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Re-throw our formatted errors
      }
      throw new Error(`Failed to check model compatibility: ${error}`);
    }
  }

  /**
   * Add vectors to the index with corresponding metadata (incremental addition)
   * Requirements: 5.3 - When new documents are added THEN system SHALL append new chunks and vectors without rebuilding existing index
   */
  async addVectors(embeddings: EmbeddingResult[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Index manager not initialized');
    }

    if (embeddings.length === 0) {
      return;
    }

    try {
      // Convert embedding IDs to numeric IDs for hnswlib
      const vectors = embeddings.map((embedding) => ({
        id: this.hashEmbeddingId(embedding.embedding_id),
        vector: embedding.vector
      }));

      // Check if we need to resize the index before adding
      const currentCount = this.vectorIndex.getCurrentCount();
      const newCount = currentCount + vectors.length;
      const currentCapacity = 100000; // This should match the initial capacity

      if (newCount > currentCapacity * 0.9) {
        const newCapacity = Math.ceil(newCount * 1.5);
        console.log(`Resizing index from ${currentCapacity} to ${newCapacity} to accommodate new vectors`);
        this.vectorIndex.resizeIndex(newCapacity);
      }

      // Add vectors incrementally (this is the key requirement - no rebuild needed)
      this.vectorIndex.addVectors(vectors);
      console.log(`Incrementally added ${embeddings.length} vectors to index (total: ${this.vectorIndex.getCurrentCount()})`);

      // Save the updated index
      await this.saveIndex();
    } catch (error) {
      throw new Error(`Failed to add vectors to index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add grouped embeddings by content type (for new grouped format)
   */
  async addGroupedEmbeddings(textEmbeddings: EmbeddingResult[], imageEmbeddings: EmbeddingResult[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Index manager not initialized');
    }

    console.log(`addGroupedEmbeddings: text=${textEmbeddings.length}, image=${imageEmbeddings.length}`);

    const allEmbeddings = [...textEmbeddings, ...imageEmbeddings];

    if (allEmbeddings.length === 0) {
      return;
    }

    try {
      // Store grouped information for later saving
      this.groupedEmbeddings = { text: textEmbeddings, image: imageEmbeddings };
      console.log('addGroupedEmbeddings: stored grouped embeddings');

      // Add all embeddings to the index (maintains current behavior)
      await this.addVectors(allEmbeddings);
      console.log('addGroupedEmbeddings: addVectors completed');

      // The saveIndex method will now use grouped format if groupedEmbeddings exists
    } catch (error) {
      throw new Error(`Failed to add grouped embeddings to index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rebuild the entire index from scratch
   * Requirements: 5.2, 5.4 - Create full index rebuild functionality for model changes or document deletions
   */
  async rebuildIndex(newModelVersion?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.log('Starting full index rebuild...');

    try {
      // Initialize new empty index (this will overwrite existing index)
      await this.vectorIndex.initialize();

      // Get all chunk embedding IDs from database (we'll need to regenerate embeddings)
      const chunkData = await this.getAllChunksFromDB();

      if (chunkData.length === 0) {
        console.log('No chunks found in database - index rebuild complete with 0 vectors');

        // Update model version if provided
        if (newModelVersion) {
          await this.updateModelVersion(newModelVersion);
        }

        await this.saveIndex();
        return;
      }

      console.log(`Found ${chunkData.length} chunks in database that need re-embedding`);

      // Note: In a complete implementation, we would need to:
      // 1. Re-generate embeddings for all chunks using the new model
      // 2. Add the new vectors to the index
      // For now, we'll create a placeholder implementation that shows the structure

      console.warn('WARNING: Full rebuild requires re-generating embeddings for all chunks.');
      console.warn('This implementation requires integration with the EmbeddingEngine.');
      console.warn('The index has been reset but vectors need to be regenerated.');

      // Check if we need to resize index based on chunk count
      const currentCapacity = 100000; // Default capacity
      if (chunkData.length > currentCapacity * 0.8) {
        const newCapacity = Math.ceil(chunkData.length * 1.5);
        this.vectorIndex.resizeIndex(newCapacity);
        console.log(`Resized index capacity to ${newCapacity} for ${chunkData.length} chunks`);
      }

      // Update model version if provided
      if (newModelVersion) {
        await this.updateModelVersion(newModelVersion);
      }

      // Save the (empty) rebuilt index structure
      await this.saveIndex();
      console.log(`Index rebuild structure complete. ${chunkData.length} chunks need re-embedding.`);

    } catch (error) {
      throw new Error(`Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Trigger a full rebuild when documents are modified or deleted
   * Requirements: 5.4 - When documents are modified or deleted THEN system SHALL trigger full index rebuild
   */
  async triggerRebuildForDocumentChanges(reason: string): Promise<void> {
    console.log(`Triggering index rebuild due to: ${reason}`);
    await this.rebuildIndex();
  }

  /**
   * Complete rebuild workflow with embedding regeneration
   * This method should be called by higher-level components that have access to the EmbeddingEngine
   * Requirements: 5.2, 5.4 - Full index rebuild functionality
   */
  async rebuildWithEmbeddings(
    embeddingEngine: { embedDocumentBatch: (texts: string[]) => Promise<EmbeddingResult[]>; getModelVersion: () => string }
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.log('Starting complete index rebuild with embedding regeneration...');

    try {
      // Get all chunks that need re-embedding
      const chunkData = await this.getAllChunksFromDB();

      if (chunkData.length === 0) {
        console.log('No chunks found - initializing empty index');
        await this.vectorIndex.initialize();
        await this.updateModelVersion(embeddingEngine.getModelVersion());

        // Store model info for the new model
        const currentModel = this.modelName || config.embedding_model;
        const currentDefaults = getModelDefaults(currentModel);
        await setSystemInfo(this.db, {
          modelName: currentModel,
          modelDimensions: currentDefaults.dimensions
        });

        await this.saveIndex();
        return;
      }

      // Initialize new empty index
      await this.vectorIndex.initialize();

      // Check if we need to resize index
      const currentCapacity = 100000;
      if (chunkData.length > currentCapacity * 0.8) {
        const newCapacity = Math.ceil(chunkData.length * 1.5);
        this.vectorIndex.resizeIndex(newCapacity);
        console.log(`Resized index capacity to ${newCapacity}`);
      }

      // Re-generate embeddings for all chunks
      console.log(`Re-generating embeddings for ${chunkData.length} chunks...`);
      const texts = chunkData.map(chunk => chunk.text);
      const newEmbeddings = await embeddingEngine.embedDocumentBatch(texts);

      if (newEmbeddings.length === 0) {
        throw new Error('Failed to generate any embeddings during rebuild');
      }

      // Add all vectors to the new index
      const vectors = newEmbeddings.map((embedding) => ({
        id: this.hashEmbeddingId(embedding.embedding_id),
        vector: embedding.vector
      }));

      this.vectorIndex.addVectors(vectors);
      console.log(`Added ${vectors.length} vectors to rebuilt index`);

      // Update model version
      await this.updateModelVersion(embeddingEngine.getModelVersion());

      // Store model info for the new model
      const currentModel = this.modelName || config.embedding_model;
      const currentDefaults = getModelDefaults(currentModel);
      await setSystemInfo(this.db, {
        modelName: currentModel,
        modelDimensions: currentDefaults.dimensions
      });

      // Save the rebuilt index
      await this.saveIndex();

      console.log(`Index rebuild complete: ${vectors.length} vectors with new model version`);

    } catch (error) {
      throw new Error(`Failed to rebuild index with embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if the current model version matches stored version
   * Requirements: 5.1, 5.2 - Compare current embedding model version with stored version
   */
  async checkModelVersion(currentVersion: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const systemInfo = await getSystemInfo(this.db);
      const storedVersion = systemInfo?.modelVersion;

      if (!storedVersion || storedVersion === "") {
        // No version stored yet, this is first run - store current version
        await setSystemInfo(this.db, { modelVersion: currentVersion });
        console.log(`Stored initial model version: ${currentVersion}`);
        return true;
      }

      const matches = storedVersion === currentVersion;

      if (!matches) {
        console.error(`Model version mismatch detected!`);
        console.error(`Stored version: ${storedVersion}`);
        console.error(`Current version: ${currentVersion}`);
        console.error(`A full index rebuild is required before the system can continue.`);
      }

      return matches;
    } catch (error) {
      throw new Error(`Failed to check model version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the stored model version after successful rebuild
   * Requirements: 5.5 - Save model name and hash in SQLite for version tracking
   */
  async updateModelVersion(version: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await setSystemInfo(this.db, { modelVersion: version });
      console.log(`Updated model version to: ${version}`);
    } catch (error) {
      throw new Error(`Failed to update model version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate model version and exit if mismatch detected
   * Requirements: 5.2 - System SHALL exit with error message until full index rebuild is completed
   */
  async validateModelVersionOrExit(currentVersion: string): Promise<void> {
    const isValid = await this.checkModelVersion(currentVersion);

    if (!isValid) {
      console.error('\n=== MODEL VERSION MISMATCH ===');
      console.error('The embedding model version has changed since the last index build.');
      console.error('This requires a full index rebuild to maintain consistency.');
      console.error('\nTo rebuild the index, run:');
      console.error('  npm run rebuild-index');
      console.error('  # or');
      console.error('  node dist/cli.js rebuild');
      console.error('\nThe system will now exit.');
      process.exit(1);
    }
  }

  /**
   * Save the vector index to disk
   */
  async saveIndex(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Index manager not initialized');
    }

    // If we have grouped embeddings, save in grouped format
    if (this.groupedEmbeddings) {
      console.log('IndexManager: Saving in grouped format');
      await this.saveGroupedIndex(this.groupedEmbeddings.text, this.groupedEmbeddings.image);
      // Clear grouped data after saving
      this.groupedEmbeddings = undefined;
    } else {
      console.log('IndexManager: Saving in standard format');
      await this.vectorIndex.saveIndex();
    }
  }

  /**
   * Create specialized indexes for text and image content when grouped data is available
   */
  private async createSpecializedIndexes(): Promise<void> {
    try {
      // Load the index data to check if it has grouped information
      const indexData = await BinaryIndexFormat.load(this.indexPath);

      if (indexData.hasContentTypeGroups && indexData.textVectors && indexData.imageVectors) {
        // Only create specialized indexes if we have both text and image vectors
        // In text-only mode, textVectors would be populated but imageVectors empty
        // In multimodal mode, both would be populated
        const hasTextVectors = indexData.textVectors.length > 0;
        const hasImageVectors = indexData.imageVectors.length > 0;

        if (hasTextVectors && hasImageVectors) {
          console.log('Creating specialized indexes for content type filtering...');

          // Create text-only index
          this.textIndex = new VectorIndex(`${this.indexPath}.text`, this.vectorIndexOptions);
          await this.textIndex.initialize();
          this.textIndex.addVectors(indexData.textVectors);
          console.log(`✓ Text index created with ${indexData.textVectors.length} vectors`);

          // Create image-only index
          this.imageIndex = new VectorIndex(`${this.indexPath}.image`, this.vectorIndexOptions);
          await this.imageIndex.initialize();
          this.imageIndex.addVectors(indexData.imageVectors);
          console.log(`✓ Image index created with ${indexData.imageVectors.length} vectors`);

          console.log('✓ Specialized indexes ready for content type filtering');
        } else if (hasTextVectors) {
          console.log('Text-only index detected - using combined index for all searches');
          // In text-only mode, we don't need specialized indexes
          // The combined index (vectorIndex) already contains all text vectors
        }
      }
    } catch (error) {
      console.warn('Failed to create specialized indexes, falling back to combined index:', error);
      // Continue without specialized indexes - search will still work with combined index
    }
  }

  /**
   * Save index with content type grouping (for new grouped format)
   */
  async saveGroupedIndex(textEmbeddings: EmbeddingResult[], imageEmbeddings: EmbeddingResult[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Index manager not initialized');
    }

    console.log(`saveGroupedIndex: text=${textEmbeddings.length}, image=${imageEmbeddings.length}`);

    // Group vectors by content type
    const textVectors = textEmbeddings.map((embedding) => ({
      id: this.hashEmbeddingId(embedding.embedding_id),
      vector: embedding.vector
    }));

    const imageVectors = imageEmbeddings.map((embedding) => ({
      id: this.hashEmbeddingId(embedding.embedding_id),
      vector: embedding.vector
    }));

    // Get index parameters
    const options = this.vectorIndex.getOptions();
    const allVectors = [...textVectors, ...imageVectors];

    console.log(`saveGroupedIndex: dimensions=${options.dimensions}, totalVectors=${allVectors.length}`);

    const indexData = {
      dimensions: options.dimensions,
      maxElements: options.maxElements,
      M: options.M || 16,
      efConstruction: options.efConstruction || 200,
      seed: options.seed || 100,
      currentSize: textVectors.length + imageVectors.length,
      vectors: allVectors, // Required for backward compatibility
      hasContentTypeGroups: true,
      textVectors,
      imageVectors
    };

    console.log('saveGroupedIndex: Calling BinaryIndexFormat.saveGrouped');
    // Save using grouped format
    await BinaryIndexFormat.saveGrouped(this.indexPath, indexData);

    console.log(`✓ Saved grouped index with ${textVectors.length} text and ${imageVectors.length} image vectors`);
  }

  /**
   * Search for similar vectors
   */
  search(queryVector: Float32Array, k: number = 5, contentType?: 'text' | 'image' | 'combined'): { embeddingIds: string[]; distances: number[] } {
    if (!this.isInitialized) {
      throw new Error('Index manager not initialized');
    }

    // Select the appropriate index based on content type
    let targetIndex: VectorIndex;

    // If we have specialized indexes (multimodal mode), use them for filtering
    if (this.textIndex && this.imageIndex) {
      if (contentType === 'text') {
        targetIndex = this.textIndex;
      } else if (contentType === 'image') {
        targetIndex = this.imageIndex;
      } else {
        // 'combined' or undefined
        targetIndex = this.vectorIndex;
      }
    } else {
      // No specialized indexes (text-only mode) - ignore contentType and use combined index
      targetIndex = this.vectorIndex;
    }

    const results = targetIndex.search(queryVector, k);

    // Convert numeric IDs back to embedding IDs
    const embeddingIds = results.neighbors.map(id => this.unhashEmbeddingId(id));

    return {
      embeddingIds,
      distances: results.distances
    };
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const totalVectors = this.vectorIndex.getCurrentCount();

    try {
      const systemInfo = await getSystemInfo(this.db);
      const modelVersion = systemInfo?.modelVersion || null;

      return {
        totalVectors,
        modelVersion: modelVersion || 'unknown',
        lastUpdated: new Date() // Could be enhanced to track actual last update time
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all chunks from database for rebuild (returns chunk data, not embeddings)
   * Note: Embeddings need to be regenerated during rebuild since we don't store vectors in DB
   */
  private async getAllChunksFromDB(): Promise<Array<{ embedding_id: string; text: string; document_id: number }>> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.db.all(
        'SELECT embedding_id, content as text, document_id FROM chunks ORDER BY id'
      );

      return rows.map(row => ({
        embedding_id: row.embedding_id,
        text: row.text,
        document_id: row.document_id
      }));
    } catch (error) {
      throw new Error(`Failed to get chunks from DB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert embedding ID string to numeric ID for hnswlib with collision handling
   */
  private hashEmbeddingId(embeddingId: string): number {
    // Check if we already have a mapping for this embedding ID
    if (this.embeddingIdToHash.has(embeddingId)) {
      return this.embeddingIdToHash.get(embeddingId)!;
    }

    let hash = 0;
    for (let i = 0; i < embeddingId.length; i++) {
      const char = embeddingId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    hash = Math.abs(hash);

    // Handle hash collisions by incrementing until we find an unused hash
    let finalHash = hash;
    while (this.hashToEmbeddingId.has(finalHash) && this.hashToEmbeddingId.get(finalHash) !== embeddingId) {
      finalHash = (finalHash + 1) & 0x7FFFFFFF; // Keep it positive
    }

    // Store the bidirectional mapping
    this.embeddingIdToHash.set(embeddingId, finalHash);
    this.hashToEmbeddingId.set(finalHash, embeddingId);

    return finalHash;
  }

  /**
   * Convert numeric ID back to embedding ID using the maintained mapping
   */
  private unhashEmbeddingId(numericId: number): string {
    const embeddingId = this.hashToEmbeddingId.get(numericId);
    if (!embeddingId) {
      console.warn(`Warning: No embedding ID found for hash ${numericId}. This may indicate index/database synchronization issues.`);
      console.warn('Consider running "raglite rebuild" to fix synchronization problems.');
      throw new Error(`No embedding ID found for hash ${numericId}`);
    }
    return embeddingId;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}