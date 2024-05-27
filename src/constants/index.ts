export const saltRounds = 10;

export const generateQuestionsPrompt = (questionCount: number = 5) => {
  return `Based off the file, generate a new set of unique ${questionCount} multiple choice questions different from previously generated questions and return only a json array format like this: [{ id: string, question: string, options: { value: string, id: string }[], correctAnswerId: string, explanation: string}]. This json structure should be the only thing you return, no other strings whatsoever. Ignore images in the file, and be as concise and fast as possible`;
};

export const generateTopicPrompt = `
Go through this document, check if it is broken down into topics covering small subsects in the document. If it does, return all the topics to me, else, try to break down the different concepts in the book and group each of them by a topic and return that to me. 

return to me in a json format like this:

["title1", "title2", ... ]

return nothing but this json`;

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
