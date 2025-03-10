import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { PineconeClient } from './PineconeClient';
import { decode } from 'iconv-lite';
import { IntegratedRecord, RecordMetadata } from '@pinecone-database/pinecone';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import {
  chunkText,
  extractPagesTextsFromPDF,
} from 'src/utils';
import * as mammoth from 'mammoth';
import { parseOfficeAsync } from 'officeparser';

@Injectable()
export class PineconeChunkService extends PineconeClient {
  constructor(
    @Inject(ILovePdfService) private IlovePdfService: ILovePdfService,
  ) {
    super();
  }

  public async upsertChunks(chunks: string[], documentId: string) {
    try {
      const chunksToUpload: IntegratedRecord<RecordMetadata>[] = chunks.map(
        (chunk, idx) => {
          return { _id: `${documentId}#chunk${idx}`, text: chunk, documentId };
        },
      );
      await this.index
        .namespace(this.documentsNameSpace)
        .upsertRecords(chunksToUpload);
      // Wait for the upserted vectors to be indexed
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return await this.index.describeIndexStats();
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to upsert chunks',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async semanticChunkSearch(query: string, documentId: string) {
    try {
      const queryResponse = await this.index
        .namespace(this.documentsNameSpace)
        .searchRecords({
          query: {
            topK: 10,
            inputs: {
              text: query,
            },
            filter: { documentId },
          },
        });

      return queryResponse.result.hits
        .map((hit) => {
          return hit.fields['text'];
        })
        .join('\n');
    } catch (error) {
      throw new HttpException(
        'Failed to perform semantic query',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

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

  private async extractChunksPerPageFromFile(
    file: Express.Multer.File,
    pdfPageRange?: { start?: number; end?: number },
  ) {
    try {
      const isPDF = file.mimetype === 'application/pdf';

      try {
        const chunks = await extractPagesTextsFromPDF(file.buffer);

        // ✅ If text is extracted, return it immediately (OCR is NOT needed)
        if (chunks.length > 0) {
          return chunks;
        }

        console.log('No text found. Proceeding to OCR...');
      } catch (error) {
        console.log('Error extracting text. Proceeding to OCR...');
      }

      if (isPDF) {
        const fileArrayBuffer =
          await this.IlovePdfService.processFileBasedOnTool(file, 'officepdf');
        const chunks = await extractPagesTextsFromPDF(fileArrayBuffer);
        return chunks;
      }

      throw new Error('File is not a PDF');
    } catch (error) {
      throw new Error(`Failed to extract chunks per page: ${error.message}`);
    }
  }

  private async extractChunksFromPDF(file: Express.Multer.File) {
    try {
      try {
        const chunks = await extractPagesTextsFromPDF(file.buffer);

        // ✅ If text is extracted, return it immediately (OCR is NOT needed)
        if (chunks.length > 0) {
          return chunks;
        }

        console.log('No text found. Proceeding to OCR...');
      } catch (error) {
        console.log('Error extracting text. Proceeding to OCR...');
      }

      const fileArrayBuffer = await this.IlovePdfService.processFileBasedOnTool(
        file,
        'officepdf',
      );
      const chunks = await extractPagesTextsFromPDF(fileArrayBuffer);
      return chunks;
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
      // Detect encoding and decode text properly (defaulting to UTF-8)
      const textContent = decode(file.buffer, 'utf-8');

      // Split into chunks (e.g., by paragraphs or every N lines)
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
}
