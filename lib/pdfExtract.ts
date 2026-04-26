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

// Resumes use various decorative characters as bullet points. pdf.js extracts
// them as raw codepoints which then leak into the LLM output as garbage.
// We strip them entirely — the LLM will add its own bullets when emitting
// the description field.
//
// Covers:
// - Private Use Area (U+E000-U+F8FF): custom-font glyphs (Wingdings, Symbol)
// - Geometric Shapes (U+25A0-U+25FF): ● ○ ■ □ ◆ ◇ ▪ ▫ ▶ ▸
// - Math Operators (U+2200-U+22FF): ≡ ≢ ∎
// - Misc Symbols / Dingbats (U+2600-U+27BF): ★ ✦ ✓ ➤
// - I Ching trigrams (U+2630): ☰
const DECORATIVE_CHARS = /[-≡-]/g;

function cleanText(raw: string): string {
  return raw
    .replace(DECORATIVE_CHARS, '')
    .replace(/[ \t]+/g, ' ')   // collapse runs of spaces/tabs
    .replace(/\s+\n/g, '\n')   // strip whitespace before newlines
    .replace(/\n\s+/g, '\n')   // strip whitespace after newlines
    .replace(/\n{3,}/g, '\n\n') // collapse 3+ newlines
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
