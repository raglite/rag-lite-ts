import Database from 'better-sqlite3';

try {
  const db = new Database('./db.sqlite');
  
  console.log('=== Database Config ===');
  const configs = db.prepare('SELECT name, value FROM config').all();
  configs.forEach(config => {
    console.log(`${config.name}: ${config.value}`);
  });
  
  console.log('\n=== Documents Count ===');
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get();
  console.log(`Documents: ${docCount.count}`);
  
  db.close();
} catch (error) {
  console.error('Error reading database:', error.message);
}