import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { saltRounds } from 'src/constants';
import OpenAI from 'openai';
import { createHmac } from 'crypto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

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

const extractJSONArray = (str: string): any[] => {
  const firstOpen = str.indexOf('[');
  const lastClose = str.lastIndexOf(']');

  if (firstOpen === -1 || lastClose === -1) {
      return []; // No valid JSON array found
  }

  const candidate = str.substring(firstOpen, lastClose + 1);

  try {
      const res = JSON.parse(candidate);
      if (Array.isArray(res)) {
          return res; // Return the valid JSON array
      }
  } catch (e) {
    throw new Error('No JSON object or array found in the text');
  }

  return []; // Return null if no valid JSON array is found
};


export const extractJSONDataFromMessages = (
  messages: OpenAI.Beta.Threads.Messages.MessagesPage,
) => {
  const data = (messages.data[0].content[0] as any).text.value;

  return extractJSONArray(data) as any;
};

export const convertSmallerDemoninationtoLarger = (amount: number, factor: number) => {
  return amount/factor
}

export const extractAndParseJSON = (text: string): any => {
  // Regular expression to match JSON arrays or objects
  const jsonRegex =
    /(\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\}|\[(?:[^\[\]]|\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\])*\])/;
  const match = text.match(jsonRegex);

  if (match) {
    try {
      // Parse the extracted JSON string
      const jsonString = match[0];
      const parsedJSON = JSON.parse(jsonString);
      return parsedJSON;
    } catch (error) {
      throw new Error('Failed to Parse JSON');
    }
  } else {
    throw new Error('No JSON object or array found in the text: ' + text);
  }
};

export const getPagination = (page: number, size: number) => {
  // starting from page 1
  const offset = (page - 1) * size;

  return { offset, limit: size };
};

export const getPaystackHash = (data: string): string => {
  const hash = createHmac(
    'sha512',
    EnvironmentVariables.config.paystackSecretKey,
  )
    .update(data)
    .digest('hex');

  return hash;
};
