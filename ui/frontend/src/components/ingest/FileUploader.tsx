import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FolderOpen, Loader2, CheckCircle2, AlertCircle, FileText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useIngestStore } from '@/stores/ingestStore';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PreflightResult {
  success: boolean;
  canProceed: boolean;
  errors: string[];
  warnings: string[];
  filesChecked: {
    path: string;
    exists: boolean;
    canDelete: boolean;
    error?: string;
  }[];
}

export function FileUploader() {
  const { 
    progress, isIngesting, mode, model, setIngesting, setProgress, reset,
    chunkSize, chunkOverlap, pathStorageStrategy, baseDirectory,
    forceRebuild,
    mdxProcessing, mermaidExtraction
  } = useIngestStore();
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  
  // State for pre-flight check dialog
  const [preflightError, setPreflightError] = useState<PreflightResult | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

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

  /**
   * ISSUE #5 FIX: Run pre-flight check before starting ingestion with forceRebuild
   * This verifies that database and index files can be deleted before attempting.
   */
  const runPreflightCheck = async (): Promise<PreflightResult | null> => {
    try {
      const response = await fetch('/api/ingest/preflight/force-rebuild');
      const result = await response.json();
      
      if (!result.canProceed) {
        return result;
      }
      
      return null; // null means no issues
    } catch (err: any) {
      return {
        success: false,
        canProceed: false,
        errors: [`Pre-flight check failed: ${err.message}`],
        warnings: [],
        filesChecked: []
      };
    }
  };

  const startIngestion = async (acceptedFiles: File[]) => {
    setIngesting(true);
    setProgress({ status: 'processing', documentsProcessed: 0, chunksCreated: 0, embeddingsGenerated: 0 });
    setSessionId(null);

    const formData = new FormData();
    const filePaths: Record<string, string> = {};
    acceptedFiles.forEach((file, index) => {
      formData.append('files', file);
      // Preserve webkitRelativePath for folder uploads (contains full relative path)
      // Store it with a unique key so backend can match it to the file
      if ((file as any).webkitRelativePath) {
        filePaths[`path_${index}`] = (file as any).webkitRelativePath;
      }
    });
    // Send file paths as JSON if any exist
    if (Object.keys(filePaths).length > 0) {
      formData.append('filePaths', JSON.stringify(filePaths));
    }
    
    formData.append('mode', mode);
    formData.append('model', model);
    formData.append('chunkSize', chunkSize.toString());
    formData.append('chunkOverlap', chunkOverlap.toString());
    formData.append('pathStorageStrategy', pathStorageStrategy);
    if (baseDirectory) formData.append('baseDirectory', baseDirectory);
    formData.append('forceRebuild', forceRebuild.toString());
    formData.append('mdxProcessing', mdxProcessing.toString());
    formData.append('mermaidExtraction', mermaidExtraction.toString());

    try {
      const response = await fetch('/api/ingest/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Ingestion failed');
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // ISSUE #5 FIX: If forceRebuild is enabled, run pre-flight check first
    if (forceRebuild) {
      const preflightResult = await runPreflightCheck();
      
      if (preflightResult) {
        // Pre-flight check failed - show error dialog
        setPreflightError(preflightResult);
        setPendingFiles(acceptedFiles);
        return;
      }
    }

    // No issues (or forceRebuild not enabled) - proceed with ingestion
    await startIngestion(acceptedFiles);
  }, [setIngesting, setProgress, mode, model, chunkSize, chunkOverlap, pathStorageStrategy, baseDirectory, forceRebuild, mdxProcessing, mermaidExtraction]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ 
    onDrop,
    disabled: isIngesting,
    useFsAccessApi: false,
    noClick: true // Disable click on dropzone, we'll use buttons instead
  });

  const handleFolderSelect = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onDrop(files);
    }
    // Reset input so same folder can be selected again
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, [onDrop]);

  // Handle retry after pre-flight failure
  const handleRetryPreflight = async () => {
    if (!pendingFiles) return;
    
    const preflightResult = await runPreflightCheck();
    
    if (preflightResult) {
      // Still failing - update error display
      setPreflightError(preflightResult);
    } else {
      // Success - close dialog and start ingestion
      setPreflightError(null);
      await startIngestion(pendingFiles);
      setPendingFiles(null);
    }
  };

  // Handle cancel after pre-flight failure
  const handleCancelPreflight = () => {
    setPreflightError(null);
    setPendingFiles(null);
  };

  // Show progress display during ingestion
  if (isIngesting && progress.status === 'processing') {
    const totalFiles = (progress as any).totalFiles || 0;
    const currentFileIndex = (progress as any).currentFileIndex || 0;
    const fileProgress = totalFiles > 0 ? Math.round((currentFileIndex / totalFiles) * 100) : 0;
    
    return (
      <div className="p-8 border-2 rounded-2xl border-primary/20 bg-primary/5 space-y-6">
        <div className="flex items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-1">Processing Ingestion</h3>
            {progress.currentFile && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {progress.currentFile}
                {totalFiles > 0 && (
                  <span className="text-xs">({currentFileIndex} / {totalFiles})</span>
                )}
              </p>
            )}
          </div>
        </div>

        {totalFiles > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>File Progress</span>
              <span>{fileProgress}%</span>
            </div>
            <Progress value={fileProgress} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center p-3 rounded-lg bg-background/50 border">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Documents</p>
            <p className="text-lg font-bold">{progress.documentsProcessed || 0}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50 border">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Chunks</p>
            <p className="text-lg font-bold">{progress.chunksCreated || 0}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50 border">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Embeddings</p>
            <p className="text-lg font-bold">{progress.embeddingsGenerated || 0}</p>
          </div>
        </div>
      </div>
    );
  }

  if (progress.status === 'completed' || progress.status === 'error') {
    return (
      <div className={cn(
        "p-8 border-2 rounded-2xl text-center space-y-4",
        progress.status === 'completed' ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"
      )}>
        <div className="flex justify-center">
          {progress.status === 'completed' ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          ) : (
            <AlertCircle className="h-12 w-12 text-destructive" />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold">
            {progress.status === 'completed' ? 'Ingestion Complete' : 'Ingestion Failed'}
          </h3>
          <p className="text-muted-foreground mt-1">
            {progress.status === 'completed' 
              ? `Successfully processed ${progress.documentsProcessed} documents.` 
              : progress.error}
          </p>
        </div>
        {progress.status === 'completed' && (
          <div className="grid grid-cols-2 gap-4 text-sm max-w-xs mx-auto py-4">
            <div className="text-left p-2 rounded bg-background border">
              <p className="text-muted-foreground text-[10px] uppercase">Chunks</p>
              <p className="font-bold">{progress.chunksCreated}</p>
            </div>
            <div className="text-left p-2 rounded bg-background border">
              <p className="text-muted-foreground text-[10px] uppercase">Embeddings</p>
              <p className="font-bold">{progress.embeddingsGenerated}</p>
            </div>
          </div>
        )}
        <Button variant="outline" onClick={reset}>
          Upload More
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Pre-flight Error Dialog */}
      <AlertDialog open={preflightError !== null} onOpenChange={(open) => !open && handleCancelPreflight()}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Force Rebuild Cannot Proceed
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  The database or index files are currently locked and cannot be deleted.
                  This usually happens when another process is using them.
                </p>
                
                {preflightError && preflightError.errors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                    <p className="font-medium text-destructive mb-2">Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {preflightError.errors.filter(e => e.trim()).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {preflightError && preflightError.filesChecked.some(f => !f.canDelete && f.exists) && (
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p className="font-medium mb-2">Locked files:</p>
                    <ul className="space-y-1 text-muted-foreground font-mono text-xs">
                      {preflightError.filesChecked
                        .filter(f => !f.canDelete && f.exists)
                        .map((file, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-destructive">✗</span>
                            {file.path.split(/[/\\]/).pop()}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-600 mb-1">💡 How to fix:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Close other browser tabs using this UI</li>
                    <li>Stop any active search queries</li>
                    <li>Wait a few seconds and try again</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPreflight}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryPreflight}>
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Upload Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/5",
          isIngesting && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Hidden file input for files (via dropzone) */}
        <input {...getInputProps()} />
        
        {/* Hidden folder input for folder selection */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error - webkitdirectory is a non-standard attribute for folder selection
          directory=""
          webkitdirectory=""
          multiple
          onChange={handleFolderChange}
          style={{ display: 'none' }}
        />
        
        <div className="p-4 rounded-full bg-primary/5 text-primary mb-4">
          {isIngesting ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileUp className="h-8 w-8" />}
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {isIngesting ? 'Processing Documents...' : isDragActive ? 'Drop files here' : 'Drop files here, or select files or folder'}
        </h3>
        <p className="text-muted-foreground max-w-sm mb-6 text-sm">
          Supports Markdown (`.md`, `.mdx`), text, and common document formats (PDF, DOCX). Images are supported in Multimodal mode.
        </p>
        {!isIngesting && (
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                open();
              }}
            >
              <FileUp className="h-4 w-4" />
              Select Files
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderSelect();
              }}
            >
              <FolderOpen className="h-4 w-4" />
              Select Folder
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
