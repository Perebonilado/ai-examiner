import { DifficultyType } from 'src/constants/QuestionGenerationPrompt';

export interface GenerateQuestionDto {
  topics: string[];
  selectedQuestionTopics?: string[] | null;
  selectedTopicIds?: number[];
  questionCount: number;
  questionType: number;
  includeUseCases: boolean;
  difficulty: DifficultyType;
  title?: string;
}
