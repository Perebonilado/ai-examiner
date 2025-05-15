import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { saltRounds } from 'src/constants';
import OpenAI from 'openai';
import { createHmac } from 'crypto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';
import { createWriteStream } from 'fs';
import * as textract from 'textract';
import { promisify } from 'util';
import * as libre from 'libreoffice-convert';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';
import { rm } from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit'
import * as path from 'path';
import { readFile } from 'fs/promises';
import puppeteer from 'puppeteer-core';


const libreConvert = promisify(libre.convert);

export const generateUUID = (): string => {
  return uuidv4();
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
};

export const replaceAllSpacesInStringWithHyphen = (str: string) => {
  return str.replace(/\s+/g, '-');
};

const extractJSONArray = (str: string): any[] => {
  const firstOpen = str.indexOf('[');
  const lastClose = str.lastIndexOf(']');

  if (firstOpen === -1 || lastClose === -1) {
    return []; // No valid JSON array found
  }

  const candidate = str.substring(firstOpen, lastClose + 1);

  try {
    const res = JSON.parse(candidate);
    if (Array.isArray(res)) {
      return res; // Return the valid JSON array
    }
  } catch (e) {
    throw new Error('No JSON object or array found in the text');
  }

  return []; // Return null if no valid JSON array is found
};

export const extractJSONDataFromMessages = (
  messages: OpenAI.Beta.Threads.Messages.MessagesPage,
) => {
  const data = (messages?.data[0]?.content[0] as any)?.text?.value;

  if (data) {
    return extractJSONArray(data) as any;
  }

  return [];
};

export const convertSmallerDemoninationtoLarger = (
  amount: number,
  factor: number,
) => {
  return amount / factor;
};

export const removeSourceContextFromSystemResponse = (text: string): string => {
  const parts = text.split('**source text start**');
  if (parts.length < 2) return text;

  const [before, rest] = parts;
  const after = rest.split('**source text end**')[1] || '';
  return (before + after).trim();
};

export const extractAndParseJSON = (text: string): any => {
  // Regular expression to match JSON arrays or objects
  const jsonRegex =
    /(\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\}|\[(?:[^\[\]]|\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\])*\])/;
  const match = text.match(jsonRegex);

  if (match) {
    try {
      // Parse the extracted JSON string
      const jsonString = match[0];
      const parsedJSON = JSON.parse(jsonString);
      return parsedJSON;
    } catch (error) {
      throw new Error('Failed to Parse JSON');
    }
  } else {
    throw new Error('No JSON object or array found in the text: ' + text);
  }
};

export const getPagination = (page: number, size: number) => {
  // starting from page 1
  const offset = (page - 1) * size;

  return { offset, limit: size };
};

export const getPaystackHash = (data: string): string => {
  const hash = createHmac(
    'sha512',
    EnvironmentVariables.config.paystackSecretKey,
  )
    .update(data)
    .digest('hex');

  return hash;
};

export const extractPagesTextsFromPDF = async (
  buffer: Buffer,
  options: PDFExtractOptions = {},
) => {
  try {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extractBuffer(buffer, options);
    return data.pages.map((page) =>
      page.content.map((item) => item.str).join(' '),
    );
  } catch (error) {
    throw new Error(error);
  }
};

export const extractTextFromPDF = async (
  buffer: Buffer,
  options: PDFExtractOptions = {},
) => {
  try {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extractBuffer(buffer, options);
    return data.pages
      .flatMap((page) => page.content.map((item) => item.str))
      .join(' ');
  } catch (error) {
    throw new Error(error);
  }
};

export const extractTextFromBuffer = async ({
  mimeType,
  buffer,
}: {
  mimeType: string;
  buffer: Buffer;
}) => {
  try {
    const extractText = promisify(textract.fromBufferWithMime);
    const text = await extractText(mimeType, buffer);
    return text as string;
  } catch (error) {
    throw new Error(error);
  }
};

export const getFileNameWithoutExtension = (name: string) => {
  return name.substring(0, name.lastIndexOf('.')) || name;
};

export const writeFileToStream = async (
  tempFilePath: string,
  content: any,
  encoding?: BufferEncoding,
) => {
  await new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(tempFilePath, { encoding });

    writeStream.write(content, encoding);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve()); // Ensure resolve is called correctly
    writeStream.end();
  });
};

