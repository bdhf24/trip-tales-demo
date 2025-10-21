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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Count stories with pages that have images but aren't in the library
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, story_id, image_url, image_prompt_spec')
      .not('image_url', 'is', null);

    if (pagesError) throw pagesError;

    // Get existing library entries
    const { data: libraryEntries, error: libraryError } = await supabase
      .from('image_library')
      .select('page_id');

    if (libraryError) throw libraryError;

    const libraryPageIds = new Set(libraryEntries?.map(e => e.page_id) || []);
    
    // Filter pages not in library
    const eligiblePages = pages?.filter(p => 
      p.image_url && 
      p.image_prompt_spec && 
      !libraryPageIds.has(p.id)
    ) || [];

    // Count unique stories
    const eligibleStoryIds = new Set(eligiblePages.map(p => p.story_id));

    return new Response(
      JSON.stringify({
        eligibleStories: eligibleStoryIds.size,
        eligiblePages: eligiblePages.length,
        pages: eligiblePages.map(p => ({
          id: p.id,
          storyId: p.story_id,
          imageUrl: p.image_url
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in backfill-approval-check function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});