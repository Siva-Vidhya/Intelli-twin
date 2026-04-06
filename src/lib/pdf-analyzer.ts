import { supabaseAdmin } from '@/lib/supabase-server';

// Standard Node.js text extraction with pdfjs-dist
export interface AnalyzedContent {
  text: string;
  pageCount: number;
}

/**
 * Downloads a PDF from a URL and extracts its text content using pdfjs-dist.
 */
export async function downloadAndExtractPDF(url: string): Promise<AnalyzedContent> {
  try {
    console.log(`[PDF Engine] Download URL: ${url}`);
    
    // Convert public URL back to storage path
    const pathMatch = url.match(/\/uploads\/(.+)$/);
    if (!pathMatch) {
      throw new Error("Invalid URL format: Cannot extract storage path");
    }
    const filePath = decodeURIComponent(pathMatch[1]);
    
    console.log(`[PDF Engine] Transporting internal storage object: ${filePath}`);

    // Download using Supabase Server-Side SDK bypassing fetch restrictions
    const { data: blob, error } = await supabaseAdmin
      .storage
      .from("uploads")
      .download(filePath);

    if (error || !blob) {
      throw new Error(`Storage access denied: ${error?.message || 'Empty payload'}`);
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[PDF Engine] File Size buffer length: ${buffer.length} bytes`);

    // Use pdfjs-dist for stable extraction
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const pdfDocument = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageCount = pdfDocument.numPages;
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    // Clean text: remove nulls, collapse spacing, Normalize line breaks
    const cleanText = fullText
      .replace(/\0/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`[PDF Engine] Parsing Result Length: ${cleanText.length} characters extracted`);

    if (cleanText.length < 20) {
      console.warn('[PDF Engine] Extracted text too short, using fallback.');
      return { text: `[Fallback Mode: PDF contains primarily images or unselectable text. URL: ${url}]`, pageCount };
    }

    return {
      text: cleanText,
      pageCount: pageCount
    };
  } catch (error: any) {
    console.error('[PDF Engine] Extraction failed:', error.message);
    // Hard fallback return instead of throw to prevent pipeline crashing
    return {
       text: `[Fallback Mode: PDF parsing failed. URL: ${url}. Error: ${error.message}]`,
       pageCount: 0
    };
  }
}

/**
 * Splits text into optimized chunks for AI processing.
 * Standardizes the input to ~15,000 characters for Gemini 1.5 Flash reliability.
 */
export function chunkText(text: string, maxLength: number = 15000): string[] {
  if (!text || text.length === 0) return [""];
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let currentPos = 0;
  
  while (currentPos < text.length) {
    let endPos = currentPos + maxLength;
    if (endPos > text.length) endPos = text.length;
    
    // Attempt to break at a paragraph/newline for semantic context
    if (endPos < text.length) {
      const nextNewline = text.lastIndexOf('\n', endPos);
      if (nextNewline > currentPos + (maxLength * 0.7)) {
        endPos = nextNewline;
      }
    }
    
    chunks.push(text.substring(currentPos, endPos).trim());
    currentPos = endPos;
  }
  
  return chunks;
}
