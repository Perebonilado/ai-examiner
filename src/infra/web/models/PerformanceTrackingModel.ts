import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';
import { QuestionType } from './QuestionTypeModel';

export interface PerformanceTrackingParsingData {
  question: string;
  answeredCorrectly: boolean;
}

export interface PerformanceTrackingRawData {
  savedProgress: UpsertQuestionProgressDTO[];
  createdOn: string;
  questionData: {
    id: string;
    question: string;
    options: [{ value: string; id: string; answer?: boolean }];
    correctAnswerId?: string;
    explanation: string;
    hint: string;
  }[];
  status: string;
  id: string;
  questionType: QuestionType;
}

type Topic = string;
type Score = number;
type Review = string;

export type PerformanceTracking = [Topic, Score, Review];

export interface PerformanceTrackingModel {
  data: PerformanceTracking[];
  documentTitle: string;
  period: string;
}
