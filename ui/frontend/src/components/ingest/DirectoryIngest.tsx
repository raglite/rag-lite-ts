import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIngestStore } from '@/stores/ingestStore';

export function DirectoryIngest() {
  const [path, setPath] = useState('');
  const { 
    isIngesting, mode, model, setIngesting, setProgress,
    chunkSize, chunkOverlap, pathStorageStrategy, baseDirectory,
    forceRebuild,
    mdxProcessing, mermaidExtraction
  } = useIngestStore();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Poll for progress updates
  useEffect(() => {
    if (!isIngesting || !sessionId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/ingest/progress/${sessionId}`);
        if (!response.ok) {
          // If 404, session might not exist yet, keep trying
          if (response.status === 404) return;
          return;
        }

        const progressData = await response.json();
        setProgress({
          ...progressData,
          status: progressData.status || 'processing'
        });

        // Stop polling if completed or error
        if (progressData.status === 'completed' || progressData.status === 'error') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIngesting(false);
        }
      } catch (err) {
        // Ignore polling errors
      }
    };

    // Poll every 200ms for real-time updates
    pollingIntervalRef.current = setInterval(pollProgress, 200);
    
    // Poll immediately once
    pollProgress();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isIngesting, sessionId, setProgress, setIngesting]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;

    setIngesting(true);
    setProgress({ status: 'processing', documentsProcessed: 0, chunksCreated: 0, embeddingsGenerated: 0 });
    setSessionId(null);

    try {
      const response = await fetch('/api/ingest/directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path, 
          mode, 
          model,
          chunkSize,
          chunkOverlap,
          pathStorageStrategy,
          baseDirectory,
          forceRebuild,
          mdxProcessing,
          mermaidExtraction
        }),
      });

      if (!response.ok) {
        throw new Error('Directory ingestion failed');
      }

      const result = await response.json();
      
      // Store session ID for progress polling
      if (result.sessionId) {
        setSessionId(result.sessionId);
      } else {
        // If no session ID (old API), just mark as completed
        setProgress({ ...result, status: 'completed' });
        setIngesting(false);
      }
    } catch (err: any) {
      setProgress({ status: 'error', error: err.message });
      setIngesting(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  };

  return (
    <div className="p-6 border rounded-2xl bg-card shadow-sm">
      <form onSubmit={handleIngest} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="path">Directory Path</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g. C:\Users\Docs or ./data"
                className="pl-10"
                disabled={isIngesting}
              />
            </div>
            <Button type="submit" disabled={isIngesting || !path.trim()} className="gap-2">
              {isIngesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ingest Path
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            The path must be accessible by the server process.
          </p>
        </div>
      </form>
    </div>
  );
}
