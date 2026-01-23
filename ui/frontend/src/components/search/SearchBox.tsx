import { useState, useRef } from 'react';
import { Search, Loader2, SlidersHorizontal, Database, Folder, Image as ImageIcon, X, Type, Sparkles, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSearchStore, GENERATOR_MODELS } from '@/stores/searchStore';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export function SearchBox() {
  const { 
    query, setQuery,
    imageFile, setImageFile,
    searchMode, setSearchMode,
    setResults, setLoading, 
    setError, isLoading,
    topK, rerank, setRerank,
    rerankingAvailable, setRerankingAvailable,
    contentType,
    dbPath, indexPath, setDbPath, setIndexPath,
    // Generation state (experimental)
    generateResponse, setGenerateResponse,
    generatorModel, setGeneratorModel,
    maxChunksForContext, setMaxChunksForContext,
    setGenerationResult, setIsGenerating
  } = useSearchStore();
  const [showOptions, setShowOptions] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image file
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setImageFile(file);
      setSearchMode('image');
      // Disable generation for image search
      setGenerateResponse(false);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setSearchMode('text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (searchMode === 'text' && !query.trim()) return;
    if (searchMode === 'image' && !imageFile) return;

    setLoading(true);
    setError(null);
    setGenerationResult(null);
    
    if (generateResponse && searchMode === 'text') {
      setIsGenerating(true);
    }

    try {
      let response: Response;
      
      if (searchMode === 'image' && imageFile) {
        // Image search: send as multipart/form-data
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('topK', topK.toString());
        formData.append('rerank', rerank.toString());
        formData.append('contentType', contentType);
        if (dbPath) formData.append('dbPath', dbPath);
        if (indexPath) formData.append('indexPath', indexPath);

        response = await fetch('/api/search', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Text search: send as JSON
        const requestBody: any = { 
          query, 
          topK, 
          rerank: generateResponse ? true : rerank,  // Force rerank if generating
          contentType,
          dbPath: dbPath || undefined,
          indexPath: indexPath || undefined
        };

        // Add generation options if enabled (experimental)
        if (generateResponse) {
          requestBody.generateResponse = true;
          requestBody.generatorModel = generatorModel;
          if (maxChunksForContext !== null) {
            requestBody.maxChunksForContext = maxChunksForContext;
          }
        }

        response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(errorData.message || 'Search failed. Make sure the backend is running.');
      }

      const data = await response.json();
      setResults(data.results);
      
      // Set generation result if available (experimental)
      if (data.generation) {
        setGenerationResult(data.generation);
      }
      
      // Update reranking availability from search results
      if (data.stats) {
        setRerankingAvailable(data.stats.rerankingEnabled || false);
        
        // Show warning if user enabled reranking but it's not available
        if (rerank && !data.stats.rerankingEnabled && searchMode === 'text' && !generateResponse) {
          setError('Reranking was enabled but is not available. It may have been disabled during ingestion.');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  // Get selected model info
  const selectedModelInfo = GENERATOR_MODELS.find(m => m.value === generatorModel);

  return (
    <div className="w-full space-y-4">
      {/* Search Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={searchMode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setSearchMode('text');
            setImageFile(null);
            setImagePreview(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          className="flex items-center gap-2"
        >
          <Type className="h-4 w-4" />
          Text Search
        </Button>
        <Button
          type="button"
          variant={searchMode === 'image' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setSearchMode('image');
            setQuery('');
            setGenerateResponse(false); // Disable generation for image search
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-2"
        >
          <ImageIcon className="h-4 w-4" />
          Image Search
        </Button>
      </div>

      <form onSubmit={handleSearch} className="relative flex gap-2">
        {searchMode === 'text' ? (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your documents semantically..."
              className="pl-10 h-12 text-lg shadow-sm"
            />
          </div>
        ) : (
          <div className="relative flex-1 border-2 border-dashed rounded-lg p-4 min-h-[120px] flex items-center justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-h-32 max-w-full object-contain rounded"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to select an image
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Image
                </Button>
              </div>
            )}
          </div>
        )}
        <Button 
          type="submit" 
          size="lg" 
          className="h-12 px-8"
          disabled={isLoading || (searchMode === 'text' && !query.trim()) || (searchMode === 'image' && !imageFile)}
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

          {/* AI Response Generation Section (Experimental) - Text mode only */}
          {searchMode === 'text' && (
            <div className="p-4 border rounded-lg bg-gradient-to-br from-primary/5 to-transparent space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium">AI Response Generation</label>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    EXPERIMENTAL
                  </Badge>
                </div>
                <Switch 
                  checked={generateResponse}
                  onCheckedChange={(checked) => {
                    setGenerateResponse(checked);
                    // If enabling generation, enable reranking (required)
                    if (checked) {
                      setRerank(true);
                    }
                  }}
                />
              </div>
              
              {generateResponse && (
                <div className="space-y-4 pt-2 border-t border-primary/10">
                  <p className="text-xs text-muted-foreground">
                    Generate an AI response based on search results. Reranking is automatically enabled.
                  </p>
                  
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      Generator Model
                    </Label>
                    <div className="grid gap-2">
                      {GENERATOR_MODELS.map((model) => (
                        <button
                          key={model.value}
                          type="button"
                          onClick={() => {
                            setGeneratorModel(model.value);
                            setMaxChunksForContext(null); // Reset to model default
                          }}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            generatorModel === model.value 
                              ? 'border-primary bg-primary/5' 
                              : 'border-muted hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{model.label}</span>
                            {model.value === 'HuggingFaceTB/SmolLM2-135M-Instruct' && (
                              <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{model.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Max Chunks Override */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Max Chunks for Context: {maxChunksForContext || selectedModelInfo?.defaultChunks || 3}
                    </Label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={maxChunksForContext || selectedModelInfo?.defaultChunks || 3}
                      onChange={(e) => setMaxChunksForContext(parseInt(e.target.value))}
                      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Number of top-ranked chunks to include in AI context
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Options */}
          <div className="p-4 border rounded-lg bg-card/50 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <label className="text-sm font-medium">Reranking</label>
                <p className="text-xs text-muted-foreground">
                  {searchMode === 'image' 
                    ? 'Disabled for image search' 
                    : generateResponse
                      ? 'Enabled (required for generation)'
                      : rerankingAvailable === false 
                        ? 'Not available (disabled during ingestion)'
                        : 'Improve search quality'}
                </p>
                {searchMode === 'image' && (
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    Image search uses CLIP embeddings for direct visual matching
                  </p>
                )}
                {searchMode === 'text' && rerankingAvailable === false && rerank && !generateResponse && (
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    Reranking was disabled during ingestion. Re-ingest with reranking enabled to use this feature.
                  </p>
                )}
              </div>
              <Switch 
                checked={(rerank && searchMode === 'text') || generateResponse}
                onCheckedChange={(checked) => {
                  if (searchMode === 'text' && !generateResponse) {
                    setRerank(checked);
                  }
                }}
                disabled={searchMode === 'image' || rerankingAvailable === false || generateResponse}
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
