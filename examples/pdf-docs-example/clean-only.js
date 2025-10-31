#!/usr/bin/env node

/**
 * Clean only script - removes existing .raglite directory without running the example
 */

import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveRagLitePaths } from 'rag-lite-ts';

async function cleanOnly() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    console.log('🧹 Cleaning up existing .raglite directory...');

    try {
        // Get standardized .raglite paths
        const ragLitePaths = resolveRagLitePaths({ baseDir: __dirname });

        // Remove entire .raglite directory if it exists
        if (existsSync(ragLitePaths.ragliteDir)) {
            await rm(ragLitePaths.ragliteDir, { recursive: true, force: true });
            console.log(`   Removed .raglite directory: ${ragLitePaths.ragliteDir}`);
        } else {
            console.log('   No .raglite directory found - already clean');
        }

        console.log('✅ Cleanup complete!');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    }
}

cleanOnly().catch(console.error);