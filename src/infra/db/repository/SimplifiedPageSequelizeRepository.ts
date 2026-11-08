import { Inject, Injectable } from '@nestjs/common';
import {
  NewSimplifiedPage,
  SimplifiedPageRepository,
} from 'src/business/repository/SimplifiedPageRepository';
import { SimplifiedPageDbConnector } from '../connectors/SimplifiedPageDbConnector';

@Injectable()
export class SimplifiedPageSequelizeRepository
  implements SimplifiedPageRepository
{
  constructor(
    @Inject(SimplifiedPageDbConnector)
    private simplifiedPageDbConnector: SimplifiedPageDbConnector,
  ) {}

  public async createPages(pages: NewSimplifiedPage[]) {
    return await this.simplifiedPageDbConnector.createPages(pages);
  }

  public async claimPage(id: string, staleBefore: Date, maxAttempts: number) {
    return await this.simplifiedPageDbConnector.claimPage(
      id,
      staleBefore,
      maxAttempts,
    );
  }

  public async completePage(id: string, content: string) {
    return await this.simplifiedPageDbConnector.completePage(id, content);
  }

  public async failPage(id: string) {
    return await this.simplifiedPageDbConnector.failPage(id);
  }
}
