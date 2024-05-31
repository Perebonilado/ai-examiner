export const saltRounds = 10;

export const generateQuestionsPrompt = (
  questionCount: number = 5,
  focusAreas?: string[],
) => {
  return `Generate ${questionCount} unique multiple choice questions from the file, different from any previously generated. For each question, evaluate what the detailed answer is, provide 4 options, and generate an id for the question, and an ids for each option. Be creative with the incorrect options, and ensure there is only one correct option. Try not have have options that all seem like the correct option. Also, make sure the id of the correct option for each question is not consecutively the same.  For example, if the correct id for question 1 is A, the correct id for question two should be maybe D or C. Shuffle it up. Ensure each option comes from the document but make sure there is only one correct option. For each question, try not to repeat the same incorrect options as well.
  
  ${focusAreas?.length ? `The questions should the following areas within the file: ${focusAreas.join(', ')}. ${focusAreas.length > 1 ? 'Try to evenly distribute the questions across these areas. If the areas are too many to distribute between the questions, then do as much as you can and leave the remaining areas. Also, shuffle up the questions such that they are mixed up based on the areas.' : ''}` : ''} Return only a JSON array in this format:
  
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
  
  Ignore images. Provide only the JSON array, nothing else. Be concise and fast .

  `;
};

export const generateTopicPrompt = `
Go through this document, check if it is broken down into topics covering small subsects in the document. If it does, return all the topics to me, else, try to break down the different concepts in the book and group each of them by a topic and return that to me. 

return to me in a json format like this:

["title1", "title2", ... ]

return nothing but this json`;

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
