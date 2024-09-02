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

      // Fetch messages in descending order to get the latest ones first
      const [messages, totalMessagesCount] = await Promise.all([
        DocumentMessageModel.findAll({
          where: {
            courseDocumentId,
            ...paginationCondition,
          },
          order: [['createdOn', 'DESC']], // Fetch newest messages first
          limit,
        }),
        DocumentMessageModel.count({
          where: { courseDocumentId },
        }),
      ]);

      // Reverse the messages to have the most recent messages last
      const orderedMessages = messages.reverse();

      return {
        data: orderedMessages.map((m) => ({
          id: m.id,
          message: m.message,
          sender: m.sender,
          createdOn: m.createdOn,
          threadId: m.openAiThreadId,
        })),
        totalCount: totalMessagesCount,
      };
    } catch (error) {
      throw new QueryError(
        'Failed to find document messages by course document id',
      ).InnerError(error);
    }
  }
}
