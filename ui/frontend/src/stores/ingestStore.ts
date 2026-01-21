import { create } from 'zustand';

export interface IngestionProgress {
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  documentErrors: number;
  embeddingErrors: number;
  processingTimeMs: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  currentFile?: string;
  error?: string;
}

/**
 * Get model-specific chunk configuration defaults
 * Based on src/core/config.ts getModelDefaults function
 */
function getModelChunkDefaults(modelName: string): { chunkSize: number; chunkOverlap: number } {
  const normalizedName = modelName.toLowerCase();
  
  // MPNet models - 768 dimensions, larger chunks
  if (normalizedName.includes('all-mpnet-base-v2')) {
    return { chunkSize: 400, chunkOverlap: 80 };
  }
  
  // MiniLM and other models - default (384 dimensions)
  // Also applies to CLIP models (512 dimensions) with same chunk defaults
  return { chunkSize: 250, chunkOverlap: 50 };
}

interface IngestState {
  progress: IngestionProgress;
  isIngesting: boolean;
  mode: 'text' | 'multimodal';
  model: string;
  
  // Chunk configuration
  chunkSize: number;
  chunkOverlap: number;
  
  // Path options
  pathStorageStrategy: 'relative' | 'absolute';
  baseDirectory: string;
  
  // Index management
  forceRebuild: boolean;
  
  // Preprocessing options
  mdxProcessing: boolean;
  mermaidExtraction: boolean;
  
  setProgress: (progress: Partial<IngestionProgress>) => void;
  setIngesting: (isIngesting: boolean) => void;
  setMode: (mode: 'text' | 'multimodal') => void;
  setModel: (model: string) => void;
  setChunkSize: (size: number) => void;
  setChunkOverlap: (overlap: number) => void;
  setPathStorageStrategy: (strategy: 'relative' | 'absolute') => void;
  setBaseDirectory: (dir: string) => void;
  setForceRebuild: (rebuild: boolean) => void;
  setMdxProcessing: (enabled: boolean) => void;
  setMermaidExtraction: (enabled: boolean) => void;
  reset: () => void;
}

const initialProgress: IngestionProgress = {
  documentsProcessed: 0,
  chunksCreated: 0,
  embeddingsGenerated: 0,
  documentErrors: 0,
  embeddingErrors: 0,
  processingTimeMs: 0,
  status: 'idle',
};

const defaultModel = 'sentence-transformers/all-MiniLM-L6-v2';
const defaultChunks = getModelChunkDefaults(defaultModel);

export const useIngestStore = create<IngestState>((set) => ({
  progress: initialProgress,
  isIngesting: false,
  mode: 'text',
  model: defaultModel,
  
  // Chunk configuration defaults (model-specific)
  chunkSize: defaultChunks.chunkSize,
  chunkOverlap: defaultChunks.chunkOverlap,
  
  // Path options defaults
  pathStorageStrategy: 'relative',
  baseDirectory: '',
  
  // Index management defaults
  forceRebuild: false,
  
  // Preprocessing defaults
  mdxProcessing: true,
  mermaidExtraction: true,

  setProgress: (progress) => 
    set((state) => ({ 
      progress: { ...state.progress, ...progress } 
    })),
  setIngesting: (isIngesting) => set({ isIngesting }),
  setMode: (mode) => {
    // Set default model for the mode
    const defaultModelForMode = mode === 'text' 
      ? 'sentence-transformers/all-MiniLM-L6-v2' 
      : 'Xenova/clip-vit-base-patch32';
    const chunks = getModelChunkDefaults(defaultModelForMode);
    set({ mode, model: defaultModelForMode, chunkSize: chunks.chunkSize, chunkOverlap: chunks.chunkOverlap });
  },
  setModel: (model) => {
    // Update chunk configuration based on model
    const chunks = getModelChunkDefaults(model);
    set({ model, chunkSize: chunks.chunkSize, chunkOverlap: chunks.chunkOverlap });
  },
  setChunkSize: (chunkSize) => {
    set({ chunkSize });
    // Auto-adjust overlap to ~20% of chunk size
    const newOverlap = Math.round(chunkSize * 0.2);
    set({ chunkOverlap: newOverlap });
  },
  setChunkOverlap: (chunkOverlap) => set({ chunkOverlap }),
  setPathStorageStrategy: (pathStorageStrategy) => set({ pathStorageStrategy }),
  setBaseDirectory: (baseDirectory) => set({ baseDirectory }),
  setForceRebuild: (forceRebuild) => set({ forceRebuild }),
  setMdxProcessing: (mdxProcessing) => set({ mdxProcessing }),
  setMermaidExtraction: (mermaidExtraction) => set({ mermaidExtraction }),
  reset: () => set((state) => ({ 
    progress: initialProgress, 
    isIngesting: false 
  })),
}));
