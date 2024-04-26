import { AbstractError } from "../AbstractError";
import { SystemModule } from "../SystemModule";

export default class QueryError extends AbstractError {
    constructor(message: string) {
        super(message, SystemModule.QUERY);
    }
}