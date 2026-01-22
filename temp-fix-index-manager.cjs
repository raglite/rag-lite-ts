const fs = require('fs');
let content = fs.readFileSync('./src/index-manager.ts', 'utf8');

// Fix the reset method - vectorStorage is in vectorIndex, not in IndexManager directly
// We should use getCurrentCount() instead and track the count before reset
const oldReset = `  async reset(): Promise<void> {
    console.log('🔄 Starting index reset...');
    const startTime = Date.now();

    try {
      // Clear in-memory mappings
      const previousVectorCount = this.vectorStorage.size;
      this.hashToEmbeddingId.clear();
      this.embeddingIdToHash.clear();
      this.vectorStorage.clear();`;

const newReset = `  async reset(): Promise<void> {
    console.log('🔄 Starting index reset...');
    const startTime = Date.now();

    try {
      // Get current vector count before clearing
      const previousVectorCount = this.vectorIndex.getCurrentCount();
      
      // Clear in-memory ID mappings
      this.hashToEmbeddingId.clear();
      this.embeddingIdToHash.clear();`;

// Handle CRLF line endings
const oldResetNormalized = oldReset.replace(/\n/g, '\r\n');
const newResetNormalized = newReset.replace(/\n/g, '\r\n');

if (content.includes(oldResetNormalized)) {
  content = content.replace(oldResetNormalized, newResetNormalized);
  fs.writeFileSync('./src/index-manager.ts', content);
  console.log('Successfully fixed IndexManager.reset() method');
} else {
  console.error('Could not find the reset method code to fix');
  // Try to find what's there
  if (content.includes('async reset(): Promise<void>')) {
    console.log('Found reset method declaration');
  }
  process.exit(1);
}
