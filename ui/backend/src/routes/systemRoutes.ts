import { Router } from 'express';
import { systemController } from '../controllers/systemController.js';

const router = Router();

router.get('/stats', systemController.getStats);

export default router;
