import { Injectable } from '@nestjs/common';
import { DocumentReadingProgressModel } from '../models/DocumentReadingProgress';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { Op } from 'sequelize';

@Injectable()
export class DocumentReadingProgressDbConnector {
  public async create(model: DocumentReadingProgressModel) {
    try {
      return await DocumentReadingProgressModel.create(model);
    } catch (error) {
      throw new DatabaseError(
        'Failed to create document reading progress',
      ).InnerError(error);
    }
  }

  public async delete(id: number) {
    try {
      await DocumentReadingProgressModel.destroy({ where: { id } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to create document reading progress',
      ).InnerError(error);
    }
  }

  public async bulkCreate(models: DocumentReadingProgressModel[]) {
    try {
      return await DocumentReadingProgressModel.bulkCreate(models);
      
    } catch (error) {
      throw new DatabaseError(
        'Failed to create document reading progress for topics',
      ).InnerError(error);
    }
  }

  public async bulkDelete(topicIds: number[]) {
    try {
      return await DocumentReadingProgressModel.destroy({
        where: {
          topicId: {
            [Op.in]: topicIds,
          },
        },
      });
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete document reading progress for topics',
      ).InnerError(error);
    }
  }
}
