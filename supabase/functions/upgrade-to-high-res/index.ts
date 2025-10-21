import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { storyId, pageNumbers } = await req.json();

    if (!storyId || !pageNumbers || !Array.isArray(pageNumbers)) {
      return new Response(
        JSON.stringify({ error: 'storyId and pageNumbers array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upgrading pages to high-res for story ${storyId}, pages:`, pageNumbers);

    // Fetch pages that need upgrading
    const { data: pages, error: fetchError } = await supabase
      .from('pages')
      .select('*')
      .eq('story_id', storyId)
      .in('page_number', pageNumbers);

    if (fetchError) throw fetchError;

    const results = [];
    
    for (const page of pages) {
      try {
        console.log(`Upgrading page ${page.page_number} to high-res`);
        
        // Call generate-image with high-res parameters
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-image', {
          body: {
            imagePrompt: page.image_prompt,
            storyId: page.story_id,
            pageNumber: page.page_number,
            size: '1024x1024',
            resolution: 'high-res'
          }
        });

        if (imageError) {
          console.error(`Error generating high-res for page ${page.page_number}:`, imageError);
          results.push({
            pageNumber: page.page_number,
            status: 'failed',
            error: imageError.message
          });
          continue;
        }

        // Update page with high-res image URL
        const { error: updateError } = await supabase
          .from('pages')
          .update({
            image_url: imageData.imageUrl,
            is_high_res: true
          })
          .eq('id', page.id);

        if (updateError) throw updateError;

        results.push({
          pageNumber: page.page_number,
          status: 'success',
          imageUrl: imageData.imageUrl
        });

        console.log(`Successfully upgraded page ${page.page_number} to high-res`);
      } catch (error) {
        console.error(`Error upgrading page ${page.page_number}:`, error);
        results.push({
          pageNumber: page.page_number,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in upgrade-to-high-res function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});