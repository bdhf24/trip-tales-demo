import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";

type ArtStylePreset = "storybook-cozy" | "watercolor-soft" | "travel-sketch";

interface ImagePromptSpec {
  stylePreset: ArtStylePreset;
  scene: string;
  landmarkDetail?: string;
  mood: "joyful" | "curious" | "adventurous";
  timeOfDay?: "morning" | "afternoon" | "golden hour";
  consistencyTags: string[];
}

interface GeneratedPage {
  heading: string;
  text: string;
  scene: string;
  landmarkDetail?: string;
  imagePrompt: string;
  imagePromptSpec: ImagePromptSpec;
}

interface StoryData {
  storyId: string;
  destination: string;
  month: string;
  tone: string;
  kids: string[];
  interests: string[];
  pages: number;
  artStylePreset: ArtStylePreset;
  generatedPages: GeneratedPage[];
}

const Story = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<StoryData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    // Try to load story from localStorage
    const storyData = localStorage.getItem(`story-${id}`);
    if (!storyData) {
      navigate("/");
      return;
    }

    try {
      const parsedStory = JSON.parse(storyData) as StoryData;
      setStory(parsedStory);
    } catch (error) {
      console.error("Error parsing story:", error);
      navigate("/");
    }
  }, [id, navigate]);

  if (!story) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-12 text-center">
          <p className="text-xl text-muted-foreground">Loading story...</p>
        </main>
      </div>
    );
  }

  const page = story.generatedPages[currentPage];
  const totalPages = story.generatedPages.length;

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Story Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {story.kids.join(" & ")}'s Adventure
            </h1>
            <p className="text-lg text-muted-foreground">
              {story.destination} • {story.month}
            </p>
          </div>

          {/* Story Page Card */}
          <div className="bg-card rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-primary/20">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">
              {page.heading}
            </h2>

            {/* Image Placeholder */}
            <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-2xl mb-6 flex items-center justify-center border-4 border-dashed border-primary/30">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🖼️</div>
                <p className="text-sm font-medium text-muted-foreground max-w-md">
                  Image placeholder
                </p>
              </div>
            </div>

            {/* Story Content */}
            <div className="prose prose-lg max-w-none mb-6">
              <p className="text-lg md:text-xl leading-relaxed text-foreground whitespace-pre-wrap">
                {page.text}
              </p>
            </div>

            {/* Image Prompt Details */}
            <details className="mt-6 p-6 bg-muted rounded-xl">
              <summary className="cursor-pointer font-semibold text-base uppercase tracking-wide text-foreground hover:text-primary transition-colors mb-4">
                🎨 Illustration Prompt Details
              </summary>
              
              <div className="space-y-4 mt-4">
                {/* Structured breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Style Preset</p>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {page.imagePromptSpec.stylePreset.replace("-", " ")}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mood</p>
                    <p className="text-sm font-medium text-foreground capitalize">{page.imagePromptSpec.mood}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time of Day</p>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {page.imagePromptSpec.timeOfDay || "Not specified"}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Landmark</p>
                    <p className="text-sm font-medium text-foreground">
                      {page.imagePromptSpec.landmarkDetail || "None"}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scene</p>
                  <p className="text-sm text-foreground">{page.imagePromptSpec.scene}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consistency Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {page.imagePromptSpec.consistencyTags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Final prompt string */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Prompt</p>
                  <textarea
                    readOnly
                    value={page.imagePrompt}
                    className="w-full p-3 text-sm font-mono bg-background border border-border rounded-lg resize-none"
                    rows={4}
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-col items-center gap-6">
            {/* Page Dots */}
            <div className="flex gap-3">
              {story.generatedPages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  className={`h-4 w-4 rounded-full transition-all ${
                    index === currentPage
                      ? "bg-primary scale-125"
                      : "bg-muted hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>

            {/* Previous/Next Buttons */}
            <div className="flex gap-4 w-full max-w-md">
              <Button
                onClick={goToPreviousPage}
                disabled={currentPage === 0}
                size="lg"
                variant="outline"
                className="flex-1 rounded-full text-lg font-semibold min-h-14"
              >
                <ChevronLeft className="mr-2 h-6 w-6" />
                Previous
              </Button>
              
              <Button
                onClick={goToNextPage}
                disabled={currentPage === totalPages - 1}
                size="lg"
                className="flex-1 rounded-full text-lg font-semibold min-h-14"
              >
                Next
                <ChevronRight className="ml-2 h-6 w-6" />
              </Button>
            </div>

            {/* Page Counter */}
            <p className="text-muted-foreground text-lg font-medium">
              Page {currentPage + 1} of {totalPages}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Story;
