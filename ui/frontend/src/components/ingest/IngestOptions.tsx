import { useIngestStore } from '@/stores/ingestStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Type, 
  Image as ImageIcon, 
  Settings2, 
  ChevronDown, 
  ChevronUp,
  Scissors,
  FolderTree,
  Database,
  FileCode,
  GitBranch
} from 'lucide-react';
import { useState } from 'react';

const TEXT_MODELS = [
  { id: 'sentence-transformers/all-MiniLM-L6-v2', name: 'MiniLM-L6 (Fastest)', dims: 384 },
  { id: 'Xenova/all-mpnet-base-v2', name: 'MPNet-Base (High Quality)', dims: 768 }
];

const MULTIMODAL_MODELS = [
  { id: 'Xenova/clip-vit-base-patch32', name: 'CLIP ViT-B/32 (Balanced)', dims: 512 },
  { id: 'Xenova/clip-vit-base-patch16', name: 'CLIP ViT-B/16 (Accurate)', dims: 512 }
];

function ConfigSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-xl bg-card/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        disabled={false}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 space-y-4 border-t bg-background/50">
          {children}
        </div>
      )}
    </div>
  );
}

export function IngestOptions() {
  const { 
    mode, model, setMode, setModel, isIngesting,
    chunkSize, chunkOverlap, setChunkSize, setChunkOverlap,
    pathStorageStrategy, baseDirectory, setPathStorageStrategy, setBaseDirectory,
    forceRebuild, setForceRebuild,
    mdxProcessing, mermaidExtraction, setMdxProcessing, setMermaidExtraction
  } = useIngestStore();

  const currentModels = mode === 'text' ? TEXT_MODELS : MULTIMODAL_MODELS;

  return (
    <div className="space-y-4">
      {/* Basic Configuration - Always Visible */}
      <div className="p-6 border rounded-2xl bg-card shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Ingestion Configuration</h3>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                Experimental
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose how your documents are processed and indexed.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Smart Processing</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          {/* Mode Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="mode-toggle" className="text-sm font-bold flex items-center gap-2">
                Processing Mode
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs transition-colors", mode === 'text' ? "text-primary font-bold" : "text-muted-foreground")}>
                  Text
                </span>
                <Switch
                  id="mode-toggle"
                  checked={mode === 'multimodal'}
                  onCheckedChange={(checked) => setMode(checked ? 'multimodal' : 'text')}
                  disabled={isIngesting}
                />
                <span className={cn("text-xs transition-colors", mode === 'multimodal' ? "text-primary font-bold" : "text-muted-foreground")}>
                  Multimodal
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "p-3 rounded-xl border-2 transition-all space-y-2",
                mode === 'text' ? "border-primary bg-primary/5" : "border-muted-foreground/10 opacity-50"
              )}>
                <Type className="h-5 w-5" />
                <div>
                  <p className="text-xs font-bold">Text-Only</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Optimized for MD, PDF, DOCX.</p>
                </div>
              </div>
              <div className={cn(
                "p-3 rounded-xl border-2 transition-all space-y-2",
                mode === 'multimodal' ? "border-primary bg-primary/5" : "border-muted-foreground/10 opacity-50"
              )}>
                <ImageIcon className="h-5 w-5" />
                <div>
                  <p className="text-xs font-bold">Multimodal</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Enables image search support.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-bold">Embedding Model</Label>
            <div className="space-y-3">
              <Select 
                value={model} 
                onValueChange={setModel}
                disabled={isIngesting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="p-3 rounded-xl bg-muted/30 border text-[10px] space-y-1">
                <p className="text-muted-foreground flex justify-between">
                  <span>Selected Model:</span>
                  <span className="font-mono">{model.split('/').pop()}</span>
                </p>
                <p className="text-muted-foreground flex justify-between">
                  <span>Dimensions:</span>
                  <span className="font-mono">{currentModels.find(m => m.id === model)?.dims || '--'}</span>
                </p>
                <p className="mt-2 text-[9px] leading-relaxed text-amber-500/80 italic">
                  Changing the model will require a full index rebuild on next ingestion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Configuration Sections */}
      <div className="space-y-3">
        {/* Chunk Configuration */}
        <ConfigSection title="Chunk Configuration" icon={Scissors}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chunk-size" className="text-xs font-medium">
                Chunk Size
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="chunk-size"
                  type="number"
                  min={100}
                  max={500}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value) || 250)}
                  disabled={isIngesting}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground">tokens</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Recommended: 200-300 tokens. Larger chunks = more context, smaller = more granular.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chunk-overlap" className="text-xs font-medium">
                Chunk Overlap
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="chunk-overlap"
                  type="number"
                  min={20}
                  max={Math.round(chunkSize * 0.5)}
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 50)}
                  disabled={isIngesting}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground">tokens</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                ~20% of chunk size recommended. Ensures context continuity between chunks.
              </p>
            </div>
          </div>
        </ConfigSection>

        {/* Path Options */}
        <ConfigSection title="Path Options" icon={FolderTree}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="path-strategy" className="text-xs font-medium">
                Path Storage Strategy
              </Label>
              <Select
                value={pathStorageStrategy}
                onValueChange={(value: 'relative' | 'absolute') => setPathStorageStrategy(value)}
                disabled={isIngesting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relative">Relative Paths</SelectItem>
                  <SelectItem value="absolute">Absolute Paths</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {pathStorageStrategy === 'relative' 
                  ? 'Paths stored relative to base directory. Portable across systems.'
                  : 'Paths stored as absolute. System-specific but explicit.'}
              </p>
            </div>
            {pathStorageStrategy === 'relative' && (
              <div className="space-y-2">
                <Label htmlFor="base-directory" className="text-xs font-medium">
                  Base Directory (for relative paths)
                </Label>
                <Input
                  id="base-directory"
                  type="text"
                  value={baseDirectory}
                  onChange={(e) => setBaseDirectory(e.target.value)}
                  disabled={isIngesting}
                  placeholder="Leave empty to use current working directory"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Base directory for resolving relative paths. Empty = current directory.
                </p>
              </div>
            )}
          </div>
        </ConfigSection>

        {/* Index Management */}
        <ConfigSection title="Index Management" icon={Database}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <Label htmlFor="force-rebuild" className="text-xs font-medium">
                  Force Rebuild (DESTRUCTIVE)
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Wipes the database + index and rebuilds from scratch. Use when switching models or you want a clean rebuild.
                </p>
              </div>
              <Switch
                id="force-rebuild"
                checked={forceRebuild}
                onCheckedChange={(checked) => {
                  if (checked) {
                    const ok = window.confirm(
                      'Force rebuild is DESTRUCTIVE.\n\nThis will wipe the database and vector index and rebuild from scratch.\n\nContinue?'
                    );
                    if (!ok) return;
                  }
                  setForceRebuild(checked);
                }}
                disabled={isIngesting}
              />
            </div>
            {forceRebuild && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] text-destructive font-medium">
                  ⚠️ This will delete the current database and index files before ingestion.
                </p>
              </div>
            )}
          </div>
        </ConfigSection>

        {/* Preprocessing Options */}
        <ConfigSection title="Preprocessing Options" icon={FileCode}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <Label htmlFor="mdx-processing" className="text-xs font-medium">
                  MDX Processing
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Process MDX files with component extraction and JSX handling.
                </p>
              </div>
              <Switch
                id="mdx-processing"
                checked={mdxProcessing}
                onCheckedChange={setMdxProcessing}
                disabled={isIngesting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <Label htmlFor="mermaid-extraction" className="text-xs font-medium">
                  Mermaid Diagram Extraction
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Extract and process Mermaid diagrams from markdown files.
                </p>
              </div>
              <Switch
                id="mermaid-extraction"
                checked={mermaidExtraction}
                onCheckedChange={setMermaidExtraction}
                disabled={isIngesting}
              />
            </div>
          </div>
        </ConfigSection>
      </div>
    </div>
  );
}
