import { useState } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { HighlightedText } from './HighlightedText';
import { ResultPreview } from './ResultPreview';

export function SearchResults() {
  const { results, query, isLoading, error } = useSearchStore();
  const [selectedResult, setSelectedResult] = useState<any>(null);

  if (error) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-destructive/50 rounded-xl bg-destructive/5">
        <p className="text-destructive font-medium">Search error</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Found {results.length} results
        </h3>
      </div>
      <div className="grid gap-4">
        {results.map((result, index) => (
          <Card 
            key={result.id || index} 
            className="group overflow-hidden hover:shadow-md transition-all cursor-pointer border-primary/5 hover:border-primary/20"
            onClick={() => setSelectedResult(result)}
          >
            <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                {result.document.contentType === 'image' ? (
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileText className="h-4 w-4 text-emerald-500" />
                )}
                <CardTitle className="text-sm font-semibold truncate max-w-[300px]">
                  {result.document.title}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {(result.score * 100).toFixed(1)}% match
                </Badge>
              </div>
              <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground">
                <Maximize2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[10px] text-muted-foreground mb-3 font-mono truncate max-w-[90%]">
                {result.document.source}
              </p>

              {result.document.contentType === 'image' && (
                <div className="mb-4 rounded-lg overflow-hidden border bg-muted/20 aspect-video flex items-center justify-center">
                  <img 
                    src={`/api/files?path=${encodeURIComponent(result.document.source)}`}
                    alt={result.document.title}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="p-3 rounded bg-muted/30 group-hover:bg-muted/50 transition-colors text-sm leading-relaxed border relative">
                <HighlightedText text={result.content} query={query} />
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-muted/30 group-hover:from-muted/50 to-transparent pointer-events-none" />
              </div>
              {result.metadata && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.metadata).slice(0, 3).map(([key, value]) => (
                    <span key={key} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-muted/20">
                      {key}: {String(value)}
                    </span>
                  ))}
                  {Object.keys(result.metadata).length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 underline">
                      +{Object.keys(result.metadata).length - 3} more
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ResultPreview 
        result={selectedResult} 
        query={query} 
        isOpen={!!selectedResult} 
        onOpenChange={(open) => !open && setSelectedResult(null)} 
      />
    </div>
  );
}
