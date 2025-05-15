import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateStoredFileRequest } from '../request/UpdateStoredFileRequest';
import { UpdateStoredFileResponse } from '../response/UpdateStoredFileResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';
import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';
import { StoredFileRepository } from 'src/business/repository/StoredFileRepository';

@Injectable()
export class UpdateStoredFileHandler extends AbstractRequestHandlerTemplate<
  UpdateStoredFileRequest,
  UpdateStoredFileResponse
> {
  constructor(
    @Inject(StoredFileQueryService)
    private storedFileQueryService: StoredFileQueryService,
    @Inject(StoredFileRepository)
    private storedFileRepository: StoredFileRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdateStoredFileRequest,
  ): Promise<CommandResponse<UpdateStoredFileResponse>> {
    try {
      const existingModel = await this.storedFileQueryService.findById(
        request.id,
      );

      if (!existingModel) {
        throw new HttpException(
          'File to update is non existent',
          HttpStatus.BAD_REQUEST,
        );
      }

      const modelToUpdate = {
        id: existingModel.id,
        originalFileId: request?.originalFileId ?? existingModel.originalFileId,
        modifiedContent: JSON.stringify(request.modifiedContent),
        documentId: existingModel.documentId,
        currentFileFormat:
          request?.currentFileFormat ?? existingModel.currentFileFormat,
        originalFileContentStructured:
          request?.originalFileContentStructured ??
          existingModel.originalFileContentStructured,
      } as StoredFileModel;

      const updated = await this.storedFileRepository.update(modelToUpdate);

      return {
        data: { id: updated.id },
        message: 'Updated',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle stored file update request',
      ).InnerError(error);
    }
  }
}
