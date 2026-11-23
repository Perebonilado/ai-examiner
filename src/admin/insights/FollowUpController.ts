import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { AdminGuard } from '../AdminGuard';
import { FollowUpService } from './FollowUpService';

const userOf = (req: Request) => req['user'] as VerifiedTokenModel;

/** The follow-up list: review, edit, send, snooze or dismiss; rules and automatic sending. */
@UseGuards(AdminGuard)
@Controller('admin/follow-ups')
export class FollowUpController {
  constructor(@Inject(FollowUpService) private followUps: FollowUpService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.followUps.list(status);
  }

  @Get('student/:userId')
  forStudent(@Param('userId') userId: string) {
    return this.followUps.forStudent(userId);
  }

  @Post('run')
  run() {
    return this.followUps.runNow();
  }

  @Get('rules')
  rules() {
    return this.followUps.ruleSettings();
  }

  @Put('rules/:rule')
  updateRule(
    @Param('rule') rule: string,
    @Body() body: { enabled?: unknown; autoSend?: unknown },
    @Req() req: Request,
  ) {
    return this.followUps.updateRule(
      rule,
      body ?? {},
      userOf(req)?.email ?? null,
    );
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.followUps.edit(id, body ?? {});
  }

  @Post(':id/send')
  send(@Param('id') id: string, @Req() req: Request) {
    return this.followUps.send(id, userOf(req)?.email ?? null);
  }

  @Post(':id/test')
  test(@Param('id') id: string, @Req() req: Request) {
    const u = userOf(req);
    return this.followUps.sendTest(id, {
      email: u?.email ?? null,
      userId: u?.sub ?? null,
    });
  }

  @Post(':id/redraft')
  redraft(@Param('id') id: string, @Body() body: { instruction?: string }) {
    return this.followUps.redraft(
      id,
      typeof body?.instruction === 'string' ? body.instruction : undefined,
    );
  }

  @Post(':id/snooze')
  snooze(@Param('id') id: string, @Body() body: { days?: number }) {
    return this.followUps.setStatus(id, 'snooze', Number(body?.days) || 3);
  }

  @Post(':id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.followUps.setStatus(id, 'dismiss');
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.followUps.setStatus(id, 'restore');
  }
}
