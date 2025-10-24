import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

    const { storyId } = await req.json();

    if (!storyId) {
      return new Response(
        JSON.stringify({ error: 'storyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PDF Export] Starting export for story: ${storyId}`);

    // Fetch story and pages
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (storyError) {
      console.error('[PDF Export] Story fetch error:', storyError);
      throw storyError;
    }

    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('story_id', storyId)
      .order('page_number', { ascending: true });

    if (pagesError) {
      console.error('[PDF Export] Pages fetch error:', pagesError);
      throw pagesError;
    }

    // Calculate hash for caching
    const contentHash = await generateHash(story, pages);

    // Check for existing cached PDF
    const { data: existingExport } = await supabase
      .from('pdf_exports')
      .select('*')
      .eq('story_id', storyId)
      .single();

    if (existingExport && existingExport.hash === contentHash) {
      console.log('[PDF Export] Using cached PDF');
      return new Response(
        JSON.stringify({ 
          pdfUrl: existingExport.pdf_url,
          cached: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate PDF
    console.log('[PDF Export] Generating new PDF');
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add cover page
    await addCoverPage(pdfDoc, story, pages, titleFont, bodyFont);

    // Add content pages (all pages)
    for (const page of pages) {
      await addContentPage(pdfDoc, page, titleFont, bodyFont);
    }

    // Add back page
    await addBackPage(pdfDoc, bodyFont);

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `${storyId}-${Date.now()}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('story-pdfs')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('[PDF Export] Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('story-pdfs')
      .getPublicUrl(fileName);

    // Update or create export record
    const exportData = {
      story_id: storyId,
      pdf_url: publicUrl,
      hash: contentHash,
      updated_at: new Date().toISOString()
    };

    if (existingExport) {
      await supabase
        .from('pdf_exports')
        .update(exportData)
        .eq('id', existingExport.id);
    } else {
      await supabase
        .from('pdf_exports')
        .insert(exportData);
    }

    console.log('[PDF Export] PDF generated successfully');

    return new Response(
      JSON.stringify({ 
        pdfUrl: publicUrl,
        cached: false,
        fileSize: pdfBytes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PDF Export] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to export PDF';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[PDF Export] Stack:', errorStack);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHash(story: any, pages: any[]): Promise<string> {
  const content = JSON.stringify({
    title: story.title,
    updated: story.updated_at,
    pages: pages.map(p => ({
      text: p.text,
      heading: p.heading,
      image: p.image_url
    }))
  });
  
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchImageWithRetry(imageUrl: string, maxRetries: number = 3): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[PDF Export] Fetching image (attempt ${attempt}/${maxRetries}): ${imageUrl}`);
      
      // Try different approaches based on the URL
      let response;
      
      if (imageUrl.includes('supabase')) {
        // For Supabase URLs, try with different headers
        response = await fetch(imageUrl, {
          headers: {
            'Accept': 'image/*',
            'User-Agent': 'TripTales-PDF-Export/1.0',
            'Cache-Control': 'no-cache'
          }
        });
      } else {
        // For other URLs, use basic fetch
        response = await fetch(imageUrl);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const imageBytes = await response.arrayBuffer();
      console.log(`[PDF Export] Image fetched successfully on attempt ${attempt}, size: ${imageBytes.byteLength} bytes`);
      return imageBytes;
      
    } catch (error) {
      console.error(`[PDF Export] Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('All retry attempts failed');
}

async function addCoverPage(
  pdfDoc: PDFDocument,
  story: any,
  pages: any[],
  titleFont: any,
  bodyFont: any
) {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  // Title
  const title = story.title || `${story.destination} Adventure`;
  const titleSize = 36;
  const titleWidth = titleFont.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 150,
    size: titleSize,
    font: titleFont,
    color: rgb(0.2, 0.2, 0.3)
  });

  // Subtitle
  const kidsJson = typeof story.kids_json === 'string' 
    ? JSON.parse(story.kids_json) 
    : story.kids_json;
  const kidsList = Array.isArray(kidsJson) 
    ? kidsJson.map((k: any) => k.name).join(' and ')
    : 'Adventure';
  
  const subtitle = `Written for ${kidsList} — ${story.month}`;
  const subtitleSize = 14;
  const subtitleWidth = bodyFont.widthOfTextAtSize(subtitle, subtitleSize);
  page.drawText(subtitle, {
    x: (width - subtitleWidth) / 2,
    y: height - 200,
    size: subtitleSize,
    font: bodyFont,
    color: rgb(0.4, 0.4, 0.5)
  });

  // Decorative note
  const note = `A personalized adventure to ${story.destination}`;
  const noteSize = 12;
  const noteWidth = bodyFont.widthOfTextAtSize(note, noteSize);
  page.drawText(note, {
    x: (width - noteWidth) / 2,
    y: height - 400,
    size: noteSize,
    font: bodyFont,
    color: rgb(0.5, 0.5, 0.6)
  });
}

async function addContentPage(
  pdfDoc: PDFDocument,
  pageData: any,
  titleFont: any,
  bodyFont: any
) {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  const margin = 50;
  
  let yPosition = height - margin;

  // Page heading
  const headingSize = 22;
  const heading = pageData.heading || '';
  const headingLines = wrapText(heading, width - 2 * margin, headingSize, titleFont);
  
  for (const line of headingLines) {
    const lineWidth = titleFont.widthOfTextAtSize(line, headingSize);
    page.drawText(line, {
      x: (width - lineWidth) / 2,
      y: yPosition,
      size: headingSize,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.3)
    });
    yPosition -= headingSize + 10;
  }

  yPosition -= 30; // Space after heading

  // Image embedding
  if (pageData.image_url) {
    try {
      console.log(`[PDF Export] Processing image for page ${pageData.page_number}: ${pageData.image_url}`);
      
      // Validate URL format
      if (!pageData.image_url.startsWith('http')) {
        throw new Error(`Invalid image URL format: ${pageData.image_url}`);
      }
      
      // Fetch the image with retry logic
      const imageBytes = await fetchImageWithRetry(pageData.image_url);
      
      // Embed the image based on format
      let image;
      const url = pageData.image_url.toLowerCase();
      if (url.includes('.png') || url.includes('png')) {
        image = await pdfDoc.embedPng(imageBytes);
        console.log(`[PDF Export] PNG image embedded successfully`);
      } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('jpg') || url.includes('jpeg')) {
        image = await pdfDoc.embedJpg(imageBytes);
        console.log(`[PDF Export] JPG image embedded successfully`);
      } else {
        // Try to detect format from content
        const uint8Array = new Uint8Array(imageBytes);
        if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
          // PNG signature
          image = await pdfDoc.embedPng(imageBytes);
          console.log(`[PDF Export] PNG image detected and embedded`);
        } else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
          // JPEG signature
          image = await pdfDoc.embedJpg(imageBytes);
          console.log(`[PDF Export] JPEG image detected and embedded`);
        } else {
          throw new Error(`Unsupported image format. URL: ${pageData.image_url}`);
        }
      }
      
      // Calculate dimensions to fit within the page
      const maxImageWidth = width - 2 * margin;
      const maxImageHeight = 300;
      
      const imageAspectRatio = image.width / image.height;
      let imageWidth = maxImageWidth;
      let imageHeight = imageWidth / imageAspectRatio;
      
      // If height exceeds max, scale down based on height
      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight;
        imageWidth = imageHeight * imageAspectRatio;
      }
      
      // Draw the image centered
      page.drawImage(image, {
        x: (width - imageWidth) / 2,
        y: yPosition - imageHeight,
        width: imageWidth,
        height: imageHeight,
      });
      
      yPosition -= imageHeight + 30;
      console.log(`[PDF Export] Image embedded successfully`);
      
    } catch (error) {
      console.error(`[PDF Export] Failed to embed image for page ${pageData.page_number}:`, error);
      console.error(`[PDF Export] Image URL: ${pageData.image_url}`);
      console.error(`[PDF Export] Error details:`, error instanceof Error ? error.message : String(error));
      
      // Fallback to placeholder if image fails to load
      const imageHeight = 250;
      const imageWidth = width - 2 * margin;
      
      page.drawRectangle({
        x: margin,
        y: yPosition - imageHeight,
        width: imageWidth,
        height: imageHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(0.95, 0.95, 0.95)
      });

      const placeholderText = `Image unavailable (${error instanceof Error ? error.message : 'Unknown error'})`;
      const placeholderSize = 10;
      const placeholderWidth = bodyFont.widthOfTextAtSize(placeholderText, placeholderSize);
      page.drawText(placeholderText, {
        x: (width - placeholderWidth) / 2,
        y: yPosition - imageHeight / 2,
        size: placeholderSize,
        font: bodyFont,
        color: rgb(0.6, 0.6, 0.6)
      });

      yPosition -= imageHeight + 30;
    }
  }

  // Body text
  const textSize = 14;
  const text = pageData.text || '';
  const textLines = wrapText(text, width - 2 * margin, textSize, bodyFont);
  
  for (const line of textLines) {
    if (yPosition < margin + 40) break; // Stop if we run out of space
    
    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: textSize,
      font: bodyFont,
      color: rgb(0.2, 0.2, 0.2)
    });
    yPosition -= textSize + 8;
  }

  // Page number
  const pageNumText = `${pageData.page_number - 1}`; // Adjust for title page
  const pageNumSize = 10;
  const pageNumWidth = bodyFont.widthOfTextAtSize(pageNumText, pageNumSize);
  page.drawText(pageNumText, {
    x: (width - pageNumWidth) / 2,
    y: 30,
    size: pageNumSize,
    font: bodyFont,
    color: rgb(0.5, 0.5, 0.5)
  });
}

async function addBackPage(pdfDoc: PDFDocument, bodyFont: any) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  // Remove emojis and special Unicode characters for WinAnsi compatibility
  const text = "Created with TripTales";
  const textSize = 12;
  const textWidth = bodyFont.widthOfTextAtSize(text, textSize);
  
  page.drawText(text, {
    x: (width - textWidth) / 2,
    y: height / 2,
    size: textSize,
    font: bodyFont,
    color: rgb(0.5, 0.5, 0.6)
  });

  const privacy = "Private export - not publicly indexed";
  const privacySize = 10;
  const privacyWidth = bodyFont.widthOfTextAtSize(privacy, privacySize);
  
  page.drawText(privacy, {
    x: (width - privacyWidth) / 2,
    y: 50,
    size: privacySize,
    font: bodyFont,
    color: rgb(0.6, 0.6, 0.6)
  });
}

// Sanitize text to remove emojis and characters not supported by WinAnsi
function sanitizeText(text: string): string {
  // Remove emojis and other Unicode characters that WinAnsi can't encode
  // WinAnsi supports characters 0x20-0xFF (basic Latin + Latin-1 Supplement)
  return text.replace(/[^\x20-\xFF]/g, '').trim();
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  // Sanitize the text first
  const sanitized = sanitizeText(text);
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}