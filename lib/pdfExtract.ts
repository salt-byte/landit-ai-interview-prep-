/**
 * Client-side PDF text extraction using pdf.js.
 *
 * Why: doing this in the browser (instead of on the backend) saves the round-
 * trip for the file bytes and the backend's pypdf parse — typically 2-4s.
 *
 * The extracted text is sent to the backend as a form field; the backend will
 * use it directly and skip its own PDF parsing path.
 */
import * as pdfjs from 'pdfjs-dist';
// Vite handles `?url` to bundle and serve the worker as a static asset.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// Many resumes draw bullet points using private-use codepoints from custom
// fonts (Wingdings, Symbol, etc.). pdf.js can't resolve these to standard
// Unicode, so we normalize them to a plain bullet here. Anything in the
// Private Use Area (U+E000-U+F8FF) gets replaced.
const PRIVATE_USE_AREA = /[-]/g;

function cleanText(raw: string): string {
  return raw
    .replace(PRIVATE_USE_AREA, '•')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }
  return cleanText(pages.join('\n'));
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}
