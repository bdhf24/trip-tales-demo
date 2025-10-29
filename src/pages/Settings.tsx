import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Check } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Load settings from localStorage with defaults
  const [photoGuidanceEnabled, setPhotoGuidanceEnabled] = useState(() => {
    const saved = localStorage.getItem('photoGuidanceEnabled');
    return saved !== null ? JSON.parse(saved) : true; // Default to enabled
  });
  
  const [photoGuidanceStrength, setPhotoGuidanceStrength] = useState(() => {
    const saved = localStorage.getItem('photoGuidanceStrength');
    return saved !== null ? parseFloat(saved) : 0.50; // Default to 50%
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('photoGuidanceEnabled', JSON.stringify(photoGuidanceEnabled));
    localStorage.setItem('photoGuidanceStrength', photoGuidanceStrength.toString());
  }, [photoGuidanceEnabled, photoGuidanceStrength]);

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been saved and will apply to all future stories.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your story generation preferences
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Photo Guidance
            </CardTitle>
            <CardDescription>
              Control character consistency in generated images. When enabled, characters will maintain their appearance across all pages based on reference photos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="photo-guidance-enabled" className="text-base">
                  Enable Photo Guidance
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use character reference photos to maintain consistent appearance
                </p>
              </div>
              <Switch
                id="photo-guidance-enabled"
                checked={photoGuidanceEnabled}
                onCheckedChange={setPhotoGuidanceEnabled}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="photo-guidance-strength" className="text-base">
                  Guidance Strength
                </Label>
                <span className="text-sm font-medium text-primary">
                  {Math.round(photoGuidanceStrength * 100)}%
                </span>
              </div>
              <Slider
                id="photo-guidance-strength"
                min={0}
                max={1}
                step={0.05}
                value={[photoGuidanceStrength]}
                onValueChange={(value) => setPhotoGuidanceStrength(value[0])}
                disabled={!photoGuidanceEnabled}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low (less consistent)</span>
                <span>High (more consistent)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Higher values prioritize consistency over creative variation. Recommended: 50% (0.50)
              </p>
            </div>

            <Button onClick={handleSave} className="w-full">
              <Check className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

