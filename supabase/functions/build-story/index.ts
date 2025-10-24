import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ArtStylePreset = "storybook-cozy" | "watercolor-soft" | "travel-sketch";

type KidProfile = {
  id: string;
  name: string;
  age: number;
  descriptor: string | null;
  appearance_notes: string | null;
  interests: string[];
};

type ImagePromptSpec = {
  stylePreset: ArtStylePreset;
  scene: string;
  landmarkDetail?: string;
  mood: "joyful" | "curious" | "adventurous";
  timeOfDay?: "morning" | "afternoon" | "golden hour";
  consistencyTags: string[];
};

const STYLE_DESCRIPTIONS: Record<ArtStylePreset, string> = {
  "storybook-cozy": "warm storybook illustration style with soft shading, gentle colors, inviting and cozy atmosphere",
  "watercolor-soft": "delicate watercolor painting with flowing colors, soft edges, dreamy and ethereal quality",
  "travel-sketch": "charming travel sketch style with loose linework, hand-drawn details, spontaneous and lively feel",
};

function buildImagePrompt(spec: ImagePromptSpec, kidProfiles: KidProfile[]): string {
  const styleDesc = STYLE_DESCRIPTIONS[spec.stylePreset];
  const characters: string[] = [];
  
  // Build character descriptions from actual kid profile data
  kidProfiles.forEach(kid => {
    const parts = [kid.name, `${kid.age} years old`];
    
    // Add descriptor if available (e.g., "curly-haired blonde girl")
    if (kid.descriptor) {
      parts.push(kid.descriptor);
    }
    
    // Add appearance notes if available (e.g., "blue eyes, freckles")
    if (kid.appearance_notes) {
      parts.push(kid.appearance_notes);
    }
    
    characters.push(parts.join(", "));
  });

  const characterDesc = characters.length > 0 ? characters.join(" and ") : "children";
  const landmarkPart = spec.landmarkDetail ? `, featuring ${spec.landmarkDetail}` : "";
  const timePart = spec.timeOfDay ? `, ${spec.timeOfDay} lighting` : "";
  
  return `${styleDesc}. Scene: ${spec.scene}${landmarkPart}. Characters: ${characterDesc}. Mood: ${spec.mood}${timePart}. ${spec.consistencyTags.join(", ")}. CRITICAL: Use wide-angle framing showing complete characters from head to toe with plenty of space around them, no cropping of bodies, centered composition.`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { 
      destination, 
      month, 
      kids, 
      interests, 
      pages = 6, 
      tone = "curious",
      artStylePreset = "storybook-cozy" as ArtStylePreset
    } = await req.json();
    
    // Fetch full kid profile data from database
    let kidProfiles: KidProfile[] = [];
    let kidInterests: string[] = [];
    
    if (kids && kids.length > 0) {
      try {
        const { data: kidsData } = await supabase
          .from('kids')
          .select('id, name, age, descriptor, appearance_notes, interests')
          .in('name', kids);
        
        if (kidsData) {
          kidProfiles = kidsData;
          kidInterests = kidsData.flatMap(k => k.interests || []);
          console.log('Fetched kid profiles:', kidProfiles);
        }
      } catch (error) {
        console.error('Error fetching kid profiles:', error);
      }
    }
    
    // Combine story interests with kid interests
    const allInterests = [...new Set([...interests, ...kidInterests])];
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    const kidsString = kids.join(", ");
    const interestsString = allInterests.join(", ");

    // Step A: Generate outline
    const outlineResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a children's travel storyteller for ages 5–8. Keep sentences short and friendly. On each page, include one kid-friendly activity/place and one light, cheerful historical/cultural nugget. Avoid heavy topics. End every page with a tiny curiosity question. Use kids' names naturally.",
          },
          {
            role: "user",
            content: `Create an outline for a ${pages}-page children's story about ${kidsString} traveling to ${destination} in ${month}. The story should have a ${tone} tone and include these interests: ${interestsString}.

Return a JSON array with this structure:
[
  {
    "page": 1,
    "heading": "Page title",
    "summary": "Brief summary of what happens on this page"
  }
]

Page 1 should introduce the kids and why the place is special with one friendly fact.
Middle pages should each mix an activity with a light cultural/historical fact and sensory details.
The final page should have a hopeful takeaway and a simple curiosity question.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_outline",
              description: "Creates a story outline with headings and summaries",
              parameters: {
                type: "object",
                properties: {
                  outline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        page: { type: "number" },
                        heading: { type: "string" },
                        summary: { type: "string" },
                      },
                      required: ["page", "heading", "summary"],
                    },
                  },
                },
                required: ["outline"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_outline" } },
      }),
    });

    if (!outlineResponse.ok) {
      const errorText = await outlineResponse.text();
      console.error("Outline generation error:", outlineResponse.status, errorText);
      
      if (outlineResponse.status === 402) {
        throw new Error("CREDITS_DEPLETED: Your Lovable AI credits have run out. Please add credits in Settings → Workspace → Usage to continue generating stories.");
      }
      
      if (outlineResponse.status === 429) {
        throw new Error("RATE_LIMITED: Too many requests. Please wait a moment and try again.");
      }
      
      throw new Error("Failed to generate story outline");
    }

    const outlineData = await outlineResponse.json();
    const outlineArgs = JSON.parse(outlineData.choices[0].message.tool_calls[0].function.arguments);
    const outline = outlineArgs.outline;

    // Determine mood mapping from tone
    const moodMap: Record<string, "joyful" | "curious" | "adventurous"> = {
      curious: "curious",
      adventurous: "adventurous",
      silly: "joyful",
    };
    const baseMood = moodMap[tone] || "joyful";

    // Step B: Generate full text and image prompts for each page
    const generatedPages = [];
    
    for (let i = 0; i < outline.length; i++) {
      const outlineItem = outline[i];
      
      // Determine time of day variation
      const timeOfDay = i === 0 ? "morning" : i === outline.length - 1 ? "golden hour" : "afternoon";
      
      const pageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a children's travel storyteller for ages 5–8. Keep sentences short and friendly. On each page, include one kid-friendly activity/place and one light, cheerful historical/cultural nugget. Avoid heavy topics. End every page with a tiny curiosity question. Use kids' names naturally.",
            },
            {
              role: "user",
              content: `Write the full text for page ${outlineItem.page} of the story.

Heading: ${outlineItem.heading}
Summary: ${outlineItem.summary}

Context:
- Destination: ${destination}
- Month: ${month}
- Kids: ${kidsString}
- Interests: ${interestsString}
- Tone: ${tone}

Write 100-140 words of friendly, age-appropriate text that brings this page to life. Include sensory details, one cultural/historical nugget, and end with a curiosity question.

Also identify:
1. The main scene/setting for this page
2. Any specific landmark or place mentioned
3. Key visual details that would appear in an illustration

Return JSON with this structure:
{
  "heading": "The page heading",
  "text": "The 100-140 word story text",
  "scene": "Brief description of the main scene/setting",
  "landmarkDetail": "Specific landmark or place (if any, otherwise null)"
}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_page",
                description: "Creates a story page with heading, text, and scene details",
                parameters: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    text: { type: "string" },
                    scene: { type: "string" },
                    landmarkDetail: { type: "string", nullable: true },
                  },
                  required: ["heading", "text", "scene"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_page" } },
        }),
      });

      if (!pageResponse.ok) {
        const errorText = await pageResponse.text();
        console.error(`Page ${outlineItem.page} generation error:`, pageResponse.status, errorText);
        
        if (pageResponse.status === 402) {
          throw new Error("CREDITS_DEPLETED: Your Lovable AI credits ran out during story generation. Please add credits in Settings → Workspace → Usage.");
        }
        
        if (pageResponse.status === 429) {
          throw new Error("RATE_LIMITED: Too many requests. Please wait a moment and try again.");
        }
        
        throw new Error(`Failed to generate page ${outlineItem.page}`);
      }

      const pageData = await pageResponse.json();
      const pageArgs = JSON.parse(pageData.choices[0].message.tool_calls[0].function.arguments);
      
      // Generate interactive elements for this page
      let interactiveElements = { questions: [], activities: [] };
      try {
        const interactiveResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a children's book educator. Generate engaging questions and activities for young children based on story content.",
              },
              {
                role: "user",
                content: `Generate 2-3 age-appropriate questions and 1-2 simple activities for this story page:

Heading: ${pageArgs.heading}
Text: ${pageArgs.text}

The questions should be open-ended and encourage discussion. Activities should be simple and fun.`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "generate_interactive_elements",
                description: "Generate questions and activities for a story page",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: { type: "string" },
                      description: "2-3 open-ended questions for children",
                    },
                    activities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          materials: { type: "string" },
                        },
                        required: ["title", "description"],
                      },
                      description: "1-2 simple activities children can do",
                    },
                  },
                  required: ["questions", "activities"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "generate_interactive_elements" } },
          }),
        });

        if (interactiveResponse.ok) {
          const interactiveData = await interactiveResponse.json();
          const toolCall = interactiveData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            interactiveElements = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (error) {
        console.error(`Error generating interactive elements for page ${outlineItem.page}:`, error);
      }
      
      // Build structured image prompt spec
      const imagePromptSpec: ImagePromptSpec = {
        stylePreset: artStylePreset,
        scene: pageArgs.scene,
        landmarkDetail: pageArgs.landmarkDetail || undefined,
        mood: baseMood,
        timeOfDay: timeOfDay as "morning" | "afternoon" | "golden hour",
        consistencyTags: [
          "children's book illustration",
          "friendly and approachable",
          "high detail",
          "vibrant colors",
        ],
      };
      
      // Build the final image prompt string using actual kid profiles
      const imagePrompt = buildImagePrompt(imagePromptSpec, kidProfiles);
      
      generatedPages.push({
        ...pageArgs,
        imagePrompt,
        imagePromptSpec,
        questions: interactiveElements.questions,
        activities: interactiveElements.activities,
      });
    }

    // Create story in database
    const storyTitle = outline[0]?.heading || `${kids.join(" and ")}'s Adventure in ${destination}`;
    const { data: storyRecord, error: storyError } = await supabase
      .from('stories')
      .insert({
        title: storyTitle,
        destination,
        month,
        length: generatedPages.length + 1, // +1 for title page
        tone,
        interests: typeof interests === 'string' ? interests.split(',').map(i => i.trim()) : interests,
        kids_json: kids,
        art_style: artStylePreset,
        outline_json: outline
      })
      .select()
      .single();

    if (storyError) {
      console.error('Error creating story:', storyError);
      throw new Error('Failed to save story to database');
    }

    const storyId = storyRecord.id;

    // Create title page (page 1)
    const titlePageImageSpec: ImagePromptSpec = {
      stylePreset: artStylePreset,
      scene: `Book cover showing ${destination} with ${kidsString} standing in front of iconic landmarks`,
      landmarkDetail: `iconic landmarks of ${destination}`,
      mood: baseMood,
      timeOfDay: "golden hour",
      consistencyTags: [
        "children's book cover",
        "group portrait with landmarks",
        "travel theme",
        "decorative composition",
        "all characters visible and centered",
      ],
    };

    const titlePagePrompt = buildImagePrompt(titlePageImageSpec, kidProfiles);
    const kidsText = kids.length > 1 ? kids.slice(0, -1).join(", ") + " and " + kids[kids.length - 1] : kids[0];

    await supabase
      .from('pages')
      .insert({
        story_id: storyId,
        page_number: 1,
        heading: storyTitle,
        text: `A Travel Adventure Story\n\nFeaturing: ${kidsText}\n\nDestination: ${destination}\n\nTime: ${month}`,
        image_prompt: titlePagePrompt,
        image_prompt_spec: titlePageImageSpec
      });

    // Save story pages to database (starting from page 2)
    for (let i = 0; i < generatedPages.length; i++) {
      const page = generatedPages[i];
      const { error: pageError } = await supabase
        .from('pages')
        .insert({
          story_id: storyId,
          page_number: i + 2, // Start from page 2
          heading: page.heading,
          text: page.text,
          image_prompt: page.imagePrompt,
          image_prompt_spec: page.imagePromptSpec,
          questions_for_child: page.questions || [],
          activities: page.activities || [],
        });

      if (pageError) {
        console.error(`Error saving page ${i + 2}:`, pageError);
      }
    }

    const response = {
      storyId,
      destination,
      month,
      tone,
      kids,
      interests,
      pages: generatedPages.length,
      artStylePreset,
      outline,
      generatedPages,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in build-story function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred generating the story" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
