import { Inject, Injectable } from '@nestjs/common';
import {
  chunkText,
  extractPagesTextsFromPDF,
  generateUUID,
  writeFileToStream,
} from 'src/utils';
import * as mammoth from 'mammoth';
import { parseOfficeAsync } from 'officeparser';
import { decode } from 'iconv-lite';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import { MistralOcrService } from 'src/integrations/mistral-ai/services/MistralOcrService';
import { FileModel } from 'src/integrations/i-love-pdf/models/FileUploadModel';
const PPTX2Json = require('pptx2json');
import { join } from 'path';
import { tmpdir } from 'os';
import PPTXCompose from 'pptx-compose';
import PptxParser from 'node-pptx-parser';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';

@Injectable()
export class ExtractTextService {
  public readonly MAX_CHUNKS = 90;

  constructor(
    @Inject(ILovePdfService) private IlovePdfService: ILovePdfService,
    @Inject(MistralOcrService) private mistralOcrService: MistralOcrService,
  ) {}

  public async getChunksBasedOnFileMimeType({
    buffer,
    mimetype,
    originalName,
  }: {
    buffer: Buffer;
    mimetype: string;
    originalName: string;
  }) {
    try {
      switch (mimetype) {
        case 'application/pdf':
          return await this.extractChunksFromPDF(buffer, originalName);

        case 'text/plain':
          return await this.extractChunksFromTXT(buffer);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractTextFromDocx(buffer);

        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.extractTextFromPPTX(buffer);

        case 'application/vnd.ms-powerpoint':
          return await this.extractChunksFromPPT({
            buffer,
            mimetype,
            originalname: originalName,
          });

        default:
          throw new Error(
            'Unsupported file type. Only PDF, TXT, DOCX, and PPTX are supported.',
          );
      }
    } catch (error) {
      throw new Error(
        `Failed to get chunks based on file mime type: ${error.message}`,
      );
    }
  }

  public async extractTextFromPDFBuffer(
    file: Buffer,
    originalFileName: string,
  ) {
    return await this.extractChunksFromPDF(file, originalFileName);
  }

  private async extractChunksFromPDF(file: Buffer, originalFileName: string) {
    try {
      try {
        const chunks = await extractPagesTextsFromPDF(file);
        const isCamScannerDoc = chunks.some((chunk) => {
          const keywords = ['cam scanner', 'camscanner'];
          if (
            chunk.toLowerCase().includes(keywords[0]) ||
            chunk.toLowerCase().includes(keywords[1])
          ) {
            return true;
          }

          return false;
        });

        if (isCamScannerDoc) {
          return await this.mistralOcrService.processPdf(
            file,
            originalFileName,
          );
        }
        if (
          chunks
            .flatMap((c) => c)
            .join('')
            .trim().length > 0
        ) {
          return chunks;
        }

        console.log('No text found. Proceeding to OCR...');
      } catch (error) {
        console.log('Error extracting text. Proceeding to OCR...');
      }

      return await this.mistralOcrService.processPdf(file, originalFileName);
    } catch (error) {
      throw new Error(`Failed to extract chunks from PDF: ${error.message}`);
    }
  }

  private async extractChunksFromPPT(file: FileModel) {
    try {
      const fileArrayBuffer = await this.IlovePdfService.processFileBasedOnTool(
        file,
        'officepdf',
      );
      const chunks = await extractPagesTextsFromPDF(fileArrayBuffer);
      return chunks.filter((c) => c.trim().length);
    } catch (error) {
      throw new Error(`Failed to extract chunks from PPT: ${error.message}`);
    }
  }

  private async extractChunksFromTXT(buffer: Buffer) {
    try {
      const textContent = decode(buffer, 'utf-8');
      const chunks = textContent.split(/\n\s*\n/).map((chunk) => chunk.trim());
      return chunks.filter((chunk) => chunk.length > 0);
    } catch (error) {
      throw new Error(`Failed to extract text from TXT file: ${error.message}`);
    }
  }

  private async extractTextFromDocx(fileBuffer: Buffer): Promise<string[]> {
    try {
      const { value: text } = await mammoth.extractRawText({
        buffer: fileBuffer,
      });
      return chunkText(text.trim());
    } catch (error) {
      throw new Error(
        `Failed to extract text from DOCX file: ${error.message}`,
      );
    }
  }

  private async extractTextFromPPTX(buffer: Buffer): Promise<string[]> {
    try {
      // const text = await parseOfficeAsync(buffer);
      const tempFileName = `${generateUUID()}.pptx`;
      const tempFilePath = join(tmpdir(), tempFileName);
      await writeFileToStream(tempFilePath, buffer);
      const parser = new PptxParser(tempFilePath);
      const textContent = await parser.extractText();

      const slides = textContent
        .map((slide) => {
          // id shape is rId1, rId34 but unordered
          return { text: slide.text.join('\n'), id: Number(slide.id.slice(3)) };
        })
        .sort((a, b) => a.id - b.id);

      // Add a small delay before attempting to delete the file
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(
            `Failed to delete temporary file: ${tempFilePath}`,
            unlinkError,
          );
          // Continue execution even if file deletion fails
        }
      }

      // return chunkText(text)
      return slides.map((s) => s.text);
    } catch (error) {
      throw new Error(
        `Failed to extract text from PPTX file: ${error.message}`,
      );
    }
  }

  public async writeChunksToTxtFile(chunks: string[]) {
    try {
    } catch (error) {
      throw new Error('Failed to write chunks to txt file');
    }
  }

  private mergeChunks(chunks: string[]): string[] {
    if (chunks.length <= this.MAX_CHUNKS) {
      return chunks;
    }

    const mergedChunks: string[] = [];
    const mergeFactor = Math.ceil(chunks.length / this.MAX_CHUNKS);

    for (let i = 0; i < chunks.length; i += mergeFactor) {
      const merged = chunks.slice(i, i + mergeFactor).join(' '); // Merge chunks together
      mergedChunks.push(merged);
    }

    return mergedChunks.slice(0, this.MAX_CHUNKS); // Ensure it doesn't exceed 90
  }
}
