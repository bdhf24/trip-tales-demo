import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, RotateCw, Sparkles, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ArtStylePreset = "storybook-cozy" | "watercolor-soft" | "travel-sketch";

interface ImagePromptSpec {
  stylePreset: ArtStylePreset;
  scene: string;
  landmarkDetail?: string;
  mood: "joyful" | "curious" | "adventurous";
  timeOfDay?: "morning" | "afternoon" | "golden hour";
  consistencyTags: string[];
}

type ImageStatus = "idle" | "queued" | "generating" | "uploaded" | "done" | "failed";

interface GeneratedPage {
  heading: string;
  text: string;
  scene: string;
  landmarkDetail?: string;
  imagePrompt: string;
  imagePromptSpec: ImagePromptSpec;
  imageUrl?: string;
  status?: ImageStatus;
  error?: string;
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

interface GuidanceSettings {
  enabled: boolean;
  kidIds: string[];
  strength: number;
  downscale: number;
}

interface Kid {
  id: string;
  name: string;
  age: number;
  descriptor: string | null;
  photoCount: number;
}

const Story = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [story, setStory] = useState<StoryData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageFormat, setImageFormat] = useState("png");
  const [guidanceSettings, setGuidanceSettings] = useState<GuidanceSettings>({
    enabled: false,
    kidIds: [],
    strength: 0.45,
    downscale: 768,
  });
  const [availableKids, setAvailableKids] = useState<Kid[]>([]);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [pageReferences, setPageReferences] = useState<{ [pageId: string]: string[] }>({}); // pageId -> kidIds[]
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileSize, setPdfFileSize] = useState<number | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    const loadStory = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stories-get', {
          body: { storyId: id }
        });

        if (error) throw error;

        const loadedStory: StoryData = {
          storyId: data.story.id,
          destination: data.story.destination,
          month: data.story.month,
          tone: data.story.tone,
          kids: data.story.kids_json,
          interests: data.story.interests,
          pages: data.pages.length,
          artStylePreset: data.story.art_style,
          generatedPages: data.pages.map((p: any) => ({
            heading: p.heading,
            text: p.text,
            scene: p.image_prompt_spec?.scene || '',
            landmarkDetail: p.image_prompt_spec?.landmarkDetail,
            imagePrompt: p.image_prompt,
            imagePromptSpec: p.image_prompt_spec,
            imageUrl: p.image_url,
            status: p.image_url ? 'done' : 'idle'
          }))
        };

        setStory(loadedStory);

        // Load saved guidance settings from localStorage
        const savedSettings = localStorage.getItem(`guidance-${id}`);
        if (savedSettings) {
          setGuidanceSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error("Error loading story:", error);
        toast({ title: "Error", description: "Failed to load story", variant: "destructive" });
        navigate("/library");
      }
    };

    const loadKids = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('kids-list');
        if (error) throw error;
        setAvailableKids(data.kids);
      } catch (error) {
        console.error("Error loading kids:", error);
      }
    };

    loadStory();
    loadKids();
  }, [id, navigate, toast]);

  // Save guidance settings to localStorage whenever they change
  useEffect(() => {
    if (id) {
      localStorage.setItem(`guidance-${id}`, JSON.stringify(guidanceSettings));
    }
  }, [guidanceSettings, id]);

  // Load page references
  const loadPageReferences = async () => {
    if (!id) return;
    
    try {
      const { data: pagesData } = await supabase
        .from('pages')
        .select('id')
        .eq('story_id', id);
      
      if (!pagesData) return;

      const refMap: { [pageId: string]: string[] } = {};
      
      for (const page of pagesData) {
        const { data: refs } = await supabase
          .from('reference_images')
          .select('kid_id')
          .eq('page_id', page.id);
        
        if (refs && refs.length > 0) {
          refMap[page.id] = refs.map(r => r.kid_id);
        }
      }
      
      setPageReferences(refMap);
    } catch (error) {
      console.error('Error loading page references:', error);
    }
  };

  useEffect(() => {
    loadPageReferences();
  }, [id]);

  const markPageAsReference = async (pageNumber: number, kidId: string) => {
    if (!story || !id) return;

    try {
      // Get the page ID from the database (pageNumber is the array index, add 1 for DB page_number)
      const { data: pageData } = await supabase
        .from('pages')
        .select('id')
        .eq('story_id', id)
        .eq('page_number', pageNumber + 1)
        .single();

      if (!pageData) {
        toast({
          title: "Error",
          description: "Could not find page in database",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('mark-page-as-reference', {
        body: {
          kidId,
          pageId: pageData.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Page marked as character reference",
      });

      await loadPageReferences();
    } catch (error) {
      console.error('Error marking page as reference:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark as reference",
        variant: "destructive",
      });
    }
  };

  const unmarkPageAsReference = async (pageNumber: number, kidId: string) => {
    if (!story || !id) return;

    try {
      const { data: pageData } = await supabase
        .from('pages')
        .select('id')
        .eq('story_id', id)
        .eq('page_number', pageNumber + 1)
        .single();

      if (!pageData) return;

      const { error } = await supabase.functions.invoke('unmark-page-reference', {
        body: {
          kidId,
          pageId: pageData.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reference removed",
      });

      await loadPageReferences();
    } catch (error) {
      console.error('Error unmarking reference:', error);
      toast({
        title: "Error",
        description: "Failed to remove reference",
        variant: "destructive",
      });
    }
  };

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

  const updatePageStatus = (pageIndex: number, updates: Partial<GeneratedPage>) => {
    setStory(prev => {
      if (!prev) return prev;
      const updatedPages = [...prev.generatedPages];
      updatedPages[pageIndex] = { ...updatedPages[pageIndex], ...updates };
      const updated = { ...prev, generatedPages: updatedPages };
      // Save to localStorage
      localStorage.setItem(`story-${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const generateAllImages = async () => {
    if (!story || !id) return;
    
    setIsGenerating(true);
    
    // Set all pages to queued
    story.generatedPages.forEach((_, index) => {
      updatePageStatus(index, { status: "queued", error: undefined });
    });

    try {
      const pages = story.generatedPages.map((page, index) => ({
        pageNumber: index,
        imagePrompt: page.imagePrompt,
      }));

      // Prepare guidance if enabled
      let guidance = null;
      if (guidanceSettings.enabled && guidanceSettings.kidIds.length > 0) {
        try {
          const { data: kidRefsData, error: kidRefsError } = await supabase.functions.invoke("prepare-kid-refs", {
            body: {
              kidIds: guidanceSettings.kidIds,
              refStrategy: 'auto-best',
              maxRef: 3,
              downscale: guidanceSettings.downscale,
              sendOriginals: false,
            },
          });

          if (kidRefsError) {
            console.error("Error preparing kid refs:", kidRefsError);
            toast({
              title: "Warning",
              description: "Could not load reference photos. Using descriptor-only generation.",
            });
          } else if (kidRefsData?.results && kidRefsData.results.length > 0) {
            guidance = {
              enabled: true,
              results: kidRefsData.results,
              strength: guidanceSettings.strength,
            };
          }
        } catch (error) {
          console.error("Error preparing guidance:", error);
        }
      }

      const { data, error } = await supabase.functions.invoke("generate-all-images", {
        body: {
          storyId: id,
          pages,
          size: imageSize,
          format: imageFormat,
          guidance,
        },
      });

      if (error) throw error;

      // Process results
      data.results.forEach((result: { pageNumber: number; imageUrl?: string; error?: string }) => {
        if (result.imageUrl) {
          updatePageStatus(result.pageNumber, {
            imageUrl: result.imageUrl,
            status: "done",
            error: undefined,
          });
        } else {
          updatePageStatus(result.pageNumber, {
            status: "failed",
            error: result.error || "Unknown error",
          });
        }
      });

      const successCount = data.results.filter((r: any) => r.imageUrl).length;
      const failCount = data.results.length - successCount;

      if (failCount === 0) {
        toast({
          title: "Success!",
          description: `Generated ${successCount} images`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Generated ${successCount} images, ${failCount} failed`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating images:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate images",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const retryPageImage = async (pageIndex: number) => {
    if (!story || !id) return;
    
    const page = story.generatedPages[pageIndex];
    updatePageStatus(pageIndex, { status: "generating", error: undefined });

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          imagePrompt: page.imagePrompt,
          storyId: id,
          pageNumber: pageIndex,
          size: imageSize,
          format: imageFormat,
        },
      });

      if (error) throw error;

      updatePageStatus(pageIndex, {
        imageUrl: data.imageUrl,
        status: "done",
        error: undefined,
      });

      toast({
        title: "Success",
        description: `Image for page ${pageIndex + 1} generated`,
      });
    } catch (error: any) {
      console.error(`Error retrying page ${pageIndex}:`, error);
      
      // Extract error message from the response
      let errorMessage = "Failed to generate image";
      let toastTitle = "Error";
      let toastDescription = `Failed to generate image for page ${pageIndex + 1}`;
      
      // Check if this is a credit/rate limit error
      if (error?.message?.includes("credits depleted") || error?.message?.includes("AI credits")) {
        errorMessage = "AI credits depleted";
        toastTitle = "Credits Depleted";
        toastDescription = "You've run out of AI credits. Please add credits to your workspace in Settings → Workspace → Usage.";
      } else if (error?.message?.includes("Rate limit")) {
        errorMessage = "Rate limit exceeded";
        toastTitle = "Rate Limited";
        toastDescription = "You're sending too many requests. Please wait a moment and try again.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      updatePageStatus(pageIndex, {
        status: "failed",
        error: errorMessage,
      });
      
      toast({
        title: toastTitle,
        description: toastDescription,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status?: ImageStatus) => {
    switch (status) {
      case "generating":
      case "queued":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "done":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: ImageStatus) => {
    switch (status) {
      case "queued":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
      case "generating":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
      case "done":
        return "bg-green-500/20 text-green-700 dark:text-green-300";
      case "failed":
        return "bg-red-500/20 text-red-700 dark:text-red-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const exportToPdf = async () => {
    if (!id) return;

    setIsExportingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-story-pdf", {
        body: { storyId: id },
      });

      if (error) {
        throw error;
      }

      setPdfUrl(data.pdfUrl);
      setPdfFileSize(data.fileSize);

      toast({
        title: data.cached ? "PDF Ready!" : "PDF Generated!",
        description: data.cached 
          ? "Using cached PDF from previous export"
          : "Your storybook has been created successfully",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export PDF",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
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

          {/* Image Generation Controls */}
          <div className="mb-8 p-6 bg-card rounded-xl border border-border">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Generate Illustrations</h3>
                <p className="text-sm text-muted-foreground">
                  Create AI-generated images for all {story.generatedPages.length} pages
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  disabled={isGenerating}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                >
                  <option value="1024x1024">Square (1024×1024)</option>
                  <option value="1024x1536">Portrait (1024×1536)</option>
                  <option value="1536x1024">Landscape (1536×1024)</option>
                </select>
                
                <select
                  value={imageFormat}
                  onChange={(e) => setImageFormat(e.target.value)}
                  disabled={isGenerating}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
                
                <Button
                  onClick={generateAllImages}
                  disabled={isGenerating}
                  size="lg"
                  className="whitespace-nowrap"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Images"
                  )}
                </Button>
              </div>
            </div>

            {/* Photo Guidance Panel */}
            <Collapsible open={isGuidanceOpen} onOpenChange={setIsGuidanceOpen} className="mt-6">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                <Sparkles className="h-4 w-4" />
                <span>Photo Likeness (Optional)</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${isGuidanceOpen ? 'rotate-90' : ''}`} />
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="guidance-enabled"
                    checked={guidanceSettings.enabled}
                    onCheckedChange={(checked) =>
                      setGuidanceSettings({ ...guidanceSettings, enabled: checked as boolean })
                    }
                    disabled={isGenerating}
                  />
                  <div className="flex-1">
                    <Label htmlFor="guidance-enabled" className="cursor-pointer font-medium">
                      Use photo references for better likeness
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll use low-res copies of selected photos to guide character appearance. Original photos stay private.
                    </p>
                  </div>
                </div>

                {guidanceSettings.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm">Select Kids</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableKids
                          .filter(kid => kid.photoCount > 0)
                          .map(kid => (
                            <button
                              key={kid.id}
                              onClick={() => {
                                const isSelected = guidanceSettings.kidIds.includes(kid.id);
                                setGuidanceSettings({
                                  ...guidanceSettings,
                                  kidIds: isSelected
                                    ? guidanceSettings.kidIds.filter(id => id !== kid.id)
                                    : [...guidanceSettings.kidIds, kid.id],
                                });
                              }}
                              disabled={isGenerating}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                guidanceSettings.kidIds.includes(kid.id)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-background border border-border hover:border-primary'
                              }`}
                            >
                              {kid.name}
                            </button>
                          ))}
                      </div>
                      {availableKids.filter(kid => kid.photoCount > 0).length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No kids with photos available. Upload photos in the Kids section first.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Likeness Strength</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(guidanceSettings.strength * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[guidanceSettings.strength * 100]}
                        onValueChange={([value]) =>
                          setGuidanceSettings({ ...guidanceSettings, strength: value / 100 })
                        }
                        min={20}
                        max={90}
                        step={5}
                        disabled={isGenerating}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower values (20-40%) = subtle guidance. Higher values (60-90%) = strong resemblance but may affect artistic style.
                      </p>
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Progress indicators */}
            {isGenerating && (
              <div className="mt-6 flex flex-wrap gap-2">
                {story.generatedPages.map((page, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(page.status)}`}
                  >
                    {getStatusIcon(page.status)}
                    <span>Page {index + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PDF Export Section */}
          <div className="mb-8 p-6 bg-card rounded-xl border border-border">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Export Storybook</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Download a high-quality PDF suitable for printing or sharing
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {!pdfUrl ? (
                  <Button
                    onClick={exportToPdf}
                    disabled={isExportingPdf}
                    size="lg"
                    className="whitespace-nowrap"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing your storybook...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Export to PDF
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      asChild
                      size="lg"
                      className="whitespace-nowrap"
                    >
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </a>
                    </Button>
                    {pdfFileSize && (
                      <p className="text-xs text-muted-foreground text-center">
                        {formatFileSize(pdfFileSize)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Story Page Card */}
          <div className="bg-card rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-primary/20">
            {currentPage === 0 ? (
              // Title Page - Special Layout
              <div className="text-center space-y-6 py-8">
                <div className="space-y-4 mb-8">
                  <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent leading-tight">
                    {page.heading}
                  </h2>
                  <div className="flex justify-center">
                    <div className="h-1 w-32 bg-gradient-to-r from-primary via-secondary to-accent rounded-full" />
                  </div>
                </div>

                {/* Title Page Image */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-2xl mb-6 flex items-center justify-center border-4 border-dashed border-primary/30 overflow-hidden">
                  {page.imageUrl ? (
                    <img
                      src={page.imageUrl}
                      alt={page.heading}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : page.status === "generating" ? (
                    <div className="text-center p-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Creating cover illustration...
                      </p>
                    </div>
                  ) : page.status === "failed" ? (
                    <div className="text-center p-8">
                      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                        Failed to generate cover
                      </p>
                      {page.error && (
                        <p className="text-xs text-muted-foreground mb-4">{page.error}</p>
                      )}
                      <Button
                        onClick={() => retryPageImage(currentPage)}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4">📖</div>
                      <p className="text-sm font-medium text-muted-foreground max-w-md">
                        Click "Generate Images" above to create the cover
                      </p>
                    </div>
                  )}
                </div>

                {/* Title Page Content */}
                <div className="prose prose-lg max-w-none">
                  <p className="text-xl md:text-2xl leading-relaxed text-foreground whitespace-pre-wrap font-medium">
                    {page.text}
                  </p>
                </div>
              </div>
            ) : (
              // Regular Story Page
              <>
                <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">
                  {page.heading}
                </h2>

                {/* Image */}
                <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-2xl mb-6 flex items-center justify-center border-4 border-dashed border-primary/30 overflow-hidden">
                  {page.imageUrl ? (
                    <>
                      <img
                        src={page.imageUrl}
                        alt={page.heading}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      
                      {/* Mark as Reference Button */}
                      {availableKids.length > 0 && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          {availableKids.map(kid => {
                            const pageId = story.generatedPages[currentPage]?.imageUrl ? `page-${currentPage}` : null;
                            const isMarked = pageId && pageReferences[pageId]?.includes(kid.id);
                            
                            return (
                              <Button
                                key={kid.id}
                                size="sm"
                                variant={isMarked ? "default" : "secondary"}
                                onClick={() => {
                                  if (isMarked) {
                                    unmarkPageAsReference(currentPage, kid.id);
                                  } else {
                                    markPageAsReference(currentPage, kid.id);
                                  }
                                }}
                                className="shadow-lg"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {isMarked ? `✓ ${kid.name}` : `+ ${kid.name}`}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : page.status === "generating" ? (
                    <div className="text-center p-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Generating illustration...
                      </p>
                    </div>
                  ) : page.status === "failed" ? (
                    <div className="text-center p-8">
                      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                        Failed to generate image
                      </p>
                      {page.error && (
                        <p className="text-xs text-muted-foreground mb-4">{page.error}</p>
                      )}
                      <Button
                        onClick={() => retryPageImage(currentPage)}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4">🖼️</div>
                      <p className="text-sm font-medium text-muted-foreground max-w-md">
                        Click "Generate Images" above to create illustrations
                      </p>
                    </div>
                  )}
                </div>

                {/* Story Content */}
                <div className="prose prose-lg max-w-none mb-6">
                  <p className="text-lg md:text-xl leading-relaxed text-foreground whitespace-pre-wrap">
                    {page.text}
                  </p>
                </div>
              </>
            )}

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
