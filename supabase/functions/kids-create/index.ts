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

    const { name, age, userId, interests } = await req.json();

    if (!name || !age) {
      return new Response(
        JSON.stringify({ error: 'Name and age are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a default user if userId not provided
    let finalUserId = userId;
    if (!finalUserId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({ name: 'Default User' })
        .select()
        .single();
      
      if (userError) throw userError;
      finalUserId = user.id;
    }

    const { data: kid, error } = await supabase
      .from('kids')
      .insert({ 
        name, 
        age, 
        user_id: finalUserId,
        descriptor: null,
        interests: interests || []
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ kid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in kids-create function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
