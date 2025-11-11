/**
 * Test utilities for multi-model support
 * Provides common configurations and helpers for testing with different embedding models
 */

export interface TestModel {
  name: string;
  dimensions: number;
  chunkSize: number;
  batchSize: number;
}

export const TEST_MODELS: TestModel[] = [
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
];

/**
 * Retrieve model configuration by name
 * @param modelName - The name of the model to retrieve
 * @returns Model configuration object or undefined if not found
 */
export function getTestModel(modelName: string): TestModel | undefined {
  return TEST_MODELS.find(m => m.name === modelName);
}
