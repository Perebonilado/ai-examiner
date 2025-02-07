import { z } from 'zod';

export const MobileGoogleValidationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
});
