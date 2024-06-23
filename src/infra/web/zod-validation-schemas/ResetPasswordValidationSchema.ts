import { z } from 'zod';

export const ResetPasswordValidationSchema = z.object({
  password: z.string(),
  token: z.string(),
});
