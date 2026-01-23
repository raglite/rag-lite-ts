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

interface SearchState {
  query: string;
  imageFile: File | null;
  searchMode: 'text' | 'image';
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  topK: number;
  rerank: boolean;
  rerankingAvailable: boolean | null; // null = unknown, true/false = from last search
  contentType: 'all' | 'text' | 'image';
  dbPath: string | null;
  indexPath: string | null;
  
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
  reset: () => set({ query: '', imageFile: null, searchMode: 'text', results: [], error: null, isLoading: false, rerankingAvailable: null }),
}));
