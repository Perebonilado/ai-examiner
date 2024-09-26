import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';

export const saltRounds = 10;

export const maxNumberOfQuestionGenerationForFreePlanTier = 1;

export const inactiveSubscriptionStatuses = [
  'completed',
  'cancelled',
  'attention',
];

export const generateQuestionsPrompt = (
  questionCount: number = 5,
  focusAreas?: string[],
) => {
  return `Analyze the document thoroughly. Generate ${questionCount} unique multiple-choice questions based on key concepts.

${focusAreas?.length ? `Focus on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. ${focusAreas.length > 1 ? 'Distribute questions evenly across concepts and shuffle their order.' : ''}` : ''}

For each question:
1. Ensure relevance to document content
2. Provide 4 options with unique IDs
3. Include one correct answer; vary its position
4. Create plausible but clearly incorrect alternatives.
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. Explain why the correct option is the answer and why the incorrect options are not.
7. Ensure the questions and options are difficult and thought provoking.

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

const summaryResponse = `
1. Evaluate the request above thoroughly.
2. Evaluate what the detailed response to the request is, however, summarize your thoughts and make it concise, get right to the point and address only the focal point of the request.
3. Your response should typically be a few lines, you may add more if necessary to pass across the point. 
4. Do not provide memorization tips or mnemoics.
4. Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not repeat the request message, omit this in your response

`;

const inDepthResponse = `
1. Evaluate what the detailed response to the request is, however, summarize your thoughts.
2. Simplify your response to make it understandable for the reader. Give relatable real life examples to buttress your explanations where possible.
3. Provide mnemonics and patterns that might help the reader memorize or remember better where possible.
4. Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not repeat the request message, omit this in your response
`;

export const generateMessagePrompt = (
  message: string,
  responseFormat: MessageReponseType,
) => {
  return `
${message}

Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not add any markdowns that translate to <code></code> in html
   - Do not repeat the request message, omit this in your response
`;
};

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
