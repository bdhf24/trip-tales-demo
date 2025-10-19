import Navbar from "@/components/Navbar";
import StoryViewer from "@/components/StoryViewer";
import { demoStory } from "@/data/demoStory";

const StoryDemo = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <StoryViewer story={demoStory} />
      </main>
    </div>
  );
};

export default StoryDemo;
