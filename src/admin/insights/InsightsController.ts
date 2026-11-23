import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { AdminGuard } from '../AdminGuard';
import { parseRange } from '../range';
import { LabelService } from './LabelService';
import { LABEL_KINDS, LabelKind } from './models';

const emailOf = (req: Request) =>
  (req['user'] as VerifiedTokenModel)?.email ?? null;

const kindsOf = (value: unknown): LabelKind[] =>
  (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map((k) => String(k).trim())
    .filter((k): k is LabelKind => LABEL_KINDS.includes(k as LabelKind));

/** Labelling: what's covered, what a run would cost, starting one, and the batches in flight. */
@UseGuards(AdminGuard)
@Controller('admin/insights')
export class InsightsController {
  constructor(@Inject(LabelService) private labels: LabelService) {}

  @Get('coverage')
  coverage() {
    return this.labels.coverage();
  }

  @Post('label/estimate')
  estimate(@Body() body: { kinds?: unknown; from?: string; to?: string }) {
    const range = parseRange(body?.from, body?.to, new Date(), 90);
    return this.labels.estimate(kindsOf(body?.kinds), range.from, range.to);
  }

  @Post('label')
  async label(
    @Req() req: Request,
    @Body()
    body: { kinds?: unknown; from?: string; to?: string; sample?: number },
  ) {
    const range = parseRange(body?.from, body?.to, new Date(), 90);
    const sample = Number(body?.sample);
    const result = await this.labels.submit({
      kinds: kindsOf(body?.kinds),
      from: range.from,
      to: range.to,
      limitPerKind:
        Number.isFinite(sample) && sample > 0
          ? Math.min(200, sample)
          : undefined,
      requestedBy: emailOf(req),
    });
    this.labels.clearCoverage();
    return result;
  }

  @Get('batches')
  batches() {
    return this.labels.batches();
  }

  /** Checks batches now instead of waiting for the next minute. */
  @Post('batches/check')
  async check() {
    await this.labels.poll();
    return this.labels.batches();
  }
}
