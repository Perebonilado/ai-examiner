import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Header,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { AdminGuard } from '../AdminGuard';
import { isAdmin, isOwnerEmail } from '../adminAccess';
import { AdminTeamService } from '../services/AdminTeamService';
import { AdminAnalyticsService } from '../services/AdminAnalyticsService';
import {
  ActivityParams,
  AdminStatsService,
  UsersParams,
} from '../services/AdminStatsService';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminStatsService) private stats: AdminStatsService,
    @Inject(AdminAnalyticsService)
    private analyticsService: AdminAnalyticsService,
    @Inject(AdminTeamService) private team: AdminTeamService,
  ) {}

  /** Any signed-in person: is this account an admin? (The app shows the Admin link from this.) */
  @UseGuards(AuthGuard)
  @Get('me')
  public async me(@Req() request: Request) {
    const user = request['user'] as VerifiedTokenModel;
    return {
      isAdmin: await isAdmin(user?.email),
      isOwner: isOwnerEmail(user?.email),
    };
  }

  /** The admin team. Everyone on it can see it; owners can add and remove admins. */
  @UseGuards(AdminGuard)
  @Get('admins')
  public admins(@Req() request: Request) {
    return this.team.list((request['user'] as VerifiedTokenModel)?.email);
  }

  @UseGuards(AdminGuard)
  @Post('admins')
  public addAdmin(@Req() request: Request, @Body() body: { email?: unknown }) {
    return this.team.add(
      (request['user'] as VerifiedTokenModel)?.email,
      body?.email,
    );
  }

  @UseGuards(AdminGuard)
  @Delete('admins/:email')
  public removeAdmin(@Req() request: Request, @Param('email') email: string) {
    return this.team.remove(
      (request['user'] as VerifiedTokenModel)?.email,
      email,
    );
  }

  @UseGuards(AdminGuard)
  @Get('analytics')
  public analytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.analyticsService.analytics({ from, to, granularity });
  }

  @UseGuards(AdminGuard)
  @Get('live')
  public live() {
    return this.analyticsService.live();
  }

  @UseGuards(AdminGuard)
  @Get('users/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ai-examiner-users.csv"')
  public exportUsers(@Query() query: Record<string, string>) {
    return this.stats.usersCsv(usersParams(query));
  }

  @UseGuards(AdminGuard)
  @Get('users/:id')
  public user(@Param('id') id: string) {
    return this.stats.userDetail(id);
  }

  @UseGuards(AdminGuard)
  @Get('users')
  public users(@Query() query: Record<string, string>) {
    return this.stats.users(usersParams(query));
  }

  @UseGuards(AdminGuard)
  @Get('activity/summary')
  public activitySummary(@Query() query: Record<string, string>) {
    return this.stats.activitySummary(activityParams(query));
  }

  @UseGuards(AdminGuard)
  @Get('activity/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="ai-examiner-activity.csv"',
  )
  public exportActivity(@Query() query: Record<string, string>) {
    return this.stats.activityCsv(activityParams(query));
  }

  @UseGuards(AdminGuard)
  @Get('activity')
  public activity(@Query() query: Record<string, string>) {
    return this.stats.activity(activityParams(query));
  }
}

const text = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const usersParams = (q: Record<string, unknown>): UsersParams => ({
  search: text(q.search),
  segment: text(q.segment) ?? text(q.filter),
  plan: text(q.plan),
  joinedFrom: text(q.joinedFrom),
  joinedTo: text(q.joinedTo),
  sort: text(q.sort),
  dir: text(q.dir),
  page: Number(q.page),
  pageSize: Number(q.pageSize),
});

const activityParams = (q: Record<string, unknown>): ActivityParams => ({
  from: text(q.from),
  to: text(q.to),
  types: text(q.types),
  search: text(q.search),
  userId: text(q.userId),
  page: Number(q.page),
  pageSize: Number(q.pageSize),
  sort: text(q.sort),
});
