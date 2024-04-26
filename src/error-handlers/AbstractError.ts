import { SystemModule } from './SystemModule';

export abstract class AbstractError extends Error {
  private _module: SystemModule;
  private _innerError?: AbstractError;
  private _detailedMessage?: string;

  constructor(message: string, module: SystemModule) {
    super(message);
    this._module = module;
    this._module = module;
  }

  InnerError(innerError: AbstractError): AbstractError {
    this._innerError = innerError;
    return this;
  }

  DetailedMessage(detailedMessage: string): AbstractError {
    this._detailedMessage = detailedMessage;
    return this;
  }

  get module(): SystemModule {
    return this._module;
  }

  get innerError(): AbstractError {
    return this._innerError;
  }

  get detailedMessage(): string {
    return this._detailedMessage;
  }
}
