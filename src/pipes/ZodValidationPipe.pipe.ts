import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors[0].message
        const field = error.errors[0].path[0]
        throw new BadRequestException(`${field} field: ${message}`);
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
