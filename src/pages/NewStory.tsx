import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { Sparkles } from "lucide-react";

const NewStory = () => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("");
  const [month, setMonth] = useState("");
  const [kidNames, setKidNames] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, always route to the demo story
    // Later this will generate a real story using the form data
    navigate("/story/demo");
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

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-2xl text-lg font-semibold py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              >
                Create My Story
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default NewStory;
