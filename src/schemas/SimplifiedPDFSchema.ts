import { z } from 'zod';

export const PDFContentSchema = z.object({
  type: z.enum(['headingOne', 'headingTwo', 'paragraph', 'bullet']),
  text: z.string(),
});

export const SimplifiedPDFArraySchema = z.object({
  simplifiedContent: z.array(PDFContentSchema)
});
