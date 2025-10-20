import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PageRequest {
  pageNumber: number;
  imagePrompt: string;
}

interface GenerateAllRequest {
  storyId: string;
  pages: PageRequest[];
  size?: string;
  format?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImageWithRetry(
  storyId: string,
  pageNumber: number,
  imagePrompt: string,
  size: string,
  format: string,
  maxRetries = 2
): Promise<{ pageNumber: number; imageUrl?: string; error?: string }> {
  const delays = [1000, 3000]; // 1s, then 3s
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Generating image for page ${pageNumber}, attempt ${attempt + 1}`);
      
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL not configured");
      }

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
      return { pageNumber, imageUrl: data.imageUrl };

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
    const { storyId, pages, size = "1024x1024", format = "png" } = await req.json() as GenerateAllRequest;
    
    if (!storyId || !pages || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storyId, pages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting sequential generation for ${pages.length} pages`);
    
    const results = [];
    
    // Generate images sequentially (concurrency = 1)
    for (const page of pages) {
      const result = await generateImageWithRetry(
        storyId,
        page.pageNumber,
        page.imagePrompt,
        size,
        format
      );
      results.push(result);
    }

    console.log(`Completed generation for all ${pages.length} pages`);

    return new Response(
      JSON.stringify({ results }),
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
