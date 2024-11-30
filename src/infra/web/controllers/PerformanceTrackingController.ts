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

@Controller('performance-tracking')
export class PerformanceTrackingController {
  constructor(
    @Inject(QuestionProgressQueryService)
    private questionProgressQueryService: QuestionProgressQueryService,
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

      console.log(performanceDataForParsing)
    } catch (error) {
      throw new HttpException(
        'Failed to get performance',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
