import { Inject, Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import { getPagination } from 'src/utils';
import { ScoreQueryService } from './ScoreQueryService';
import { QuestionTopicQueryService } from './QuestionTopicQueryService';
import { LookUpQueryService } from './LookUpQueryService';
import * as moment from 'moment';
import { Op } from 'sequelize';
import { UserModel } from 'src/infra/db/models/UserModel';
import { DocumentTopicQueryService } from './DocumentTopicQueryService';
import { OralQuestionAnalysisQueryService } from './OralQuestionAnalysisQueryService';
import { PromptConfigV2 } from 'src/constants/QuestionGenerationPromptV2';
import { FlaggedQuestionQueryService } from './FlaggedQuestionQueryService';

@Injectable()
export class QuestionQueryService {
  constructor(
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
    @Inject(QuestionTopicQueryService)
    private questionTopicService: QuestionTopicQueryService,
    @Inject(LookUpQueryService) private lookUpQueryService: LookUpQueryService,
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
    @Inject(OralQuestionAnalysisQueryService)
    private oralQuestionAnalysisQueryService: OralQuestionAnalysisQueryService,
    @Inject(FlaggedQuestionQueryService)
    private flaggedQuestionQueryService: FlaggedQuestionQueryService,
  ) {}

  public async findAllQuestionsByDocumentIdAndUserId(
    documentId: string,
    userId: string,
    pageSize: number,
    page: number,
  ) {
    try {
      const { limit, offset } = getPagination(page, pageSize);
      const totalCount = await QuestionModel.count({
        where: { courseDocumentId: documentId, userId },
      });
      const questions = await QuestionModel.findAll({
        where: { courseDocumentId: documentId, userId },
        order: [['created_on', 'DESC']],
        limit,
        offset,
      });

      const questionsWithScoresAndTopics = await Promise.all(
        questions.map(async (q) => {
          const score = await this.scoreQueryService.findScoreByQuestionId(
            q.id,
          );

          const topics =
            await this.questionTopicService.findQuestionTopicsByQuestionId(
              q.id,
            );

          const type = await this.lookUpQueryService.findLookUpById(
            q.questionTypeId,
          );

          return {
            ...q.get({ plain: true }),
            score: score ? score.score : null,
            topics: topics
              ? topics.map((t) => ({ id: t.id, title: t.documentTopicTitle }))
              : null,
            type: type ? type.title : null,
          };
        }),
      );

      return {
        questions: questionsWithScoresAndTopics,
        meta: {
          currentPage: page,
          pageSize,
          totalCount,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find questions').InnerError(error);
    }
  }

  public async findSharedQuestionById(id: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id } });
      const courseDocument = await CourseDocumentModel.findOne({
        where: { id: question.courseDocumentId },
      });
      const type = await this.lookUpQueryService.findLookUpById(
        question.questionTypeId,
      );
      const sharedBy = await UserModel.findOne({
        where: { id: question.userId },
      });

      return {
        id: question.id,
        documentTitle: courseDocument.title,
        questions: JSON.parse(question.data),
        createdOn: question.createdOn,
        fileId: courseDocument.openAiFileId,
        type: type ? type.title : null,
        typeId: type ? type.id : null,
        difficulty: question.difficulty,
        isCaseStudy: question.isCaseStudy,
        sharedBy: {
          firstname: sharedBy.firstName,
          lastName: sharedBy.lastName,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find shared questions').InnerError(error);
    }
  }

  public async findQuestionsById(id: string, userId: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id, userId } });
      const flaggedQuestions =
        await this.flaggedQuestionQueryService.findFlaggedQuestionsByTestId(
          question.id,
        );
      const flaggedSelectedQuestionIds = flaggedQuestions?.map(
        (fl) => fl.selectedQuestionId,
      );
      const courseDocument = await CourseDocumentModel.findOne({
        where: { id: question.courseDocumentId, userId },
      });
      const score = await this.scoreQueryService.findScoreByQuestionId(
        question.id,
      );
      const topics =
        await this.questionTopicService.findQuestionTopicsByQuestionId(id);

      const allTopics =
        await this.documentTopicQueryService.findAllByDocumentTopicsByDocumentIdAndUserId(
          courseDocument.id,
          userId,
        );
      const allTopicsMapped = allTopics.map((t) => t.title);

      const type = await this.lookUpQueryService.findLookUpById(
        question.questionTypeId,
      );

      let analysisData = null;
      if (type.title.toLowerCase().includes('oral')) {
        const analysisDataAvailable =
          await this.oralQuestionAnalysisQueryService.findByQuestionId(
            question.id,
          );
        if (analysisDataAvailable) {
          const dataToSet = {
            analysis: JSON.parse(analysisDataAvailable.analysisData),
            callId: analysisDataAvailable.callId,
          };
          analysisData = dataToSet;
        }
      }

      return {
        id: question.id,
        documentTitle: courseDocument.title,
        documentId: courseDocument.id,
        createdOn: question.createdOn,
        questions: JSON.parse(question.data)?.filter((q) => {
          if (flaggedSelectedQuestionIds.indexOf(q.id) === -1) {
            return true;
          }

          return false;
        }),
        score: score ? score.score : null,
        topics: topics
          ? topics.map((t) => ({ id: t.id, title: t.documentTopicTitle }))
          : null,
        type: type ? type.title : null,
        fileId: courseDocument.openAiFileId,
        allTopics: allTopicsMapped,
        analysisData,
      };
    } catch (error) {
      console.log(error);
      throw new QueryError('Failed to find questions by id').InnerError(error);
    }
  }

  public async getQuestionById(id: string) {
    try {
      return await QuestionModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to get questions by id').InnerError(error);
    }
  }

  public async getUserQuestionsCountForCurrentMonth(userId: string) {
    try {
      const startOfMonth = moment().startOf('month').toDate();
      const endOfMonth = moment().endOf('month').toDate();

      return await QuestionModel.count({
        where: {
          userId: userId,
          createdOn: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
        },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to get number of questions generated for the user for current month',
      ).InnerError(error);
    }
  }

  public async findPreviousQuestionsByConfig(
    documentId: string,
    {
      difficulty,
      includeCaseStudies,
    }: Omit<
      PromptConfigV2,
      | 'questionCount'
      | 'focusAreas'
      | 'questionType'
      | 'sourceText'
      | 'previousQuestions'
    >,
    questionType: string,
    limit: number,
  ) {
    try {
      const previousQuestions = await QuestionModel.findAll({
        where: {
          courseDocumentId: documentId,
          difficulty,
          isCaseStudy: includeCaseStudies,
          questionTypeId: questionType,
        },
        limit,
      });

      const questions = previousQuestions.map(
        (q) => JSON.parse(q.data).question as string,
      );
      return questions;
    } catch (error) {
      throw new QueryError('Failed to find prev questions').InnerError(error);
    }
  }
}
