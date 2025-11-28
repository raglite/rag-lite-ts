import { openDatabase, getSystemInfo } from '../../dist/core/db.js';

async function checkModel() {
  try {
    console.log('=== Checking stored model info ===');
    const db = await openDatabase('./db.sqlite');
    
    const systemInfo = await getSystemInfo(db);
    if (systemInfo && systemInfo.modelName && systemInfo.modelDimensions) {
      console.log(`Stored model: ${systemInfo.modelName}`);
      console.log(`Stored dimensions: ${systemInfo.modelDimensions}`);
      console.log(`Mode: ${systemInfo.mode || 'not set'}`);
      console.log(`Model type: ${systemInfo.modelType || 'not set'}`);
    } else {
      console.log('No model info stored in database');
    }
    
    // Also check config table directly
    console.log('\n=== Raw config table ===');
    const configs = await db.all('SELECT name, value FROM config');
    configs.forEach(config => {
      console.log(`${config.name}: ${config.value}`);
    });
    
    await db.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkModel();