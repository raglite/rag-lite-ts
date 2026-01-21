import { Router } from 'express';
import multer from 'multer';
import { ingestController } from '../controllers/ingestController.js';

const router = Router();

// Configure multer for memory storage (no temp files needed)
// Files are kept in memory as Buffers and passed directly to ingestFromMemory
// Limit: 100MB per file (reasonable for document ingestion)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB per file
  }
});

// Routes

// ISSUE #5 FIX: Pre-flight check for force rebuild
// Call this endpoint before starting ingestion with forceRebuild=true
// to verify that database and index files can be deleted
router.get('/preflight/force-rebuild', ingestController.checkForceRebuildPreflight);

router.post('/files', upload.array('files'), ingestController.handleFileUpload);
router.post('/directory', ingestController.handleDirectoryIngest);
router.get('/progress/:sessionId', ingestController.getProgress);

export default router;
