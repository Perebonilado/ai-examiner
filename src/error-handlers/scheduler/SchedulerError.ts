import { AbstractError } from '../AbstractError';
import { SystemModule } from '../SystemModule';

export class SchedulerError extends AbstractError {
  constructor(message: string) {
    super(message, SystemModule.SCHEDULER);
  }
}
