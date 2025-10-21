import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImagePromptSpec {
  scene: string;
  location?: string;
  landmark?: string;
  mood: string;
  timeOfDay?: string;
  characters: Array<{ kidName: string; descriptor: string }>;
}

interface AddToLibraryRequest {
  pageId: string;
  imageUrl: string;
  imagePromptSpec: ImagePromptSpec;
  artStyle: string;
}

// Simple keyword-based scene type classifier
function classifySceneType(scene: string): string {
  const lowerScene = scene.toLowerCase();
  
  if (lowerScene.includes('arriving') || lowerScene.includes('airport') || 
      lowerScene.includes('station') || lowerScene.includes('first glimpse')) {
    return 'arrival';
  }
  if (lowerScene.includes('walking') || lowerScene.includes('exploring') || 
      lowerScene.includes('discovering') || lowerScene.includes('strolling')) {
    return 'exploring';
  }
  if (lowerScene.includes('visit') || lowerScene.includes('at the')) {
    return 'landmark';
  }
  if (lowerScene.includes('eating') || lowerScene.includes('shopping') || 
      lowerScene.includes('playing') || lowerScene.includes('learning')) {
    return 'activity';
  }
  if (lowerScene.includes('inside') || lowerScene.includes('museum') || 
      lowerScene.includes('restaurant') || lowerScene.includes('hotel')) {
    return 'indoor';
  }
  if (lowerScene.includes('park') || lowerScene.includes('street') || 
      lowerScene.includes('garden') || lowerScene.includes('beach')) {
    return 'outdoor';
  }
  if (lowerScene.includes('goodbye') || lowerScene.includes('leaving') || 
      lowerScene.includes('final') || lowerScene.includes('last')) {
    return 'farewell';
  }
  
  return 'other';
}

// Generate searchable tags from metadata
function generateTags(spec: ImagePromptSpec): string[] {
  const tags: string[] = [];
  
  // Add character names (check if characters exist and is an array)
  if (spec.characters && Array.isArray(spec.characters)) {
    spec.characters.forEach(char => {
      if (char && char.kidName) {
        tags.push(char.kidName.toLowerCase());
      }
    });
  }
  
  // Add location/landmark
  if (spec.location) tags.push(spec.location.toLowerCase());
  if (spec.landmark) tags.push(spec.landmark.toLowerCase());
  
  // Add mood
  if (spec.mood) tags.push(spec.mood.toLowerCase());
  
  // Add time of day
  if (spec.timeOfDay) tags.push(spec.timeOfDay.toLowerCase());
  
  // Extract key words from scene
  if (spec.scene) {
    const sceneWords = spec.scene.toLowerCase().split(' ')
      .filter(word => word.length > 4) // Only meaningful words
      .slice(0, 5); // Max 5 words
    tags.push(...sceneWords);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pageId, imageUrl, imagePromptSpec, artStyle }: AddToLibraryRequest = await req.json();

    console.log('Adding image to library:', { pageId, artStyle });

    // Extract metadata from imagePromptSpec
    const sceneType = classifySceneType(imagePromptSpec.scene);
    const tags = generateTags(imagePromptSpec);
    
    // Format characters as JSONB (handle missing or empty characters)
    const characters = (imagePromptSpec.characters && Array.isArray(imagePromptSpec.characters))
      ? imagePromptSpec.characters.map(c => ({
          kidName: c.kidName,
          descriptor: c.descriptor
        }))
      : [];

    // Check if already exists
    const { data: existing } = await supabase
      .from('image_library')
      .select('id')
      .eq('page_id', pageId)
      .single();

    if (existing) {
      console.log('Image already in library, skipping');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already in library',
        id: existing.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert into library
    const { data, error } = await supabase
      .from('image_library')
      .insert({
        page_id: pageId,
        image_url: imageUrl,
        characters,
        scene_type: sceneType,
        location: imagePromptSpec.location || null,
        landmark: imagePromptSpec.landmark || null,
        mood: imagePromptSpec.mood,
        time_of_day: imagePromptSpec.timeOfDay || null,
        art_style: artStyle,
        tags,
        quality_score: 0.5, // Default quality
        reuse_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to library:', error);
      throw error;
    }

    console.log('Successfully added to library:', data.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: data.id,
      sceneType,
      tags 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in add-to-library:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});