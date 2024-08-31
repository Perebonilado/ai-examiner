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

export const generateMessagePrompt = (message: string) => {
return `
Analyze the provided document thoroughly. Determine if the following request is within the context of the document:

Request: ${message}

If the request is relevant to the document's content:
1. Evaluate the request comprehensively
2. Provide a detailed response addressing all aspects of the request
3. Simplify your response to make it understandable for the reader. Give relatable real life examples to buttress your explanations where possible.
4. Provide pnemonics and patterns that might help the reader memorize or remember better where possible.
5. Format the response as follows:
   - Use pure text
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not repeat the request message, omit this in your response

If the request is not relevant to the document's content:
Respond only with: "Your message is not within the context of the provided document."

Adhere strictly to these guidelines in your response.
`
}

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
