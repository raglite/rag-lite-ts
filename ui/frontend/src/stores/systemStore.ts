import { create } from 'zustand';

export interface SystemStats {
  mode: string;
  totalChunks: number;
  rerankingEnabled: boolean;
  dbSize: string;
  indexSize: string;
  dbPath: string;
  indexPath: string;
  error?: string;
}

interface SystemState {
  stats: SystemStats | null;
  isLoading: boolean;
  error: string | null;
  
  setStats: (stats: SystemStats | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  fetchStats: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/system/stats');
      if (!response.ok) throw new Error('Failed to fetch system stats');
      const data = await response.json();
      set({ stats: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  }
}));
