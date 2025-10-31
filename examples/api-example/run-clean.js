#!/usr/bin/env node

/**
 * Clean run script - removes existing database and index files before running the example
 */

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

async function cleanAndRun() {
    console.log('🧹 Cleaning up existing files...');
    
    // Remove all example database and index files
    const filesToRemove = [
        // Main example files
        'db.sqlite', 'vector-index.bin',
        // Factory example files
        'factory-db.sqlite', 'factory-index.bin',
        // Simple API example files
        'simple-db.sqlite', 'simple-index.bin',
        // Content system example files
        'content-db.sqlite', 'content-index.bin',
        // RAG factory example files
        'rag-db.sqlite', 'rag-index.bin'
    ];
    
    for (const file of filesToRemove) {
        if (existsSync(file)) {
            await unlink(file);
            console.log(`   Removed ${file}`);
        }
    }
    
    console.log('✅ Cleanup complete!\n');
    
    // Run the main example
    console.log('🚀 Starting fresh example run...\n');
    
    const child = spawn('node', ['index.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    child.on('close', (code) => {
        process.exit(code);
    });
}

cleanAndRun().catch(console.error);