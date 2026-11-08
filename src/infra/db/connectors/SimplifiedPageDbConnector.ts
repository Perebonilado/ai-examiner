import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { literal } from 'sequelize';
import * as moment from 'moment';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { generateUUID } from 'src/utils';
import { SimplifiedPageModel } from '../models/SimplifiedPageModel';
import { NewSimplifiedPage } from 'src/business/repository/SimplifiedPageRepository';

const now = () => moment(new Date()).utc().toDate();

@Injectable()
export class SimplifiedPageDbConnector {
  public async createPages(pages: NewSimplifiedPage[]) {
    if (!pages.length) return;
    try {
      const createdOn = now();
      await SimplifiedPageModel.bulkCreate(
        pages.map(
          (p) =>
            ({
              id: generateUUID(),
              documentId: p.documentId,
              pageNumber: p.pageNumber,
              sourceText: p.sourceText,
              status: 'pending',
              attempts: 0,
              createdOn,
              updatedOn: createdOn,
            }) as SimplifiedPageModel,
        ),
        { ignoreDuplicates: true },
      );
    } catch (error) {
      throw new DatabaseError('Failed to create simplified pages').InnerError(
        error,
      );
    }
  }

  public async claimPage(id: string, staleBefore: Date, maxAttempts: number) {
    try {
      const [affected] = await SimplifiedPageModel.update(
        {
          status: 'running',
          attempts: literal('attempts + 1'),
          updatedOn: now(),
        } as unknown as SimplifiedPageModel,
        {
          where: {
            id,
            [Op.or]: [
              { status: 'pending' },
              { status: 'failed', attempts: { [Op.lt]: maxAttempts } },
              {
                status: 'running',
                updatedOn: { [Op.lt]: staleBefore },
                attempts: { [Op.lt]: maxAttempts },
              },
            ],
          },
        },
      );
      return affected === 1;
    } catch (error) {
      throw new DatabaseError('Failed to claim simplified page').InnerError(
        error,
      );
    }
  }

  public async completePage(id: string, content: string) {
    try {
      await SimplifiedPageModel.update(
        { status: 'done', content, updatedOn: now() } as SimplifiedPageModel,
        { where: { id } },
      );
    } catch (error) {
      throw new DatabaseError('Failed to save simplified page').InnerError(
        error,
      );
    }
  }

  public async failPage(id: string) {
    try {
      await SimplifiedPageModel.update(
        { status: 'failed', updatedOn: now() } as SimplifiedPageModel,
        { where: { id } },
      );
    } catch (error) {
      throw new DatabaseError('Failed to mark simplified page').InnerError(
        error,
      );
    }
  }
}
