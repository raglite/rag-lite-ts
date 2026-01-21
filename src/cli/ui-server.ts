import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the project root directory
 * When built, CLI is at dist/esm/cli/ui-server.js, so go up 3 levels
 * When running from source, CLI is at src/cli/ui-server.ts, so go up 2 levels
 */
function getProjectRoot(): string {
  // Try going up 3 levels first (for built version)
  const builtPath = join(__dirname, '../../..');
  if (fs.existsSync(join(builtPath, 'package.json'))) {
    return builtPath;
  }
  // Fallback: go up 2 levels (for source execution)
  return join(__dirname, '../..');
}

/**
 * Launch the UI server
 */
export async function runUI(options: any = {}): Promise<void> {
  const port = options.port || 3000;
  const backendPort = options.backendPort || 3001;

  console.log('🚀 Launching RAG-lite TS UI...');

  // Resolve UI paths from project root
  const projectRoot = getProjectRoot();
  const backendPath = join(projectRoot, 'ui', 'backend', 'src', 'index.ts');
  const frontendPath = join(projectRoot, 'ui', 'frontend');
  
  if (!fs.existsSync(backendPath)) {
    console.error(`❌ UI backend not found at: ${backendPath}`);
    console.error('   Make sure the UI is set up in the ui/ directory.');
    process.exit(1);
  }
  
  if (!fs.existsSync(frontendPath)) {
    console.error(`❌ UI frontend not found at: ${frontendPath}`);
    console.error('   Make sure the UI is set up in the ui/ directory.');
    process.exit(1);
  }
  
  // Pass the working directory where 'raglite ui' was called to the backend
  // This ensures the backend uses the correct paths for db.sqlite and vector-index.bin
  const workingDir = process.cwd();
  
  console.log(`📡 Starting backend on port ${backendPort}...`);
  
  // Start backend server
  const backendProcess = spawn('npx', ['tsx', backendPath], {
    stdio: 'pipe',
    env: { 
      ...process.env, 
      PORT: backendPort.toString(),
      RAG_WORKING_DIR: workingDir
    },
    shell: true
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Failed to start backend process:', err);
    process.exit(1);
  });

  // Forward backend output with prefix
  backendProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[Backend] ${data}`);
  });
  backendProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[Backend] ${data}`);
  });

  console.log(`🎨 Starting frontend on port ${port}...`);
  
  // Start frontend dev server
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: frontendPath,
    stdio: 'pipe',
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${backendPort}`
    },
    shell: true
  });

  frontendProcess.on('error', (err) => {
    console.error('❌ Failed to start frontend process:', err);
    backendProcess.kill();
    process.exit(1);
  });

  // Forward frontend output with prefix
  frontendProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[Frontend] ${data}`);
  });
  frontendProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[Frontend] ${data}`);
  });

  // Wait a bit for servers to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n✨ UI Access:`);
  console.log(`   Frontend: http://localhost:${port}`);
  console.log(`   Backend:  http://localhost:${backendPort}`);
  console.log(`\n💡 Press Ctrl+C to stop both servers\n`);
  
  // Keep the process alive and handle cleanup
  return new Promise((resolve) => {
    const cleanup = () => {
      console.log('\n🛑 Shutting down servers...');
      backendProcess.kill();
      frontendProcess.kill();
      resolve();
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Handle process exits
    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`\n❌ Backend process exited with code ${code}`);
        frontendProcess.kill();
        resolve();
      }
    });
    
    frontendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`\n❌ Frontend process exited with code ${code}`);
        backendProcess.kill();
        resolve();
      }
    });
  });
}
