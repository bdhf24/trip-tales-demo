import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, MapPin, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Story {
  id: string;
  title: string;
  destination: string;
  month: string;
  created_at: string;
  art_style: string;
}

const Library = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stories-list');
        
        if (error) throw error;
        setStories(data.stories || []);
      } catch (error) {
        console.error('Error fetching stories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) throw error;

      // Remove from local state
      setStories(stories.filter(s => s.id !== storyId));
      
      // Clear from localStorage if exists
      localStorage.removeItem(`story-${storyId}`);

      toast({
        title: "Story deleted",
        description: `"${storyTitle}" has been removed from your library.`,
      });
    } catch (error) {
      console.error('Error deleting story:', error);
      toast({
        title: "Failed to delete story",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">Loading your stories...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Story Library</h1>
            <p className="text-muted-foreground">Browse all your created stories</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/library/manage">Manage Library</Link>
          </Button>
        </div>

        {stories.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No stories yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first adventure story!
            </p>
            <Button asChild>
              <Link to="/new">Create Story</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <Card key={story.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <Link to={`/story/${story.id}`}>
                    <h3 className="text-xl font-semibold mb-3 text-foreground line-clamp-2">
                      {story.title}
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{story.destination}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{story.month}</span>
                      </div>
                      <div className="text-xs mt-3">
                        Created {new Date(story.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Story
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{story.title}" and all its pages. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteStory(story.id, story.title)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
