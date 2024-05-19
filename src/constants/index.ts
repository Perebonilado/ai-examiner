export const saltRounds = 10;

export const getGenerationPropmt = (questionCount: number = 5) => {
  return `Based off the file, generate a new set of unique ${questionCount} multiple choice questions different from previously generated questions and return only a json array format like this: [{ id: string, question: string, options: { value: string, id: string }[], correctAnswerId: string, explanation: string}]. This json structure should be the only thing you return, no other strings whatsoever. Ignore images in the file, and be as concise and fast as possible`;
};

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
