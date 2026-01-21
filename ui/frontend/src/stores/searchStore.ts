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
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  topK: number;
  rerank: boolean;
  contentType: 'all' | 'text' | 'image';
  dbPath: string | null;
  indexPath: string | null;
  
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setTopK: (topK: number) => void;
  setRerank: (rerank: boolean) => void;
  setContentType: (contentType: 'all' | 'text' | 'image') => void;
  setDbPath: (dbPath: string | null) => void;
  setIndexPath: (indexPath: string | null) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isLoading: false,
  error: null,
  topK: 10,
  rerank: false,
  contentType: 'all',
  dbPath: null,
  indexPath: null,

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setTopK: (topK) => set({ topK }),
  setRerank: (rerank) => set({ rerank }),
  setContentType: (contentType) => set({ contentType }),
  setDbPath: (dbPath) => set({ dbPath }),
  setIndexPath: (indexPath) => set({ indexPath }),
  reset: () => set({ query: '', results: [], error: null, isLoading: false }),
}));
