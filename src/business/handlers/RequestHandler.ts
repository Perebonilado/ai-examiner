import { CommandResponse } from './response/CommandResponse';

export interface RequestHandler<T, U> {
  handle(request: T): Promise<CommandResponse<U>>;
}
