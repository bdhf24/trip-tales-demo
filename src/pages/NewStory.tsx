import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INTERESTS = [
  "beaches", "castles", "soccer", "animals", "boats",
  "food", "museums", "hiking", "art", "music"
];

const TONES = [
  { value: "curious", label: "Curious" },
  { value: "adventurous", label: "Adventurous" },
  { value: "silly", label: "Silly" },
];

const ART_STYLES = [
  { value: "storybook-cozy", label: "Storybook Cozy" },
  { value: "watercolor-soft", label: "Watercolor Soft" },
  { value: "travel-sketch", label: "Travel Sketch" },
];

const NewStory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [destination, setDestination] = useState("");
  const [month, setMonth] = useState("");
  const [kidNames, setKidNames] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(6);
  const [tone, setTone] = useState<"curious" | "adventurous" | "silly">("curious");
  const [artStyle, setArtStyle] = useState<"storybook-cozy" | "watercolor-soft" | "travel-sketch">("storybook-cozy");
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedInterests.length === 0) {
      toast({
        title: "Please select at least one interest",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const kids = kidNames.split(",").map(name => name.trim()).filter(Boolean);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/build-story`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            destination,
            month,
            kids,
            interests: selectedInterests,
            pages: pageCount,
            tone,
            artStylePreset: artStyle,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate story");
      }

      const data = await response.json();
      
      // Store the story in localStorage
      localStorage.setItem(`story-${data.storyId}`, JSON.stringify(data));
      
      navigate(`/story/${data.storyId}`);
    } catch (error) {
      console.error("Error generating story:", error);
      toast({
        title: "Failed to generate story",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create Your Adventure
            </h1>
            <p className="text-lg text-muted-foreground">
              Tell us about your trip and we'll create a magical story!
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-card rounded-3xl shadow-2xl p-8 md:p-10 border-2 border-primary/20 space-y-8">
              {/* Destination Field */}
              <div className="space-y-3">
                <Label htmlFor="destination" className="text-lg font-semibold">
                  Where did you go? 🌍
                </Label>
                <Input
                  id="destination"
                  type="text"
                  placeholder="e.g., Mallorca, Spain"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="text-lg h-14 rounded-2xl border-2 focus:border-primary"
                />
              </div>

              {/* Month Field */}
              <div className="space-y-3">
                <Label htmlFor="month" className="text-lg font-semibold">
                  What month did you visit? 📅
                </Label>
                <Input
                  id="month"
                  type="text"
                  placeholder="e.g., July"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  className="text-lg h-14 rounded-2xl border-2 focus:border-primary"
                />
              </div>

              {/* Kid Names Field */}
              <div className="space-y-3">
                <Label htmlFor="kidNames" className="text-lg font-semibold">
                  Who went on the adventure? 👦👧
                </Label>
                <Input
                  id="kidNames"
                  type="text"
                  placeholder="e.g., Emma, Lucas"
                  value={kidNames}
                  onChange={(e) => setKidNames(e.target.value)}
                  required
                  className="text-lg h-14 rounded-2xl border-2 focus:border-primary"
                />
                <p className="text-sm text-muted-foreground">
                  Separate multiple names with commas
                </p>
              </div>

              {/* Interests Field */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold">
                  What are they interested in? 🎨
                </Label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => (
                    <Badge
                      key={interest}
                      variant={selectedInterests.includes(interest) ? "default" : "outline"}
                      className="cursor-pointer text-base py-2 px-4 rounded-full"
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Select at least one interest
                </p>
              </div>

              {/* Page Count Field */}
              <div className="space-y-3">
                <Label htmlFor="pageCount" className="text-lg font-semibold">
                  How many pages? 📖
                </Label>
                <Input
                  id="pageCount"
                  type="number"
                  min="3"
                  max="12"
                  value={pageCount}
                  onChange={(e) => setPageCount(parseInt(e.target.value) || 6)}
                  className="text-lg h-14 rounded-2xl border-2 focus:border-primary"
                />
              </div>

              {/* Tone Field */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold">
                  Story tone 🎭
                </Label>
                <div className="flex gap-3">
                  {TONES.map((t) => (
                    <Badge
                      key={t.value}
                      variant={tone === t.value ? "default" : "outline"}
                      className="cursor-pointer text-base py-2 px-4 rounded-full flex-1 justify-center"
                      onClick={() => setTone(t.value as typeof tone)}
                    >
                      {t.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Art Style Field */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold">
                  Illustration style 🎨
                </Label>
                <div className="flex gap-3">
                  {ART_STYLES.map((style) => (
                    <Badge
                      key={style.value}
                      variant={artStyle === style.value ? "default" : "outline"}
                      className="cursor-pointer text-base py-2 px-4 rounded-full flex-1 justify-center"
                      onClick={() => setArtStyle(style.value as typeof artStyle)}
                    >
                      {style.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                disabled={isGenerating}
                className="w-full rounded-2xl text-lg font-semibold py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Your Story...
                  </>
                ) : (
                  <>
                    Create My Story
                    <Sparkles className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default NewStory;
