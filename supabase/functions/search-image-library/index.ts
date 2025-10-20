import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  characters: string[];
  scene: string;
  location?: string;
  landmark?: string;
  mood: string;
  timeOfDay?: string;
  artStyle: string;
  minQuality?: number;
}

interface LibraryMatch {
  id: string;
  imageUrl: string;
  matchScore: number;
  pageId: string;
  reuseCount: number;
  qualityScore: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      characters,
      scene,
      location,
      landmark,
      mood,
      timeOfDay,
      artStyle,
      minQuality = 0.5
    }: SearchRequest = await req.json();

    console.log('Searching library for:', { characters, scene, location, mood, artStyle });

    // Query the image library
    const { data: libraryImages, error } = await supabase
      .from('image_library')
      .select('*')
      .gte('quality_score', minQuality)
      .eq('art_style', artStyle);

    if (error) {
      console.error('Error querying library:', error);
      throw error;
    }

    if (!libraryImages || libraryImages.length === 0) {
      console.log('No library images found');
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Score each image based on match criteria
    const scoredMatches: LibraryMatch[] = libraryImages
      .map((img) => {
        let score = 0;
        const imgCharacters = (img.characters as any[]).map((c: any) => c.kidName);

        // Must match: all character names (60 points)
        const allCharactersMatch = characters.every(char => 
          imgCharacters.some((imgChar: string) => 
            imgChar.toLowerCase() === char.toLowerCase()
          )
        ) && imgCharacters.length === characters.length;

        if (!allCharactersMatch) return null; // Skip if characters don't match

        score += 60;

        // High score: same location (15 points)
        if (location && img.location?.toLowerCase() === location.toLowerCase()) {
          score += 15;
        }

        // High score: same landmark (10 points)
        if (landmark && img.landmark?.toLowerCase().includes(landmark.toLowerCase())) {
          score += 10;
        }

        // Medium score: same mood (10 points)
        if (mood && img.mood?.toLowerCase() === mood.toLowerCase()) {
          score += 10;
        }

        // Low score: same time of day (5 points)
        if (timeOfDay && img.time_of_day?.toLowerCase() === timeOfDay.toLowerCase()) {
          score += 5;
        }

        // Bonus for higher quality (normalize to 0-10 scale)
        score += img.quality_score * 10;

        // Small penalty for heavily reused images (max -5)
        score -= Math.min(img.reuse_count * 0.5, 5);

        return {
          id: img.id,
          imageUrl: img.image_url,
          matchScore: score,
          pageId: img.page_id,
          reuseCount: img.reuse_count,
          qualityScore: img.quality_score
        };
      })
      .filter((match): match is LibraryMatch => match !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3); // Top 3 matches

    console.log(`Found ${scoredMatches.length} matches, top score: ${scoredMatches[0]?.matchScore || 0}`);

    return new Response(JSON.stringify({ matches: scoredMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in search-image-library:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});