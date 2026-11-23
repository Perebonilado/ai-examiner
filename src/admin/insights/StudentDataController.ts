import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { AdminGuard } from '../AdminGuard';
import { InsightsService } from './InsightsService';
import { TranslateService } from './TranslateService';

const emailOf = (req: Request) =>
  (req['user'] as VerifiedTokenModel)?.email ?? null;

/** Students' conversations, test attempts and documents, with Claude's labels. Every open is logged. */
@UseGuards(AdminGuard)
@Controller('admin')
export class StudentDataController {
  constructor(
    @Inject(InsightsService) private insights: InsightsService,
    @Inject(TranslateService) private translations: TranslateService,
  ) {}

  @Get('conversations')
  conversations(@Query() q: Record<string, string>) {
    return this.insights.conversations(q);
  }

  @Get('conversations/:key')
  conversation(@Param('key') key: string, @Req() req: Request) {
    return this.insights.conversation(key, emailOf(req));
  }

  /** English translations of a conversation (made once with Claude, then kept). */
  @Post('conversations/:key/translate')
  translateConversation(@Param('key') key: string) {
    return this.translations.conversation(key);
  }

  @Get('tests/summary')
  testsSummary(@Query() q: Record<string, string>) {
    return this.insights.testsSummary(q);
  }

  @Get('tests')
  tests(@Query() q: Record<string, string>) {
    return this.insights.tests(q);
  }

  @Get('tests/:key')
  test(@Param('key') key: string, @Req() req: Request) {
    return this.insights.test(key, emailOf(req));
  }

  @Get('documents')
  documents(@Query() q: Record<string, string>) {
    return this.insights.documents(q);
  }

  @Get('documents/:id')
  document(@Param('id') id: string, @Req() req: Request) {
    return this.insights.document(id, emailOf(req));
  }

  @Get('insights/overview')
  overview(@Query() q: Record<string, string>) {
    return this.insights.overview(q);
  }

  @Get('insights/labels')
  labels(@Query() q: Record<string, string>) {
    return this.insights.labels(q);
  }

  @Post('insights/labels/:id/correct')
  correct(
    @Param('id') id: string,
    @Body() body: { mood?: unknown; wrong?: unknown },
    @Req() req: Request,
  ) {
    return this.insights.correct(id, body, emailOf(req));
  }

  @Get('insights/views')
  views() {
    return this.insights.views();
  }
}
