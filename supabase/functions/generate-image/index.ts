import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize prompt to remove brand names and unsafe content
function sanitizePrompt(prompt: string): string {
  let sanitized = prompt;
  
  // Remove common brand names (case-insensitive)
  const brandNames = [
    'disney', 'pixar', 'dreamworks', 'marvel', 'dc comics',
    'coca-cola', 'pepsi', 'mcdonalds', 'nike', 'adidas'
  ];
  
  brandNames.forEach(brand => {
    const regex = new RegExp(brand, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // Remove potentially unsafe keywords
  const unsafeTerms = [
    'nightclub', 'bar', 'alcohol', 'beer', 'wine',
    'dangerous', 'violent', 'scary', 'horror'
  ];
  
  unsafeTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // Clean up extra spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Truncate to max 650 chars
  if (sanitized.length > 650) {
    sanitized = sanitized.substring(0, 650);
  }
  
  return sanitized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      imagePrompt, 
      storyId, 
      pageNumber, 
      size = "1024x1024", 
      format = "png",
      guidance 
    } = await req.json();
    
    if (!imagePrompt || !storyId || pageNumber === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imagePrompt, storyId, pageNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    // Sanitize the prompt
    const sanitized = sanitizePrompt(imagePrompt);
    console.log(`Generating image for story ${storyId}, page ${pageNumber}`);
    console.log(`Sanitized prompt: ${sanitized}`);
    console.log(`Guidance enabled: ${guidance?.enabled || false}`);

    // Prepare message content
    let messageContent: any = sanitized;
    let usedGuidance = false;

    // If guidance is enabled and we have reference images
    if (guidance?.enabled && guidance?.kidRefs && guidance.kidRefs.length > 0) {
      console.log(`Using photo guidance with ${guidance.kidRefs.length} reference images`);
      
      // Build a multi-part message with text + reference images
      const contentParts: any[] = [
        {
          type: "text",
          text: `Create an illustration based on this description: ${sanitized}\n\nUse the provided reference images to ensure character likeness (strength: ${guidance.strength || 0.45}). Match the hair, facial features, skin tone, and general appearance from the references.`
        }
      ];

      // Add reference images
      for (const kidRef of guidance.kidRefs) {
        for (const ref of kidRef.refs) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: ref.url
            }
          });
        }
      }

      messageContent = contentParts;
      usedGuidance = true;
    }

    // Generate image using Lovable AI (Nano banana)
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Image generation error:", imageResponse.status, errorText);
      
      if (imageResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (imageResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) {
      throw new Error("No image returned from AI");
    }

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = base64Image.split(",")[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fileName = `stories/${storyId}/page-${pageNumber}.${format}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("story-images")
      .upload(fileName, imageBuffer, {
        contentType: `image/${format}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("story-images")
      .getPublicUrl(fileName);

    // Update page with image URL
    const { error: updateError } = await supabase
      .from('pages')
      .update({ image_url: publicUrl })
      .eq('story_id', storyId)
      .eq('page_number', pageNumber);

    if (updateError) {
      console.error('Error updating page with image URL:', updateError);
    }

    console.log(`Successfully generated and uploaded image: ${publicUrl}`);

    return new Response(
      JSON.stringify({ imageUrl: publicUrl, usedGuidance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-image:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate image" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
