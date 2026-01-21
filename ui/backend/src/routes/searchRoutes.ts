import { Router } from 'express';
import { searchController } from '../controllers/searchController.js';

const router = Router();

router.post('/', searchController.performSearch);

export default router;
