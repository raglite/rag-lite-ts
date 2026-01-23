import { Router } from 'express';
import multer from 'multer';
import { searchController } from '../controllers/searchController.js';

const router = Router();

// Configure multer for memory storage (for image uploads)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Handle both JSON (text search) and multipart/form-data (image search)
router.post('/', upload.single('image'), searchController.performSearch);

export default router;
