#!/usr/bin/env node

/**
 * Clean run script - removes existing database and index files before running the example
 */

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

async function cleanAndRun() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const docsDir = join(__dirname, 'example-docs');

    console.log('🧹 Cleaning up existing files...');

    // Remove existing files if they exist
    const filesToRemove = [
        join(docsDir, 'db.sqlite'),
        join(docsDir, 'vector-index.bin')
    ];

    for (const file of filesToRemove) {
        if (existsSync(file)) {
            await unlink(file);
            console.log(`   Removed ${file}`);
        }
    }

    console.log('✅ Cleanup complete!\n');

    // Run the main example
    console.log('🚀 Starting fresh PDF/DOCX example run...\n');

    const child = spawn('node', ['pdf-docx-example.js'], {
        stdio: 'inherit',
        shell: true
    });

    child.on('close', (code) => {
        process.exit(code);
    });
}

cleanAndRun().catch(console.error);