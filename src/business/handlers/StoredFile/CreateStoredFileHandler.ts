import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateStoredFileRequest } from '../request/CreateStoredFileRequest';
import { CreateStoredFileResponse } from '../response/CreateStoredFileResponse';
import { StoredFileRepository } from 'src/business/repository/StoredFileRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';

@Injectable()
export class CreateStoredFileHandler extends AbstractRequestHandlerTemplate<
  CreateStoredFileRequest,
  CreateStoredFileResponse
> {
  constructor(
    @Inject(StoredFileRepository)
    private storedFileRepository: StoredFileRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateStoredFileRequest,
  ): Promise<CommandResponse<CreateStoredFileResponse>> {
    try {
      const modelToCreate = {
        originalFileId: request.originalFileId,
        modifiedContent: request?.modifiedContent,
        documentId: request.documentId,
        currentFileFormat: request.currentFileFormat,
        sprintReadContent: request?.sprintReadContent
          ? JSON.stringify(request.sprintReadContent)
          : null,
      } as StoredFileModel;

      const created = await this.storedFileRepository.create(modelToCreate);

      return {
        data: { id: created.id },
        message: 'Successful',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle file storage creation',
      ).InnerError(error);
    }
  }
}
