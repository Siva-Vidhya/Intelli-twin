/**
 * Phase 3: Stable PDF Parser using pdfjs-dist/legacy (no worker, memory-only)
 * Compatible with Next.js 16 + Turbopack serverless environment.
 */

// Phase 13: Polyfill DOMMatrix for Node.js environment (required by PDF.js for text extraction)
if (typeof global !== 'undefined' && !('DOMMatrix' in global)) {
  // @ts-ignore
  global.DOMMatrix = class DOMMatrix {
    m11: number = 1; m12: number = 0; m13: number = 0; m14: number = 0;
    m21: number = 0; m22: number = 1; m23: number = 0; m24: number = 0;
    m31: number = 0; m32: number = 0; m33: number = 1; m34: number = 0;
    m41: number = 0; m42: number = 0; m43: number = 0; m44: number = 1;

    constructor(init?: any) {
      if (typeof init === 'string') {
        throw new Error('String constructor not supported in minimal polyfill');
      } else if (Array.isArray(init)) {
        if (init.length === 6) {
          this.a = init[0]; this.b = init[1]; this.c = init[2];
          this.d = init[3]; this.e = init[4]; this.f = init[5];
        } else if (init.length === 16) {
          this.m11 = init[0]; this.m12 = init[1]; this.m13 = init[2]; this.m14 = init[3];
          this.m21 = init[4]; this.m22 = init[5]; this.m23 = init[6]; this.m24 = init[7];
          this.m31 = init[8]; this.m32 = init[9]; this.m33 = init[10]; this.m34 = init[11];
          this.m41 = init[12]; this.m42 = init[13]; this.m43 = init[14]; this.m44 = init[15];
        }
      }
    }
    // Getter/Setter aliases for 2D parts
    get a() { return this.m11; } set a(v) { this.m11 = v; }
    get b() { return this.m12; } set b(v) { this.m12 = v; }
    get c() { return this.m21; } set c(v) { this.m21 = v; }
    get d() { return this.m22; } set d(v) { this.m22 = v; }
    get e() { return this.m41; } set e(v) { this.m41 = v; }
    get f() { return this.m42; } set f(v) { this.m42 = v; }
  };
}
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
