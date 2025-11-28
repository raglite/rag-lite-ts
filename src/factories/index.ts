/**
 * Factory exports for creating RAG instances
 * Provides convenient factory functions for common use cases
 * 
 * This module serves as the main entry point for factory functions that
 * simplify the creation of search and ingestion systems.
 * The factories handle complex initialization while providing clean APIs.
 * 
 * MAIN FACTORY CLASSES:
 * - IngestionFactory: Creates IngestionPipeline instances for document ingestion
 * - SearchFactory: Creates SearchEngine with automatic mode detection (recommended)
 * 
 * @example
 * ```typescript
 * import { IngestionFactory, SearchFactory } from './factories';
 * 
 * // Create ingestion pipeline
 * const ingestion = await IngestionFactory.create('./db.sqlite', './index.bin');
 * 
 * // Create search engine with automatic mode detection
 * const search = await SearchFactory.create('./index.bin', './db.sqlite');
 * ```
 */

// Main factory classes
export { IngestionFactory } from './ingestion-factory.js';

// Polymorphic search factory (recommended for automatic mode detection)
// Re-exported from core for convenience
export { SearchFactory } from './search-factory.js';

// Factory option types
export type {
  IngestionFactoryOptions,
  ContentSystemConfig
} from './ingestion-factory.js';
