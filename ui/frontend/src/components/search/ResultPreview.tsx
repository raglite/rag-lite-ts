import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { HighlightedText } from './HighlightedText';
import { FileText, Copy, Check, ExternalLink, Calendar, HardDrive } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ResultPreviewProps {
  result: any;
  query: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResultPreview({ result, query, isOpen, onOpenChange }: ResultPreviewProps) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-500" />
                <DialogTitle className="text-xl">{result.document.title}</DialogTitle>
              </div>
              <DialogDescription className="font-mono text-[10px] break-all">
                {result.document.source}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="secondary" className="gap-1">
              <span className="text-primary font-bold">{(result.score * 100).toFixed(1)}%</span> Match Score
            </Badge>
            {result.document.contentType && (
              <Badge variant="outline" className="capitalize">{result.document.contentType}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          {/* Image Preview for Multimodal */}
          {result.document.contentType === 'image' && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Image Preview
              </h4>
              <div className="rounded-2xl overflow-hidden border bg-muted/20 flex items-center justify-center min-h-[300px] shadow-inner">
                <img 
                  src={`/api/files?path=${encodeURIComponent(result.document.source)}`}
                  alt={result.document.title}
                  className="max-h-[500px] w-auto object-contain"
                />
              </div>
            </section>
          )}

          {/* Content Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Document Content
              </h4>
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 gap-2">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="p-6 rounded-xl bg-muted/30 border leading-relaxed whitespace-pre-wrap text-sm md:text-base selection:bg-primary/20">
              <HighlightedText text={result.content} query={query} />
            </div>
          </section>

          {/* Metadata Section */}
          <section className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              File Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Processed</p>
                  <p className="text-sm font-medium">
                    {result.document.createdAt ? new Date(result.document.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <HardDrive className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">ID</p>
                  <p className="text-sm font-medium truncate max-w-[150px]">{result.id || 'N/A'}</p>
                </div>
              </div>
            </div>

            {result.metadata && Object.keys(result.metadata).length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-muted/10 border space-y-3">
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Extended Metadata</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                  {Object.entries(result.metadata).map(([key, value]) => (
                    <div key={key} className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground capitalize">{key}</p>
                      <p className="text-xs font-semibold truncate">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="border-t pt-4 mt-auto flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground italic">
            Search query matched {query.split(/\s+/).filter(w => w.length > 2).length} keywords in this segment.
          </p>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
