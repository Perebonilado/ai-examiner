export const saltRounds = 10;

export const generateQuestionsPrompt = (
  questionCount: number = 5,
  focusAreas?: string[],
) => {
  return `Analyze the document thoroughly. Generate ${questionCount} unique multiple-choice questions based on key concepts. If insufficient content, generate the maximum possible.

${focusAreas?.length ? `Focus on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. ${focusAreas.length > 1 ? 'Distribute questions evenly across concepts and shuffle their order.' : ''}` : ''}

For each question:
1. Ensure relevance to document content
2. Provide 4 options with unique IDs
3. Include one correct answer; vary its position
4. Create plausible but clearly incorrect alternatives
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation

Ignore images. Return only a JSON array in this format:

[
  {
    "id": "string",
    "question": "string",
    "options": [
      { "value": "string", "id": "string" }
    ],
    "correctAnswerId": "string",
    "explanation": "string",
    "hint": "string"
  }
]

If unable to generate questions, return "unable to generate questions".`;
};
export const generateTopicPrompt = `
Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast`;

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
