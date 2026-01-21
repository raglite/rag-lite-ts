import { Request, Response } from 'express';
import { SearchService } from '../services/searchService.js';

export const searchController = {
  async performSearch(req: Request, res: Response) {
    try {
      const { query, topK, rerank, contentType, dbPath, indexPath } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter is required and must be a string'
        });
      }

      console.log(`Search Request: "${query}" (topK: ${topK}, rerank: ${rerank}, dbPath: ${dbPath || 'default'}, indexPath: ${indexPath || 'default'})`);
      
      const searchResult = await SearchService.search(query, {
        topK: topK ? parseInt(topK.toString()) : 10,
        rerank: rerank === true || rerank === 'true',
        contentType: contentType || 'all',
        dbPath: dbPath || undefined,
        indexPath: indexPath || undefined
      });

      res.json(searchResult);
    } catch (error: any) {
      console.error('Search Error:', error);
      res.status(500).json({
        error: 'Search Failed',
        message: error.message
      });
    }
  }
};
