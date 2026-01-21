import { useState } from 'react';
import { Search, Loader2, SlidersHorizontal, Database, Folder } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSearchStore } from '@/stores/searchStore';
import { Switch } from '@/components/ui/switch';

export function SearchBox() {
  const { 
    query, setQuery, 
    setResults, setLoading, 
    setError, isLoading,
    topK, rerank, contentType,
    dbPath, indexPath, setDbPath, setIndexPath
  } = useSearchStore();
  const [showOptions, setShowOptions] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          topK, 
          rerank, 
          contentType,
          dbPath: dbPath || undefined,
          indexPath: indexPath || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed. Make sure the backend is running.');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSearch} className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your documents semantically..."
            className="pl-10 h-12 text-lg shadow-sm"
          />
        </div>
        <Button 
          type="submit" 
          size="lg" 
          className="h-12 px-8"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12"
          onClick={() => setShowOptions(!showOptions)}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      {showOptions && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Path Configuration Section */}
          <div className="p-4 border rounded-lg bg-card/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Path Configuration</label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPaths(!showPaths)}
                className="h-7 text-xs"
              >
                {showPaths ? 'Hide' : 'Show'} Paths
              </Button>
            </div>
            
            {showPaths && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 space-y-3 md:space-y-0">
                <div className="space-y-2">
                  <Label htmlFor="dbPath" className="text-xs text-muted-foreground flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Database Path (optional)
                  </Label>
                  <div className="relative">
                    <Input
                      id="dbPath"
                      value={dbPath || ''}
                      onChange={(e) => setDbPath(e.target.value || null)}
                      placeholder="Leave empty for default (db.sqlite)"
                      className="text-sm font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Custom SQLite database file path
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="indexPath" className="text-xs text-muted-foreground flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    Index Path (optional)
                  </Label>
                  <div className="relative">
                    <Input
                      id="indexPath"
                      value={indexPath || ''}
                      onChange={(e) => setIndexPath(e.target.value || null)}
                      placeholder="Leave empty for default (vector-index.bin)"
                      className="text-sm font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Custom vector index file path
                  </p>
                </div>
              </div>
            )}
            
            {(dbPath || indexPath) && (
              <div className="pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDbPath(null);
                    setIndexPath(null);
                  }}
                  className="w-full text-xs"
                >
                  Reset to Default Paths
                </Button>
              </div>
            )}
          </div>

          {/* Search Options */}
          <div className="p-4 border rounded-lg bg-card/50 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Reranking</label>
                <p className="text-xs text-muted-foreground">Improve search quality</p>
              </div>
              <Switch 
                checked={rerank}
                onCheckedChange={(checked) => useSearchStore.getState().setRerank(checked)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Results Count: {topK}</label>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={topK}
                onChange={(e) => useSearchStore.getState().setTopK(parseInt(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <div className="flex gap-2">
                {['all', 'text', 'image'].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={contentType === type ? 'default' : 'outline'}
                    className="capitalize flex-1"
                    onClick={() => useSearchStore.getState().setContentType(type as any)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
