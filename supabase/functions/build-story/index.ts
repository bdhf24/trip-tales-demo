import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as uuid from "https://deno.land/std@0.223.0/uuid/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, month, kids, interests, pages = 6, tone = "curious" } = await req.json();
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

    // Step B: Generate full text for each page
    const generatedPages = [];
    
    for (const outlineItem of outline) {
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

Also create an imagePrompt for this page using these guidelines:
- Style: warm picture-book, soft shading, joyful mood
- Include specific landmark or setting detail
- Mention character details if applicable

Return JSON with this structure:
{
  "heading": "The page heading",
  "text": "The 100-140 word story text",
  "imagePrompt": "Description for the image"
}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_page",
                description: "Creates a story page with heading, text, and image prompt",
                parameters: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    text: { type: "string" },
                    imagePrompt: { type: "string" },
                  },
                  required: ["heading", "text", "imagePrompt"],
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
      generatedPages.push(pageArgs);
    }

    const response = {
      storyId,
      destination,
      month,
      tone,
      kids,
      interests,
      pages: generatedPages.length,
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
