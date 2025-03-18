import { Inject, Injectable } from '@nestjs/common';
import { chunkText, extractPagesTextsFromPDF } from 'src/utils';
import * as mammoth from 'mammoth';
import { parseOfficeAsync } from 'officeparser';
import { decode } from 'iconv-lite';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import { MistralOcrService } from 'src/integrations/mistral-ai/services/MistralOcrService';

@Injectable()
export class ExtractTextService {
  public readonly MAX_CHUNKS = 90;

  constructor(
    @Inject(ILovePdfService) private IlovePdfService: ILovePdfService,
    @Inject(MistralOcrService) private mistralOcrService: MistralOcrService,
  ) {}

  public async getChunksBasedOnFileMimeType(file: Express.Multer.File) {
    try {
      const { mimetype, buffer } = file;

      switch (mimetype) {
        case 'application/pdf':
          return await this.extractChunksFromPDF(file);

        case 'text/plain':
          return await this.extractChunksFromTXT(file);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractTextFromDocx(file.buffer);

        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.extractTextFromPPTX(buffer);

        case 'application/vnd.ms-powerpoint':
          return await this.extractChunksFromPPT(file);

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

  private async extractChunksFromPDF(file: Express.Multer.File) {
    try {
      try {
        const chunks = await extractPagesTextsFromPDF(file.buffer);

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

      return await this.mistralOcrService.processPdf(file);
    } catch (error) {
      throw new Error(`Failed to extract chunks from PDF: ${error.message}`);
    }
  }

  private async extractChunksFromPPT(file: Express.Multer.File) {
    try {
      const fileArrayBuffer = await this.IlovePdfService.processFileBasedOnTool(
        file,
        'officepdf',
      );
      const chunks = await extractPagesTextsFromPDF(fileArrayBuffer);
      return chunks;
    } catch (error) {
      throw new Error(`Failed to extract chunks from PPT: ${error.message}`);
    }
  }

  private async extractChunksFromTXT(file: Express.Multer.File) {
    try {
      const textContent = decode(file.buffer, 'utf-8');
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
      const text = await parseOfficeAsync(buffer);
      return chunkText(text);
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
