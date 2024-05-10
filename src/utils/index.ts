import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { saltRounds } from 'src/constants';
import { MCQModel } from 'src/integrations/open-ai/models/MCQModel';
import OpenAI from 'openai';

export const generateUUID = (): string => {
  return uuidv4();
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
};

export const replaceAllSpacesInStringWithHyphen = (str: string) => {
  return str.replace(/\s+/g, '-');
};

export const extractQuestionsFromMessages = (
  messages: OpenAI.Beta.Threads.Messages.MessagesPage,
) => {
  const questions = (messages.data[0].content[0] as any).text.value;

  return JSON.parse(
    questions.replace(/^```json\s*|\s*```$/g, ''),
  ) as unknown as MCQModel[];
};
