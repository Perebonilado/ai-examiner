import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { QuestionProgressModel } from '../models/QuestionProgressModel';
import * as moment from 'moment';
import { QuestionProgressDataModel } from 'src/infra/web/models/QuestionProgressDataModel';

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
            ) as QuestionProgressDataModel[])
          : null;
        const progressToSave = JSON.parse(progress.data) as [
          QuestionProgressDataModel,
        ];

        if (!savedProgress) {
          return await QuestionProgressModel.update(
            {
              ...savedProgress,
              data: JSON.stringify(progressToSave),
              modifiedOn: moment(new Date()).utc().toDate(),
            },
            {
              where: { id: progress.id },
              fields: ['data', 'modifiedOn'],
            },
          );
        } else {
          const savedQuestionNeedsUpdate = savedProgress.some((p) => {
            return progressToSave[0].selectionOptionId === p.selectionOptionId;
          });

          if (savedQuestionNeedsUpdate) {
            const updatedProgress = savedProgress.map((p) => {
              if (p.selectionOptionId === progressToSave[0].selectionOptionId) {
                return {
                  ...p,
                  selectionOptionId: progressToSave[0].selectionOptionId,
                };
              } else {
                return p;
              }
            });

            return await QuestionProgressModel.update(
              {
                ...savedProgress,
                data: JSON.stringify(updatedProgress),
                modifiedOn: moment(new Date()).utc().toDate(),
              },
              {
                where: { id: progress.id },
                fields: ['data', 'modifiedOn'],
              },
            );
          } else {
            const updatedProgress = [...savedProgress, ...progressToSave];

            return await QuestionProgressModel.update(
              {
                ...savedProgress,
                data: JSON.stringify(updatedProgress),
                modifiedOn: moment(new Date()).utc().toDate(),
              },
              {
                where: { id: progress.id },
                fields: ['data', 'modifiedOn'],
              },
            );
          }
        }
      } else if (!progress.id && progress.data) {
        // create the progress as it is new
        return await QuestionProgressModel.create(progress);
      } else if (progress.id && !progress.data) {
        // clear existing progress data
        return await QuestionProgressModel.update(
          {
            ...progress,
            data: null,
            modifiedOn: moment(new Date()).utc().toDate(),
          },
          {
            where: { id: progress.id },
            fields: ['data', 'modifiedOn'],
          },
        );
      }
    } catch (error) {
      throw new DatabaseError('Failed to upsert progress').InnerError(error);
    }
  }
}
