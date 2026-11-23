import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AdminGuard } from '../AdminGuard';
import { EventBatch, TelemetryService } from './TelemetryService';

/** Where the app sends what students do. Signed-in or not; never fails the app. */
@Controller('events')
export class TelemetryController {
  constructor(
    @Inject(JwtService) private jwt: JwtService,
    @Inject(TelemetryService) private telemetry: TelemetryService,
  ) {}

  @Post()
  @HttpCode(204)
  async collect(@Body() body: EventBatch, @Req() req: Request) {
    let userId: string | null = null;
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      try {
        const payload: any = await this.jwt.verifyAsync(token, {
          secret: EnvironmentVariables.config.jwtSecret,
        });
        userId = typeof payload?.sub === 'string' ? payload.sub : null;
      } catch {
        // An expired token: keep the events, just not linked to anyone.
      }
    }
    try {
      await this.telemetry.ingest(body, { userId, ip: req.ip ?? '' });
    } catch (error) {
      console.error('events: not saved', error?.message);
    }
  }
}

/** What students do, summed up for the admin. */
@UseGuards(AdminGuard)
@Controller('admin')
export class TelemetryAdminController {
  constructor(@Inject(TelemetryService) private telemetry: TelemetryService) {}

  @Get('behaviour')
  report(@Query() q: Record<string, string>) {
    return this.telemetry.report(q);
  }

  @Get('users/:id/timeline')
  timeline(@Param('id') id: string) {
    return this.telemetry.timeline(id);
  }
}
