import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { DeleteUserDataRequest } from '../request/DeleteUserDataRequest';
import { DeleteUserDataResponse } from '../response/DeleteUserDataResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { DocumentMessageRepository } from 'src/business/repository/DocumentMessageRepository';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';
import { OneTimeSubscriptionRepository } from 'src/business/repository/OneTimeSubscriptionRepository';
import { PerformanceTrackingRepository } from 'src/business/repository/PerformanceTrackingRepository';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { QuestionProgressRepository } from 'src/business/repository/QuestionProgressRepository';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { UserRepository } from 'src/business/repository/UserRepository';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { FloDeskMailerService } from 'src/integrations/flo-desk-mailer/services/FloDeskMailerService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { FlodeskSubscriberStatus } from 'src/integrations/flo-desk-mailer/models/FLoDeskSubscriberModel';

@Injectable()
export class DeleteUserDataHandler extends AbstractRequestHandlerTemplate<
  DeleteUserDataRequest,
  DeleteUserDataResponse
> {
  constructor(
    @Inject(CourseDocumentRepository)
    private courseDocumentRepository: CourseDocumentRepository,
    @Inject(CourseRepository)
    private courseRepository: CourseRepository,
    @Inject(DocumentMessageRepository)
    private documentMessageRepository: DocumentMessageRepository,
    @Inject(DocumentTopicRepository)
    private documentTopicRepository: DocumentTopicRepository,
    @Inject(OneTimeSubscriptionRepository)
    private oneTimeSubscriptionRepository: OneTimeSubscriptionRepository,
    @Inject(PerformanceTrackingRepository)
    private performanceTrackingRepository: PerformanceTrackingRepository,
    @Inject(QuestionRepository) private questionRepository: QuestionRepository,
    @Inject(QuestionProgressRepository)
    private questionProgressRepository: QuestionProgressRepository,
    @Inject(ScoreRepository) private scoreRepository: ScoreRepository,
    @Inject(SubscriptionRepository)
    private subscriptionRepository: SubscriptionRepository,
    @Inject(UserRepository) private userRepository: UserRepository,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(FloDeskMailerService)
    private floDeskMailerService: FloDeskMailerService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
  ) {
    super();
  }

  public async handleRequest(
    request: DeleteUserDataRequest,
  ): Promise<CommandResponse<DeleteUserDataResponse>> {
    try {
      const { userId } = request;
      await this.performanceTrackingRepository.deleteUserPerformanceTrackingData(
        userId,
      );
      await this.documentMessageRepository.deleteAllUserDocumentMessages(
        userId,
      );
      await this.documentTopicRepository.deleteAllUserDocumentTopics(userId);
      await this.scoreRepository.deleteAllUserScoreData(userId);
      await this.questionProgressRepository.deleteAllUserQuestionProgressData(
        userId,
      );
      await this.questionRepository.deleteAllUserQuestionsData(userId);
      await this.courseDocumentRepository.deleteAllUserCourseDocuments(userId);
      await this.courseRepository.deleteAllUserCourses(userId);

      // subscription data
      await this.oneTimeSubscriptionRepository.deleteUserOneTimeSubscriptionData(
        userId,
      );

      const subscriptionDetails =
        await this.subscriptionQueryService.findByUserId(userId);
      if (subscriptionDetails?.subscriptionCode) {
        const subInfo =
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            subscriptionDetails.subscriptionCode,
          );
        const { status, token } = subInfo.subscrptionInformation;
        if (
          status.toLowerCase() === 'active' ||
          status.toLowerCase() === 'attention'
        ) {
          await this.paystackSubscriptionService.disableSubscription({
            emailToken: token,
            subscriptionCode: subscriptionDetails.subscriptionCode,
          });
        }

        await this.subscriptionRepository.deleteUserSubscriptionData(userId);
      }

      // unsubscribe user from flo desk
      const user = await this.userQueryService.findById(userId);
      const floDeskDetails = await this.floDeskMailerService.retrieveSubscriber(
        user.email,
      );

      if (floDeskDetails.status !== FlodeskSubscriberStatus.Unsubscribed) {
        await this.floDeskMailerService.unsubscribe(user.email);
      }

      // delete user

      await this.userRepository.deleteUser(userId);

      return {
        message: 'User data deleted successfully',
        data: null,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to delete user data').InnerError(error);
    }
  }
}
