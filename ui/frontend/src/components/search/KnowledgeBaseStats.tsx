import { useEffect, useState } from 'react';
import { Database, FileText, Scissors, Brain, Calendar, AlertCircle, Loader2, RefreshCw, Folder } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface KnowledgeBaseStats {
  error?: string;
  message?: string;
  mode: string | null;
  totalChunks: number;
  totalDocuments: number;
  rerankingEnabled: boolean;
  modelName: string | null;
  modelDimensions: number | null;
  createdAt: string | null;
  dbSize: string;
  indexSize: string;
  dbPath: string;
  indexPath: string;
  contentTypeDistribution: Array<{ name: string; value: number }>;
}

export function KnowledgeBaseStats() {
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const doFetch = async (retryAttempt = false) => {
      try {
        const response = await fetch('/api/system/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setIsLoading(false);
          setIsRefreshing(false);
          retryCount = 0;
        } else if (!retryAttempt && retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => doFetch(true), 1000 * retryCount);
        } else {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      } catch (error) {
        if (retryCount >= maxRetries) {
          console.error('Failed to fetch stats after retries:', error);
          setIsLoading(false);
          setIsRefreshing(false);
        } else if (!retryAttempt) {
          retryCount++;
          setTimeout(() => doFetch(true), 1000 * retryCount);
        }
      }
    };

    await doFetch();
  };

  useEffect(() => {
    // Wait a bit before first fetch to let backend start
    const initialTimeout = setTimeout(() => {
      fetchStats(false);
    }, 500);
    
    return () => {
      clearTimeout(initialTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <Card className="border-muted/50 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Knowledge Base</p>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.error) {
    return (
      <Card className="border-muted/50 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Knowledge Base</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-500/80">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              {stats?.message || 'Not initialized. Ingest documents to begin.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatModelName = (modelName: string | null) => {
    if (!modelName) return 'Unknown';
    // Extract just the model identifier (e.g., "all-MiniLM-L6-v2" from "sentence-transformers/all-MiniLM-L6-v2")
    const parts = modelName.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : modelName;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="border-muted/50 bg-muted/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Knowledge Base</p>
          </div>
          {!isLoading && stats && !stats.error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="h-7 w-7 p-0"
              title="Refresh stats"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          )}
        </div>
        
        {/* Compact Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3 w-3" />
              <p className="text-[10px] font-medium uppercase">Documents</p>
            </div>
            <p className="text-lg font-semibold">{stats.totalDocuments.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Scissors className="h-3 w-3" />
              <p className="text-[10px] font-medium uppercase">Chunks</p>
            </div>
            <p className="text-lg font-semibold">{stats.totalChunks.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Brain className="h-3 w-3" />
              <p className="text-[10px] font-medium uppercase">Model</p>
            </div>
            <p className="text-sm font-medium truncate" title={stats.modelName || 'Unknown'}>
              {formatModelName(stats.modelName)}
            </p>
            {stats.modelDimensions && (
              <p className="text-[10px] text-muted-foreground">{stats.modelDimensions}D</p>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <p className="text-[10px] font-medium uppercase">Created</p>
            </div>
            <p className="text-[10px] font-medium">{formatDate(stats.createdAt)}</p>
          </div>
        </div>

        {/* Compact Additional Info - Collapsible or inline */}
        <div className="mt-3 pt-3 border-t border-muted/50 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>Mode:</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                {stats.mode || 'text'}
              </Badge>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Reranking:</span>
              <Badge variant={stats.rerankingEnabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {stats.rerankingEnabled ? 'On' : 'Off'}
              </Badge>
            </span>
            <span>DB: {stats.dbSize} MB</span>
            <span>Index: {stats.indexSize} MB</span>
            {stats.contentTypeDistribution.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span>Types:</span>
                <div className="flex gap-1">
                  {stats.contentTypeDistribution.map(({ name, value }) => (
                    <Badge key={name} variant="secondary" className="text-[10px] px-1 py-0">
                      {name}({value.toLocaleString()})
                    </Badge>
                  ))}
                </div>
              </span>
            )}
          </div>
          
          {/* Data Locations */}
          <div className="pt-2 border-t border-muted/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Folder className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Data Locations</p>
            </div>
            <div className="space-y-1 font-mono text-[10px] text-muted-foreground break-all">
              <p><span className="text-primary/80 font-semibold">DB:</span> {stats.dbPath}</p>
              <p><span className="text-primary/80 font-semibold">Index:</span> {stats.indexPath}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
