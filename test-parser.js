import fs from 'fs';
import { parsePDF } from './src/lib/pdf-parser.js';

async function test() {
  try {
    // Create a very basic valid PDF buffer or use a dummy one
    // Actually, a totally empty buffer will throw
    const dummyBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000107 00000 n \n0000000212 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n305\n%%EOF");
    
    console.log("Testing PDF parsing...");
    const text = await parsePDF(dummyBuffer);
    console.log("Extracted Text:", text);
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
