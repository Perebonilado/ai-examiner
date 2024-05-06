import { Injectable } from '@nestjs/common';
import { RequestHandler } from './RequestHandler';
import { CommandResponse } from './response/CommandResponse';

@Injectable()
export default abstract class AbstractRequestHandlerTemplate<T, U>
  implements RequestHandler<T, U>
{
  protected abstract handleRequest(request: T): Promise<CommandResponse<U>>;

  public async handle(request: T): Promise<CommandResponse<U>> {
    return await this.handleRequest(request);
  }
}
