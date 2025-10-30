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
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Generate signed URLs for the photos so the AI can access them
    const photoUrls = await Promise.all(
      photos.map(async (photo) => {
        const path = photo.image_url.split('/').pop(); // Extract the file path
        const { data: signedUrlData } = await supabase.storage
          .from('kid-photos')
          .createSignedUrl(path, 3600); // 1 hour expiry
        return signedUrlData?.signedUrl || photo.image_url;
      })
    );

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
    const systemPrompt = `You are creating a DISTINCTIVE visual character descriptor for a children's picture-book. Focus on UNIQUE identifying features that differentiate this child from others.

CRITICAL: Be specific and distinctive. Avoid generic terms like "kind eyes" or "friendly smile" that could apply to anyone.

Describe in detail:
1. FACE SHAPE: oval, round, heart-shaped, square, long, etc.
2. HAIR: exact texture (straight, wavy, curly, coily), length (shoulder, chin, pixie, long), specific style (ponytail, braids, bangs, side-part), precise color (golden blonde, auburn, jet-black, light brown, dark brown, etc.)
3. EYES: shape (almond, round, wide-set, close-set), color if visible (blue, brown, hazel, green), and any distinctive features (long lashes, expressive brows)
4. NOSE & MOUTH: distinctive features (button nose, pronounced nose, small lips, full lips, gap in teeth, dimples)
5. SKIN TONE: be specific (fair with rosy cheeks, warm beige, light brown, medium brown, deep brown, olive, etc.)
6. DISTINCTIVE FEATURES: freckles, birthmarks, glasses style, unique accessories (specific hair clips, headbands, jewelry)
7. CLOTHING STYLE: specific preferences (always in dresses, sporty athletic wear, graphic tees, bright colors, pastels, etc.)
8. BODY TYPE/BUILD: petite, tall for age, athletic, stocky, slim, etc.

Start with "${kid.name}, age ${kid.age}:" then provide 50-80 words of SPECIFIC, DISTINCTIVE details. Make this description unique enough that it couldn't describe any other child.`;

    const content = [
      {
        type: "text",
        text: `Describe ${kid.name}, age ${kid.age}, based on these photos:`
      },
      ...photoUrls.map(url => ({
        type: "image_url",
        image_url: { url }
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
