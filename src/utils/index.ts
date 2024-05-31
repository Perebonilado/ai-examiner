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

export const extractJSONDataFromMessages = (
  messages: OpenAI.Beta.Threads.Messages.MessagesPage,
) => {
  const data = (messages.data[0].content[0] as any).text.value;

  return JSON.parse(
    data.replace(/^```json\s*|\s*```$/g, ''),
  ) as any;
};

export const getPagination = (page: number, size: number) => {
  // starting from page 1
  const offset = (page - 1) * size;

  return { offset, limit: size };
};
