import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { Op } from 'sequelize';
import { DocumentMessageModel } from 'src/infra/db/models/DocumentMessageModel';
import { removeSourceContextFromSystemResponse } from 'src/utils';

@Injectable()
export class DocumentMessageQueryService {
  constructor() {}

  public async countAllDocumentMessagesByCourseId(courseDocumentId: string) {
    try {
      return await DocumentMessageModel.count({ where: { courseDocumentId } });
    } catch (error) {
      throw new QueryError(
        'Failed to count all document messages by course document id',
      ).InnerError(error);
    }
  }

  /** The newest messages of a chat, oldest first (for the prompt). */
  public async findRecentMessages(courseDocumentId: string, limit: number) {
    try {
      const messages = await DocumentMessageModel.findAll({
        where: { courseDocumentId },
        attributes: ['sender', 'message', 'createdOn'],
        order: [['createdOn', 'DESC']],
        limit,
      });
      return messages.reverse().map((m) => ({
        sender: m.sender as string,
        message: m.message,
      }));
    } catch (error) {
      throw new QueryError(
        'Failed to find recent document messages',
      ).InnerError(error);
    }
  }

  public async findDocumentMessagesByCourseDocumentId({
    courseDocumentId,
    limit = 5,
    lastMessageCreatedOn,
    includeSourceTextInSystemResponse = false,
  }: {
    courseDocumentId: string;
    limit: number;
    lastMessageCreatedOn?: Date;
    includeSourceTextInSystemResponse?: boolean;
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
        data: orderedMessages.map((m) => {
          let messageToReturn = m.message;
          if (m.sender === 'system' && !includeSourceTextInSystemResponse) {
            messageToReturn = removeSourceContextFromSystemResponse(m.message);
          }
          return {
            id: m.id,
            message: messageToReturn,
            sender: m.sender,
            image: m?.image,
            createdOn: m.createdOn,
            threadId: m.openAiThreadId,
          };
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
