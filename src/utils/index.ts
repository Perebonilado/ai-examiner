import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { saltRounds } from 'src/constants';

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