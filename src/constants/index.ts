export const saltRounds = 10;

export const generateQuestionsPrompt = (questionCount: number = 5) => {
  return `Generate ${questionCount} unique multiple choice questions from the file, different from any previously generated. Return only a JSON array in this format:
  
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
  
  Ignore images. Provide only the JSON array, nothing else. Be concise and fast.

  `;
};

export const generateTopicPrompt = `
Go through this document, check if it is broken down into topics covering small subsects in the document. If it does, return all the topics to me, else, try to break down the different concepts in the book and group each of them by a topic and return that to me. 

return to me in a json format like this:

["title1", "title2", ... ]

return nothing but this json`;

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
