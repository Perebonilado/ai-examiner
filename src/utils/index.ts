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
import fontkit from '@pdf-lib/fontkit';
import * as path from 'path';

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

export type PDFContentType = 'headingOne' | 'headingTwo' | 'paragraph' | 'bullet';

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
    const pdfDoc = await PDFDocument.create();

    pdfDoc.registerFontkit(fontkit)

    // Load Unicode-safe fonts
    const regularFontBytes = fs.readFileSync(
      path.join(__dirname, '../assets/fonts/NotoSans-Regular.ttf'),
    );
    const boldFontBytes = fs.readFileSync(
      path.join(__dirname, '../assets/fonts/NotoSans-Bold.ttf'),
    );

    const regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    for (const content of pageContent) {
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      let cursorY = height - 50;

      for (const item of content) {
        let fontSize = 12;
        let font = regularFont;
        let color = rgb(0, 0, 0);
        let indent = 0;
        let spacingAfter = 10;

        switch (item.type) {
          case 'headingOne':
            fontSize = 18;
            font = boldFont;
            spacingAfter = 20;
            break;

          case 'headingTwo':
            fontSize = 14;
            font = boldFont;
            spacingAfter = 16;
            break;

          case 'bullet':
            indent = 15;
            item.text = `• ${item.text}`;
            break;
        }

        const wrappedLines = wrapText(item.text, width - 100 - indent, font, fontSize);
        for (const line of wrappedLines) {
          page.drawText(line, {
            x: 50 + indent,
            y: cursorY,
            size: fontSize,
            font,
            color,
          });
          cursorY -= fontSize + 4;
        }

        cursorY -= spacingAfter;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to create simplified PDF');
  }
};