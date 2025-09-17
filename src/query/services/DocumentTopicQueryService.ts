import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

@Injectable()
export class DocumentTopicQueryService {
  public async findDocumentTopicById(id: number) {
    try {
      return await DocumentTopicModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to find document topic').InnerError(error);
    }
  }

  public async findAllByDocumentTopicsByDocumentIdAndUserId(
    documentId: string,
    userId?: string,
  ) {
    try {
      return await DocumentTopicModel.findAll({
        where: { documentId, ...(userId ? { userId } : {}) },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find document topics by document and user id',
      ).InnerError(error);
    }
  }

  public async findAllDocumentTopicsWithReadingProgress(documentId: string) {
    const topics = await DocumentTopicModel.findAll({
      where: { documentId },
    });
    const topicsWithReadingProgress = await Promise.all(
      topics.map(async (topic) => {
        const userHasReadTopic = await DocumentReadingProgressModel.findOne({
          where: { topicId: topic.id },
        });

        return {
          ...topic.get({ plain: true }),
          isRead: userHasReadTopic ? true : false,
        };
      }),
    );

    return topicsWithReadingProgress;
  }

  public async findAllDocumentTopicsByDocumentIds(docIds: string[]) {
    try {
      return await DocumentTopicModel.findAll({
        where: {
          documentId: {
            [Op.in]: docIds,
          },
        },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find all document topics by id',
      ).InnerError(error);
    }
  }

  public async findDocumentTopicsByTitleAndDocumentId(
    title: string,
    documentId: string,
  ) {
    try {
      return await DocumentTopicModel.findOne({ where: { title, documentId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find document topics by title and id',
      ).InnerError(error);
    }
  }

  public async findDocumentTopicsByTitleAndDocumentIdAndStartPage(
    title: string,
    documentId: string,
    startPage,
  ) {
    try {
      return await DocumentTopicModel.findOne({
        where: { title, documentId, startPage },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find document topics by title and id',
      ).InnerError(error);
    }
  }
}
