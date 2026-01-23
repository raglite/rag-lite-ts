import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import searchRoutes from './routes/searchRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files for images - allow access to local files
app.use('/api/files', (req, res, next) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).send('Path is required');
  
  // Basic security check: resolve path and serve
  res.sendFile(path.resolve(filePath), (err) => {
    if (err) next(err);
  });
});

// Basic Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RAG-lite TS Backend is running' });
});

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/system', systemRoutes);

// Serve frontend static files if built version exists
const frontendDistPath = process.env.UI_FRONTEND_DIST || 
  path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // SPA fallback: serve index.html for non-API routes not handled by static
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

export async function startServer(options: { port?: number } = {}) {
  const PORT = options.port || process.env.PORT || 3001;

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 RAG-lite TS UI Backend running at http://localhost:${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health\n`);
      resolve(server);
    });
  });
}

// Only start if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
