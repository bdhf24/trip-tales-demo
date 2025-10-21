import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { storyId } = await req.json();

    if (!storyId) {
      return new Response(
        JSON.stringify({ error: 'storyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all pages for the story
    const { data: pages, error: fetchError } = await supabase
      .from('pages')
      .select('*')
      .eq('story_id', storyId)
      .order('page_number');

    if (fetchError) throw fetchError;

    console.log(`Generating interactive elements for ${pages.length} pages`);

    const results = [];

    for (const page of pages) {
      try {
        console.log(`Generating interactive elements for page ${page.page_number}`);

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a children\'s book educator. Generate engaging questions and activities for young children based on story content.'
              },
              {
                role: 'user',
                content: `Generate 2-3 age-appropriate questions and 1-2 simple activities for this story page:

Heading: ${page.heading}
Text: ${page.text}

The questions should be open-ended and encourage discussion. Activities should be simple and fun.`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'generate_interactive_elements',
                description: 'Generate questions and activities for a story page',
                parameters: {
                  type: 'object',
                  properties: {
                    questions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '2-3 open-ended questions for children'
                    },
                    activities: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          description: { type: 'string' },
                          materials: { type: 'string' }
                        },
                        required: ['title', 'description']
                      },
                      description: '1-2 simple activities children can do'
                    }
                  },
                  required: ['questions', 'activities']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'generate_interactive_elements' } }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`AI API error for page ${page.page_number}:`, response.status, errorText);
          throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall) {
          console.error('No tool call in response for page', page.page_number);
          throw new Error('No interactive elements generated');
        }

        const interactiveElements = JSON.parse(toolCall.function.arguments);

        // Update page with interactive elements
        const { error: updateError } = await supabase
          .from('pages')
          .update({
            questions_for_child: interactiveElements.questions,
            activities: interactiveElements.activities
          })
          .eq('id', page.id);

        if (updateError) throw updateError;

        results.push({
          pageNumber: page.page_number,
          status: 'success',
          questions: interactiveElements.questions,
          activities: interactiveElements.activities
        });

        console.log(`Successfully generated interactive elements for page ${page.page_number}`);
      } catch (error) {
        console.error(`Error generating interactive elements for page ${page.page_number}:`, error);
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
    console.error('Error in add-interactive-elements function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});