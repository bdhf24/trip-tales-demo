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

    const { kidId } = await req.json();

    if (!kidId) {
      return new Response(
        JSON.stringify({ error: 'kidId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch kid and their photos
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
      .limit(3);

    if (photosError) throw photosError;

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No photos found for this kid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback: return a template descriptor
      const descriptor = `${kid.name} (${kid.age}): Please add a description of their appearance.`;
      
      const { error: updateError } = await supabase
        .from('kids')
        .update({ descriptor })
        .eq('id', kidId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ descriptor, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use vision model to extract descriptor
    const systemPrompt = `You are creating a safe, high-level visual character descriptor for a children's picture-book. Do NOT identify brands, exact locations, or sensitive info. Describe only: approximate hair style & color, skin tone in broad terms, eye impression (color optional), typical clothing style/colors, notable accessories (e.g., unicorn clip), and general vibe (e.g., sporty). Keep to 35–60 words. Start with the child's name and age.`;

    const content = [
      {
        type: "text",
        text: `Describe ${kid.name}, age ${kid.age}, based on these photos:`
      },
      ...photos.slice(0, 3).map(photo => ({
        type: "image_url",
        image_url: { url: photo.image_url }
      }))
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', response.status, errorText);
      throw new Error(`Vision API failed: ${response.status}`);
    }

    const data = await response.json();
    const descriptor = data.choices[0].message.content.trim();

    // Update kid with descriptor
    const { error: updateError } = await supabase
      .from('kids')
      .update({ descriptor })
      .eq('id', kidId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ descriptor }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in kids-extract-descriptor function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
