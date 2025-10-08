/**
 * Test utilities for multi-model support
 * Provides common configurations and helpers for testing with different embedding models
 */

export const TEST_MODELS = [
  {
    name: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    chunkSize: 250,
    batchSize: 16
  },
  {
    name: 'Xenova/all-mpnet-base-v2', 
    dimensions: 768,
    chunkSize: 400,
    batchSize: 8
  }
] as const;

/**
 * Retrieve model configuration by name
 * @param modelName - The name of the model to retrieve
 * @returns Model configuration object or undefined if not found
 */
export function getTestModel(modelName: string) {
  return TEST_MODELS.find(m => m.name === modelName);
}

/**
 * Type for test model configuration
 */
export type TestModel = typeof TEST_MODELS[number];