import { Request, Response } from 'express';
import { SearchService } from '../services/searchService.js';

export const searchController = {
  async performSearch(req: Request, res: Response) {
    try {
      // Check if this is an image search (multipart/form-data) or text search (JSON)
      const imageFile = req.file;
      const isImageSearch = !!imageFile;

      if (isImageSearch) {
        // Image search: extract options from form data
        const { topK, rerank, contentType, dbPath, indexPath } = req.body;
        
        console.log(`Image Search Request: "${imageFile.originalname}" (topK: ${topK}, rerank: ${rerank}, dbPath: ${dbPath || 'default'}, indexPath: ${indexPath || 'default'})`);
        
        const searchResult = await SearchService.searchImage(imageFile, {
          topK: topK ? parseInt(topK.toString()) : 10,
          rerank: rerank === true || rerank === 'true',
          contentType: contentType || 'all',
          dbPath: dbPath || undefined,
          indexPath: indexPath || undefined
        });

        res.json(searchResult);
      } else {
        // Text search: extract from JSON body
        const { query, topK, rerank, contentType, dbPath, indexPath } = req.body;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Query parameter is required and must be a string'
          });
        }

        console.log(`Text Search Request: "${query}" (topK: ${topK}, rerank: ${rerank}, dbPath: ${dbPath || 'default'}, indexPath: ${indexPath || 'default'})`);
        
        const searchResult = await SearchService.search(query, {
          topK: topK ? parseInt(topK.toString()) : 10,
          rerank: rerank === true || rerank === 'true',
          contentType: contentType || 'all',
          dbPath: dbPath || undefined,
          indexPath: indexPath || undefined
        });

        res.json(searchResult);
      }
    } catch (error: any) {
      console.error('Search Error:', error);
      res.status(500).json({
        error: 'Search Failed',
        message: error.message
      });
    }
  }
};
