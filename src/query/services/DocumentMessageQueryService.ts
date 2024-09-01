import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { Op } from 'sequelize';
import { DocumentMessageModel } from 'src/infra/db/models/DocumentMessageModel';

@Injectable()
export class DocumentMessageQueryService {
  constructor() {}

  public async findDocumentMessagesByCourseDocumentId({
    courseDocumentId,
    limit = 5,
    lastMessageCreatedOn,
  }: {
    courseDocumentId: string;
    limit: number;
    lastMessageCreatedOn?: Date;
  }) {
    try {
      const paginationCondition = lastMessageCreatedOn
        ? { createdOn: { [Op.lt]: lastMessageCreatedOn } }
        : {};

      const messages = await DocumentMessageModel.findAll({
        where: {
          courseDocumentId,
          ...paginationCondition,
        },
        order: [['createdOn', 'DESC']],
        limit,
      });

      const totalMessagesCount = await DocumentMessageModel.count({
        where: { courseDocumentId },
      });

      return {
        data: messages.map((m)=>{
          return {
            id: m.id,
            message: m.message,
            sender: m.sender,
            createdOn: m.createdOn
          }
        }),
        totalCount: totalMessagesCount,
      };
    } catch (error) {
      throw new QueryError(
        'Failed to find document messages by course document id',
      ).InnerError(error);
    }
  }
}
