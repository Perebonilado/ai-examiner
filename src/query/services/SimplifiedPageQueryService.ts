import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { SimplifiedPageModel } from 'src/infra/db/models/SimplifiedPageModel';

@Injectable()
export class SimplifiedPageQueryService {
  /** Every page's number, status and attempts (no text), in page order. */
  public async findStatusesByDocumentId(documentId: string) {
    try {
      return await SimplifiedPageModel.findAll({
        where: { documentId },
        attributes: ['id', 'pageNumber', 'status', 'attempts', 'updatedOn'],
        order: [['pageNumber', 'ASC']],
      });
    } catch (error) {
      throw new QueryError('Failed to find simplified pages').InnerError(error);
    }
  }

  public async findSourceTextById(id: string) {
    try {
      return await SimplifiedPageModel.findOne({
        where: { id },
        attributes: ['id', 'pageNumber', 'sourceText'],
      });
    } catch (error) {
      throw new QueryError('Failed to find simplified page').InnerError(error);
    }
  }

  /** Simplified content of the given pages (all done pages when pageNumbers is omitted). */
  public async findDoneContent(documentId: string, pageNumbers?: number[]) {
    try {
      return await SimplifiedPageModel.findAll({
        where: {
          documentId,
          status: 'done',
          ...(pageNumbers ? { pageNumber: { [Op.in]: pageNumbers } } : {}),
        },
        attributes: ['pageNumber', 'content'],
        order: [['pageNumber', 'ASC']],
      });
    } catch (error) {
      throw new QueryError('Failed to find simplified content').InnerError(
        error,
      );
    }
  }
}
