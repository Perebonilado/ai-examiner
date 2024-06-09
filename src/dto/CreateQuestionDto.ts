import { MCQModel } from 'src/integrations/open-ai/models/MCQModel';

export interface CreateQuestionDto {
  data: MCQModel[];
  userId: string;
  courseDocumentId: string;
  questionTypeId: number;
}
