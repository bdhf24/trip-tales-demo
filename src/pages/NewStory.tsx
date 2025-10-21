import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { Sparkles, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [customInterest, setCustomInterest] = useState("");
  const [kidInterests, setKidInterests] = useState<string[]>([]);

  // Auto-populate interests when kid names change
  useEffect(() => {
    const fetchKidInterests = async () => {
      if (!kidNames.trim()) {
        setKidInterests([]);
        return;
      }

      const names = kidNames.split(",").map(name => name.trim()).filter(Boolean);
      
      try {
        const { data, error } = await supabase
          .from('kids')
          .select('interests, name')
          .in('name', names);

        if (error) throw error;

        if (data && data.length > 0) {
          const allInterests = data.flatMap(k => k.interests || []);
          const uniqueInterests = [...new Set(allInterests)];
          setKidInterests(uniqueInterests);

          // Auto-select kid interests
          setSelectedInterests(prev => {
            const combined = [...new Set([...prev, ...uniqueInterests])];
            return combined;
          });
        } else {
          setKidInterests([]);
        }
      } catch (error) {
        console.error("Error fetching kid interests:", error);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchKidInterests, 500);
    return () => clearTimeout(timeoutId);
  }, [kidNames]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !selectedInterests.includes(customInterest.trim())) {
      setSelectedInterests(prev => [...prev, customInterest.trim()]);
      setCustomInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setSelectedInterests(prev => prev.filter(i => i !== interest));
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
      const errorMessage = error instanceof Error ? error.message : "Failed to generate story";
      
      // Check for specific error types and provide user-friendly messages
      if (errorMessage.includes("CREDITS_DEPLETED")) {
        toast({
          title: "AI Credits Required",
          description: errorMessage.replace("CREDITS_DEPLETED: ", ""),
          variant: "destructive",
          duration: 8000,
        });
      } else if (errorMessage.includes("RATE_LIMITED")) {
        toast({
          title: "Rate Limited",
          description: errorMessage.replace("RATE_LIMITED: ", ""),
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Failed to generate story",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      console.error("Error generating story:", error);
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

                {kidInterests.length > 0 && (
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    ✨ Auto-populated from kid profiles: {kidInterests.join(", ")}
                  </p>
                )}

                {/* Selected Interests */}
                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                    {selectedInterests.map((interest) => (
                      <Badge
                        key={interest}
                        variant="default"
                        className="text-base py-2 px-4 rounded-full cursor-pointer"
                        onClick={() => removeInterest(interest)}
                      >
                        {interest}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Predefined Interests */}
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

                {/* Custom Interest Input */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add custom interest..."
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={addCustomInterest}
                    variant="outline"
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Select at least one interest or add your own
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
