import { z } from 'zod';

export const LoginValidationSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
