import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ExportFormat } from 'asposeslidescloud';
import { googlePresentationFileFormat, pdfMimeType } from 'src/constants';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { FileConversionService } from 'src/integrations/aspose/services/FileConversionService';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';
import { UpdateStoredFileHandler } from 'src/business/handlers/StoredFile/UpdateStoredFileHandler';
import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';
import { PDFContent } from 'src/utils';

/**
 * A document as a PDF (what Easy Read's Original view and page extraction use).
 * Non-PDF files are converted on the fly; persistAsPdf then replaces the stored file with the
 * PDF once, so later opens skip the conversion. Concurrent calls for the same file share one
 * conversion / one replacement.
 */
@Injectable()
export class DocumentPdfService {
  private readonly logger = new Logger(DocumentPdfService.name);
  private readonly converting = new Map<string, Promise<Buffer>>();
  private readonly persisting = new Map<string, Promise<void>>();

  constructor(
    @Inject(GoogleDriveService) private googleDriveService: GoogleDriveService,
    @Inject(FileConversionService)
    private fileConversionService: FileConversionService,
    @Inject(StoredFileQueryService)
    private storedFileQueryService: StoredFileQueryService,
    @Inject(UpdateStoredFileHandler)
    private updateStoredFileHandler: UpdateStoredFileHandler,
  ) {}

  public isPdf(storedFile: StoredFileModel) {
    return storedFile.currentFileFormat === pdfMimeType;
  }

  public async getPdf(storedFile: StoredFileModel): Promise<Buffer> {
    if (this.isPdf(storedFile)) {
      return await this.googleDriveService.getFile(storedFile.originalFileId);
    }
    const key = `${storedFile.id}:${storedFile.originalFileId}`;
    const inFlight = this.converting.get(key);
    if (inFlight) return await inFlight;
    const conversion = this.convert(storedFile).finally(() =>
      this.converting.delete(key),
    );
    this.converting.set(key, conversion);
    return await conversion;
  }

  private async convert(storedFile: StoredFileModel): Promise<Buffer> {
    const { currentFileFormat, originalFileId } = storedFile;
    if (currentFileFormat === googlePresentationFileFormat) {
      return await this.googleDriveService.exportFileAsPDF(originalFileId);
    }
    const file = await this.googleDriveService.getFile(originalFileId);
    switch (currentFileFormat) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.fileConversionService.convertDocument({
          buffer: file,
          extension: 'docx',
          convertTo: 'pdf',
        });
      case 'text/plain':
        return await this.fileConversionService.convertDocument({
          buffer: file,
          extension: 'txt',
          convertTo: 'Pdf',
        });
      case 'application/vnd.ms-powerpoint':
        return await this.fileConversionService.convertSlide({
          buffer: file,
          extension: 'ppt',
          convertTo: ExportFormat['Pdf'],
        });
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await this.fileConversionService.convertSlide({
          buffer: file,
          extension: 'pptx',
          convertTo: ExportFormat['Pdf'],
        });
      default:
        throw new HttpException(
          'File format not supported for viewing',
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  /**
   * Replaces a non-PDF stored file with its PDF (uploads the PDF, points the stored file at it,
   * deletes the old file). Re-reads the stored file first and does nothing if another request
   * already did it. Never throws; failures are logged and the next view converts again.
   */
  public persistAsPdf(
    storedFile: StoredFileModel,
    pdf: Buffer,
    title: string,
  ): Promise<void> {
    if (this.isPdf(storedFile)) return Promise.resolve();
    const inFlight = this.persisting.get(storedFile.id);
    if (inFlight) return inFlight;

    const work = (async () => {
      try {
        const latest = await this.storedFileQueryService.findById(
          storedFile.id,
        );
        if (
          !latest ||
          this.isPdf(latest) ||
          latest.originalFileId !== storedFile.originalFileId
        ) {
          return;
        }
        const uploaded = await this.googleDriveService.uploadFile({
          file: pdf,
          mimetype: pdfMimeType,
          originalFileName: title || 'document',
          mimeTypeToSaveAs: pdfMimeType,
        });
        // UpdateStoredFileHandler always rewrites modifiedContent: pass the current value back.
        const fresh = await this.storedFileQueryService.findById(storedFile.id);
        await this.updateStoredFileHandler.handle({
          id: storedFile.id,
          modifiedContent: this.parseContent(fresh?.modifiedContent),
          currentFileFormat: pdfMimeType,
          originalFileId: uploaded.fileId,
        });
        try {
          await this.googleDriveService.deleteFile(storedFile.originalFileId);
        } catch (error) {
          this.logger.warn(
            `Could not delete replaced file ${storedFile.originalFileId}: ${error?.message}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Could not save PDF for stored file ${storedFile.id}: ${error?.message}`,
        );
      }
    })().finally(() => this.persisting.delete(storedFile.id));

    this.persisting.set(storedFile.id, work);
    return work;
  }

  private parseContent(value: string | null | undefined): PDFContent[][] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
