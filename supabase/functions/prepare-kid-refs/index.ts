import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple image downscaling using canvas-like approach
async function downscaleImage(imageUrl: string, targetSize: number): Promise<string> {
  try {
    // Fetch the original image
    const response = await fetch(imageUrl);
    const imageBuffer = await response.arrayBuffer();
    
    // For now, we'll return the original URL
    // In production, you'd use a proper image processing library
    // or service to downscale images
    return imageUrl;
  } catch (error) {
    console.error('Error downscaling image:', error);
    return imageUrl;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { 
      kidIds, 
      refStrategy = 'auto-best', 
      selectedPhotoIds,
      maxRef = 3,
      downscale = 768,
      sendOriginals = false
    } = await req.json();

    if (!kidIds || !Array.isArray(kidIds) || kidIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'kidIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const kidId of kidIds) {
      // Fetch photos for this kid
      const { data: photos, error: photosError } = await supabase
        .from('kid_photos')
        .select('*')
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false });

      if (photosError) {
        console.error(`Error fetching photos for kid ${kidId}:`, photosError);
        continue;
      }

      if (!photos || photos.length === 0) {
        continue;
      }

      let selectedPhotos = photos;

      // Apply selection strategy
      if (refStrategy === 'manual-pick' && selectedPhotoIds && selectedPhotoIds.length > 0) {
        selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
      }

      // Limit to maxRef
      selectedPhotos = selectedPhotos.slice(0, maxRef);

      // Process photos
      const refs = await Promise.all(
        selectedPhotos.map(async (photo) => {
          let url = photo.image_url;
          
          // Downscale if requested
          if (!sendOriginals && downscale) {
            url = await downscaleImage(photo.image_url, downscale);
          }

          return {
            photoId: photo.id,
            url,
            kidId
          };
        })
      );

      results.push({
        kidId,
        refs
      });
    }

    return new Response(
      JSON.stringify({ kidRefs: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in prepare-kid-refs function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
