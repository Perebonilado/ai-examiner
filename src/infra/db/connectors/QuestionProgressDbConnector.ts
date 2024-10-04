import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { QuestionProgressModel } from '../models/QuestionProgressModel';
import * as moment from 'moment';
import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';

@Injectable()
export class QuestionProgressDbConnector {
  public async upsert(progress: QuestionProgressModel) {
    try {
      // add or replace to question progress data
      
      if (progress.id && progress.data) {
        const existingQuestionProgress = await QuestionProgressModel.findOne({
          where: { id: progress.id },
        });

        const savedProgress = existingQuestionProgress.data
          ? (JSON.parse(
              existingQuestionProgress.data,
            ) as UpsertQuestionProgressDTO[])
          : null;
        const progressToSave = JSON.parse(progress.data) as [
          UpsertQuestionProgressDTO,
        ];

        if (!savedProgress) {
          return await QuestionProgressModel.update(
            {
              ...savedProgress,
              status: progress.status,
              data: JSON.stringify(progressToSave),
              modifiedOn: moment(new Date()).utc().toDate(),
            },
            {
              where: { id: progress.id },
              fields: ['data', 'modifiedOn', 'status'],
            },
          );
        } else {
          const savedQuestionNeedsUpdate = savedProgress.some((p) => {
            return progressToSave[0].selectedQuestionId === p.selectedQuestionId;
          });

          if (savedQuestionNeedsUpdate) {
            const updatedProgress = savedProgress.map((p) => {
              if (p.selectedQuestionId === progressToSave[0].selectedQuestionId) {
                return {
                  ...p,
                  selectedOptionId: progressToSave[0].selectedOptionId,
                };
              } else {
                return p;
              }
            });

            return await QuestionProgressModel.update(
              {
                ...savedProgress,
                data: JSON.stringify(updatedProgress),
                status: progress.status,
                modifiedOn: moment(new Date()).utc().toDate(),
              },
              {
                where: { id: progress.id },
                fields: ['data', 'modifiedOn', 'status'],
              },
            );
          } else {
            const updatedProgress = [...savedProgress, ...progressToSave];

            return await QuestionProgressModel.update(
              {
                ...savedProgress,
                data: JSON.stringify(updatedProgress),
                status: progress.status,
                modifiedOn: moment(new Date()).utc().toDate(),
              },
              {
                where: { id: progress.id },
                fields: ['data', 'modifiedOn', 'status'],
              },
            );
          }
        }
      } else if (!progress.id && progress.data) {
        // create the progress as it is new
        return await QuestionProgressModel.create(progress);
      } else if (progress.id && !progress.data) {
        // clear existing progress data or change status

        return await QuestionProgressModel.update(
          {
            ...progress,
            data: progress.data ?? null,
            status: progress.status,
            modifiedOn: moment(new Date()).utc().toDate(),
          },
          {
            where: { id: progress.id },
            fields: ['data', 'modifiedOn', 'status'],
          },
        );
      }
    } catch (error) {
      throw new DatabaseError('Failed to upsert progress').InnerError(error);
    }
  }
}
