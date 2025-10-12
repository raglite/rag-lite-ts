import { readFileSync } from 'fs';

try {
  console.log('=== Checking vector index file ===');
  const data = readFileSync('./vector-index.bin', 'utf-8');
  const stored = JSON.parse(data);
  
  console.log(`Stored dimensions: ${stored.dimensions}`);
  console.log(`Stored maxElements: ${stored.maxElements}`);
  console.log(`Stored currentSize: ${stored.currentSize}`);
  console.log(`Number of vectors: ${stored.vectors?.length || 0}`);
  
  if (stored.vectors && stored.vectors.length > 0) {
    console.log(`First vector dimensions: ${stored.vectors[0].vector.length}`);
  }
  
} catch (error) {
  console.error('Error reading index file:', error.message);
}