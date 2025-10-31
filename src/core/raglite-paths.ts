/**
 * RAG-lite Path Management
 * 
 * Manages the standardized .raglite directory structure as specified in the design:
 * .raglite/
 * ├── db.sqlite                    # Database
 * ├── index.bin                    # Vector index
 * └── content/                     # Content directory
 */

import { join, resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * RAG-lite directory structure configuration
 */
export interface RagLiteConfig {
    /** Base directory for RAG-lite files (default: current working directory) */
    baseDir?: string;
    /** Custom database filename (default: 'db.sqlite') */
    dbFilename?: string;
    /** Custom index filename (default: 'index.bin') */
    indexFilename?: string;
    /** Custom content directory name (default: 'content') */
    contentDirname?: string;
}

/**
 * Resolved RAG-lite paths
 */
export interface RagLitePaths {
    /** Base .raglite directory */
    ragliteDir: string;
    /** Database file path */
    dbPath: string;
    /** Vector index file path */
    indexPath: string;
    /** Content directory path */
    contentDir: string;
}

/**
 * Resolves and creates the standardized .raglite directory structure
 * 
 * @param config - Configuration for RAG-lite paths
 * @returns Resolved paths for all RAG-lite components
 * 
 * @example
 * ```typescript
 * // Use default structure in current directory
 * const paths = resolveRagLitePaths();
 * // Results in:
 * // .raglite/db.sqlite
 * // .raglite/index.bin
 * // .raglite/content/
 * 
 * // Use custom base directory
 * const paths = resolveRagLitePaths({ baseDir: './my-project' });
 * // Results in:
 * // my-project/.raglite/db.sqlite
 * // my-project/.raglite/index.bin
 * // my-project/.raglite/content/
 * ```
 */
export function resolveRagLitePaths(config: RagLiteConfig = {}): RagLitePaths {
    const {
        baseDir = process.cwd(),
        dbFilename = 'db.sqlite',
        indexFilename = 'index.bin',
        contentDirname = 'content'
    } = config;

    // Resolve base directory to absolute path
    const absoluteBaseDir = resolve(baseDir);

    // Create .raglite directory structure
    const ragliteDir = join(absoluteBaseDir, '.raglite');
    const dbPath = join(ragliteDir, dbFilename);
    const indexPath = join(ragliteDir, indexFilename);
    const contentDir = join(ragliteDir, contentDirname);

    return {
        ragliteDir,
        dbPath,
        indexPath,
        contentDir
    };
}

/**
 * Ensures the .raglite directory structure exists
 * 
 * @param paths - RAG-lite paths to create
 * @throws {Error} If directory creation fails
 */
export function ensureRagLiteStructure(paths: RagLitePaths): void {
    try {
        // Create .raglite directory
        if (!existsSync(paths.ragliteDir)) {
            mkdirSync(paths.ragliteDir, { recursive: true });
        }

        // Create content directory
        if (!existsSync(paths.contentDir)) {
            mkdirSync(paths.contentDir, { recursive: true });
        }
    } catch (error) {
        throw new Error(`Failed to create .raglite directory structure: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Migrates from user-specified paths to standardized .raglite structure
 * 
 * This function helps transition from the current approach where users specify
 * arbitrary paths to the standardized .raglite structure.
 * 
 * @param userDbPath - User-specified database path
 * @param userIndexPath - User-specified index path
 * @param config - Configuration for the target .raglite structure
 * @returns Resolved .raglite paths and migration info
 * 
 * @example
 * ```typescript
 * // Migrate from user paths to .raglite structure
 * const migration = migrateToRagLiteStructure('./my-db.sqlite', './my-index.bin');
 * 
 * console.log('Target paths:', migration.paths);
 * console.log('Migration needed:', migration.needsMigration);
 * 
 * if (migration.needsMigration) {
 *   console.log('Files will be moved from:');
 *   console.log('  DB:', migration.sourceDbPath, '->', migration.paths.dbPath);
 *   console.log('  Index:', migration.sourceIndexPath, '->', migration.paths.indexPath);
 * }
 * ```
 */
export function migrateToRagLiteStructure(
    userDbPath: string,
    userIndexPath: string,
    config: RagLiteConfig = {}
): {
    paths: RagLitePaths;
    needsMigration: boolean;
    sourceDbPath: string;
    sourceIndexPath: string;
} {
    // Determine base directory from user paths
    const dbDir = dirname(resolve(userDbPath));
    const indexDir = dirname(resolve(userIndexPath));

    // Use the directory containing the database as the base directory
    // This preserves the user's intended project location
    const baseDir = config.baseDir || dbDir;

    // Resolve target .raglite paths
    const paths = resolveRagLitePaths({ ...config, baseDir });

    // Check if migration is needed
    const resolvedUserDbPath = resolve(userDbPath);
    const resolvedUserIndexPath = resolve(userIndexPath);

    const needsMigration = (
        resolvedUserDbPath !== paths.dbPath ||
        resolvedUserIndexPath !== paths.indexPath
    );

    return {
        paths,
        needsMigration,
        sourceDbPath: resolvedUserDbPath,
        sourceIndexPath: resolvedUserIndexPath
    };
}

/**
 * Gets the standardized .raglite paths for a given project directory
 * 
 * This is the recommended way to get RAG-lite paths for new projects.
 * 
 * @param projectDir - Project directory (default: current working directory)
 * @returns Standardized RAG-lite paths
 * 
 * @example
 * ```typescript
 * // For current directory
 * const paths = getStandardRagLitePaths();
 * 
 * // For specific project
 * const paths = getStandardRagLitePaths('./my-project');
 * 
 * // Use with factories
 * const search = await SearchFactory.create(paths.indexPath, paths.dbPath);
 * const ingestion = await IngestionFactory.create(paths.dbPath, paths.indexPath);
 * ```
 */
export function getStandardRagLitePaths(projectDir: string = process.cwd()): RagLitePaths {
    const paths = resolveRagLitePaths({ baseDir: projectDir });
    ensureRagLiteStructure(paths);
    return paths;
}