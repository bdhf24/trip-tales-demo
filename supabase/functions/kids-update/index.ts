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

    const { kidId, name, age, descriptor, interests } = await req.json();

    if (!kidId) {
      return new Response(
        JSON.stringify({ error: 'kidId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (age !== undefined) updates.age = age;
    if (descriptor !== undefined) updates.descriptor = descriptor;
    if (interests !== undefined) updates.interests = interests;

    const { data: kid, error } = await supabase
      .from('kids')
      .update(updates)
      .eq('id', kidId)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ kid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in kids-update function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
