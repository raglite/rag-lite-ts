import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Search, Settings, 
  Moon, Sun, Database,
  FileUp,
  FolderOpen
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { SearchBox } from '@/components/search/SearchBox';
import { SearchResults } from '@/components/search/SearchResults';
import { KnowledgeBaseStats } from '@/components/search/KnowledgeBaseStats';
import { FileUploader } from '@/components/ingest/FileUploader';
import { DirectoryIngest } from '@/components/ingest/DirectoryIngest';
import { IngestOptions } from '@/components/ingest/IngestOptions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function App() {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto p-8 max-w-5xl">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">RAG-lite TS</h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Local Semantic Engine
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Tabs defaultValue="search" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="ingest" className="gap-2">
              <FileUp className="h-4 w-4" />
              Ingest
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold mb-2">Semantic Search</h2>
                <p className="text-muted-foreground">
                  Find information across your documents using natural language queries.
                </p>
              </div>
              <KnowledgeBaseStats />
              <SearchBox />
              <SearchResults />
            </section>
          </TabsContent>

          <TabsContent value="ingest" className="animate-in fade-in duration-500">
            <div className="space-y-8">
              <section className="space-y-6">
                <div className="max-w-2xl">
                  <h2 className="text-3xl font-bold mb-2">Ingest Documents</h2>
                  <p className="text-muted-foreground">
                    Add new files or directories to your semantic search index.
                  </p>
                </div>
                
                <IngestOptions />
                <FileUploader />
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Local Directory</h3>
                </div>
                <DirectoryIngest />
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
