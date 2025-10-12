/**
 * Factory exports for creating text-specific RAG instances
 * Provides convenient factory functions for common use cases
 * 
 * This module serves as the main entry point for factory functions that
 * simplify the creation of text-based search and ingestion systems.
 * The factories handle complex initialization while providing clean APIs.
 * 
 * MAIN FACTORY CLASSES:
 * - TextSearchFactory: Creates SearchEngine instances for text search
 * - TextIngestionFactory: Creates IngestionPipeline instances for text ingestion
 * - TextRAGFactory: Creates both search and ingestion instances together
 * - TextFactoryHelpers: Utility functions for validation and error recovery
 * 
 * CONVENIENCE ALIASES:
 * - SearchFactory: Alias for TextSearchFactory
 * - IngestionFactory: Alias for TextIngestionFactory
 * - RAGFactory: Alias for TextRAGFactory
 * 
 * @example
 * ```typescript
 * import { TextSearchFactory, TextIngestionFactory } from './factories';
 * 
 * // Create search engine
 * const search = await TextSearchFactory.create('./index.bin', './db.sqlite');
 * 
 * // Create ingestion pipeline
 * const ingestion = await TextIngestionFactory.create('./db.sqlite', './index.bin');
 * 
 * // Or create both together
 * import { TextRAGFactory } from './factories';
 * const { searchEngine, ingestionPipeline } = await TextRAGFactory.createBoth(
 *   './index.bin',
 *   './db.sqlite'
 * );
 * ```
 */

// Main factory classes
export {
  TextSearchFactory,
  TextIngestionFactory,
  TextRAGFactory,
  TextFactoryHelpers
} from './text-factory.js';

// Factory option types
export type {
  TextSearchOptions,
  TextIngestionOptions
} from './text-factory.js';

// Convenience re-exports for common patterns
export { TextSearchFactory as SearchFactory } from './text-factory.js';
export { TextIngestionFactory as IngestionFactory } from './text-factory.js';
export { TextRAGFactory as RAGFactory } from './text-factory.js';