import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, ChildProcess } from 'child_process';
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
  const backendBuiltPath = join(projectRoot, 'ui', 'backend', 'dist', 'index.js');
  const backendSourcePath = join(projectRoot, 'ui', 'backend', 'src', 'index.ts');
  const frontendBuiltPath = join(projectRoot, 'ui', 'frontend', 'dist');
  const frontendSourcePath = join(projectRoot, 'ui', 'frontend');
  
  // Check if built files exist
  const useBuiltBackend = fs.existsSync(backendBuiltPath);
  const useBuiltFrontend = fs.existsSync(frontendBuiltPath);
  
  if (!useBuiltBackend && !fs.existsSync(backendSourcePath)) {
    console.error(`❌ UI backend not found at: ${backendSourcePath}`);
    console.error('   Make sure the UI is set up in the ui/ directory.');
    process.exit(1);
  }
  
  if (!useBuiltFrontend && !fs.existsSync(frontendSourcePath)) {
    console.error(`❌ UI frontend not found at: ${frontendSourcePath}`);
    console.error('   Make sure the UI is set up in the ui/ directory.');
    process.exit(1);
  }
  
  // Pass the working directory where 'raglite ui' was called to the backend
  const workingDir = process.cwd();
  // Built mode: single server on port (UI + API). Dev mode: backend on backendPort, frontend on port.
  const effectiveBackendPort = useBuiltFrontend ? port : backendPort;
  
  console.log(`📡 Starting backend on port ${effectiveBackendPort}...`);
  
  // Start backend server - use built version if available
  const backendCommand = useBuiltBackend ? 'node' : 'npx';
  const backendArgs = useBuiltBackend 
    ? [backendBuiltPath]
    : ['tsx', backendSourcePath];
  
  const backendProcess = spawn(backendCommand, backendArgs, {
    stdio: 'pipe',
    env: { 
      ...process.env, 
      PORT: effectiveBackendPort.toString(),
      RAG_WORKING_DIR: workingDir,
      UI_FRONTEND_DIST: useBuiltFrontend ? frontendBuiltPath : undefined
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

  // Only start frontend dev server if built version doesn't exist
  let frontendProcess: ChildProcess | null = null;
  
  if (!useBuiltFrontend) {
    console.log(`🎨 Starting frontend dev server on port ${port}...`);
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendSourcePath,
      stdio: 'pipe',
      env: {
        ...process.env,
        VITE_API_URL: `http://localhost:${effectiveBackendPort}`
      },
      shell: true
    });

    frontendProcess.on('error', (err: Error) => {
      console.error('❌ Failed to start frontend process:', err);
      backendProcess.kill();
      process.exit(1);
    });

    // Forward frontend output with prefix
    frontendProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[Frontend] ${data}`);
    });
    frontendProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[Frontend] ${data}`);
    });
  } else {
    console.log(`🎨 Using built frontend from ${frontendBuiltPath}`);
    console.log(`   Frontend will be served by backend on port ${effectiveBackendPort}`);
  }

  // Wait a bit for servers to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n✨ UI Access:`);
  if (useBuiltFrontend) {
    console.log(`   Frontend & Backend: http://localhost:${port}`);
  } else {
    console.log(`   Frontend: http://localhost:${port}`);
    console.log(`   Backend:  http://localhost:${effectiveBackendPort}`);
  }
  console.log(`\n💡 Press Ctrl+C to stop both servers\n`);
  
  // Keep the process alive and handle cleanup
  return new Promise((resolve) => {
    const cleanup = () => {
      console.log('\n🛑 Shutting down servers...');
      backendProcess.kill();
      if (frontendProcess) {
        frontendProcess.kill();
      }
      resolve();
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Handle process exits
    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`\n❌ Backend process exited with code ${code}`);
        if (frontendProcess) {
          frontendProcess.kill();
        }
        resolve();
      }
    });
    
    if (frontendProcess) {
      frontendProcess.on('exit', (code: number | null) => {
        if (code !== 0 && code !== null) {
          console.error(`\n❌ Frontend process exited with code ${code}`);
          backendProcess.kill();
          resolve();
        }
      });
    }
  });
}
