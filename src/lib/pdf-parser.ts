/**
 * Phase 3: Stable PDF Parser using pdfjs-dist/legacy (no worker, memory-only)
 * Compatible with Next.js 16 + Turbopack serverless environment.
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Empty PDF buffer received");
  }

  try {
    // Dynamic import for ESM/Turbopack compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const maxPages = pdfDocument.numPages;
    let fullText = '';

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n\n';
    }

    const cleanText = fullText
      .replace(/\0/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleanText;
  } catch (error: any) {
    console.error("[PDF Parser] Extraction error:", error.message);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}
