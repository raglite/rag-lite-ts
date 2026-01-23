import { Bot, Clock, Cpu, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GenerationResult } from '@/stores/searchStore';

interface GeneratedResponseProps {
  generation: GenerationResult;
  isLoading?: boolean;
}

export function GeneratedResponse({ generation, isLoading }: GeneratedResponseProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-sm font-medium">Generating AI Response...</CardTitle>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
              EXPERIMENTAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-2">
            <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
            <div className="h-4 bg-muted/50 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-muted/50 rounded animate-pulse w-4/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatModelName = (modelName: string) => {
    const parts = modelName.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : modelName;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">AI-Generated Response</CardTitle>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
              EXPERIMENTAL
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        {/* Generated Response Text */}
        <div className="p-4 rounded-lg bg-card border shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {generation.response}
          </p>
        </div>

        {/* Truncation Warning */}
        {generation.truncated && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Context was truncated due to model limits. Not all search results were included in the generation.
            </p>
          </div>
        )}

        {/* Generation Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3" />
            <span className="font-medium">{formatModelName(generation.modelUsed)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{(generation.generationTimeMs / 1000).toFixed(1)}s</span>
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            <span>{generation.chunksUsedForContext} chunks used</span>
          </span>
          <span className="text-muted-foreground/70">
            {generation.tokensUsed} tokens
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
