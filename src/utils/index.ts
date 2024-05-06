import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

export const generateUUID = (): string => {
  return uuidv4();
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
