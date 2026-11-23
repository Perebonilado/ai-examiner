import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { ActivityService } from '../services/ActivityService';

@Controller('activity')
export class ActivityController {
  constructor(@Inject(ActivityService) private activity: ActivityService) {}

  /** The app calls this every minute while a tab is open: powers "online now" and "active today". */
  @UseGuards(AuthGuard)
  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async heartbeat(
    @Req() request: Request,
    @Body() body: { doing?: unknown; path?: unknown },
  ) {
    const user = request['user'] as VerifiedTokenModel;
    const doing = typeof body?.doing === 'string' ? body.doing.trim() : null;
    const path = typeof body?.path === 'string' ? body.path.trim() : null;
    try {
      await this.activity.heartbeat(
        user.sub,
        doing || null,
        path || null,
        request.headers['user-agent'],
      );
    } catch (error) {
      // A missed heartbeat never matters to the person using the app.
      console.error('heartbeat failed', error?.message);
    }
  }
}
