
import { AbstractError } from '../AbstractError';
import { SystemModule } from '../SystemModule';

interface CommandRequest {}

export class HandlerError extends AbstractError {
  private _request: CommandRequest;

  constructor(message: string) {
    super(message, SystemModule.HANDLER);
  }

  Request(request: CommandRequest): HandlerError {
    this._request = request;
    return this;
  }

  get request(): CommandRequest {
    return this._request;
  }
}
