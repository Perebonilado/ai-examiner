import { DifficultyType } from "src/constants/QuestionGenerationPrompt";

export interface GenerateQuestionDto {
    topics: string[];
    selectedQuestionTopics?: string[] | null;
    questionCount: number;
    questionType: number;
    includeUseCases: boolean;
    difficulty: DifficultyType;
  }