/**
 * Demo script showing ResourceManager usage
 * This demonstrates the internal resource management system
 */

import { ResourceManager } from './resource-manager.js';
import { CommonErrors } from './api-errors.js';

async function demonstrateResourceManager() {
  console.log('=== ResourceManager Demo ===\n');

  // 1. Create ResourceManager instances
  console.log('1. Creating ResourceManager instances...');
  const manager1 = ResourceManager.getInstance({ basePath: './demo-data' });
  const manager2 = ResourceManager.getInstance({ basePath: './demo-data' }); // Same config
  const manager3 = ResourceManager.getInstance({ basePath: './other-data' }); // Different config

  console.log(`   - manager1 === manager2: ${manager1 === manager2} (singleton pattern)`);
  console.log(`   - manager1 === manager3: ${manager1 === manager3} (different configs)`);
  console.log(`   - Active instances: ${ResourceManager.getActiveInstanceCount()}`);

  // 2. Check if instances exist
  console.log('\n2. Checking instance existence...');
  console.log(`   - Has instance for './demo-data': ${ResourceManager.hasInstance({ basePath: './demo-data' })}`);
  console.log(`   - Has instance for './nonexistent': ${ResourceManager.hasInstance({ basePath: './nonexistent' })}`);

  // 3. Validate search files (will fail since files don't exist)
  console.log('\n3. Validating search files...');
  try {
    await manager1.validateSearchFiles();
    console.log('   - Validation passed');
  } catch (error) {
    console.log(`   - Validation failed (expected): ${error instanceof Error ? error.message.split('\n')[0] : 'Unknown error'}`);
  }

  // 4. Demonstrate error handling
  console.log('\n4. Demonstrating error handling...');
  try {
    throw CommonErrors.NO_DOCUMENTS_INGESTED;
  } catch (error) {
    if (error instanceof Error) {
      console.log(`   - Error caught: ${error.message}`);
    }
  }

  // 5. Cleanup resources
  console.log('\n5. Cleaning up resources...');
  console.log(`   - Before cleanup: ${ResourceManager.getActiveInstanceCount()} instances`);
  await ResourceManager.cleanupAll();
  console.log(`   - After cleanup: ${ResourceManager.getActiveInstanceCount()} instances`);

  console.log('\n=== Demo Complete ===');
}

// Run the demo if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('resource-manager-demo.js')) {
  demonstrateResourceManager().catch(console.error);
}

export { demonstrateResourceManager };