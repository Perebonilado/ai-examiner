interface EssayQuestion {
  question: string;
  answer: string;
}

export interface AnalyzeEssayTestDto {
  questionId: string;
  data: EssayQuestion[];
}
