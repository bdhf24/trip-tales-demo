import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, RotateCw, Sparkles, FileText, Download, ChevronDown, MessageCircle, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  previewImageUrl?: string;
  isHighRes?: boolean;
  status?: ImageStatus;
  error?: string;
  questions?: string[];
  activities?: Array<{
    title: string;
    description: string;
    materials?: string;
  }>;
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
  const [previewMode, setPreviewMode] = useState(true);
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
  const [costStats, setCostStats] = useState<{
    imagesGenerated: number;
    imagesReused: number;
    estimatedCost: number;
    costSaved: number;
  } | null>(null);
  const [showInteractive, setShowInteractive] = useState(true);
  const [upgradingPages, setUpgradingPages] = useState<Set<number>>(new Set());

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
            previewImageUrl: p.preview_image_url,
            isHighRes: p.is_high_res,
            status: p.image_url ? 'done' : 'idle',
            questions: p.questions_for_child || [],
            activities: p.activities || [],
          }))
        };

        setStory(loadedStory);
        
        // Load cost stats if available
        if (data.story.images_generated !== undefined) {
          setCostStats({
            imagesGenerated: data.story.images_generated || 0,
            imagesReused: data.story.images_reused || 0,
            estimatedCost: parseFloat(data.story.estimated_cost || 0),
            costSaved: parseFloat(data.story.cost_saved || 0),
          });
        }

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

  const upgradeToHighRes = async (pageNumbers?: number[]) => {
    if (!story || !id) return;

    const pagesToUpgrade = pageNumbers || story.generatedPages
      .map((_, index) => index)
      .filter(index => !story.generatedPages[index].isHighRes);

    if (pagesToUpgrade.length === 0) {
      toast({
        title: "Nothing to upgrade",
        description: "All pages are already high-resolution",
      });
      return;
    }

    setUpgradingPages(new Set(pagesToUpgrade));

    try {
      const { data, error } = await supabase.functions.invoke("upgrade-to-high-res", {
        body: {
          storyId: id,
          pageNumbers: pagesToUpgrade,
        },
      });

      if (error) throw error;

      // Update the story with new high-res images
      data.results.forEach((result: { pageNumber: number; imageUrl?: string; error?: string }) => {
        if (result.imageUrl) {
          updatePageStatus(result.pageNumber, {
            imageUrl: result.imageUrl,
            isHighRes: true,
            error: undefined,
          });
        } else {
          toast({
            title: "Error",
            description: `Failed to upgrade page ${result.pageNumber + 1}: ${result.error}`,
            variant: "destructive",
          });
        }
      });

      const successCount = data.results.filter((r: any) => r.imageUrl).length;
      toast({
        title: "Success!",
        description: `Upgraded ${successCount} ${successCount === 1 ? 'page' : 'pages'} to high-resolution`,
      });
    } catch (error) {
      console.error("Error upgrading to high-res:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upgrade images",
        variant: "destructive",
      });
    } finally {
      setUpgradingPages(new Set());
    }
  };

  const markPageAsReference = async (pageNumber: number, kidId: string) => {
    if (!story) return;
    try {
      const page = story.generatedPages[pageNumber];
      if (!page) return;

      // Find page id from story pages
      const { data: pagesData, error: pagesError } = await supabase
        .from('pages')
        .select('id')
        .eq('story_id', story.storyId)
        .range(pageNumber, pageNumber);

      if (pagesError || !pagesData || pagesData.length === 0) {
        toast({ title: "Error", description: "Page not found", variant: "destructive" });
        return;
      }

      const pageId = pagesData[0].id;

      // Insert reference image record
      const { error } = await supabase
        .from('reference_images')
        .insert({ page_id: pageId, kid_id: kidId });

      if (error) {
        toast({ title: "Error", description: "Failed to mark reference", variant: "destructive" });
        return;
      }

      // Update local state
      setPageReferences(prev => {
        const newRefs = { ...prev };
        if (!newRefs[pageId]) newRefs[pageId] = [];
        if (!newRefs[pageId].includes(kidId)) newRefs[pageId].push(kidId);
        return newRefs;
      });

      toast({ title: "Success", description: "Marked page as reference", variant: "default" });
    } catch (error) {
      console.error("Error marking page as reference:", error);
      toast({ title: "Error", description: "Failed to mark page as reference", variant: "destructive" });
    }
  };

  const unmarkPageAsReference = async (pageNumber: number, kidId: string) => {
    if (!story) return;
    try {
      const page = story.generatedPages[pageNumber];
      if (!page) return;

      // Find page id from story pages
      const { data: pagesData, error: pagesError } = await supabase
        .from('pages')
        .select('id')
        .eq('story_id', story.storyId)
        .range(pageNumber, pageNumber);

      if (pagesError || !pagesData || pagesData.length === 0) {
        toast({ title: "Error", description: "Page not found", variant: "destructive" });
        return;
      }

      const pageId = pagesData[0].id;

      // Delete reference image record
      const { error } = await supabase
        .from('reference_images')
        .delete()
        .eq('page_id', pageId)
        .eq('kid_id', kidId);

      if (error) {
        toast({ title: "Error", description: "Failed to unmark reference", variant: "destructive" });
        return;
      }

      // Update local state
      setPageReferences(prev => {
        const newRefs = { ...prev };
        if (newRefs[pageId]) {
          newRefs[pageId] = newRefs[pageId].filter(id => id !== kidId);
          if (newRefs[pageId].length === 0) delete newRefs[pageId];
        }
        return newRefs;
      });

      toast({ title: "Success", description: "Unmarked page as reference", variant: "default" });
    } catch (error) {
      console.error("Error unmarking page as reference:", error);
      toast({ title: "Error", description: "Failed to unmark page as reference", variant: "destructive" });
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
        imagePromptSpec: page.imagePromptSpec,
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
          artStyle: story.artStylePreset,
          size: previewMode ? "512x512" : imageSize,
          format: imageFormat,
          previewMode,
          guidance,
        },
      });

      if (error) throw error;

      // Process results
      data.results.forEach((result: { pageNumber: number; imageUrl?: string; error?: string }) => {
        if (result.imageUrl) {
          if (previewMode) {
            updatePageStatus(result.pageNumber, {
              previewImageUrl: result.imageUrl,
              isHighRes: false,
              status: "done",
              error: undefined,
            });
          } else {
            updatePageStatus(result.pageNumber, {
              imageUrl: result.imageUrl,
              isHighRes: true,
              status: "done",
              error: undefined,
            });
          }
        } else {
          updatePageStatus(result.pageNumber, {
            status: "failed",
            error: result.error || "Unknown error",
          });
        }
      });

      const successCount = data.results.filter((r: any) => r.imageUrl).length;
      const failCount = data.results.length - successCount;
      const reusedCount = data.results.filter((r: any) => r.reused).length;

      if (failCount === 0) {
        const message = previewMode 
          ? `Generated ${successCount} preview images`
          : reusedCount > 0 
            ? `Generated ${successCount} images (${reusedCount} reused from library, saved $${(reusedCount * 0.40).toFixed(2)})`
            : `Generated ${successCount} images`;
        
        toast({
          title: "Success!",
          description: message,
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

  const displayImageUrl = page.isHighRes ? page.imageUrl : (page.previewImageUrl || page.imageUrl);
  const hasPreviewOnly = page.previewImageUrl && !page.isHighRes;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Story Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {story.kids.join(" & ")}'s Adventure
            </h1>
            <p className="text-lg text-muted-foreground">
              {story.destination} • {story.month}
            </p>
          </div>

          {/* Image Generation Controls */}
          <div className="mb-8 p-6 bg-card rounded-xl border">
            <div className="flex flex-col gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Generate Illustrations</h3>
                <p className="text-sm text-muted-foreground">
                  Create AI-generated images for all {story.generatedPages.length} pages
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="preview-mode"
                    checked={previewMode}
                    onCheckedChange={(checked) => setPreviewMode(checked as boolean)}
                    disabled={isGenerating}
                  />
                  <Label htmlFor="preview-mode" className="text-sm font-medium cursor-pointer">
                    Preview Mode (512x512, faster & cheaper)
                  </Label>
                </div>
              </div>

              {!previewMode && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    disabled={isGenerating}
                    className="px-3 py-2 bg-background border rounded-lg text-sm"
                  >
                    <option value="1024x1024">Square (1024×1024)</option>
                    <option value="1024x1536">Portrait (1024×1536)</option>
                    <option value="1536x1024">Landscape (1536×1024)</option>
                  </select>
                  
                  <select
                    value={imageFormat}
                    onChange={(e) => setImageFormat(e.target.value)}
                    disabled={isGenerating}
                    className="px-3 py-2 bg-background border rounded-lg text-sm"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={generateAllImages}
                  disabled={isGenerating}
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    `Generate ${previewMode ? 'Previews' : 'Images'}`
                  )}
                </Button>

                {story.generatedPages.some(p => p.previewImageUrl && !p.isHighRes) && (
                  <Button
                    onClick={() => upgradeToHighRes()}
                    disabled={upgradingPages.size > 0}
                    size="lg"
                    variant="secondary"
                  >
                    {upgradingPages.size > 0 ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      "Upgrade All to High-Res"
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Photo Guidance Panel */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="guidance-enabled" className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="guidance-enabled"
                    checked={guidanceSettings.enabled}
                    onCheckedChange={(checked) => setGuidanceSettings(prev => ({ ...prev, enabled: checked as boolean }))}
                  />
                  Enable Photo Guidance
                </Label>
                <Button size="sm" variant="outline" onClick={() => setIsGuidanceOpen(!isGuidanceOpen)}>
                  {isGuidanceOpen ? "Hide" : "Show"} Settings
                </Button>
              </div>
              {isGuidanceOpen && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label className="block mb-1">Select Kids for Guidance</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableKids.map(kid => (
                        <Badge
                          key={kid.id}
                          variant={guidanceSettings.kidIds.includes(kid.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setGuidanceSettings(prev => {
                              const kidIds = prev.kidIds.includes(kid.id)
                                ? prev.kidIds.filter(id => id !== kid.id)
                                : [...prev.kidIds, kid.id];
                              return { ...prev, kidIds };
                            });
                          }}
                        >
                          {kid.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="guidance-strength" className="block mb-1">Guidance Strength</Label>
                    <Slider
                      id="guidance-strength"
                      min={0}
                      max={1}
                      step={0.05}
                      value={[guidanceSettings.strength]}
                      onValueChange={(value) => setGuidanceSettings(prev => ({ ...prev, strength: value[0] }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="guidance-downscale" className="block mb-1">Downscale for Reference Images</Label>
                    <select
                      id="guidance-downscale"
                      value={guidanceSettings.downscale}
                      onChange={(e) => setGuidanceSettings(prev => ({ ...prev, downscale: parseInt(e.target.value) }))}
                      className="px-3 py-2 bg-background border rounded-lg text-sm"
                    >
                      <option value={512}>512</option>
                      <option value={768}>768</option>
                      <option value={1024}>1024</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cost Breakdown and PDF Export sections */}
          {costStats && (
            <div className="mb-8 p-6 bg-card rounded-xl border">
              <h3 className="font-semibold text-lg mb-4">Cost Breakdown</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Images Generated: {costStats.imagesGenerated}</li>
                <li>Images Reused: {costStats.imagesReused}</li>
                <li>Estimated Cost: ${costStats.estimatedCost.toFixed(2)}</li>
                <li>Cost Saved: ${costStats.costSaved.toFixed(2)}</li>
              </ul>
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={async () => {
                    if (!id) return;
                    setIsExportingPdf(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("export-pdf", {
                        body: { storyId: id },
                      });
                      if (error) throw error;
                      setPdfUrl(data.url);
                      setPdfFileSize(data.fileSize);
                      toast({ title: "PDF Exported", description: "Your PDF is ready to download." });
                    } catch (error) {
                      console.error("Error exporting PDF:", error);
                      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  size="lg"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Export PDF
                    </>
                  )}
                </Button>
                {pdfUrl && (
                  <Button asChild variant="outline" size="lg">
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF ({pdfFileSize ? `${(pdfFileSize / 1024).toFixed(1)} KB` : "?"})
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Story Page Card */}
          <div className="bg-card rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-primary/20">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">
              {page.heading}
            </h2>

            {/* Image with resolution badge */}
            <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-2xl mb-6 flex items-center justify-center overflow-hidden">
              {displayImageUrl ? (
                <>
                  <img
                    src={displayImageUrl}
                    alt={page.heading}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  
                  {/* Resolution Badge */}
                  <Badge
                    className="absolute top-4 left-4"
                    variant={page.isHighRes ? "default" : "secondary"}
                  >
                    {page.isHighRes ? "High-Res" : "Preview"}
                  </Badge>

                  {/* Upgrade Button for individual page */}
                  {hasPreviewOnly && (
                    <Button
                      size="sm"
                      onClick={() => upgradeToHighRes([currentPage])}
                      disabled={upgradingPages.has(currentPage)}
                      className="absolute bottom-4 right-4"
                    >
                      {upgradingPages.has(currentPage) ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Upgrading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Upgrade to High-Res
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center p-8">
                  <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Click "Generate {previewMode ? 'Previews' : 'Images'}" above
                  </p>
                </div>
              )}
            </div>

            {/* Story Text */}
            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {page.text}
              </p>
            </div>

            {/* Interactive Elements */}
            {(page.questions && page.questions.length > 0) || (page.activities && page.activities.length > 0) ? (
              <div className="space-y-4 mt-8">
                {/* Questions Section */}
                {page.questions && page.questions.length > 0 && (
                  <Collapsible open={showInteractive} onOpenChange={setShowInteractive}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          Questions to Ask Your Child
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showInteractive ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 p-4 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg">
                      <ul className="space-y-2">
                        {page.questions.map((question, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                            <span className="text-sm text-foreground">{question}</span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Activities Section */}
                {page.activities && page.activities.length > 0 && (
                  <Collapsible defaultOpen={showInteractive}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-green-50 dark:bg-green-950/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="font-semibold text-green-900 dark:text-green-100">
                          Try This!
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showInteractive ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-3">
                      {page.activities.map((activity, index) => (
                        <div key={index} className="p-4 bg-green-50/50 dark:bg-green-950/10 rounded-lg">
                          <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                            {activity.title}
                          </h4>
                          <p className="text-sm text-foreground mb-2">
                            {activity.description}
                          </p>
                          {activity.materials && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Materials:</strong> {activity.materials}
                            </p>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : null}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-8">
            <Button
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
              variant="outline"
              size="lg"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {story.generatedPages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentPage
                      ? 'bg-primary w-8'
                      : 'bg-muted hover:bg-muted-foreground/50'
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>

            <Button
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              variant="outline"
              size="lg"
            >
              Next
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Story;
