#!/usr/bin/env node

/**
 * Clean and run script - removes existing .raglite directory and then runs the example
 * For cleanup only, use: npm run clean
 */

import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveRagLitePaths } from 'rag-lite-ts';

async function cleanAndRun() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    console.log('🧹 Cleaning up existing .raglite directory...');

    // Get standardized .raglite paths
    const ragLitePaths = resolveRagLitePaths({ baseDir: __dirname });

    // Remove entire .raglite directory if it exists
    if (existsSync(ragLitePaths.ragliteDir)) {
        await rm(ragLitePaths.ragliteDir, { recursive: true, force: true });
        console.log(`   Removed .raglite directory: ${ragLitePaths.ragliteDir}`);
    } else {
        console.log('   No .raglite directory found - starting fresh');
    }

    console.log('✅ Cleanup complete!\n');

    // Run the main example
    console.log('🚀 Starting fresh unified content system example...\n');

    const child = spawn('node', ['pdf-docx-example.js'], {
        stdio: 'inherit',
        shell: true
    });

    child.on('close', (code) => {
        process.exit(code);
    });
}

cleanAndRun().catch(console.error);