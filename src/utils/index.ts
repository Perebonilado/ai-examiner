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

  return []
};

export const convertSmallerDemoninationtoLarger = (
  amount: number,
  factor: number,
) => {
  return amount / factor;
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

export const extractTextFromPDF = async (
  file: Express.Multer.File,
  options: PDFExtractOptions = {},
) => {
  try {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extractBuffer(file.buffer, options);
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
  encoding: BufferEncoding,
) => {
  await new Promise((resolve, reject) => {
    const writeStream = createWriteStream(tempFilePath, {
      encoding: encoding,
    });
    writeStream.write(content, encoding);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
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
