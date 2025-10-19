import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Story } from "@/data/demoStory";

interface StoryViewerProps {
  story: Story;
}

const StoryViewer = ({ story }: StoryViewerProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const page = story.pages[currentPage];
  const totalPages = story.pages.length;

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
    <div className="w-full max-w-4xl mx-auto">
      {/* Story Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          {story.title}
        </h1>
        <p className="text-lg text-muted-foreground">{story.destination}</p>
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
            <p className="text-lg font-semibold text-muted-foreground">
              {page.imageCaption}
            </p>
          </div>
        </div>

        {/* Story Content */}
        <div className="prose prose-lg max-w-none">
          <p className="text-lg md:text-xl leading-relaxed text-foreground">
            {page.content}
          </p>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col items-center gap-6">
        {/* Page Dots */}
        <div className="flex gap-3">
          {story.pages.map((_, index) => (
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
  );
};

export default StoryViewer;
