import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PageRequest {
  pageNumber: number;
  imagePrompt: string;
  imagePromptSpec?: any;
}

interface GenerateAllRequest {
  storyId: string;
  pages: PageRequest[];
  artStyle: string;
  size?: string;
  format?: string;
  guidance?: any;
  previewMode?: boolean; // New: Generate preview images (512x512) instead of high-res
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImageWithRetry(
  storyId: string,
  pageNumber: number,
  imagePrompt: string,
  imagePromptSpec: any,
  size: string,
  format: string,
  artStyle: string,
  maxRetries = 2,
  guidance?: any
): Promise<{ pageNumber: number; imageUrl?: string; error?: string; usedGuidance?: boolean; reused?: boolean }> {
  const delays = [1000, 3000]; // 1s, then 3s
  
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  // First, check the image library for a matching image
  try {
    console.log(`Checking image library for page ${pageNumber}...`);
    const libraryResponse = await fetch(`${SUPABASE_URL}/functions/v1/search-image-library`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        characters: imagePromptSpec.characters?.map((c: any) => c.kidName) || [],
        scene: imagePromptSpec.scene || '',
        location: imagePromptSpec.location,
        landmark: imagePromptSpec.landmarkDetail,
        mood: imagePromptSpec.mood || 'joyful',
        timeOfDay: imagePromptSpec.timeOfDay,
        artStyle: artStyle,
        minQuality: 0.5
      })
    });

    if (libraryResponse.ok) {
      const libraryData = await libraryResponse.json();
      const topMatch = libraryData.matches?.[0];
      
      // If we found a good match (score >= 70), reuse it
      if (topMatch && topMatch.matchScore >= 70) {
        console.log(`Found library match for page ${pageNumber} (score: ${topMatch.matchScore})`);
        
        // Update the page with the reused image URL
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        await supabase
          .from('pages')
          .update({ image_url: topMatch.imageUrl })
          .eq('story_id', storyId)
          .eq('page_number', pageNumber);

        // Increment reuse count and update last_reused_at
        await supabase
          .from('image_library')
          .update({ 
            reuse_count: topMatch.reuseCount + 1,
            last_reused_at: new Date().toISOString()
          })
          .eq('id', topMatch.id);

        return {
          pageNumber,
          imageUrl: topMatch.imageUrl,
          reused: true,
          usedGuidance: false
        };
      }
    }
  } catch (libraryError) {
    console.warn(`Library check failed for page ${pageNumber} (non-critical):`, libraryError);
  }

  // No library match, proceed with generation
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Generating image for page ${pageNumber}, attempt ${attempt + 1}`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          imagePrompt,
          storyId,
          pageNumber,
          size,
          format,
          guidance,
          resolution: size === "512x512" ? "preview" : "high-res"
        }),
      });

      if (response.status === 429) {
        console.log(`Rate limited on page ${pageNumber}, waiting 5s...`);
        await sleep(5000);
        if (attempt < maxRetries) continue;
        throw new Error("Rate limit exceeded");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`Successfully generated image for page ${pageNumber}`);
      return { pageNumber, imageUrl: data.imageUrl, usedGuidance: data.usedGuidance, reused: false };

    } catch (error) {
      console.error(`Error generating image for page ${pageNumber}, attempt ${attempt + 1}:`, error);
      
      // If this is not the last attempt and it's a retryable error
      if (attempt < maxRetries && error instanceof Error) {
        const isRetryable = 
          error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("5") ||
          error.message.includes("Rate limit");
          
        if (isRetryable) {
          const delay = delays[attempt] || 3000;
          console.log(`Retrying page ${pageNumber} after ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      }
      
      // Final attempt failed
      return {
        pageNumber,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return {
    pageNumber,
    error: "Max retries exceeded",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyId, pages, artStyle, size = "1024x1024", format = "png", guidance, previewMode = false } = await req.json() as GenerateAllRequest;
    
    if (!storyId || !pages || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storyId, pages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Adjust size for preview mode
    const actualSize = previewMode ? "512x512" : size;
    console.log(`Starting sequential generation for ${pages.length} pages with library check (${previewMode ? 'preview' : 'high-res'} mode)`);
    
    const results = [];
    let imagesGenerated = 0;
    let imagesReused = 0;
    const generatedImageUrls: string[] = []; // Track generated images for reference chaining
    
    // Generate images sequentially (concurrency = 1)
    for (const page of pages) {
      // Enhance guidance with previously generated page images for consistency
      const enhancedGuidance = guidance ? {
        ...guidance,
        storyPageReferences: generatedImageUrls.slice(-3) // Use last 3 pages as references
      } : undefined;
      
      const result = await generateImageWithRetry(
        storyId,
        page.pageNumber,
        page.imagePrompt,
        page.imagePromptSpec || {},
        actualSize,
        format,
        artStyle,
        2,
        enhancedGuidance
      );
      results.push(result);
      
      // Add generated image URL to reference chain for subsequent pages
      if (result.imageUrl && !result.reused) {
        generatedImageUrls.push(result.imageUrl);
      }
      
      if (result.reused) {
        imagesReused++;
      } else if (result.imageUrl) {
        imagesGenerated++;
      }
    }

    console.log(`Completed: ${imagesGenerated} generated, ${imagesReused} reused from library`);

    // Update story cost tracking
    const COST_PER_IMAGE = 0.40;
    const costSaved = imagesReused * COST_PER_IMAGE;
    const estimatedCost = imagesGenerated * COST_PER_IMAGE;

    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('stories')
          .update({
            images_generated: imagesGenerated,
            images_reused: imagesReused,
            estimated_cost: estimatedCost,
            cost_saved: costSaved
          })
          .eq('id', storyId);
      }
    } catch (updateError) {
      console.warn('Failed to update story cost tracking:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        results,
        stats: {
          imagesGenerated,
          imagesReused,
          estimatedCost: estimatedCost.toFixed(2),
          costSaved: costSaved.toFixed(2)
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-all-images:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate images" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
