export const saltRounds = 10;

export const generateQuestionsPrompt = (
  questionCount: number = 5,
  focusAreas?: string[],
) => {
  return `Please review the document, and generate ${questionCount} unique multiple choice questions within the context of what is taught in the document. Each question should be detailed and relevant to a concept taught in the document. Ensure that each question is asked based on a concept being taught within the document. Each question should be different from any question previously generated. For each question, evaluate what the detailed answer is, provide 4 options, and generate an id for the question, and an ids for each option. Be creative with the incorrect options, and ensure there is only one correct option. Try not have have options that all seem like the correct option. Also, make sure the id of the correct option for each question is not consecutively the same.  For example, if the correct id for question 1 is A, the correct id for question two should be maybe D or C. Shuffle it up. Ensure each option comes from the document but make sure there is only one correct option. For each question, try not to repeat the same incorrect options as well.
  
  ${focusAreas?.length ? `The questions should be based on the following concepts or topics witin the document: ${focusAreas.join(', ')}. Each question should be specific to one of the afore mentioned concepts. Do not ask generalized questions, but specific questions which require a core understanding of the concept. Also, do not reference chapters in the questions, be direct and only ask questions applicable to the concept. 
  
  ${focusAreas.length > 1 ? 'Try to evenly distribute the questions across these concepts. If the concepts are too many to distribute amongst the questions, then ensure the questions come from some of the concepts provided. Also, shuffle up the questions such that they are mixed up based on the areas.' : ''}` : ''} 
  
  Provide only a JSON array in this format:
  
  [
    {
      "id": "string",
      "question": "string",
      "options": [
        { "value": "string", "id": "string" }
      ],
      "correctAnswerId": "string",
      "explanation": "string"
    }
  ]
  
  Ignore images. Provide only the JSON array, nothing else. Be concise and fast. Your response should contain only a JSON array, nothing else but this!

  `;
};

export const generateTopicPrompt = `
Please review the document and determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast`;

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
