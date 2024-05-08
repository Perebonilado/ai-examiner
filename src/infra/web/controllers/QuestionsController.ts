import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AIExaminerService } from 'src/integrations/open-ai/services/AIExaminerService';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerateMCQDto } from 'src/dto/GenerateMCQDto';

@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(AIExaminerService) private aiExaminerService: AIExaminerService,
  ) {}

  @Post('/generate-mcq')
  @UseInterceptors(FileInterceptor('document'))
  public async generateMCQQuestions(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GenerateMCQDto,
  ) {
    try {
      if (!body.category.trim()) {
        throw new HttpException('category is required', HttpStatus.BAD_REQUEST);
      }

      const questions =
        await this.aiExaminerService.generateMultipleChoiceQuestions({
          filePath: '',
          examiner: {
            instructions: `You are a ${body.category} examiner in a university`,
            name: `${body.category} examiner`,
          },
        });

      return questions;
    } catch (error) {
      throw new HttpException(
        'Something went wrong while generating mcq questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
