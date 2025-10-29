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

function buildImagePrompt(spec: ImagePromptSpec, kidProfiles: KidProfile[], storyText?: string): string {
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
  
  // CRITICAL: Ensure ALL characters appear in EVERY image
  const allCharactersRequired = kidProfiles.length > 0 
    ? `CRITICAL REQUIREMENT: ALL of the following characters MUST be clearly visible and present in this image: ${kidProfiles.map(k => k.name).join(", ")}. Every single character must appear in every scene.`
    : "";
  
  // CRITICAL: Image must match the actual story content
  const storyAlignment = storyText 
    ? `CRITICAL: This illustration must EXACTLY match the story text content. The image should visually depict what is described in the story text, including specific actions, settings, objects, and details mentioned. The visual elements must align precisely with the narrative.`
    : "";
  
  // Character consistency requirements
  const consistencyRequirement = kidProfiles.length > 0
    ? `CHARACTER CONSISTENCY REQUIREMENTS:
- Each character's facial features (hair color, hair style, eye color, skin tone, face shape, distinctive features) must remain IDENTICAL across all pages
- Facial features are LOCKED and cannot change
- Clothing, accessories, and poses CAN vary based on the scene and story context
- Maintain exact same facial appearance while allowing clothing to change naturally with the story`
    : "";
  
  return `${styleDesc}. 

${storyAlignment}

Scene Description: ${spec.scene}${landmarkPart}. 
Characters Present: ${characterDesc}. 
Mood: ${spec.mood}${timePart}. 

${allCharactersRequired}

${consistencyRequirement}

Technical Requirements: ${spec.consistencyTags.join(", ")}. 

Composition Requirements:
- Wide-angle framing showing complete characters from head to toe
- Plenty of space around characters (at least 20% empty space on all sides)
- No cropping of bodies, heads, or any body parts
- Centered composition with all characters clearly visible
- Full environmental context including ground, sky, and background elements`;
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
    
    // Fetch full kid profile data from database (OPTIMIZED: only fetch required fields)
    let kidProfiles: KidProfile[] = [];
    let kidInterests: string[] = [];
    
    if (kids && kids.length > 0) {
      try {
        // OPTIMIZATION: Only select fields we actually use to reduce data transfer
        const { data: kidsData } = await supabase
          .from('kids')
          .select('id, name, age, descriptor, appearance_notes, interests')
          .in('name', kids);
        
        if (kidsData) {
          kidProfiles = kidsData;
          // OPTIMIZATION: Flatten interests once and filter out nulls/undefined
          kidInterests = kidsData
            .flatMap(k => k.interests || [])
            .filter((interest): interest is string => Boolean(interest));
          console.log('Fetched kid profiles:', kidProfiles.length, 'profiles');
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
            content: `You are a children's travel storyteller for ages 5–8. Keep sentences short and friendly. On each page, include one kid-friendly activity/place and one light, cheerful historical/cultural nugget. Avoid heavy topics. End every page with a tiny curiosity question. Use kids' names naturally.

CRITICAL REQUIREMENT: Every single page must include ALL characters (${kidsString}) actively participating in the story. No page should exclude any character.`,
          },
          {
            role: "user",
            content: `Create an outline for a ${pages}-page children's story about ${kidsString} traveling to ${destination} in ${month}. The story should have a ${tone} tone and include these interests: ${interestsString}.

CRITICAL: Every page in the outline must include ALL characters (${kidsString}). Every character must be part of every page's activities and narrative.

Return a JSON array with this structure:
[
  {
    "page": 1,
    "heading": "Page title",
    "summary": "Brief summary of what happens on this page (must include all characters: ${kidsString})"
  }
]

Page 1 should introduce all the kids (${kidsString}) and why the place is special with one friendly fact.
Middle pages should each mix an activity involving all characters with a light cultural/historical fact and sensory details. Every page must show all characters participating.
The final page should have all characters together with a hopeful takeaway and a simple curiosity question.`,
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
              content: `You are a children's travel storyteller for ages 5–8. Keep sentences short and friendly. On each page, include one kid-friendly activity/place and one light, cheerful historical/cultural nugget. Avoid heavy topics. End every page with a tiny curiosity question. Use kids' names naturally.

CRITICAL REQUIREMENTS:
- EVERY page must include ALL characters (${kidsString}) actively participating in the story
- The scene description you provide must EXACTLY match what is written in the story text
- Visual details must align precisely with the narrative content
- Every character should be mentioned and included in the action`,
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

IMPORTANT: Make sure ALL kids (${kidsString}) are mentioned and actively participating in the story on this page. Every character should be included in the narrative.

Also identify:
1. The main scene/setting for this page (must match what's described in the story text)
2. Any specific landmark or place mentioned
3. Key visual details that would appear in an illustration (these should EXACTLY match what is described in the story text - actions, objects, activities, setting details)

CRITICAL: The scene description must reflect what is actually written in the story text. The visual elements must align precisely with the narrative content.

Return JSON with this structure:
{
  "heading": "The page heading",
  "text": "The 100-140 word story text (must mention all characters: ${kidsString})",
  "scene": "Detailed description of the main scene/setting that matches the story text exactly",
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
      
      // Build the scene description that incorporates story text details
      // The scene should reflect what's actually described in the story text
      const enhancedScene = `${pageArgs.scene}. Based on the story: ${pageArgs.text.substring(0, 200)}...`;
      
      // Generate interactive elements for this page (OPTIONAL - can be generated later via add-interactive-elements)
      // Skip during story creation to reduce API costs - interactive elements can be added on-demand
      let interactiveElements = { questions: [], activities: [] };
      
      // OPTIMIZATION: Interactive elements are now generated only when requested via the separate endpoint
      // This saves N API calls (where N = number of pages) during story creation
      // Users can generate interactive elements later if needed via the add-interactive-elements function
      
      // Build structured image prompt spec using enhanced scene that includes story details
      const imagePromptSpec: ImagePromptSpec = {
        stylePreset: artStylePreset,
        scene: enhancedScene,
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
      
      // Build the final image prompt string using actual kid profiles and story text
      // Pass the full story text to ensure image matches the narrative content
      const imagePrompt = buildImagePrompt(imagePromptSpec, kidProfiles, pageArgs.text);
      
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
      scene: `Book cover showing ${destination} with ${kidsString} standing together in front of iconic landmarks of ${destination}`,
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

    const kidsText = kids.length > 1 ? kids.slice(0, -1).join(", ") + " and " + kids[kids.length - 1] : kids[0];
    const titlePageText = `A Travel Adventure Story featuring ${kidsText} traveling to ${destination} in ${month}`;
    const titlePagePrompt = buildImagePrompt(titlePageImageSpec, kidProfiles, titlePageText);

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
