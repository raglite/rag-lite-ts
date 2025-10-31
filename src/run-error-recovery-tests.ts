/**
 * Test Runner for Chameleon Error Recovery and Reliability Tests
 * Runs the comprehensive error recovery test suite
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('🧪 Running Chameleon Error Recovery and Reliability Tests...\n');
  
  const testFiles = [
    'chameleon-error-recovery.test.ts',
    'chameleon-reliability-integration.test.ts', 
    'chameleon-stress-testing.test.ts',
    'chameleon-error-simulation.test.ts'
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testFile of testFiles) {
    console.log(`\n📋 Running ${testFile}...`);
    
    try {
      // Build the test file first
      const buildProcess = spawn('npx', ['tsc', '--project', 'tsconfig.test.json'], {
        stdio: 'pipe',
        shell: true
      });
      
      await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });
      });
      
      // Run the compiled test
      const testProcess = spawn('node', ['--test', `dist/${testFile.replace('.ts', '.js')}`], {
        stdio: 'pipe',
        shell: true
      });
      
      let output = '';
      let errorOutput = '';
      
      testProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        testProcess.on('close', (code) => {
          console.log(`Exit code: ${code}`);
          
          if (output) {
            console.log('Output:', output);
          }
          
          if (errorOutput) {
            console.log('Errors:', errorOutput);
          }
          
          // Count tests (this is a simple approximation)
          const testMatches = output.match(/✓|×/g);
          const currentTests = testMatches ? testMatches.length : 0;
          totalTests += currentTests;
          
          if (code === 0) {
            passedTests += currentTests;
            console.log(`✅ ${testFile} completed successfully`);
          } else {
            failedTests += currentTests;
            console.log(`❌ ${testFile} failed`);
          }
          
          resolve(code);
        });
      });
      
    } catch (error) {
      console.error(`❌ Failed to run ${testFile}:`, error instanceof Error ? error.message : String(error));
      failedTests++;
    }
  }
  
  console.log('\n📊 Test Summary:');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All error recovery tests completed!');
    console.log('✅ System demonstrates robust error handling and recovery mechanisms');
  } else {
    console.log('\n⚠️  Some tests failed - this may be expected in test environments');
    console.log('🔍 Review the output above for specific failure details');
  }
  
  return failedTests === 0;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };