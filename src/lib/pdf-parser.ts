/**
 * Phase 3: Stable PDF Parser using pdfjs-dist/legacy (no worker, memory-only)
 * Compatible with Next.js 16 + Turbopack serverless environment.
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Empty PDF buffer received");
  }

  console.log(`[PDF Parser] Decoding buffer (${buffer.byteLength} bytes)...`);

  try {
    // Dynamic import for ESM/Turbopack compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Phase 7.2: Fix worker loading error by explicitly setting the worker location
    try {
        // @ts-ignore - Dynamic import of the worker module
        const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
        // Register the worker module directly to avoid external file lookup
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        console.log("[PDF Parser] Worker successfully registered via module import.");
    } catch (workerErr: any) {
        console.warn("[PDF Parser] Worker loading failed, attempted fallback to fake worker:", workerErr.message);
        // On some environments, we might need to manually assign the workerSrc to a string/URL
        // but for server-side, importing it often resolves the global lookup.
    }

    // Specify standard fonts path to improve extraction reliability
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
      stopAtErrors: false,
    });

    const pdfDocument = await loadingTask.promise;
    const maxPages = pdfDocument.numPages;
    console.log(`[PDF Parser] Document loaded: ${maxPages} pages found.`);
    
    let fullText = '';

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        
        fullText += pageText + '\n\n';
      } catch (pageErr: any) {
        console.warn(`[PDF Parser] Warning: Failed to extract page ${pageNum}:`, pageErr.message);
      }
    }

    const cleanText = fullText
      .replace(/\0/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleanText.length === 0) {
      console.warn("[PDF Parser] Warning: Extraction produced no text. This might be a scanned image PDF.");
    } else {
      console.log(`[PDF Parser] Successfully extracted ${cleanText.length} characters.`);
    }

    return cleanText;
  } catch (error: any) {
    console.error("[PDF Parser] Extraction error:", error.message);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}
