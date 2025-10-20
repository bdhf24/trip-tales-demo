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

    const { kidId } = await req.json();

    if (!kidId) {
      return new Response(
        JSON.stringify({ error: 'kidId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all photos to delete from storage
    const { data: photos } = await supabase
      .from('kid_photos')
      .select('image_url')
      .eq('kid_id', kidId);

    // Delete photos from storage
    if (photos && photos.length > 0) {
      const filePaths = photos.map(p => {
        const url = new URL(p.image_url);
        return url.pathname.split('/').slice(-2).join('/');
      });
      
      await supabase.storage
        .from('kid-photos')
        .remove(filePaths);
    }

    // Delete kid (cascade will delete photos records)
    const { error } = await supabase
      .from('kids')
      .delete()
      .eq('id', kidId);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in kids-delete function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
