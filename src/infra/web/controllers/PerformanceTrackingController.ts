import {
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  Body,
  Param,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { QuestionProgressQueryService } from 'src/query/services/QuestionProgressQueryService';
import * as moment from 'moment';
import {
  PerformanceTrackingParsingData,
  PerformanceTrackingRawData,
} from '../models/PerformanceTrackingModel';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { generatePerformanceTrackingPrompt } from 'src/constants';
import { extractJSONDataFromMessages, generateUUID } from 'src/utils';

@Controller('performance-tracking')
export class PerformanceTrackingController {
  constructor(
    @Inject(QuestionProgressQueryService)
    private questionProgressQueryService: QuestionProgressQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('/:documentId')
  public async getPerformanceTrackingPerDocument(
    @Param('documentId') documentId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const startOfLastWeek = moment()
        .subtract(1, 'week')
        .startOf('week')
        .format('YYYY-MM-DD');
      const endOfLastWeek = moment()
        .subtract(1, 'week')
        .endOf('week')
        .format('YYYY-MM-DD');

      const progressInfo =
        await this.questionProgressQueryService.getPreviousWeekProgress({
          documentId,
          userId: userToken.sub,
          startDate: startOfLastWeek,
          endDate: endOfLastWeek,
        });

      const documentInfo =
        await this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        );

      const performanceDataForParsing =
        await this.getPerformaceDataForProcessing(progressInfo);

      const assistantId = EnvironmentVariables.config.assistantIdPaidPlan;

      const temporaryVectorStoreName = `${generateUUID()}_${new Date().getTime()}`;

      const temporaryVectorStore = await this.examinerService.createVectorStore(
        temporaryVectorStoreName,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          documentInfo.openAiFileId,
          temporaryVectorStore.id,
        );

      const thread = await this.examinerService.createThread();

      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStoreId,
        );

      await this.examinerService.createThreadMessage(
        updatedThread.id,
        generatePerformanceTrackingPrompt(performanceDataForParsing),
      );

      const run = await this.examinerService.createRun(
        assistantId,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id,
      );

      const performanceTracking = extractJSONDataFromMessages(messages)

      return performanceTracking
    } catch (error) {
      throw new HttpException(
        'Failed to get performance',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async getPerformaceDataForProcessing(
    progressInfo: PerformanceTrackingRawData[],
  ) {
    try {
      const progressInfoMapping = progressInfo.map((pi) => {
        let questionData = [];
        let savedProgress = [];
        if (pi.questionData?.length) {
          questionData = JSON.parse(pi.questionData as unknown as string);
        }

        if (pi.savedProgress?.length) {
          savedProgress = JSON.parse(pi.savedProgress as unknown as string);
        }

        return {
          ...pi,
          questionData: questionData,
          savedProgress: savedProgress,
        } as unknown as PerformanceTrackingRawData;
      });

      const performanceDataForParsing: PerformanceTrackingParsingData[] = [];

      for (let i = 0; i < progressInfoMapping.length; i++) {
        const progressData = progressInfoMapping[i].savedProgress;
        const questionData = progressInfoMapping[i].questionData;

        questionData.forEach((qd) => {
          if (progressInfoMapping[i].questionType === 'Multiple Choice') {
            const userAnsweredCorrectly =
              progressData.find((p) => p.selectedQuestionId === qd.id)
                ?.selectedOptionId === qd?.correctAnswerId;
            const question = qd.question;

            performanceDataForParsing.push({
              answeredCorrectly: userAnsweredCorrectly,
              question,
            });
          } else if (
            progressInfoMapping[i].questionType === 'Multiple True-False'
          ) {
            let correctlyAnsweredCount = 0;

            // loop through the options and check if user picked that option in progress
            qd.options.forEach((opt) => {
              const optionsPickedInProgress = progressData.filter(
                (p) => p.selectedQuestionId === qd.id,
              );

              if (optionsPickedInProgress.length) {
                const usersOptionSelection = optionsPickedInProgress.find(
                  (o) => o.selectedOptionId === opt.id,
                );
                if (usersOptionSelection) {
                  if (usersOptionSelection.selectedAnswer === opt.answer) {
                    correctlyAnsweredCount++;
                  }
                }
              }
            });
            const question = qd.question;
            const percentageOfCorrectlyAnswered =
              (correctlyAnsweredCount / qd.options.length) * 100;
            const userAnsweredCorrectly =
              percentageOfCorrectlyAnswered > 75 ? true : false;

            performanceDataForParsing.push({
              answeredCorrectly: userAnsweredCorrectly,
              question,
            });
          }
        });
      }

      return performanceDataForParsing;
    } catch (error) {
      throw new Error('Failed to get performace data for processing');
    }
  }
}
