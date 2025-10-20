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

    const url = new URL(req.url);
    const kidId = url.searchParams.get('kidId');

    if (!kidId) {
      return new Response(
        JSON.stringify({ error: 'kidId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: kid, error: kidError } = await supabase
      .from('kids')
      .select('*')
      .eq('id', kidId)
      .single();

    if (kidError) throw kidError;

    const { data: photos, error: photosError } = await supabase
      .from('kid_photos')
      .select('*')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: false });

    if (photosError) throw photosError;

    return new Response(
      JSON.stringify({ kid, photos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in kids-get function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
