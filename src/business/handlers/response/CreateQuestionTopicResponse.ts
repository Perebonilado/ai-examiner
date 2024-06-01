import { QuestionTopicModel } from "src/infra/db/models/QuestionTopicModel";

export interface CreateQuestionTopicRepsonse {
    data: QuestionTopicModel[]
}