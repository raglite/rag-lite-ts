import { Request, Response } from 'express';
import { SystemService } from '../services/systemService.js';

export const systemController = {
  async getStats(req: Request, res: Response) {
    try {
      const stats = await SystemService.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to fetch stats',
        message: error.message
      });
    }
  }
};
