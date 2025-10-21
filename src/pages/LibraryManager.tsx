import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Library, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';

interface BackfillStats {
  eligibleStories: number;
  eligiblePages: number;
  pages: Array<{
    id: string;
    storyId: string;
    imageUrl: string;
  }>;
}

interface BackfillProgress {
  total: number;
  processed: number;
  added: number;
  skipped: number;
  errors: number;
}

const LibraryManager = () => {
  const [stats, setStats] = useState<BackfillStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress>({
    total: 0,
    processed: 0,
    added: 0,
    skipped: 0,
    errors: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-approval-check');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Error fetching backfill stats:', error);
      toast.error('Failed to load library statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const runBackfill = async () => {
    if (!stats) return;

    setIsBackfilling(true);
    setProgress({
      total: stats.eligiblePages,
      processed: 0,
      added: 0,
      skipped: 0,
      errors: 0
    });

    try {
      const { data, error } = await supabase.functions.invoke('backfill-image-library');
      
      if (error) throw error;

      setProgress({
        total: stats.eligiblePages,
        processed: stats.eligiblePages,
        added: data.added || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0
      });

      toast.success(`Backfill complete! Added ${data.added} images to library.`);
      
      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Error running backfill:', error);
      toast.error('Failed to run backfill');
    } finally {
      setIsBackfilling(false);
    }
  };

  const progressPercentage = progress.total > 0 
    ? (progress.processed / progress.total) * 100 
    : 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Library className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Library Manager</h1>
          </div>

          {isLoading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Stats Card */}
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Backfill Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Eligible Stories</p>
                    <p className="text-3xl font-bold text-primary">{stats?.eligibleStories || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Eligible Pages</p>
                    <p className="text-3xl font-bold text-secondary">{stats?.eligiblePages || 0}</p>
                  </div>
                </div>

                {stats && stats.eligiblePages > 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      These images can be added to your library to improve future story generation by reusing similar images.
                    </p>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="lg" className="w-full" disabled={isBackfilling}>
                          {isBackfilling ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Running Backfill...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-5 w-5" />
                              Run Backfill
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Backfill</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will add {stats.eligiblePages} images from {stats.eligibleStories} stories to your image library. 
                            This helps improve future story generation by reusing similar images, reducing costs and generation time.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={runBackfill}>
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}

                {stats && stats.eligiblePages === 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">Library is up to date!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      All existing story images have been added to the library.
                    </p>
                  </div>
                )}
              </Card>

              {/* Progress Card */}
              {isBackfilling && (
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Backfill Progress</h3>
                  <Progress value={progressPercentage} className="mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Processed</p>
                      <p className="text-lg font-semibold">{progress.processed}/{progress.total}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Added</p>
                      <p className="text-lg font-semibold text-green-600">{progress.added}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Skipped</p>
                      <p className="text-lg font-semibold text-yellow-600">{progress.skipped}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Errors</p>
                      <p className="text-lg font-semibold text-red-600">{progress.errors}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LibraryManager;