export const convertOldPptToText = async (file: Buffer) => {
  const tempDir = 'temp';
  try {
    // Create the temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Convert the PPT buffer to PDF
    const outputBuffer = await libreConvert(file, '.pdf', undefined);

    // Extract text from the PDF buffer
    const pdfData = await pdfParse(outputBuffer);
    const text = pdfData.text;
    // await unlink(tempDir);
    return text;
  } catch (error) {
    throw new Error(`Failed to convert PPT to text: ${error.message}`);
  } finally {
    // Clean up the temporary directory and its contents
    await rm(tempDir, { recursive: true, force: true });
  }
};

export function chunkText(
  text: string,
  maxWords: number = 250,
  overlap: number = 50,
): string[] {
  const words = text.split(/\s+/); // Split by whitespace
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);
    start += maxWords - overlap; // Move forward but keep overlap
  }

  return chunks;
}

export const splitPdfPagesToIndividualFiles = async (
  file: Buffer,
): Promise<Buffer[]> => {
  try {
    const pdfDoc = await PDFDocument.load(file);
    const totalPages = pdfDoc.getPageCount();
    const outputBuffers: Buffer[] = [];

    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);

      const newPdfBytes = await newPdf.save();
      outputBuffers.push(Buffer.from(newPdfBytes));
    }

    return outputBuffers;
  } catch (error) {
    throw new Error('Failed to split pages');
  }
};

type PDFContentType = 'headingOne' | 'headingTwo' | 'paragraph' | 'bullet';

export interface PDFContent {
  type: PDFContentType;
  text: string;
}

const wrapText = (
  text: string,
  maxWidth: number,
  font: any,
  fontSize: number,
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

export const createSimplifiedPdf = async (pageContent: PDFContent[][]): Promise<Buffer> => {
  try {
    const html = generateHTMLFromContent(pageContent);

    const browser = await puppeteer.connect({browserWSEndpoint: 'wss://browserless-production-dfc4.up.railway.app?token=qu5tpi99EESc45tMpJn8BrPscsLeqWd9DwUxEm1nC2r648Vp'});
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Puppeteer PDF generation failed:', error);
    throw new Error('Failed to create PDF using Puppeteer');
  }
};

const generateHTMLFromContent = (pages: PDFContent[][]): string => {
  const fontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap';

  const styles = `
    <style>
      @import url('${fontUrl}');
      * {
        box-sizing: border-box;
      }
      body {
        font-family: 'Noto Sans', sans-serif;
        font-size: 16px;
        line-height: 1.6;
        padding: 0;
        margin: 0;
        color: #000;
        background-color: #fff;
      }
      .page {
        padding: 40px;
        page-break-after: always;
      }
      .page:last-child {
        page-break-after: auto;
      }
      h1 {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 16px;
      }
      h2 {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 12px;
      }
      p {
        margin: 0 0 12px 0;
      }
      ul {
        margin: 0 0 12px 20px;
        padding-left: 0;
      }
      li {
        margin-bottom: 6px;
      }
    </style>
  `;

  const escapeHtml = (text: string): string =>
    text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

  const renderPage = (content: PDFContent[]): string => {
    let html = '';
    let bulletItems: string[] = [];

    content.forEach((item, idx) => {
      const escapedText = escapeHtml(item.text);
      switch (item.type) {
        case 'headingOne':
          html += flushBullets() + `<h1>${escapedText}</h1>\n`;
          break;
        case 'headingTwo':
          html += flushBullets() + `<h2>${escapedText}</h2>\n`;
          break;
        case 'bullet':
          bulletItems.push(`<li>${escapedText}</li>`);
          break;
        case 'paragraph':
        default:
          html += flushBullets() + `<p>${escapedText}</p>\n`;
          break;
      }

      // Flush bullets on last item
      if (idx === content.length - 1) html += flushBullets();
    });

    function flushBullets(): string {
      if (!bulletItems.length) return '';
      const listHtml = `<ul>\n${bulletItems.join('\n')}\n</ul>\n`;
      bulletItems = [];
      return listHtml;
    }

    return html;
  };

  const pagesHtml = pages.map(page => `<div class="page">${renderPage(page)}</div>`).join('\n');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${styles}
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;
};
