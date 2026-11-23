import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { isAdmin } from './adminAccess';

/**
 * Lets a request through only with a valid sign-in token whose email belongs to an admin: an
 * owner (ADMIN_EMAILS) or someone an owner added from the dashboard.
 * Use on its own (it checks the token itself), not after AuthGuard.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new HttpException(
        'No bearer token passed',
        HttpStatus.UNAUTHORIZED,
      );
    }
    let payload: VerifiedTokenModel;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: EnvironmentVariables.config.jwtSecret,
      });
    } catch (error) {
      throw new HttpException(
        `Invalid token: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!(await isAdmin(payload?.email))) {
      throw new HttpException('Not an admin', HttpStatus.FORBIDDEN);
    }
    request['user'] = payload;
    return true;
  }
}
