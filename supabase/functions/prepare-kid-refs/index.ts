import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const kidRefsSchema = z.object({
  kidIds: z.array(z.string().uuid()).min(1, { message: 'At least one kid ID is required' }),
  refStrategy: z.string().optional(),
  selectedPhotoIds: z.array(z.string().uuid()).optional(),
  maxRef: z.number().int().min(1).max(10).optional(),
  downscale: z.number().int().min(256).max(2048).optional(),
  sendOriginals: z.boolean().optional()
});

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
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    
    // Validate input
    const validation = kidRefsSchema.safeParse(requestBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.issues 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      kidIds, 
      refStrategy = 'auto-best', 
      selectedPhotoIds,
      maxRef = 3,
      downscale = 768,
      sendOriginals = false
    } = validation.data;

    const results = [];

    for (const kidId of kidIds) {
      const refs = [];
      
      // Fetch kid data to get appearance_notes and descriptor
      const { data: kidData, error: kidError } = await supabase
        .from('kids')
        .select('id, name, descriptor, appearance_notes')
        .eq('id', kidId)
        .single();
      
      if (kidError) {
        console.error(`Error fetching kid data for ${kidId}:`, kidError);
        continue;
      }
      
      // Fetch photos for this kid
      const { data: photos, error: photosError } = await supabase
        .from('kid_photos')
        .select('*')
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false });

      if (photosError) {
        console.error(`Error fetching photos for kid ${kidId}:`, photosError);
      } else if (photos && photos.length > 0) {
        let selectedPhotos = photos;

        // Apply selection strategy
        if (refStrategy === 'manual-pick' && selectedPhotoIds && selectedPhotoIds.length > 0) {
          selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
        }

        // Limit to maxRef
        selectedPhotos = selectedPhotos.slice(0, maxRef);

        // Process photos
        for (const photo of selectedPhotos) {
          let url = photo.image_url;
          
          // Downscale if requested (placeholder for now)
          if (!sendOriginals && downscale) {
            url = await downscaleImage(photo.image_url, downscale);
          }

          refs.push({
            photoId: photo.id,
            url,
            type: 'photo'
          });
        }
      }

      // Fetch reference story pages for this kid
      const { data: references, error: refError } = await supabase
        .from('reference_images')
        .select(`
          id,
          pages!inner (
            id,
            image_url
          )
        `)
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false })
        .limit(maxRef);

      if (refError) {
        console.error(`Error fetching references for kid ${kidId}:`, refError);
      } else if (references && references.length > 0) {
        for (const ref of references) {
          const page = ref.pages as any;
          if (page && page.image_url) {
            refs.push({
              photoId: ref.id,
              url: page.image_url,
              type: 'story_page'
            });
          }
        }
      }

      if (refs.length === 0) {
        console.log(`No photos or references found for kid ${kidId}`);
        continue;
      }

      // Limit total refs to maxRef
      const limitedRefs = refs.slice(0, maxRef);

      results.push({
        kidId: kidData.id,
        kidName: kidData.name,
        descriptor: kidData.descriptor,
        appearanceNotes: kidData.appearance_notes,
        refs: limitedRefs
      });
    }

    return new Response(
      JSON.stringify({ results }),
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
