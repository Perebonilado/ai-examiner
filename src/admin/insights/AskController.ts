import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { generateUUID } from 'src/utils';
import { AdminGuard } from '../AdminGuard';
import { select } from '../sql';
import { AskService } from './AskService';
import { DigestService } from './DigestService';
import { StudentFeedbackModel } from './models';

/** Ask Claude (streamed) and the themes report. */
@UseGuards(AdminGuard)
@Controller('admin')
export class AskController {
  constructor(
    @Inject(AskService) private askService: AskService,
    @Inject(DigestService) private digests: DigestService,
  ) {}

  /** Server-sent events: {type:"step"|"text"|"done"|"error", ...}. */
  @Post('ask')
  async ask(
    @Body()
    body: {
      question?: string;
      history?: { role: 'user' | 'assistant'; text: string }[];
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    const emit = (e: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
    };
    const question = String(body?.question ?? '').trim();
    if (!question) {
      emit({ type: 'error', message: 'Ask a question first.' });
      return res.end();
    }
    const history = Array.isArray(body?.history)
      ? body.history
          .filter(
            (h) =>
              (h?.role === 'user' || h?.role === 'assistant') &&
              typeof h.text === 'string',
          )
          .slice(-6)
      : [];
    try {
      await this.askService.ask(
        question,
        history,
        emit,
        controller.signal,
        (req['user'] as VerifiedTokenModel)?.email ?? null,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        emit({
          type: 'error',
          message: 'Something went wrong. Try again in a moment.',
        });
      console.error('ask: failed', error?.message);
    }
    res.end();
  }

  @Get('insights/digest')
  digest(@Query() q: Record<string, string>) {
    return this.digests.latest(q);
  }

  @Post('insights/digest')
  async writeDigest(@Body() body: { from?: string; to?: string }) {
    void this.digests
      .generate(body?.from, body?.to)
      .catch((e) => console.error('digest failed', e?.message));
    return this.digests.latest(body ?? {});
  }
}

const KINDS = ['chat_answer', 'test', 'easy_read'];

/** Students' own ratings: a thumbs up or down on a chat answer, a test, or Easy Read. */
@UseGuards(AuthGuard)
@Controller('feedback')
export class StudentFeedbackController {
  @Post()
  async rate(
    @Req() req: Request,
    @Body()
    body: { kind?: string; itemId?: string; rating?: number; comment?: string },
  ) {
    const user = req['user'] as VerifiedTokenModel;
    const kind = String(body?.kind ?? '');
    const itemId = String(body?.itemId ?? '').slice(0, 64);
    const rating =
      Number(body?.rating) > 0 ? 1 : Number(body?.rating) < 0 ? -1 : 0;
    if (!user?.sub || !KINDS.includes(kind) || !itemId) return { saved: false };
    if (!rating) {
      await StudentFeedbackModel.destroy({
        where: { userId: user.sub, kind, itemId },
      });
      return { saved: true, rating: 0 };
    }
    const comment =
      typeof body?.comment === 'string'
        ? body.comment.trim().slice(0, 500) || null
        : null;
    const existing = await StudentFeedbackModel.findOne({
      where: { userId: user.sub, kind, itemId },
    });
    if (existing)
      await existing.update({
        rating,
        ...(comment !== null ? { comment } : {}),
      });
    else
      await StudentFeedbackModel.create({
        id: generateUUID(),
        userId: user.sub,
        kind,
        itemId,
        rating,
        comment,
        createdOn: new Date(),
      } as StudentFeedbackModel);
    return { saved: true, rating };
  }

  /** The signed-in student's own ratings for some items (so the buttons show their choice). */
  @Get()
  async mine(
    @Req() req: Request,
    @Query('kind') kind: string,
    @Query('ids') ids: string,
  ) {
    const user = req['user'] as VerifiedTokenModel;
    const list = String(ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (!user?.sub || !KINDS.includes(kind) || !list.length) return {};
    const rows = await select<{ item_id: string; rating: number }>(
      `SELECT item_id, rating FROM student_feedback WHERE user_id = :u AND kind = :kind AND item_id IN (:ids)`,
      { u: user.sub, kind, ids: list },
    );
    return Object.fromEntries(rows.map((r) => [r.item_id, Number(r.rating)]));
  }
}
