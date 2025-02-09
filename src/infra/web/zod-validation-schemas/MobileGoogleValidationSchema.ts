import { z } from 'zod';

export const MobileGoogleValidationSchema = z.object({
  token: z.string(),
});
