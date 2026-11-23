import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { UserModel } from 'src/infra/db/models/UserModel';
import { AdminGuard } from '../AdminGuard';
import { CampaignService } from '../services/CampaignService';

@UseGuards(AdminGuard)
@Controller('admin/campaigns')
export class CampaignController {
  constructor(@Inject(CampaignService) private campaigns: CampaignService) {}

  private async admin(request: Request) {
    const token = request['user'] as VerifiedTokenModel;
    const user = await UserModel.findByPk(token.sub, {
      attributes: ['id', 'firstName', 'email'],
    });
    return {
      id: token.sub,
      email: user?.email || token.email,
      firstName: user?.firstName ?? null,
    };
  }

  @Get('templates')
  public templates() {
    return this.campaigns.templates();
  }

  @Get('audiences')
  public audiences() {
    return this.campaigns.audiences();
  }

  @Get('')
  public list(@Query('status') status?: string) {
    return this.campaigns.list(status);
  }

  @Post('')
  public async create(
    @Body() body: { templateKey?: string },
    @Req() request: Request,
  ) {
    return this.campaigns.create(
      String(body?.templateKey || ''),
      (await this.admin(request)).id,
    );
  }

  @Get(':id')
  public get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Put(':id')
  public update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.campaigns.update(id, body || {});
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(@Param('id') id: string) {
    await this.campaigns.remove(id);
  }

  @Post(':id/preview')
  public async preview(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Req() request: Request,
  ) {
    return this.campaigns.preview(id, body || {}, await this.admin(request));
  }

  @Post(':id/test')
  public async test(
    @Param('id') id: string,
    @Body() body: { to?: string },
    @Req() request: Request,
  ) {
    return this.campaigns.sendTest(id, await this.admin(request), body?.to);
  }

  @Get(':id/estimate')
  public async estimate(
    @Param('id') id: string,
    @Query('audience') audience?: string,
    @Query('sendAt') sendAt?: string,
  ) {
    const c = await this.campaigns.find(id);
    const key = audience || c.audience;
    const count =
      (await this.campaigns.audiences()).find((a) => a.key === key)?.count ?? 0;
    const when = sendAt ? new Date(sendAt) : null;
    const e = await this.campaigns.estimate(
      c,
      count,
      when && !Number.isNaN(when.getTime()) ? when : null,
    );
    return {
      recipients: e.recipients,
      days: e.days,
      dailyLimit: e.dailyLimit,
      startsOn: e.startsOn,
      finishesOn: e.finishesOn,
    };
  }

  @Post(':id/schedule')
  public schedule(
    @Param('id') id: string,
    @Body() body: { sendAt?: string | null },
  ) {
    return this.campaigns.schedule(id, body?.sendAt ?? null);
  }

  @Post(':id/pause')
  public pause(@Param('id') id: string) {
    return this.campaigns.setStatus(id, 'pause');
  }

  @Post(':id/resume')
  public resume(@Param('id') id: string) {
    return this.campaigns.setStatus(id, 'resume');
  }

  @Post(':id/unschedule')
  public unschedule(@Param('id') id: string) {
    return this.campaigns.setStatus(id, 'unschedule');
  }

  @Get(':id/report')
  public report(@Param('id') id: string) {
    return this.campaigns.report(id);
  }
}
