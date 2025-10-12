import { openDatabase, getStoredModelInfo } from '../../dist/core/db.js';

async function checkModel() {
  try {
    console.log('=== Checking stored model info ===');
    const db = await openDatabase('./db.sqlite');
    
    const storedModel = await getStoredModelInfo(db);
    if (storedModel) {
      console.log(`Stored model: ${storedModel.modelName}`);
      console.log(`Stored dimensions: ${storedModel.dimensions}`);
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