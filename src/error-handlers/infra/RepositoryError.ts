import { AbstractError } from "../AbstractError";
import { SystemModule } from "../SystemModule";

export default class RepositoryError extends AbstractError {
    constructor(message: string) {
        super(message, SystemModule.REPOSITORY);
    }
}