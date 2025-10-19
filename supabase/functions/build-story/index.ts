import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type ArtStylePreset = "storybook-cozy" | "watercolor-soft" | "travel-sketch";
type CharacterSheet = {
  leo: { age: number; hair: string; outfit: string; trait: string };
  sasha: { age: number; hair: string; accessory: string; trait: string };
};
type ImagePromptSpec = {
  stylePreset: ArtStylePreset;
  scene: string;
  landmarkDetail?: string;
  mood: "joyful" | "curious" | "adventurous";
  timeOfDay?: "morning" | "afternoon" | "golden hour";
  consistencyTags: string[];
};

const CHARACTER_SHEET: CharacterSheet = {
  leo: {
    age: 8,
    hair: "short brown",
    outfit: "sporty travel wear",
    trait: "soccer-loving",
  },
  sasha: {
    age: 5,
    hair: "long brown",
    accessory: "unicorn hairclip",
    trait: "unicorn-loving",
  },
};

const STYLE_DESCRIPTIONS: Record<ArtStylePreset, string> = {
  "storybook-cozy": "warm storybook illustration style with soft shading, gentle colors, inviting and cozy atmosphere",
  "watercolor-soft": "delicate watercolor painting with flowing colors, soft edges, dreamy and ethereal quality",
  "travel-sketch": "charming travel sketch style with loose linework, hand-drawn details, spontaneous and lively feel",
};

function buildImagePrompt(spec: ImagePromptSpec, kids: string[]): string {
  const styleDesc = STYLE_DESCRIPTIONS[spec.stylePreset];
  const characters: string[] = [];
  
  // Build character descriptions from character sheet
  kids.forEach(kidName => {
    const normalizedName = kidName.toLowerCase();
    if (normalizedName === "leo" && CHARACTER_SHEET.leo) {
      const leo = CHARACTER_SHEET.leo;
      characters.push(`Leo (${leo.age} years old, ${leo.hair} hair, ${leo.outfit}, ${leo.trait})`);
    } else if (normalizedName === "sasha" && CHARACTER_SHEET.sasha) {
      const sasha = CHARACTER_SHEET.sasha;
      characters.push(`Sasha (${sasha.age} years old, ${sasha.hair} hair, wearing ${sasha.accessory}, ${sasha.trait})`);
    } else {
      // Generic character description for other names
      characters.push(`${kidName} (child traveler)`);
    }
  });

  const characterDesc = characters.length > 0 ? characters.join(" and ") : "children";
  const landmarkPart = spec.landmarkDetail ? `, featuring ${spec.landmarkDetail}` : "";
  const timePart = spec.timeOfDay ? `, ${spec.timeOfDay} lighting` : "";
  
  return `${styleDesc}. Scene: ${spec.scene}${landmarkPart}. Characters: ${characterDesc}. Mood: ${spec.mood}${timePart}. ${spec.consistencyTags.join(", ")}`;
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
    const { 
      destination, 
      month, 
      kids, 
      interests, 
      pages = 6, 
      tone = "curious",
      artStylePreset = "storybook-cozy" as ArtStylePreset
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const storyId = crypto.randomUUID();
    const kidsString = kids.join(", ");
    const interestsString = interests.join(", ");

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
        throw new Error(`Failed to generate page ${outlineItem.page}`);
      }

      const pageData = await pageResponse.json();
      const pageArgs = JSON.parse(pageData.choices[0].message.tool_calls[0].function.arguments);
      
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
      
      // Build the final image prompt string
      const imagePrompt = buildImagePrompt(imagePromptSpec, kids);
      
      generatedPages.push({
        ...pageArgs,
        imagePrompt,
        imagePromptSpec,
      });
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
