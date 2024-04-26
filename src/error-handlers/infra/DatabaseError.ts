import { AbstractError } from '../AbstractError';
import { SystemModule } from '../SystemModule';

export class DatabaseError extends AbstractError {
  constructor(message: string) {
    super(message, SystemModule.DATABASE);
  }
}
