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
  return pages.join('\n').trim();
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}
