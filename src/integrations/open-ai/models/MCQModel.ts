import { ExaminerModel } from './ExaminerModel';

export interface GenerateMCQPayloadModel {
  filePath: string;
  examiner: ExaminerModel;
}

export interface MCQModel {
  id: string;
  question: string;
  options: { value: string; id: string}[];
  correctAnswerId: string;
  explanation: string;
}
