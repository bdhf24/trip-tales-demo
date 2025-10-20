import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting backfill of image library...');

    // Get all pages with images and their stories
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select(`
        id,
        image_url,
        image_prompt_spec,
        story:stories (
          art_style
        )
      `)
      .not('image_url', 'is', null);

    if (pagesError) {
      console.error('Error fetching pages:', pagesError);
      throw pagesError;
    }

    if (!pages || pages.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No pages with images found',
        added: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${pages.length} pages with images`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    // Process each page
    for (const page of pages) {
      try {
        const story = (page.story as any)?.[0];
        if (!story || !page.image_prompt_spec) {
          console.log(`Skipping page ${page.id} - missing story or spec`);
          skipped++;
          continue;
        }

        // Call add-to-library function
        const response = await fetch(`${supabaseUrl}/functions/v1/add-to-library`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: page.id,
            imageUrl: page.image_url,
            imagePromptSpec: page.image_prompt_spec,
            artStyle: story.art_style
          })
        });

        if (!response.ok) {
          console.error(`Failed to add page ${page.id}:`, await response.text());
          errors++;
          continue;
        }

        const result = await response.json();
        if (result.success) {
          added++;
        } else {
          skipped++;
        }

      } catch (error) {
        console.error(`Error processing page ${page.id}:`, error);
        errors++;
      }
    }

    console.log(`Backfill complete: ${added} added, ${skipped} skipped, ${errors} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      total: pages.length,
      added,
      skipped,
      errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in backfill-image-library:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});