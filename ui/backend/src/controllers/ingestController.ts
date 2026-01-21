import { Request, Response } from 'express';
import { IngestService } from '../services/ingestService.js';
import path from 'path';
import fs from 'fs/promises';

export const ingestController = {
  /**
   * ISSUE #5 FIX: Pre-flight check endpoint for force rebuild
   * Call this before starting ingestion with forceRebuild=true to verify
   * that database and index files can be deleted.
   */
  async checkForceRebuildPreflight(req: Request, res: Response) {
    try {
      const result = await IngestService.checkForceRebuildPreflight();
      
      // Return appropriate status code based on result
      if (result.canProceed) {
        res.json({
          success: true,
          ...result
        });
      } else {
        // Return 409 Conflict if files are locked
        res.status(409).json({
          success: false,
          ...result
        });
      }
    } catch (error: any) {
      console.error('Pre-flight check error:', error);
      res.status(500).json({
        success: false,
        canProceed: false,
        errors: [error.message],
        warnings: [],
        filesChecked: []
      });
    }
  },

  async handleFileUpload(req: Request, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      const { 
        mode, model,
        chunkSize, chunkOverlap,
        pathStorageStrategy, baseDirectory,
        forceRebuild,
        mdxProcessing, mermaidExtraction
      } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No files uploaded'
        });
      }

      console.log(`Ingestion Request: ${files.length} files (mode: ${mode})`);
      
      // Parse file paths if provided (for folder uploads with webkitRelativePath)
      let filePaths: Record<string, string> = {};
      if (req.body.filePaths) {
        try {
          filePaths = typeof req.body.filePaths === 'string' 
            ? JSON.parse(req.body.filePaths) 
            : req.body.filePaths;
        } catch (e) {
          console.warn('Failed to parse filePaths:', e);
        }
      }
      
      // Map files to include buffer (from memory storage) and original name (for storage)
      // For folder uploads, use webkitRelativePath if available (preserves folder structure)
      const fileMappings = files.map((file, index) => {
        // Check if we have a stored path for this file index (from webkitRelativePath)
        const pathKey = `path_${index}`;
        const relativePath = filePaths[pathKey];
        
        // Use webkitRelativePath if available (preserves folder structure), otherwise use originalname
        // originalname from Multer might be sanitized, so we prefer the stored path
        const originalName = relativePath || file.originalname;
        
        // With memoryStorage, file.buffer contains the file data
        if (!file.buffer) {
          throw new Error(`File buffer not available for ${originalName}. File may be too large (max 100MB).`);
        }
        
        return {
          buffer: file.buffer,
          originalName: originalName // Preserve original filename with path structure
        };
      });
      
      // Start ingestion asynchronously and return sessionId immediately
      const sessionId = await IngestService.ingestFiles(fileMappings, {
        mode: mode || 'text',
        model,
        chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap) : undefined,
        pathStorageStrategy: pathStorageStrategy || 'relative',
        baseDirectory: baseDirectory || undefined,
        forceRebuild: forceRebuild === 'true' || forceRebuild === true,
        mdxProcessing: mdxProcessing !== 'false' && mdxProcessing !== false, // Default to true
        mermaidExtraction: mermaidExtraction !== 'false' && mermaidExtraction !== false // Default to true
      });

      // Return sessionId immediately, ingestion continues in background
      res.json({ sessionId, status: 'processing' });

      // Note: Files are kept in memory (multer.memoryStorage) and passed directly to ingestFromMemory
      // No temp files are created, so no cleanup is needed
    } catch (error: any) {
      console.error('Ingestion Error:', error);
      res.status(500).json({
        error: 'Ingestion Failed',
        message: error.message
      });
    }
  },

  async getProgress(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const sessionIdStr: string = Array.isArray(sessionId) ? sessionId[0] : sessionId;
      const progress = IngestService.getProgress(sessionIdStr);
      
      if (!progress) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Progress session not found'
        });
      }

      res.json(progress);
    } catch (error: any) {
      console.error('Progress Error:', error);
      res.status(500).json({
        error: 'Progress Failed',
        message: error.message
      });
    }
  },

  async handleDirectoryIngest(req: Request, res: Response) {
    try {
      const { 
        path: rawDirPath, 
        mode, model,
        chunkSize, chunkOverlap,
        pathStorageStrategy, baseDirectory,
        forceRebuild,
        mdxProcessing, mermaidExtraction
      } = req.body;

      // Handle case where path could be string or string[]
      const dirPath: string = Array.isArray(rawDirPath) ? rawDirPath[0] : rawDirPath;

      if (!dirPath) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Directory path is required'
        });
      }

      console.log(`Directory Ingestion Request: ${dirPath} (mode: ${mode})`);
      
      const sessionId = await IngestService.ingestDirectory(dirPath, {
        mode: mode || 'text',
        model,
        chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap) : undefined,
        pathStorageStrategy: pathStorageStrategy || 'relative',
        baseDirectory: baseDirectory || undefined,
        forceRebuild: forceRebuild === 'true' || forceRebuild === true,
        mdxProcessing: mdxProcessing !== 'false' && mdxProcessing !== false, // Default to true
        mermaidExtraction: mermaidExtraction !== 'false' && mermaidExtraction !== false // Default to true
      });

      // Return sessionId immediately, ingestion continues in background
      res.json({ sessionId, status: 'processing' });
    } catch (error: any) {
      console.error('Directory Ingestion Error:', error);
      res.status(500).json({
        error: 'Ingestion Failed',
        message: error.message
      });
    }
  }
};
