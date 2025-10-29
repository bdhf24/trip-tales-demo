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
      guidance,
      storyPageReferences = [],
      resolution = "high-res" // "preview" or "high-res"
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

    // If guidance is enabled and we have reference images or story page references
    if (guidance?.enabled && (guidance?.results?.length > 0 || guidance?.storyPageReferences?.length > 0)) {
      console.log(`Using photo guidance with ${guidance.results?.length || 0} kids and ${guidance.storyPageReferences?.length || 0} story page references`);
      
      // Enhance prompt with appearance notes and descriptors (OPTIMIZED: use array.join for better performance)
      const promptParts = [sanitized];
      
      // Extract character names from the prompt to ensure all are included
      const characterNames = guidance.results?.map((r: any) => r.kidName) || [];
      if (characterNames.length > 0) {
        promptParts.push(`\n\nMANDATORY: ALL characters (${characterNames.join(", ")}) MUST appear in this image. Every single character must be clearly visible and present in the scene.`);
      }
      
      // OPTIMIZATION: Build character descriptions in one pass instead of multiple string concatenations
      if (guidance.results && guidance.results.length > 0) {
        const characterDescriptions = guidance.results
          .map((kidRef: any) => {
            const parts: string[] = [];
            if (kidRef.appearanceNotes) {
              parts.push(`Character appearance notes for ${kidRef.kidName}: ${kidRef.appearanceNotes}`);
            }
            if (kidRef.descriptor) {
              parts.push(`Character description for ${kidRef.kidName}: ${kidRef.descriptor}`);
            }
            return parts.join('. ');
          })
          .filter((desc: string) => desc.length > 0);
        
        if (characterDescriptions.length > 0) {
          promptParts.push('\n\n' + characterDescriptions.join('\n\n'));
        }
      }
      
      // Add context about story page references for consistency
      if (guidance.storyPageReferences && guidance.storyPageReferences.length > 0) {
        promptParts.push('\n\nMaintain consistent character appearance with previous story pages. Use previous page images as reference for character facial features while allowing clothing to vary.');
      }
      
      // Add story content alignment reminder
      promptParts.push('\n\nSTORY CONTENT ALIGNMENT: This illustration must visually depict the exact scenes, actions, and details described in the story text. The image should match what is happening in the narrative, including specific activities, settings, and visual elements mentioned in the story.');
      
      const enhancedPrompt = promptParts.join('');
      
      // Build a multi-part message with text + reference images
      const contentParts: any[] = [
        {
          type: "text",
          text: `${enhancedPrompt}

CRITICAL CHARACTER CONSISTENCY REQUIREMENTS:
- Use the provided reference images to maintain EXACT character appearance throughout the entire story
- Match PRECISELY: hair color, hair style, facial features, eye color, skin tone, face shape, and body type from the references
- Each character MUST look identical to their reference photos in every scene
- Character appearance strength: ${guidance.strength || 0.45}

MANDATORY CHARACTER PRESENCE:
- ALL characters mentioned in the story MUST appear in this illustration
- Every character must be clearly visible, not hidden or in the background
- If multiple characters are part of the story, ALL of them must be present and visible in this image
- Do not exclude any character from any scene

FACIAL FEATURES LOCKED (DO NOT CHANGE):
- Hair color, hair style, eye color, skin tone, face shape - these MUST remain IDENTICAL to reference photos
- Distinctive facial features (freckles, glasses, etc.) must be consistent across all pages
- Facial features are PERMANENT and cannot change between pages

CLOTHING AND POSES CAN VARY:
- Clothing, accessories, and poses may change naturally based on the scene and story context
- Characters can wear different outfits appropriate to the setting and activities
- Poses can vary (standing, sitting, running, etc.) to match the story action
- While appearance changes, facial features remain locked

CRITICAL FRAMING AND COMPOSITION RULES - FOLLOW EXACTLY:
- WIDE SHOT REQUIRED: Use a wide camera angle that shows the full scene with plenty of space around characters
- FULL BODY FRAMING: Show characters from head to toe completely within the frame
- NO CROPPING: Absolutely do not crop or cut off ANY part of characters - heads, bodies, arms, legs, or feet MUST be fully visible
- ADEQUATE SPACING: Leave substantial empty space (at least 20% of image) around all sides of characters
- CENTERED COMPOSITION: Position all characters in the CENTER of the frame, not at edges
- ZOOM OUT: The camera should be pulled back far enough to capture the entire scene and all characters completely
- ENVIRONMENTAL CONTEXT: Include the full surrounding environment - ground, sky, and background elements
- COMPLETE VISIBILITY: Every person and object mentioned in the scene description must be completely visible and unobstructed

POSE VARIATION (while maintaining appearance):
- Vary poses, actions, and body language dynamically based on the scene
- Show diverse activities: standing, sitting, kneeling, running, pointing, waving, jumping, or interacting with objects
- Keep character APPEARANCE consistent while changing their ACTIONS and POSES
- Avoid repetitive poses across pages, but maintain the same character likeness`
        }
      ];

      // Add kid photo reference images
      if (guidance.results && guidance.results.length > 0) {
        for (const kidRef of guidance.results) {
          for (const ref of kidRef.refs) {
            contentParts.push({
              type: "image_url",
              image_url: {
                url: ref.url
              }
            });
          }
        }
      }
      
      // Add story page references for consistency (limit to last 3)
      if (guidance.storyPageReferences && guidance.storyPageReferences.length > 0) {
        const recentPages = guidance.storyPageReferences.slice(-3);
        for (const pageUrl of recentPages) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: pageUrl
            }
          });
        }
      }

      messageContent = contentParts;
      usedGuidance = true;
      console.log(`Enhanced prompt with appearance notes and ${contentParts.length - 1} reference images`);
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

    // Update page with image URL and resolution flag
    const columnToUpdate = resolution === "preview" ? "preview_image_url" : "image_url";
    const updateData: any = {
      [columnToUpdate]: publicUrl
    };
    
    // If high-res, mark as high-res
    if (resolution === "high-res") {
      updateData.is_high_res = true;
    }
    
    const { data: updatedPage, error: updateError } = await supabase
      .from('pages')
      .update(updateData)
      .eq('story_id', storyId)
      .eq('page_number', pageNumber)
      .select('id, image_prompt_spec, story:stories(art_style)')
      .single();

    if (updateError) {
      console.error('Error updating page with image URL:', updateError);
    }

    // Add to image library for future reuse
    if (updatedPage && updatedPage.image_prompt_spec) {
      try {
        const story = (updatedPage.story as any)?.[0];
        const addToLibraryResponse = await fetch(`${SUPABASE_URL}/functions/v1/add-to-library`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: updatedPage.id,
            imageUrl: publicUrl,
            imagePromptSpec: updatedPage.image_prompt_spec,
            artStyle: story?.art_style || 'storybook-cozy'
          })
        });

        if (addToLibraryResponse.ok) {
          console.log('Successfully added image to library');
        } else {
          console.warn('Failed to add image to library:', await addToLibraryResponse.text());
        }
      } catch (libraryError) {
        console.warn('Error adding to library (non-critical):', libraryError);
      }
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
