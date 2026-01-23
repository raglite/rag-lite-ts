import { create } from 'zustand';

export interface SearchResult {
  id: string;
  score: number;
  document: {
    title: string;
    source: string;
    contentType: 'text' | 'image';
  };
  content: string;
  metadata?: Record<string, any>;
}

// Generation result from AI response generation (experimental)
export interface GenerationResult {
  response: string;
  modelUsed: string;
  tokensUsed: number;
  truncated: boolean;
  chunksUsedForContext: number;
  generationTimeMs: number;
}

// Available generator models
export const GENERATOR_MODELS = [
  { 
    value: 'HuggingFaceTB/SmolLM2-135M-Instruct', 
    label: 'SmolLM2-135M (Balanced)', 
    description: 'Recommended default, uses top 3 chunks',
    defaultChunks: 3 
  },
  { 
    value: 'HuggingFaceTB/SmolLM2-360M-Instruct', 
    label: 'SmolLM2-360M (Higher Quality)', 
    description: 'Better quality, slower, uses top 5 chunks',
    defaultChunks: 5 
  }
] as const;

interface SearchState {
  query: string;
  imageFile: File | null;
  searchMode: 'text' | 'image';
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  topK: number;
  rerank: boolean;
  rerankingAvailable: boolean | null;
  contentType: 'all' | 'text' | 'image';
  dbPath: string | null;
  indexPath: string | null;
  
  // Generation state (experimental)
  generateResponse: boolean;
  generatorModel: string;
  maxChunksForContext: number | null;
  generationResult: GenerationResult | null;
  isGenerating: boolean;
  
  setQuery: (query: string) => void;
  setImageFile: (file: File | null) => void;
  setSearchMode: (mode: 'text' | 'image') => void;
  setResults: (results: SearchResult[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setTopK: (topK: number) => void;
  setRerank: (rerank: boolean) => void;
  setRerankingAvailable: (available: boolean | null) => void;
  setContentType: (contentType: 'all' | 'text' | 'image') => void;
  setDbPath: (dbPath: string | null) => void;
  setIndexPath: (indexPath: string | null) => void;
  
  // Generation setters (experimental)
  setGenerateResponse: (generate: boolean) => void;
  setGeneratorModel: (model: string) => void;
  setMaxChunksForContext: (chunks: number | null) => void;
  setGenerationResult: (result: GenerationResult | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  imageFile: null,
  searchMode: 'text',
  results: [],
  isLoading: false,
  error: null,
  topK: 10,
  rerank: false,
  rerankingAvailable: null,
  contentType: 'all',
  dbPath: null,
  indexPath: null,
  
  // Generation state (experimental)
  generateResponse: false,
  generatorModel: 'HuggingFaceTB/SmolLM2-135M-Instruct',
  maxChunksForContext: null, // null = use model default
  generationResult: null,
  isGenerating: false,

  setQuery: (query) => set({ query }),
  setImageFile: (imageFile) => set({ imageFile }),
  setSearchMode: (searchMode) => set({ searchMode }),
  setResults: (results) => set({ results }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setTopK: (topK) => set({ topK }),
  setRerank: (rerank) => set({ rerank }),
  setRerankingAvailable: (rerankingAvailable) => set({ rerankingAvailable }),
  setContentType: (contentType) => set({ contentType }),
  setDbPath: (dbPath) => set({ dbPath }),
  setIndexPath: (indexPath) => set({ indexPath }),
  
  // Generation setters (experimental)
  setGenerateResponse: (generateResponse) => set({ generateResponse }),
  setGeneratorModel: (generatorModel) => set({ generatorModel }),
  setMaxChunksForContext: (maxChunksForContext) => set({ maxChunksForContext }),
  setGenerationResult: (generationResult) => set({ generationResult }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  
  reset: () => set({ 
    query: '', 
    imageFile: null, 
    searchMode: 'text', 
    results: [], 
    error: null, 
    isLoading: false, 
    rerankingAvailable: null,
    generationResult: null,
    isGenerating: false
  }),
}));
